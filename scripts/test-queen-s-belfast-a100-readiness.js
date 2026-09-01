#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  resolveUcatDecile,
  loadUcatDecileData
} = require('../assets/js/engine/ucat-decile-service');

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, overrides) {
  if (Array.isArray(overrides) || overrides === null || typeof overrides !== 'object') {
    return clone(overrides);
  }

  const result = clone(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = merge(result[key], value);
    } else {
      result[key] = clone(value);
    }
  }
  return result;
}

function hasNestedKey(value, targetKey) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) {
    return true;
  }
  return Object.values(value).some((entry) => hasNestedKey(entry, targetKey));
}

function publicBandForScore(config, score) {
  const bands = config.score_model.derived_prediction_bands_45_scale;
  const band = bands.find((entry) => score >= entry.min && score <= entry.max);
  return band ? {
    publicBand: band.qub_public_band,
    canonicalBand: band.canonical_band
  } : null;
}

const course = readJson('data/universities/queen-s-belfast-a100.json');
const research = readJson('data/research/queen-s-belfast-a100-research.json');
const config = readJson('data/interview-band-configs/queen-s-belfast-a100.json');
const card = readJson('data/examples/queen-s-belfast-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/queen-s-belfast-a100.json');
const index = readJson('data/index.json');
const ucatDeciles = loadUcatDecileData(path.join(rootDir, 'data/ucat-deciles.json'));

assert.strictEqual(course.profile_id, 'queen-s-belfast-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(course.engine_notes.activation_ready, true);
assert.strictEqual(course.engine_notes.production_ready, true);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');

assert.strictEqual(config.score_model.type, 'component_sum');
assert.strictEqual(config.score_model.scale.max, 45);
assert.strictEqual(config.score_model.official_formula, true);
assert.strictEqual(config.score_model.official_scale, true);
assert.strictEqual(config.score_model.prediction_band_labels_official, false);
assert.strictEqual(config.score_model.methodology_confidence, 'high');
assert.strictEqual(config.score_model.prediction_calibration_confidence, 'medium');
assert.strictEqual(config.score_model.active_band_source, 'derived_prediction_bands_45_scale');
assert.strictEqual(
  config.score_model.runtime_spec_requested_active_band_source,
  'derived_prediction_bands_on_official_45_scale'
);

const gcseComponent = config.score_model.components.find((component) => {
  return component.component_id === 'gcse_points';
});
const scottishHigherComponent = config.score_model.components.find((component) => {
  return component.component_id === 'scottish_higher_academic_points';
});
const ucatComponent = config.score_model.components.find((component) => {
  return component.component_id === 'ucat_decile_points';
});
assert.strictEqual(gcseComponent.type, 'gcse_mandatory_then_best');
assert.deepStrictEqual(gcseComponent.match.excluded_qualification_routes, ['scottish']);
assert.strictEqual(gcseComponent.subject_count, 9);
assert.strictEqual(gcseComponent.max, 36);
assert.strictEqual(scottishHigherComponent.type, 'academic_profile_matrix');
assert.deepStrictEqual(scottishHigherComponent.match.qualification_routes, ['scottish']);
assert.strictEqual(scottishHigherComponent.max, 36);
assert.deepStrictEqual(
  scottishHigherComponent.scottish.higher_advanced_higher.bands.map((band) => ({
    profile: band.higher_profile.join(''),
    points: band.points
  })),
  [
    { profile: 'AAAAA', points: 36 },
    { profile: 'AAAAB', points: 34 },
    { profile: 'AAABB', points: 32 },
    { profile: 'AABBB', points: 30 },
    { profile: 'ABBBB', points: 28 }
  ]
);
assert.deepStrictEqual(ucatComponent.points_by_decile, {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9
});

assert.match(course.stage_2_interview_selection.calculation.total_score.notes, /45-point/i);
assert.doesNotMatch(course.stage_2_interview_selection.calculation.total_score.notes, /derived/i);
assert.match(config.evidence.summary, /45-point maximum are official/i);
assert.match(config.evidence.summary, /prediction band labels are ApplySmart-derived/i);

for (const item of fixture.public_band_boundaries_45_scale) {
  const band = publicBandForScore(config, item.score);
  assert.deepStrictEqual(
    band,
    {
      publicBand: item.expected_public_band,
      canonicalBand: item.expected_canonical_band
    },
    `score ${item.score}`
  );
}

const coverage = new Map();
for (let score = 0; score <= 45; score += 1) {
  const band = publicBandForScore(config, score);
  assert.ok(band, `score ${score} must map to one public band`);
  coverage.set(score, band.publicBand);
}
assert.strictEqual(coverage.size, 46);

for (const item of fixture.ucat_decile_boundaries) {
  const decile = resolveUcatDecile(item.score, {
    courseProfileId: course.profile_id,
    decileData: ucatDeciles
  });
  assert.strictEqual(decile.available, true, `UCAT ${item.score}`);
  assert.strictEqual(decile.national_decile, item.expected_decile, `UCAT ${item.score}`);
  assert.strictEqual(
    ucatComponent.points_by_decile[String(decile.national_decile)],
    item.expected_points,
    `UCAT ${item.score}`
  );
}

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant, {
    ucatDecileData: ucatDeciles
  });
  const expected = scenario.expected;

  assert.strictEqual(
    result.eligibility.status,
    expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  assert.strictEqual(
    result.guidance_pool_id ?? null,
    expected.guidance_pool_id,
    `${scenario.scenario_id}: pool`
  );
  assert.strictEqual(
    result.canonical_interview_band ?? null,
    expected.canonical_band,
    `${scenario.scenario_id}: canonical band`
  );
  assert.strictEqual(
    result.ranking?.value ?? null,
    expected.score,
    `${scenario.scenario_id}: score`
  );
  if (Number.isFinite(expected.gcse_points)) {
    assert.strictEqual(
      result.ranking.components.gcse_points.value,
      expected.gcse_points,
      `${scenario.scenario_id}: GCSE points`
    );
  }
  if (Number.isFinite(expected.scottish_higher_points)) {
    assert.strictEqual(
      result.ranking.components.scottish_higher_academic_points.value,
      expected.scottish_higher_points,
      `${scenario.scenario_id}: Scottish Higher academic points`
    );
    assert.strictEqual(
      result.ranking.components.gcse_points.applicable,
      false,
      `${scenario.scenario_id}: GCSE component bypassed`
    );
  }
  if (Number.isFinite(expected.ucat_points)) {
    assert.strictEqual(
      result.ranking.components.ucat_decile_points.value,
      expected.ucat_points,
      `${scenario.scenario_id}: UCAT points`
    );
  }
  if (Number.isFinite(expected.score) && expected.guidance_pool_id !== null) {
    assert.strictEqual(
      publicBandForScore(config, expected.score).publicBand,
      expected.public_band,
      `${scenario.scenario_id}: public band`
    );
  }
  if (Object.hasOwn(expected, 'interview_outcome')) {
    assert.strictEqual(
      result.interview_outcome ?? null,
      expected.interview_outcome,
      `${scenario.scenario_id}: interview outcome`
    );
  }
  if (expected.failure) {
    const reasons = [
      ...(result.eligibility.failures || []),
      ...(result.eligibility.manual_review_reasons || [])
    ];
    assert.ok(
      reasons.includes(expected.failure),
      `${scenario.scenario_id}: expected failure ${expected.failure}`
    );
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

const sjtResults = [1, 2, 3, 4].map((band) => {
  const applicant = merge(fixture.base_applicant, {
    admissions_tests: {
      ucat: {
        sjt_band: band
      }
    }
  });
  return classifyInterviewBand(course, config, applicant, {
    ucatDecileData: ucatDeciles
  });
});
for (const result of sjtResults) {
  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.ranking.value, 40);
  assert.strictEqual(result.canonical_interview_band, 'realistic');
  assert.ok(!result.eligibility.failures.includes('disqualifying_sjt_rule'));
}

assert.strictEqual(card.prediction.available, true);
assert.strictEqual(card.prediction.result_band, 'realistic');
assert.strictEqual(card.prediction.qub_public_band, 'Strong');
assert.deepStrictEqual(card.prediction.component_breakdown.pre_interview_score, {
  value: 40,
  max: 45,
  official: true
});
assert.strictEqual(card.confidence.stage_confidence.methodology, 'high');
assert.strictEqual(card.confidence.stage_confidence.prediction_calibration, 'medium');
assert.strictEqual(card.prediction.component_breakdown.gcse_points.value, 32);
assert.strictEqual(card.prediction.component_breakdown.ucat_decile_points.value, 8);
assert.strictEqual(card.prediction.component_breakdown.pre_interview_score.value, 40);
assert.match(card.prediction.band_basis, /ApplySmart derived/);
assert.match(card.prediction.band_basis, /not an official QUB cut-off/i);
assert.doesNotMatch(JSON.stringify(card), /offer_probability|offer_prediction_status/);

assert.deepStrictEqual(
  research.remaining_evidence_gaps
    .filter((gap) => gap.blocking_for_supported_prediction === true)
    .map((gap) => gap.gap_id),
  []
);
assert.strictEqual(research.metadata.active_band_source_stored, 'derived_prediction_bands_45_scale');
assert.match(research.metadata.technical_naming_correction, /Band values, confidence and methodology were not changed/);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry);
assert.strictEqual(indexEntry.uses_ucat, true);
assert.strictEqual(indexEntry.selection_model, 'points_system');
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/queen-s-belfast-a100.json');
assert.strictEqual(indexEntry.result_card_example_file, 'examples/queen-s-belfast-a100-result-card.example.json');
assert.strictEqual(indexEntry.readiness_fixture_file, 'fixtures/interview-band-classification/queen-s-belfast-a100.json');

for (const [field, expected] of Object.entries({
  eligibility_ready: true,
  interview_prediction_ready: true,
  interview_band_config_ready: true,
  metadata_activation_ready: true,
  activation_ready: true,
  production_ready: true,
  result_card_ready: true,
  eligibility: true,
  interview_prediction: true,
  historical_guidance: true,
  international_prediction: false,
  contextual_logic: true,
  result_card: true,
  regression: true
})) {
  assert.strictEqual(course.engine_notes[field], expected, `course ${field}`);
  assert.strictEqual(indexEntry[field], expected, `index ${field}`);
}

assert.strictEqual(indexEntry.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(indexEntry.prediction_confidence, 'medium');
assert.strictEqual(index.total_courses, index.universities.length);

console.log('QUB A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log('Band boundaries checked: 0 through 45 with no gaps or overlaps');
console.log('UCAT decile point mappings checked: 10');
console.log('Contextual, POP, international, SJT and offer-scope safeguards: PASS');
