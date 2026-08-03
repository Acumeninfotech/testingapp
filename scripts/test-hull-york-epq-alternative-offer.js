#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const {
  buildHullYorkA100ResultCard,
  evaluateHullYorkA100
} = require('../assets/js/engine/hull-york-a100-consumer');
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

const course = readJson('data/universities/hull-york-a100.json');
const config = readJson('data/interview-band-configs/hull-york-a100.json');
const fixture = readJson('data/fixtures/hull-york-a100-readiness.json');

const EPQ_PATHWAY_ID = 'hull_york_epq_alternative';
const FIRM_CHOICE_ADVISORY =
  'This reduced EPQ offer applies only if Hull York Medical School is accepted as your firm UCAS choice.';

function subject(subjectId, predictedGrade, sittingStatus = 'first_sitting') {
  return {
    subject_id: subjectId,
    predicted_grade: predictedGrade,
    ...(sittingStatus ? { sitting_status: sittingStatus } : {})
  };
}

function applicantWith({
  subjects = [
    subject('biology', 'A'),
    subject('chemistry', 'A'),
    subject('history', 'A')
  ],
  epq = undefined,
  completedInOneSitting = true,
  hasResits = false,
  includeResitEvidence = true
} = {}) {
  const aLevelProfile = {
    subjects,
    ...(completedInOneSitting !== undefined
      ? { completed_in_one_sitting: completedInOneSitting }
      : {}),
    ...(includeResitEvidence ? { has_resits: hasResits } : {})
  };
  if (epq !== undefined) {
    aLevelProfile.epq = epq;
  }

  return merge(fixture.base_applicant, {
    applicant_identity: {
      resit: includeResitEvidence
        ? {
            has_resits: hasResits,
            subjects_resat: hasResits ? ['history'] : []
          }
        : null
    },
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 700,
          decision_making: 750,
          quantitative_reasoning: 750
        },
        sjt_band: 2,
        test_year: 2026
      }
    },
    a_level_profile: aLevelProfile
  });
}

function evaluate(applicant) {
  return evaluateHullYorkA100(course, config, applicant);
}

function dedicatedCard(applicant) {
  return buildHullYorkA100ResultCard(course, config, applicant);
}

function apiCard(applicant) {
  return predict({
    universityIds: ['hull-york-a100'],
    studentProfile: applicant
  })[0].result_card;
}

function publicPost16PathwayChecks(checks) {
  return (checks || []).filter((check) =>
    check.qualification_type === 'a_level' &&
    [
      'a_level_standard_offer',
      'epq_alternative_offer',
      'a_level_route'
    ].includes(check.requirement_type)
  );
}

function assertPublicPost16(label, card, expectedRows) {
  const rows = publicPost16PathwayChecks(card.academic_requirement_checks || []);
  assert.deepStrictEqual(
    rows.map((check) => [
      check.label,
      check.status,
      check.requirement_type
    ]),
    expectedRows,
    `${label}: unexpected public post-16 rows ${JSON.stringify(card.academic_requirement_checks)}`
  );
}

function assertNoFirmAdvisory(label, card) {
  assert.deepStrictEqual(card.future_conditions || [], [], `${label}: no public future conditions`);
  assert.deepStrictEqual(card.future_condition_advisories || [], [], `${label}: no future advisory`);
  assert.notStrictEqual(card.trust_statement, FIRM_CHOICE_ADVISORY, `${label}: no firm-choice trust statement`);
}

function assertAcademicScenario({
  label,
  applicant,
  expectedStatus,
  expectedPathway,
  expectedPathwayId,
  expectedFailure,
  expectedManualReviewReason,
  expectedEpqFailedCondition,
  expectedFutureConditions = []
}) {
  const generic = evaluateCourseEligibility(course, applicant);
  const result = evaluate(applicant);

  assert.strictEqual(result.eligibility.status, expectedStatus, `${label}: HYMS eligibility`);
  assert.strictEqual(generic.academic_pathway ?? null, expectedPathway, `${label}: generic pathway`);
  assert.strictEqual(result.eligibility.academic_pathway ?? null, expectedPathway, `${label}: HYMS pathway`);
  assert.strictEqual(generic.academic_pathway_id ?? null, expectedPathwayId, `${label}: generic pathway id`);
  assert.strictEqual(result.eligibility.academic_pathway_id ?? null, expectedPathwayId, `${label}: HYMS pathway id`);
  assert.deepStrictEqual(result.eligibility.future_conditions || [], expectedFutureConditions, `${label}: future conditions`);

  if (expectedFailure) {
    assert.ok(result.eligibility.failures.includes(expectedFailure), `${label}: HYMS failure`);
    assert.ok(generic.failures.includes(expectedFailure), `${label}: generic failure`);
  }
  if (expectedManualReviewReason) {
    assert.ok(
      result.eligibility.manual_review_reasons.includes(expectedManualReviewReason),
      `${label}: HYMS manual-review reason`
    );
    assert.ok(
      generic.manual_review_reasons.includes(expectedManualReviewReason),
      `${label}: generic manual-review reason`
    );
  } else {
    assert.deepStrictEqual(result.eligibility.manual_review_reasons, [], `${label}: no HYMS manual review`);
  }
  if (expectedEpqFailedCondition) {
    assert.ok(
      result.eligibility.epq_alternative_result?.failed_conditions.includes(expectedEpqFailedCondition),
      `${label}: HYMS EPQ failed condition`
    );
    assert.ok(
      generic.epq_alternative_result?.failed_conditions.includes(expectedEpqFailedCondition),
      `${label}: generic EPQ failed condition`
    );
  }
}

assert.deepStrictEqual(course.stage_1_eligibility.post_16.a_level.standard_offer.grade_profile, [
  'A',
  'A',
  'A'
]);
assert.deepStrictEqual(course.stage_1_eligibility.post_16.a_level.epq_alternative_offer, {
  enabled: true,
  pathway_id: EPQ_PATHWAY_ID,
  a_level_grades: ['A', 'A', 'B'],
  epq_minimum_grade: 'A',
  subject_grade_requirements: {
    biology: 'A',
    chemistry: 'A'
  },
  conditions: {
    all_a_levels_same_sitting: true,
    a_level_resits_allowed: false,
    firm_choice_only: true,
    equivalent_grade_combinations_allowed: false
  }
});
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(course.stage_1_eligibility.post_16.a_level, 'epq_alternative'),
  false,
  'HYMS must use the canonical epq_alternative_offer field, not the legacy alias.'
);

assertAcademicScenario({
  label: 'AAA no EPQ',
  applicant: applicantWith(),
  expectedStatus: 'eligible',
  expectedPathway: 'standard',
  expectedPathwayId: null
});
assertPublicPost16(
  'AAA no EPQ',
  dedicatedCard(applicantWith()),
  [['A-level grades', 'met', 'a_level_standard_offer']]
);
assertNoFirmAdvisory('AAA no EPQ', dedicatedCard(applicantWith()));

assertAcademicScenario({
  label: 'AAA EPQ planning',
  applicant: applicantWith({ epq: { status: 'planning', grade: null } }),
  expectedStatus: 'eligible',
  expectedPathway: 'standard',
  expectedPathwayId: null
});
assertPublicPost16(
  'AAA EPQ planning',
  dedicatedCard(applicantWith({ epq: { status: 'planning', grade: null } })),
  [['A-level grades', 'met', 'a_level_standard_offer']]
);
assertNoFirmAdvisory(
  'AAA EPQ planning',
  dedicatedCard(applicantWith({ epq: { status: 'planning', grade: null } }))
);

for (const [label, epq] of [
  ['AAB EPQ A', { status: 'achieved', grade: 'A' }],
  ['AAB EPQ A*', { status: 'achieved', grade: 'A*' }]
]) {
  const applicant = applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B')
    ],
    epq
  });
  assertAcademicScenario({
    label,
    applicant,
    expectedStatus: 'eligible',
    expectedPathway: 'epq_alternative',
    expectedPathwayId: EPQ_PATHWAY_ID,
    expectedFutureConditions: ['firm_choice_required']
  });
  const card = dedicatedCard(applicant);
  assertPublicPost16(label, card, [['A-levels + EPQ', 'met', 'epq_alternative_offer']]);
  assert.deepStrictEqual(card.future_conditions, ['firm_choice_required']);
  assert.deepStrictEqual(card.future_condition_advisories, [FIRM_CHOICE_ADVISORY]);
  assert.strictEqual(card.trust_statement, FIRM_CHOICE_ADVISORY);
}

assertAcademicScenario({
  label: 'AAB predicted EPQ A',
  applicant: applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B')
    ],
    epq: { status: 'predicted', grade: 'A' }
  }),
  expectedStatus: 'eligible',
  expectedPathway: 'epq_alternative',
  expectedPathwayId: EPQ_PATHWAY_ID,
  expectedFutureConditions: ['firm_choice_required']
});

for (const [label, scenario] of [
  ['AAB EPQ B', {
    epq: { status: 'achieved', grade: 'B' },
    expectedEpqFailedCondition: 'epq_minimum_grade'
  }],
  ['A*AC EPQ A', {
    subjects: [
      subject('biology', 'A*'),
      subject('chemistry', 'A'),
      subject('history', 'C')
    ],
    epq: { status: 'achieved', grade: 'A' },
    expectedEpqFailedCondition: 'a_level_grade_profile'
  }],
  ['ABB EPQ A*', {
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'B'),
      subject('history', 'B')
    ],
    epq: { status: 'achieved', grade: 'A*' },
    expectedEpqFailedCondition: 'subject_grade:chemistry'
  }],
  ['AAB EPQ A Biology A Chemistry B', {
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'B'),
      subject('history', 'A')
    ],
    epq: { status: 'achieved', grade: 'A' },
    expectedEpqFailedCondition: 'subject_grade:chemistry'
  }],
  ['AAB EPQ A Biology B Chemistry A', {
    subjects: [
      subject('biology', 'B'),
      subject('chemistry', 'A'),
      subject('history', 'A')
    ],
    epq: { status: 'achieved', grade: 'A' },
    expectedEpqFailedCondition: 'subject_grade:biology'
  }],
  ['AAB EPQ A A-level resit', {
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B', 'resit')
    ],
    epq: { status: 'achieved', grade: 'A' },
    hasResits: true,
    expectedEpqFailedCondition: 'a_level_resits_not_allowed'
  }],
  ['AAB EPQ A not same sitting', {
    completedInOneSitting: false,
    epq: { status: 'achieved', grade: 'A' },
    expectedEpqFailedCondition: 'all_a_levels_same_sitting'
  }]
]) {
  const applicant = applicantWith({
    subjects: scenario.subjects || [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B')
    ],
    epq: scenario.epq,
    completedInOneSitting: scenario.completedInOneSitting ?? true,
    hasResits: scenario.hasResits ?? false
  });
  assertAcademicScenario({
    label,
    applicant,
    expectedStatus: 'not_eligible',
    expectedPathway: null,
    expectedPathwayId: null,
    expectedFailure: 'a_level_requirements_not_met',
    expectedEpqFailedCondition: scenario.expectedEpqFailedCondition
  });
  const card = dedicatedCard(applicant);
  assertPublicPost16(label, card, [['A-levels + EPQ', 'not_met', 'epq_alternative_offer']]);
  assertNoFirmAdvisory(label, card);
}

assertAcademicScenario({
  label: 'AAB EPQ planning',
  applicant: applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B')
    ],
    epq: { status: 'planning', grade: null }
  }),
  expectedStatus: 'manual_review',
  expectedPathway: 'epq_alternative',
  expectedPathwayId: EPQ_PATHWAY_ID,
  expectedManualReviewReason: `${EPQ_PATHWAY_ID}_epq_grade_required`
});
assertPublicPost16(
  'AAB EPQ planning',
  dedicatedCard(applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B')
    ],
    epq: { status: 'planning', grade: null }
  })),
  [['A-levels + EPQ', 'information_needed', 'epq_alternative_offer']]
);
assertNoFirmAdvisory(
  'AAB EPQ planning',
  dedicatedCard(applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B')
    ],
    epq: { status: 'planning', grade: null }
  }))
);

assertAcademicScenario({
  label: 'AAB EPQ A missing Biology',
  applicant: applicantWith({
    subjects: [
      subject('chemistry', 'A'),
      subject('mathematics', 'A'),
      subject('history', 'B')
    ],
    epq: { status: 'achieved', grade: 'A' }
  }),
  expectedStatus: 'manual_review',
  expectedPathway: 'epq_alternative',
  expectedPathwayId: EPQ_PATHWAY_ID,
  expectedManualReviewReason: 'a_level_subject_combination_evidence_missing'
});

assertAcademicScenario({
  label: 'AAB EPQ A same-sitting evidence unknown',
  applicant: applicantWith({
    subjects: [
      subject('biology', 'A', null),
      subject('chemistry', 'A', null),
      subject('history', 'B', null)
    ],
    epq: { status: 'achieved', grade: 'A' },
    completedInOneSitting: null,
    includeResitEvidence: true,
    hasResits: false
  }),
  expectedStatus: 'manual_review',
  expectedPathway: 'epq_alternative',
  expectedPathwayId: EPQ_PATHWAY_ID,
  expectedManualReviewReason: 'same_sitting_evidence_missing'
});

assertAcademicScenario({
  label: 'AAB EPQ A resit evidence unknown',
  applicant: applicantWith({
    subjects: [
      subject('biology', 'A', null),
      subject('chemistry', 'A', null),
      subject('history', 'B', null)
    ],
    epq: { status: 'achieved', grade: 'A' },
    completedInOneSitting: true,
    includeResitEvidence: false
  }),
  expectedStatus: 'manual_review',
  expectedPathway: 'epq_alternative',
  expectedPathwayId: EPQ_PATHWAY_ID,
  expectedManualReviewReason: 'a_level_resit_evidence_missing'
});

assertAcademicScenario({
  label: 'AAB EPQ not taken',
  applicant: applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B')
    ],
    epq: { status: 'not_taken', grade: null }
  }),
  expectedStatus: 'not_eligible',
  expectedPathway: null,
  expectedPathwayId: null,
  expectedFailure: 'a_level_requirements_not_met'
});
assertPublicPost16(
  'AAB EPQ not taken',
  dedicatedCard(applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B')
    ],
    epq: { status: 'not_taken', grade: null }
  })),
  [['A-level grades', 'not_met', 'a_level_standard_offer']]
);

assertAcademicScenario({
  label: 'Legacy profile without EPQ',
  applicant: applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B')
    ],
    epq: undefined
  }),
  expectedStatus: 'not_eligible',
  expectedPathway: null,
  expectedPathwayId: null,
  expectedFailure: 'a_level_requirements_not_met'
});

{
  const applicant = applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B')
    ],
    epq: { status: 'achieved', grade: 'A' }
  });
  const card = apiCard(applicant);
  assert.strictEqual(card.academic_pathway, 'epq_alternative');
  assert.strictEqual(card.academic_pathway_id, EPQ_PATHWAY_ID);
  assert.deepStrictEqual(card.future_conditions, ['firm_choice_required']);
  assert.deepStrictEqual(card.future_condition_advisories, [FIRM_CHOICE_ADVISORY]);
  assert.strictEqual(card.trust_statement, FIRM_CHOICE_ADVISORY);
  assertPublicPost16('API AAB EPQ A', card, [['A-levels + EPQ', 'met', 'epq_alternative_offer']]);
}

console.log('Hull York EPQ alternative offer: PASS');
