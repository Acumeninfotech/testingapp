#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  buildDecisionTimeline,
  buildDecisionTransparency,
  buildEvidenceConfidence
} = require('../assets/js/engine/result-card-presenter');

const rootDir = path.resolve(__dirname, '..');
const id = 'city-st-george-s-of-london-a100';

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

function includesReason(result, reason) {
  return [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ].includes(reason);
}

function splitUcat(totalScore) {
  const first = Math.floor(totalScore / 3);
  const second = Math.floor((totalScore - first) / 2);
  return {
    verbal_reasoning: first,
    decision_making: second,
    quantitative_reasoning: totalScore - first - second
  };
}

const course = readJson(`data/universities/${id}.json`);
const research = readJson(`data/research/${id}-research.json`);
const config = readJson(`data/interview-band-configs/${id}.json`);
const fixture = readJson(`data/fixtures/interview-band-classification/${id}.json`);
const card = readJson(`data/examples/${id}-result-card.example.json`);
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, id);
assert.strictEqual(research.course_profile_id, id);
assert.strictEqual(config.course_profile_id, id);
assert.strictEqual(fixture.course_profile_id, id);
assert.strictEqual(card.course_identity.profile_id, id);

assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');
assert.strictEqual(course.stage_1_eligibility.admissions_tests.ucat.minimum_subsection_scores[0].minimum_score, 500);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.sjt.used_as_gate, false);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.excluded_bands, []);
assert.strictEqual(config.score_model.sjt_handling.sjt_excluded_from_prediction, true);
assert.match(config.score_model.university_warning_verbatim, /not possible to predict/i);
assert.strictEqual(research.metadata.academic_model, 'threshold_only');
assert.strictEqual(research.metadata.contextual_model, 'metadata_only_no_ucat_adjustment');
assert.strictEqual(research.metadata.offer_prediction_scope, 'out_of_scope');

const indexEntry = index.universities.find((entry) => entry.id === id);
assert.ok(indexEntry, 'City St George A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.interview_band_config_file, `interview-band-configs/${id}.json`);

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);
  const expected = scenario.expected;

  assert.strictEqual(result.eligibility.status, expected.eligibility_status, scenario.scenario_id);
  assert.strictEqual(result.guidance_pool_id ?? null, expected.guidance_pool_id, scenario.scenario_id);
  assert.strictEqual(result.canonical_interview_band, expected.interview_band, scenario.scenario_id);
  if (expected.source_band_id) {
    assert.strictEqual(result.source_interview_band_id, expected.source_band_id, scenario.scenario_id);
  }
  if (expected.failure) {
    assert.ok(includesReason(result, expected.failure), `${scenario.scenario_id}: ${expected.failure}`);
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

const poolIdentities = {
  home_non_graduate: {
    applicant_identity: { applicant_type: 'standard_school_leaver', fee_status: 'home', domicile: 'england', graduate: false },
    qualification_route: 'a_level'
  },
  home_graduate: {
    applicant_identity: { applicant_type: 'graduate', fee_status: 'home', domicile: 'england', graduate: true },
    qualification_route: 'graduate',
    a_level_profile: null,
    gcse_profile: { subjects: {}, total_gcse_count: 0 },
    graduate_profile: { is_graduate: true, degree_classification: '2_1', recognised_institution: true }
  },
  overseas_non_graduate: {
    applicant_identity: { applicant_type: 'international_standard_school_leaver', fee_status: 'international', domicile: 'international', english_language_exempt: true },
    qualification_route: 'a_level'
  },
  overseas_graduate: {
    applicant_identity: { applicant_type: 'graduate', fee_status: 'international', domicile: 'international', graduate: true, english_language_exempt: true },
    qualification_route: 'graduate',
    a_level_profile: null,
    gcse_profile: { subjects: {}, total_gcse_count: 0 },
    graduate_profile: { is_graduate: true, degree_classification: '2_1', recognised_institution: true }
  }
};

for (const boundary of fixture.historical_guidance_boundaries) {
  const applicant = merge(
    fixture.base_applicant,
    merge(poolIdentities[boundary.pool], {
      admissions_tests: {
        ucat: {
          total_score: boundary.ucat_total,
          subtests: splitUcat(boundary.ucat_total)
        }
      }
    })
  );
  const result = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(result.guidance_pool_id, boundary.pool, boundary.pool);
  assert.strictEqual(result.canonical_interview_band, boundary.expected_band, `${boundary.pool} ${boundary.ucat_total}`);
  assert.strictEqual(result.source_interview_band_id, boundary.source_band_id, `${boundary.pool} ${boundary.ucat_total}`);
}

const nonContextual = classifyInterviewBand(course, config, fixture.base_applicant);
const contextual = classifyInterviewBand(
  course,
  config,
  merge(fixture.base_applicant, {
    applicant_identity: {
      contextual: true,
      contextual_flags: { care_experienced: true }
    }
  })
);
assert.strictEqual(contextual.canonical_interview_band, nonContextual.canonical_interview_band);
assert.strictEqual(contextual.band_metric.value, nonContextual.band_metric.value);
assert.strictEqual(
  config.score_model.computed_band_ranges_by_category[contextual.guidance_pool_id].reference_cutoff,
  config.score_model.computed_band_ranges_by_category[nonContextual.guidance_pool_id].reference_cutoff
);

assert.strictEqual(card.prediction.source_interview_band_id, 'B');
assert.strictEqual(card.prediction.official_prediction.available, false);
assert.strictEqual(card.sjt_handling.sjt_excluded_from_prediction, true);
assert.strictEqual(card.sjt_handling.band_4_penalty_applied, false);
assert.strictEqual(card.contextual_metadata.eligible_for_contextual_offer, false);
assert.deepStrictEqual(card.decision_timeline, buildDecisionTimeline(card));
assert.deepStrictEqual(card.decision_transparency, buildDecisionTransparency(card));
assert.deepStrictEqual(card.evidence_confidence, buildEvidenceConfidence(card));
assert.match(JSON.stringify(card.decision_transparency), /SJT is recorded but excluded/i);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);
assert.strictEqual(hasNestedKey(card, 'offer_prediction_status'), false);

console.log("City St George's A100 readiness regression: PASS");
console.log('UCAT section gates, four-pool routing, contextual metadata, SJT exclusion and result card: PASS');
