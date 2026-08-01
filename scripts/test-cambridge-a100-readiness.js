#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  presentResultCard,
  humanManualReviewReason,
  insufficientEvidenceReasonCodeFromWarnings
} = require('../assets/js/engine/result-card-presenter');
const {
  predict
} = require('../server/src/predict');

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

function failures(result) {
  return [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
}

function includesFailure(result, expected) {
  return failures(result).includes(expected);
}

function includesFailurePrefix(result, expectedPrefix) {
  return failures(result).some((failure) => String(failure).startsWith(expectedPrefix));
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

function makeResultCard(course, config, applicant, classification) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    manualReviewReason: humanManualReviewReason(classification.eligibility.manual_review_reasons),
    insufficientEvidenceReasonCode:
      classification.insufficient_evidence_reason_code ||
      insufficientEvidenceReasonCodeFromWarnings(classification.warnings, {
        eligibilityStatus: classification.eligibility.status,
        guidancePoolId: classification.guidance_pool_id ?? null
      }) ||
      null,
    missingInformation: classification.missing_information || null,
    transparencyContext: {
      course_identity: {
        profile_id: course.profile_id
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: course.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      stage_1_eligibility: course.stage_1_eligibility || null,
      historical_admissions: course.historical_admissions || null,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      score_model: config.score_model,
      guidance_pool_id: classification.guidance_pool_id || null,
      missing_information: classification.missing_information || null,
      warnings: classification.warnings || []
    }
  });
}

function withApiSafeUcat(totalScore, sjtBand = 2) {
  const verbalReasoning = Math.floor(totalScore / 3);
  const decisionMaking = Math.floor((totalScore - verbalReasoning) / 2);
  const quantitativeReasoning = totalScore - verbalReasoning - decisionMaking;

  return {
    total_score: totalScore,
    score_scale: 2700,
    sjt_band: sjtBand,
    test_year: 2026,
    subtests: {
      verbal_reasoning: verbalReasoning,
      decision_making: decisionMaking,
      quantitative_reasoning: quantitativeReasoning
    }
  };
}

const course = readJson('data/universities/cambridge-a100.json');
const research = readJson('data/research/cambridge-a100-research.json');
const config = readJson('data/interview-band-configs/cambridge-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/cambridge-a100.json');
const card = readJson('data/examples/cambridge-a100-result-card.example.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'cambridge-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_year, 2027);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'holistic_review');
assert.strictEqual(course.stage_1_eligibility.admissions_tests.sjt.used_as_gate, false);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.excluded_bands, []);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(hasNestedKey(course, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(config, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(config, 'approx_probability'), false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Cambridge A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.interview_band_config_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.prediction_confidence, 'medium');
assert.strictEqual(indexEntry.manual_review_policy, 'conditional');
assert.strictEqual(indexEntry.offer_prediction_scope, 'out_of_scope');

const gcseModifier = config.score_model.components.find((component) =>
  component.component_id === 'gcse_profile_modifier'
);
assert.ok(gcseModifier, 'Cambridge must configure a GCSE profile modifier.');
assert.strictEqual(gcseModifier.type, 'gcse_profile_modifier');
assert.strictEqual(config.score_model.presentation.hide_score_breakdown, true);
assert.strictEqual(config.score_model.presentation.hide_selection_score_details, true);
assert.ok(
  research.metadata.research_engine_json_discrepancies.some((entry) =>
    entry.field.includes('manual_review_required')
  ),
  'The pre-implementation manual-review discrepancy must be recorded.'
);
assert.ok(
  research.metadata.research_engine_json_discrepancies.some((entry) =>
    entry.field.includes('approx_probability')
  ),
  'The probability-display discrepancy must be recorded.'
);

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);
  const expected = scenario.expected;

  assert.strictEqual(
    result.eligibility.status,
    expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  if (Object.hasOwn(expected, 'guidance_pool_id')) {
    assert.strictEqual(
      result.guidance_pool_id ?? null,
      expected.guidance_pool_id,
      `${scenario.scenario_id}: guidance pool`
    );
  }
  assert.strictEqual(
    result.canonical_interview_band,
    expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  if (Number.isFinite(expected.score)) {
    assert.strictEqual(result.ranking?.value, expected.score, `${scenario.scenario_id}: hidden score`);
  }
  if (expected.gcse_profile_class) {
    assert.strictEqual(
      result.ranking?.components?.gcse_profile_modifier?.profile_class,
      expected.gcse_profile_class,
      `${scenario.scenario_id}: GCSE profile class`
    );
  }
  if (Object.hasOwn(expected, 'manual_review_required')) {
    assert.strictEqual(
      result.manual_review_required === true,
      expected.manual_review_required,
      `${scenario.scenario_id}: manual review`
    );
  }
  if (expected.manual_review_reason) {
    assert.ok(
      includesFailure(result, expected.manual_review_reason),
      `${scenario.scenario_id}: manual review reason`
    );
  }
  if (expected.failure) {
    assert.ok(includesFailure(result, expected.failure), `${scenario.scenario_id}: failure ${expected.failure}`);
  }
  if (expected.failure_prefix) {
    assert.ok(
      includesFailurePrefix(result, expected.failure_prefix),
      `${scenario.scenario_id}: failure prefix ${expected.failure_prefix}`
    );
  }
}

const completeHomeProfileScenarios = [
  {
    label: 'Scenario 1: UCAT 2400',
    ucat: 2400,
    expectedBand: 'interview_likely',
    expectedRecommendation: 'Strong Choice'
  },
  {
    label: 'Scenario 2: UCAT 2050',
    ucat: 2050,
    expectedBand: 'ambitious',
    expectedRecommendation: 'Ambitious Choice'
  },
  {
    label: 'Scenario 3: UCAT 2000',
    ucat: 2000,
    expectedBand: 'high_risk',
    expectedRecommendation: 'High Risk'
  }
];

for (const scenario of completeHomeProfileScenarios) {
  const applicant = merge(fixture.base_applicant, {
    admissions_tests: {
      ucat: {
        total_score: scenario.ucat,
        sjt_band: 2
      }
    }
  });
  const classification = classifyInterviewBand(course, config, applicant);
  const resultCard = makeResultCard(course, config, applicant, classification);

  assert.strictEqual(classification.eligibility.status, 'eligible', `${scenario.label}: eligibility`);
  assert.strictEqual(
    classification.canonical_interview_band,
    scenario.expectedBand,
    `${scenario.label}: calculated band must be preserved`
  );
  assert.strictEqual(
    classification.manual_review_required === true,
    false,
    `${scenario.label}: complete profile must not require manual review`
  );
  assert.strictEqual(
    resultCard.recommendation_display_state,
    'standard',
    `${scenario.label}: result card must not show Information Needed`
  );
  assert.strictEqual(
    resultCard.internal_recommendation,
    scenario.expectedRecommendation,
    `${scenario.label}: public band label`
  );
  assert.notStrictEqual(
    resultCard.primary_user_facing_recommendation,
    'More information is required',
    `${scenario.label}: complete profile must not be converted into Information Needed`
  );
}

const strongGcseLowUcatApplicant = merge(fixture.base_applicant, {
  admissions_tests: {
    ucat: withApiSafeUcat(2000, 2)
  }
});
const weakGcseApplicant = merge(fixture.base_applicant, {
  gcse_profile: {
    subjects: {
      english_language: '8',
      mathematics: '8',
      biology: '8',
      chemistry: '8',
      physics: '7',
      english_literature: '7',
      history: '6',
      geography: '6',
      french: '6',
      music: '5'
    },
    total_gcse_count: 10
  },
  admissions_tests: {
    ucat: withApiSafeUcat(2200, 2)
  }
});
const incompleteGcseApplicant = clone(fixture.base_applicant);
incompleteGcseApplicant.gcse_profile = {
  ...(incompleteGcseApplicant.gcse_profile || {}),
  subjects: {
    english_language: '8',
    mathematics: '8',
    biology: '8',
    chemistry: '8',
    physics: '8'
  },
  total_gcse_count: 5
};
incompleteGcseApplicant.admissions_tests = {
  ...(incompleteGcseApplicant.admissions_tests || {}),
  ucat: withApiSafeUcat(2000, 2)
};

const strongClassification = classifyInterviewBand(course, config, strongGcseLowUcatApplicant);
const strongCard = makeResultCard(course, config, strongGcseLowUcatApplicant, strongClassification);
assert.strictEqual(strongClassification.eligibility.status, 'eligible');
assert.strictEqual(strongClassification.canonical_interview_band, 'high_risk');
assert.strictEqual(strongCard.recommendation_display_state, 'standard');
assert.strictEqual(strongCard.internal_recommendation, 'High Risk');
assert.strictEqual(strongCard.risk_explanation?.reason_code, 'ucat_historical_guidance_range');
assert.deepStrictEqual(strongCard.risk_explanation?.contributing_factors, ['ucat']);

const weakClassification = classifyInterviewBand(course, config, weakGcseApplicant);
const weakCard = makeResultCard(course, config, weakGcseApplicant, weakClassification);
assert.strictEqual(weakClassification.eligibility.status, 'eligible');
assert.strictEqual(weakClassification.canonical_interview_band, 'high_risk');
assert.strictEqual(weakCard.recommendation_display_state, 'standard');
assert.strictEqual(weakCard.internal_recommendation, 'High Risk');
assert.strictEqual(weakCard.risk_explanation?.reason_code, 'academic_historical_guidance_range');
assert.deepStrictEqual(weakCard.risk_explanation?.contributing_factors, ['academic']);

const incompleteClassification = classifyInterviewBand(course, config, incompleteGcseApplicant);
const incompleteCard = makeResultCard(course, config, incompleteGcseApplicant, incompleteClassification);
const incompleteGcseReason =
  'ApplySmart needs a more complete GCSE profile before it can assess your Cambridge interview potential. This is not a rejection.';
assert.strictEqual(incompleteClassification.eligibility.status, 'eligible');
assert.strictEqual(incompleteClassification.canonical_interview_band, 'insufficient_evidence');
assert.strictEqual(incompleteClassification.insufficient_evidence_reason_code, 'insufficient_gcse_results');
assert.deepStrictEqual(
  incompleteClassification.missing_information,
  {
    qualification_type: 'gcse',
    provided_count: 5,
    required_count: 8
  }
);
assert.strictEqual(incompleteClassification.ranking, null);
assert.strictEqual(incompleteCard.recommendation_display_state, 'insufficient_evidence');
assert.strictEqual(incompleteCard.primary_explanation, incompleteGcseReason);
assert.strictEqual(incompleteCard.information_needed_reason, incompleteGcseReason);
assert.doesNotMatch(incompleteCard.primary_explanation, /best eight GCSEs/i);
assert.strictEqual(incompleteCard.decision_transparency?.insufficient_evidence_reason_code, 'insufficient_gcse_results');
assert.strictEqual(incompleteCard.decision_transparency?.information_needed_reason, incompleteGcseReason);
assert.deepStrictEqual(
  incompleteCard.missing_information,
  {
    qualification_type: 'gcse',
    provided_count: 5,
    required_count: 8
  }
);

const incompleteApiResult = predict({
  universityIds: ['cambridge-a100'],
  studentProfile: incompleteGcseApplicant
})[0].result_card;
assert.strictEqual(incompleteApiResult.prediction?.result_band, 'insufficient_evidence');
assert.strictEqual(incompleteApiResult.recommendation_display_state, 'insufficient_evidence');
assert.strictEqual(
  incompleteApiResult.decision_transparency?.insufficient_evidence_reason_code,
  'insufficient_gcse_results'
);
assert.strictEqual(incompleteApiResult.primary_explanation, incompleteGcseReason);
assert.strictEqual(incompleteApiResult.information_needed_reason, incompleteGcseReason);
assert.doesNotMatch(incompleteApiResult.primary_explanation, /best eight GCSEs/i);

const evaluatorStrong = evaluateCourseEligibility(course, strongGcseLowUcatApplicant);
const evaluatorWeak = evaluateCourseEligibility(course, weakGcseApplicant);
const evaluatorIncomplete = evaluateCourseEligibility(course, incompleteGcseApplicant);
assert.strictEqual(evaluatorStrong.status, 'eligible');
assert.strictEqual(evaluatorWeak.status, 'eligible');
assert.strictEqual(evaluatorIncomplete.status, 'eligible');

const internationalApplicant = merge(fixture.base_applicant, {
  applicant_identity: {
    applicant_type: 'international_standard_school_leaver',
    fee_status: 'International',
    domicile: 'International',
    english_language_exempt: true
  },
  admissions_tests: {
    ucat: withApiSafeUcat(2360, 2)
  },
  application_year: 2027
});
const ibApplicant = merge(fixture.base_applicant, {
  qualification_route: 'international_baccalaureate',
  a_level_profile: null,
  ib_profile: {
    total_points: 41,
    higher_level_subjects: [
      {
        subject_id: 'chemistry',
        higher_level_grade: '7'
      },
      {
        subject_id: 'biology',
        higher_level_grade: '7'
      },
      {
        subject_id: 'mathematics',
        higher_level_grade: '6'
      }
    ]
  },
  admissions_tests: {
    ucat: withApiSafeUcat(2360, 2)
  }
});

const evaluatorInternational = evaluateCourseEligibility(course, internationalApplicant);
const classifierInternational = classifyInterviewBand(course, config, internationalApplicant);
assert.strictEqual(evaluatorInternational.status, 'eligible');
assert.strictEqual(classifierInternational.eligibility.status, evaluatorInternational.status);
assert.strictEqual(classifierInternational.manual_review_required === true, true);
const internationalApiCard = predict({
  universityIds: ['cambridge-a100'],
  studentProfile: internationalApplicant
})[0].result_card;
assert.strictEqual(internationalApiCard.recommendation_display_state, 'manual_review');

const evaluatorIb = evaluateCourseEligibility(course, ibApplicant);
const classifierIb = classifyInterviewBand(course, config, ibApplicant);
assert.strictEqual(evaluatorIb.status, 'eligible');
assert.strictEqual(classifierIb.eligibility.status, evaluatorIb.status);
const ibApiCard = predict({
  universityIds: ['cambridge-a100'],
  studentProfile: ibApplicant
})[0].result_card;
assert.strictEqual(ibApiCard.recommendation_display_state, 'standard');

const gcseGateConfig = merge(config, {
  eligibility: {
    gcse: {
      minimum_count: 8,
      use_exact_subject_list: true
    }
  }
});
const officialGateFailure = classifyInterviewBand(course, gcseGateConfig, incompleteGcseApplicant);
assert.strictEqual(officialGateFailure.eligibility.status, 'not_eligible');
assert.strictEqual(officialGateFailure.canonical_interview_band, 'not_eligible');
assert.ok(
  officialGateFailure.eligibility.failures.includes('minimum_gcse_count_not_met'),
  'Official GCSE minimum-count failure must remain Not Eligible.'
);

const baseClassification = classifyInterviewBand(course, config, fixture.base_applicant);
const baseCard = makeResultCard(course, config, fixture.base_applicant, baseClassification);
const studentFacingText = JSON.stringify(baseCard);
assert.doesNotMatch(studentFacingText, /\b(2350|2250|2150|2050|2400|2300|2200)\b/);
assert.doesNotMatch(studentFacingText, /\d+(?:\.\d+)?\s*%/);
assert.doesNotMatch(studentFacingText, /\boffer[- ]?(prediction|probability|likelihood|chance)\b/i);
assert.doesNotMatch(studentFacingText, /\bapprox_probability\b/i);
assert.match(
  JSON.stringify(baseCard.decision_transparency),
  /holistically by college|holistic interview guidance/i
);

console.log('Cambridge A100 readiness regression passed.');
