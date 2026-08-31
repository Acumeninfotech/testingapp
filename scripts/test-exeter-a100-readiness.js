#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand,
  deriveQualificationStatus
} = require('../assets/js/engine/interview-band-classifier');
const {
  humanManualReviewReason,
  insufficientEvidenceReasonCodeFromWarnings,
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');
const {
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

function cardFor(applicant, classification) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true ||
      classification.eligibility.status === 'manual_review',
    manualReviewReason: humanManualReviewReason(classification.eligibility.manual_review_reasons),
    insufficientEvidenceReasonCode: insufficientEvidenceReasonCodeFromWarnings(classification.warnings, {
      eligibilityStatus: classification.eligibility.status,
      guidancePoolId: classification.guidance_pool_id ?? null
    }),
    transparencyContext: {
      course_identity: { profile_id: 'exeter-a100' },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: course.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      stage_1_eligibility: course.stage_1_eligibility,
      historical_admissions: course.historical_admissions,
      ranking: classification.ranking,
      band_metric: classification.band_metric,
      guidance_pool: classification.guidance_pool,
      score_model: config.score_model,
      guidance_pool_id: classification.guidance_pool_id || null,
      warnings: classification.warnings || []
    }
  });
}

const course = readJson('data/universities/exeter-a100.json');
const research = readJson('data/research/exeter-a100-research.json');
const config = readJson('data/interview-band-configs/exeter-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/exeter-a100.json');
const example = readJson('data/examples/exeter-a100-result-card.example.json');
const index = readJson('data/index.json');
const ucatDeciles = loadUcatDecileData(path.join(rootDir, 'data/ucat-deciles.json'));

assert.strictEqual(course.profile_id, 'exeter-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(course.engine_notes.contextual_logic, true);
assert.strictEqual(course.engine_notes.international_prediction, true);
assert.strictEqual(research.metadata.exeter_specific_shared_engine_branch_added, false);
assert.strictEqual(research.metadata.historical_foi_derived_ucat_equivalents_executable, false);
assert.match(research.metadata.contextual_double_counting_prevention, /no separate 69 contextual threshold/i);

const componentTypes = config.score_model.components.map((component) => component.type);
assert.ok(componentTypes.includes('conditional_points'));
assert.strictEqual(
  config.score_model.components.find((component) => component.component_id === 'achieved_grade_uplift').max,
  10
);
assert.strictEqual(
  config.score_model.components.some((component) => component.component_id === 'wp_contextual_uplift'),
  true,
  'Confirmed Exeter contextual applicants must retain the published +5 Exeter Score uplift.'
);

const exeterContextualUplift = config.score_model.components.find(
  (component) => component.component_id === 'wp_contextual_uplift'
);

assert.strictEqual(exeterContextualUplift.max, 5);
assert.deepStrictEqual(
  exeterContextualUplift.conditions[0].match.any_group_ids,
  ['exeter_contextual_confirmed'],
  'Exeter +5 must be controlled only by the dedicated contextual evaluator output.'
);
assert.strictEqual(config.score_model.label, 'Exeter Score');
assert.strictEqual(
  config.score_model.applicable_max_score.strategy,
  'base_plus_applicable_conditional_components'
);
assert.strictEqual(
  config.guidance_pools.find((pool) => pool.pool_id === 'exeter_home_direct_school_leaver')
    .band_rules[0].value,
  74
);
assert.strictEqual(
  config.guidance_pools.some((pool) => /contextual/.test(pool.pool_id)),
  false,
  'Contextual applicants must not get a separate lower threshold pool.'
);

let contextualScore = null;
let nonContextualComparisonScore = null;

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant, {
    ucatDecileData: ucatDeciles
  });

  assert.strictEqual(
    result.eligibility.status,
    scenario.expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  assert.strictEqual(
    result.guidance_pool_id ?? null,
    scenario.expected.guidance_pool_id,
    `${scenario.scenario_id}: guidance pool`
  );
  assert.strictEqual(
    result.canonical_interview_band,
    scenario.expected.interview_band,
    `${scenario.scenario_id}: band`
  );

  if (Number.isFinite(scenario.expected.score)) {
    assert.strictEqual(result.ranking.value, scenario.expected.score, `${scenario.scenario_id}: score`);
    assert.strictEqual(
      result.ranking.applicable_max_score,
      scenario.expected.applicable_max_score,
      `${scenario.scenario_id}: applicable max score`
    );
    assert.strictEqual(
      result.ranking.selection_score_max,
      scenario.expected.applicable_max_score,
      `${scenario.scenario_id}: selection_score_max`
    );
    assert.strictEqual(
      result.ranking.max,
      scenario.expected.applicable_max_score,
      `${scenario.scenario_id}: ranking max`
    );
    assert.strictEqual(
      result.ranking.components.achieved_grade_uplift.value,
      scenario.expected.achieved_uplift,
      `${scenario.scenario_id}: achieved uplift`
    );
    assert.strictEqual(
      result.ranking.components.wp_contextual_uplift.value,
      scenario.expected.contextual_uplift,
      `${scenario.scenario_id}: contextual uplift`
    );

    const card = cardFor(applicant, result);
    assert.strictEqual(card.decision_transparency.score_breakdown.value, scenario.expected.score);
    assert.strictEqual(card.decision_transparency.score_breakdown.name, 'Exeter Score');
    assert.strictEqual(
      card.decision_transparency.score_breakdown.max,
      scenario.expected.applicable_max_score,
      `${scenario.scenario_id}: result-card denominator`
    );
    assert.strictEqual(
      card.decision_transparency.score_breakdown.applicable_max_score,
      scenario.expected.applicable_max_score,
      `${scenario.scenario_id}: API applicable_max_score`
    );
    assert.strictEqual(
      card.decision_transparency.score_breakdown.selection_score_max,
      scenario.expected.applicable_max_score,
      `${scenario.scenario_id}: API selection_score_max`
    );
    assert.ok(
      card.decision_transparency.score_breakdown.checks.some((check) =>
        /Achieved-grade uplift|Grade profile score|UCAT score/.test(check.label)
      ),
      `${scenario.scenario_id}: result-card score breakdown labels`
    );
  } else {
    assert.strictEqual(result.ranking, null, `${scenario.scenario_id}: no ranking for manual review`);
    assert.ok(result.eligibility.manual_review_reasons.includes(scenario.expected.manual_review_reason));
    assert.match(humanManualReviewReason(result.eligibility.manual_review_reasons), /manual review/i);
  }

  if (scenario.scenario_id === 'exeter_contextual_uplift_without_lower_threshold') {
    contextualScore = result.ranking.value;
  }
  if (scenario.scenario_id === 'exeter_same_profile_without_contextual_is_ambitious') {
    nonContextualComparisonScore = result.ranking.value;
  }
}

assert.strictEqual(contextualScore - nonContextualComparisonScore, 0);

const predictedApplicant = fixture.base_applicant;
assert.strictEqual(deriveQualificationStatus(predictedApplicant), 'predicted');
const achievedApplicant = merge(fixture.base_applicant, fixture.scenarios[1].overrides);
assert.strictEqual(deriveQualificationStatus(achievedApplicant), 'achieved');

assert.strictEqual(example.course_identity.profile_id, course.profile_id);
assert.strictEqual(example.prediction.result_band, 'realistic');
assert.strictEqual(example.prediction.score, 70);
assert.strictEqual(example.display.recommendation_display_state, 'standard');
assert.strictEqual(example.decision_transparency.score_breakdown.value, 70);
assert.strictEqual(example.decision_transparency.score_breakdown.max, 90);
assert.strictEqual(example.decision_transparency.score_breakdown.name, 'Exeter Score');
assert.ok(
  example.decision_transparency.score_breakdown.checks.some((check) => check.label === 'Achieved-grade uplift')
);
assert.strictEqual(
  example.decision_transparency.score_breakdown.checks.some((check) => check.label === 'Contextual uplift'),
  false
);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry);
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/exeter-a100.json');
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.offer_prediction_scope, 'out_of_scope');

console.log('Exeter A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log('Achieved vs predicted, contextual vs non-contextual, Home/International pools and GAMSAT manual review: PASS');
console.log('Contextual scoring double-count guard: PASS');
console.log('Result-card conditional score breakdown: PASS');
