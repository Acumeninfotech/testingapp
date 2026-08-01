#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  presentResultCard,
  humanManualReviewReason,
  insufficientEvidenceReasonCodeFromWarnings
} = require('../assets/js/engine/result-card-presenter');

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

function includesFailure(result, expected) {
  const failures = [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
  return failures.some((failure) => failure === expected);
}

function publicResultSurface(resultCard) {
  return JSON.stringify({
    display: {
      primary_user_facing_recommendation: resultCard.primary_user_facing_recommendation,
      recommendation_display_state: resultCard.recommendation_display_state,
      primary_explanation: resultCard.primary_explanation,
      historical_guidance_caveat: resultCard.historical_guidance_caveat
    },
    decision_timeline: resultCard.decision_timeline,
    decision_transparency: resultCard.decision_transparency
  });
}

const INTERNAL_LEAK_PATTERN =
  /\/32|GCSE points|A-level points|internal strength|academic score|selection score|threshold of 3|3 out of 3|\/3|UCAT conversions/i;

function assertNoPublicInternalLeak(resultCard, message) {
  assert.strictEqual(
    resultCard.decision_transparency.score_breakdown ?? null,
    null,
    `${message}: internal Leeds score must not be exposed`
  );
  assert.doesNotMatch(
    publicResultSurface(resultCard),
    INTERNAL_LEAK_PATTERN,
    `${message}: public result card must not leak internal calculations`
  );
}

function makeResultCard(course, config, applicant, classification) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    manualReviewReason: humanManualReviewReason(classification.eligibility.manual_review_reasons),
    insufficientEvidenceReasonCode: insufficientEvidenceReasonCodeFromWarnings(classification.warnings, {
      eligibilityStatus: classification.eligibility.status,
      guidancePoolId: classification.guidance_pool_id ?? null
    }),
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
      warnings: classification.warnings || []
    }
  });
}

const GCSE_SUBJECT_ORDER = [
  'english_language',
  'mathematics',
  'biology',
  'chemistry',
  'physics',
  'history',
  'geography',
  'english_literature'
];

function gcseProfileForInternalScore(targetScore) {
  const grades = [];
  let remaining = targetScore;
  while (remaining >= 3 && grades.length < 8) {
    grades.push('8');
    remaining -= 3;
  }
  while (remaining >= 2 && grades.length < 8) {
    grades.push('7');
    remaining -= 2;
  }
  while (remaining >= 1 && grades.length < 8) {
    grades.push('6');
    remaining -= 1;
  }
  while (grades.length < 8) {
    grades.push('5');
  }

  const subjects = {};
  GCSE_SUBJECT_ORDER.forEach((subjectId, index) => {
    subjects[subjectId] = String(Math.max(4, Number(grades[index]) || 5));
  });

  return { subjects, total_gcse_count: 8 };
}

function classifyScenario(overrides = {}) {
  const applicant = merge(fixture.base_applicant, overrides);
  const classification = classifyInterviewBand(course, config, applicant);
  const resultCard = makeResultCard(course, config, applicant, classification);
  return { applicant, classification, resultCard };
}

function matrixInternal(classification) {
  return classification.ranking?.components?.leeds_hidden_compensation_matrix?.internal || {};
}

const course = readJson('data/universities/leeds-a100.json');
const research = readJson('data/research/leeds-a100-research.json');
const config = readJson('data/interview-band-configs/leeds-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/leeds-a100.json');
const card = readJson('data/examples/leeds-a100-result-card.example.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'leeds-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'academic_plus_ucat_weighting');
assert.strictEqual(config.score_model.presentation.hide_score_breakdown, true);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.sjt.used_as_gate, true);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.excluded_bands, [4]);
assert.strictEqual(course.engine_notes.international_prediction, false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Leeds A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.international_prediction, false);
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/leeds-a100.json');

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);
  const expected = scenario.expected;

  assert.strictEqual(
    result.eligibility.status,
    expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  assert.strictEqual(
    result.guidance_pool_id ?? null,
    expected.guidance_pool_id,
    `${scenario.scenario_id}: guidance pool`
  );
  assert.strictEqual(
    result.canonical_interview_band,
    expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  if (expected.failure) {
    assert.ok(includesFailure(result, expected.failure), `${scenario.scenario_id}: failure ${expected.failure}`);
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);

  const resultCard = makeResultCard(course, config, applicant, result);
  assertNoPublicInternalLeak(resultCard, scenario.scenario_id);
}

const homeStrong = classifyInterviewBand(course, config, fixture.base_applicant);
const homeStrongCard = makeResultCard(course, config, fixture.base_applicant, homeStrong);
assert.strictEqual(homeStrongCard.primary_user_facing_recommendation, 'Strong choice for your application');
assert.strictEqual(homeStrongCard.internal_recommendation, 'Strong Choice');
assert.strictEqual(
  homeStrongCard.primary_explanation,
  "Based on ApplySmart's assessment, your academic profile and UCAT appear competitive for this applicant group."
);
assertNoPublicInternalLeak(homeStrongCard, 'home strong API card');

const aStarAStarB = classifyScenario({
  a_level_profile: {
    subjects: [
      {
        subject_id: 'biology',
        predicted_grade: 'A*',
        sitting_status: 'first_sitting',
        practical_endorsement: 'pass'
      },
      {
        subject_id: 'chemistry',
        predicted_grade: 'A*',
        sitting_status: 'first_sitting',
        practical_endorsement: 'pass'
      },
      {
        subject_id: 'mathematics',
        predicted_grade: 'B',
        sitting_status: 'first_sitting'
      }
    ]
  }
});
assert.strictEqual(aStarAStarB.classification.eligibility.status, 'not_eligible');
assert.ok(includesFailure(aStarAStarB.classification, 'a_level_requirements_not_met'));
assert.strictEqual(
  aStarAStarB.resultCard.primary_user_facing_recommendation,
  'Not currently eligible'
);
assert.strictEqual(
  aStarAStarB.resultCard.primary_explanation,
  'Your A-level grades (predicted or achieved) do not meet the published minimum. Based on the information entered, one or more supported entry requirements are not met.'
);

const academicBoundaryCases = [
  [22, 'weak', 'high_risk', 'More cautious choice for your application'],
  [23, 'moderate', 'realistic', 'Possible choice for your application'],
  [25, 'moderate', 'realistic', 'Possible choice for your application'],
  [26, 'strong', 'interview_likely', 'Strong choice for your application'],
  [28, 'strong', 'interview_likely', 'Strong choice for your application'],
  [29, 'very_strong', 'interview_likely', 'Strong choice for your application'],
  [32, 'very_strong', 'interview_likely', 'Strong choice for your application']
];

for (const [academicScore, expectedAcademicBand, expectedBand, expectedPublicLabel] of academicBoundaryCases) {
  const { classification, resultCard } = classifyScenario({
    gcse_profile: gcseProfileForInternalScore(academicScore - 8),
    admissions_tests: {
      ucat: {
        total_score: 2050,
        sjt_band: 2
      }
    }
  });
  const internal = matrixInternal(classification);
  assert.strictEqual(internal.academic_score, academicScore, `academic score ${academicScore}`);
  assert.strictEqual(internal.academic_band, expectedAcademicBand, `academic band ${academicScore}`);
  assert.strictEqual(classification.canonical_interview_band, expectedBand, `public band ${academicScore}`);
  assert.strictEqual(resultCard.primary_user_facing_recommendation, expectedPublicLabel, `public label ${academicScore}`);
  assertNoPublicInternalLeak(resultCard, `academic boundary ${academicScore}`);
}

const ucatBoundaryCases = [
  [1899, 'below_recent_range', 'high_risk', 'More cautious choice for your application'],
  [1900, 'borderline', 'realistic', 'Possible choice for your application'],
  [1929, 'borderline', 'realistic', 'Possible choice for your application'],
  [1930, 'historically_competitive', 'interview_likely', 'Strong choice for your application'],
  [1949, 'historically_competitive', 'interview_likely', 'Strong choice for your application'],
  [1950, 'competitive', 'interview_likely', 'Strong choice for your application'],
  [2049, 'competitive', 'interview_likely', 'Strong choice for your application'],
  [2050, 'strong', 'interview_likely', 'Strong choice for your application']
];

for (const [ucatScore, expectedUcatPosition, expectedBand, expectedPublicLabel] of ucatBoundaryCases) {
  const { classification, resultCard } = classifyScenario({
    gcse_profile: gcseProfileForInternalScore(24),
    admissions_tests: {
      ucat: {
        total_score: ucatScore,
        sjt_band: 2
      }
    }
  });
  assert.strictEqual(matrixInternal(classification).ucat_position, expectedUcatPosition, `UCAT position ${ucatScore}`);
  assert.strictEqual(classification.canonical_interview_band, expectedBand, `UCAT public band ${ucatScore}`);
  assert.strictEqual(resultCard.primary_user_facing_recommendation, expectedPublicLabel, `UCAT public label ${ucatScore}`);
  assertNoPublicInternalLeak(resultCard, `UCAT boundary ${ucatScore}`);
}

for (const sjtBand of [1, 2, 3]) {
  const { classification } = classifyScenario({
    admissions_tests: {
      ucat: {
        total_score: 2050,
        sjt_band: sjtBand
      }
    }
  });
  assert.strictEqual(classification.eligibility.status, 'eligible', `SJT Band ${sjtBand}`);
}

const sjtBand4 = classifyScenario({
  admissions_tests: {
    ucat: {
      total_score: 2050,
      sjt_band: 4
    }
  }
});
assert.strictEqual(sjtBand4.classification.eligibility.status, 'not_eligible');
assert.ok(includesFailure(sjtBand4.classification, 'disqualifying_sjt_rule'));

const achievedAaa = classifyScenario({
  a_level_profile: {
    subjects: [
      {
        subject_id: 'biology',
        achieved_grade: 'A',
        sitting_status: 'first_sitting',
        practical_endorsement: 'pass'
      },
      {
        subject_id: 'chemistry',
        achieved_grade: 'A',
        sitting_status: 'first_sitting',
        practical_endorsement: 'pass'
      },
      {
        subject_id: 'mathematics',
        achieved_grade: 'A',
        sitting_status: 'first_sitting'
      }
    ]
  }
});
assert.strictEqual(achievedAaa.classification.eligibility.status, 'eligible');
assert.strictEqual(achievedAaa.classification.canonical_interview_band, 'interview_likely');

const failedGcse = classifyScenario({
  gcse_profile: {
    subjects: {
      english_language: '3',
      mathematics: '4',
      biology: '4',
      chemistry: '4',
      physics: '4',
      history: '4'
    },
    total_gcse_count: 6
  }
});
assert.strictEqual(failedGcse.classification.eligibility.status, 'not_eligible');
assert.ok(includesFailure(failedGcse.classification, 'minimum_gcse_grade_not_met:english_language'));

const failedPractical = classifyScenario({
  a_level_profile: {
    subjects: [
      {
        subject_id: 'biology',
        predicted_grade: 'A',
        sitting_status: 'first_sitting',
        practical_endorsement: 'fail'
      },
      {
        subject_id: 'chemistry',
        predicted_grade: 'A',
        sitting_status: 'first_sitting',
        practical_endorsement: 'pass'
      },
      {
        subject_id: 'mathematics',
        predicted_grade: 'A',
        sitting_status: 'first_sitting'
      }
    ]
  }
});
assert.strictEqual(failedPractical.classification.eligibility.status, 'not_eligible');
assert.ok(includesFailure(failedPractical.classification, 'science_practical_endorsement_not_confirmed:biology'));

const acceptedFirstResit = classifyScenario({
  applicant_identity: {
    resit: {
      has_resits: true,
      attempt_count: 1
    }
  }
});
assert.strictEqual(acceptedFirstResit.classification.eligibility.status, 'eligible');

const rejectedThirdAttempt = classifyScenario({
  applicant_identity: {
    resit: {
      has_resits: true,
      attempt_count: 2
    }
  }
});
assert.strictEqual(rejectedThirdAttempt.classification.eligibility.status, 'not_eligible');
assert.ok(includesFailure(rejectedThirdAttempt.classification, 'resit_policy_not_met'));

const routeBoundaryCases = [
  [
    'graduate',
    {
      qualification_route: 'graduate',
      applicant_identity: {
        graduate: true
      }
    },
    'manual_review',
    null,
    'insufficient_evidence'
  ],
  ['ib', { qualification_route: 'ib' }, 'manual_review', null, 'insufficient_evidence'],
  ['scottish', { qualification_route: 'scottish' }, 'manual_review', null, 'insufficient_evidence'],
  ['btec', { qualification_route: 'btec' }, 'not_eligible', null, 'not_eligible']
];

for (const [label, overrides, expectedEligibility, expectedPool, expectedBand] of routeBoundaryCases) {
  const { classification, resultCard } = classifyScenario(overrides);
  assert.strictEqual(classification.eligibility.status, expectedEligibility, label);
  assert.strictEqual(classification.guidance_pool_id ?? null, expectedPool, label);
  assert.strictEqual(classification.canonical_interview_band, expectedBand, label);
  assertNoPublicInternalLeak(resultCard, label);
}

assert.strictEqual(card.display.primary_user_facing_recommendation, 'Strong choice for your application');
assert.strictEqual(card.decision_transparency.score_breakdown ?? null, null);
assert.doesNotMatch(
  JSON.stringify({
    display: card.display,
    decision_timeline: card.decision_timeline,
    decision_transparency: card.decision_transparency
  }),
  INTERNAL_LEAK_PATTERN
);

console.log('Leeds A100 readiness regression: PASS');
