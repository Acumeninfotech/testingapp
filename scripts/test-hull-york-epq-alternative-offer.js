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
const STANDARD_A_LEVEL_PATHWAY_ID = 'standard_AAA_biology_chemistry';
const CONTEXTUAL_REDUCED_PATHWAY_ID = 'hyms_contextual_reduced_AAB';
const FIRM_CHOICE_ADVISORY =
  'This reduced EPQ offer applies only if Hull York Medical School is accepted as your firm UCAS choice.';
const HYMS_CONTEXTUAL_REDUCED_FIRM_CHOICE_CONDITION =
  'hyms_contextual_reduced_offer_firm_choice_required';
const HYMS_CONTEXTUAL_REDUCED_FIRM_CHOICE_ADVISORY =
  'HYMS states that the reduced AAB offer is only available to applicants who firmly accept their offer of a place at Hull York Medical School. If HYMS is your insurance choice, the standard AAA offer applies.';
const HYMS_CONTEXTUAL_REDUCED_INFORMATION_NEEDED_REASON =
  'hyms_contextual_reduced_offer_information_needed';
const HYMS_CONTEXTUAL_REDUCED_INFORMATION_NEEDED_MESSAGE =
  'More information is needed to confirm whether you qualify for HYMS’s contextual reduced AAB offer. You currently meet one ordinary contextual criterion. Please confirm: UCAT bursary.';

function subject(subjectId, predictedGrade, sittingStatus = 'first_sitting') {
  return {
    subject_id: subjectId,
    predicted_grade: predictedGrade,
    ...(sittingStatus ? { sitting_status: sittingStatus } : {})
  };
}

function noContextualProfile() {
  return {
    home_area_region: {
      polar4_quintile: 'q5'
    },
    financial_support: {
      ucat_bursary_recipient: 'no'
    },
    school_education: {
      school_below_progress_8: 'no',
      below_average_gcse_school: 'no',
      below_average_post16_school: 'no'
    },
    personal_circumstances: {
      care_experienced: 'no',
      refugee: 'no',
      military_family: 'no',
      gypsy_roma_traveller: 'no',
      first_in_family_at_university: 'no'
    },
    access_programmes: {
      participation_status: 'no',
      ukwpmed: {
        status: 'no',
        programme_id: '',
        programme_status: '',
        provider_university_id: '',
        completion_year: ''
      },
      other_programmes: []
    }
  };
}

function contextualProfile({
  polar4Quintile = 'q2',
  ucatBursaryRecipient = 'yes'
} = {}) {
  return merge(noContextualProfile(), {
    home_area_region: {
      polar4_quintile: polar4Quintile
    },
    financial_support: {
      ucat_bursary_recipient: ucatBursaryRecipient
    }
  });
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
  includeResitEvidence = true,
  contextual_profile = noContextualProfile()
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
      contextual: false,
      contextual_status_confirmed: false,
      contextual_flags: {
        ucat_bursary: false,
        recognised_wp_programme: false,
        polar4_quintile: null,
        care_experienced: false,
        refugee: false,
        military_family: false,
        gypsy_roma_traveller: false,
        school_below_progress_8: false,
        first_generation_higher_education: false
      },
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
    contextual_profile,
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
      'a_level_contextual_reduced_offer',
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
  expectedGenericPathway = expectedPathway,
  expectedGenericPathwayId = expectedPathwayId,
  expectedHymsPathway = expectedPathway,
  expectedHymsPathwayId = expectedPathwayId,
  expectedFailure,
  expectedManualReviewReason,
  expectedEpqFailedCondition,
  expectedFutureConditions = []
}) {
  const generic = evaluateCourseEligibility(course, applicant);
  const result = evaluate(applicant);

  assert.strictEqual(result.eligibility.status, expectedStatus, `${label}: HYMS eligibility`);
  assert.strictEqual(generic.academic_pathway ?? null, expectedGenericPathway, `${label}: generic pathway`);
  assert.strictEqual(result.eligibility.academic_pathway ?? null, expectedHymsPathway, `${label}: HYMS pathway`);
  assert.strictEqual(generic.academic_pathway_id ?? null, expectedGenericPathwayId, `${label}: generic pathway id`);
  assert.strictEqual(result.eligibility.academic_pathway_id ?? null, expectedHymsPathwayId, `${label}: HYMS pathway id`);
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
  expectedPathwayId: STANDARD_A_LEVEL_PATHWAY_ID
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
  expectedPathwayId: STANDARD_A_LEVEL_PATHWAY_ID
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

{
  const applicant = applicantWith({
    subjects: [
      subject('chemistry', 'A'),
      subject('biology', 'A'),
      subject('psychology', 'B')
    ],
    contextual_profile: contextualProfile({
      ucatBursaryRecipient: 'yes',
      polar4Quintile: 'q2'
    })
  });
  const result = evaluate(applicant);
  const card = dedicatedCard(applicant);
  const api = apiCard(applicant);

  assert.strictEqual(result.eligibility.contextual_eligibility.status, 'contextual');
  assert.strictEqual(
    result.eligibility.contextual_eligibility.consequences.reduced_offer.status,
    'eligible'
  );
  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.eligibility.academic_pathway, 'contextual_reduced_offer');
  assert.strictEqual(result.eligibility.academic_pathway_id, CONTEXTUAL_REDUCED_PATHWAY_ID);
  assert.strictEqual(
    result.eligibility.failures.includes('a_level_requirements_not_met'),
    false
  );
  assert.strictEqual(result.eligibility.epq_alternative_result, undefined);
  assert.strictEqual(result.estimated_selection_score.status, 'calculated');
  assert.notStrictEqual(result.canonical_interview_band, 'not_eligible');
  assert.notStrictEqual(result.canonical_interview_band, 'insufficient_evidence');
  assert.ok(result.recommendation);

  assert.strictEqual(card.academic_pathway, 'contextual_reduced_offer');
  assert.strictEqual(card.academic_pathway_id, CONTEXTUAL_REDUCED_PATHWAY_ID);
  assert.deepStrictEqual(card.future_conditions, [
    HYMS_CONTEXTUAL_REDUCED_FIRM_CHOICE_CONDITION
  ]);
  assert.deepStrictEqual(card.future_condition_advisories, [
    HYMS_CONTEXTUAL_REDUCED_FIRM_CHOICE_ADVISORY
  ]);
  assert.strictEqual(card.trust_statement, HYMS_CONTEXTUAL_REDUCED_FIRM_CHOICE_ADVISORY);
  assert.strictEqual(
    card.alternative_academic_offer.applicable_offer,
    'Contextual reduced offer: AAB'
  );
  assertPublicPost16(
    'AAB contextual reduced offer',
    card,
    [['Contextual reduced offer: AAB', 'met', 'a_level_contextual_reduced_offer']]
  );

  assert.strictEqual(api.academic_pathway, 'contextual_reduced_offer');
  assert.strictEqual(api.academic_pathway_id, CONTEXTUAL_REDUCED_PATHWAY_ID);
  assert.deepStrictEqual(api.future_conditions, [
    HYMS_CONTEXTUAL_REDUCED_FIRM_CHOICE_CONDITION
  ]);
  assert.deepStrictEqual(api.future_condition_advisories, [
    HYMS_CONTEXTUAL_REDUCED_FIRM_CHOICE_ADVISORY
  ]);
  assert.strictEqual(api.trust_statement, HYMS_CONTEXTUAL_REDUCED_FIRM_CHOICE_ADVISORY);
  assert.notStrictEqual(api.prediction.result_band, 'not_eligible');
  assert.notStrictEqual(api.recommendation_display_state, 'not_eligible');
  assert.doesNotMatch(JSON.stringify(api), /A-level requirements not met/i);
  assert.doesNotMatch(JSON.stringify(api), /Not suitable/i);
}

{
  const applicant = applicantWith({
    subjects: [
      subject('chemistry', 'A'),
      subject('biology', 'A'),
      subject('psychology', 'B')
    ],
    epq: { status: 'not_taken', grade: null },
    contextual_profile: contextualProfile({
      ucatBursaryRecipient: 'not_sure',
      polar4Quintile: 'q2'
    })
  });
  const result = evaluate(applicant);
  const card = dedicatedCard(applicant);
  const api = apiCard(applicant);

  assert.strictEqual(
    result.eligibility.contextual_eligibility.consequences.reduced_offer.status,
    'information_needed',
    'Case 4: contextual reduced-offer status'
  );
  assert.strictEqual(result.eligibility.status, 'manual_review', 'Case 4: HYMS eligibility');
  assert.notStrictEqual(result.eligibility.status, 'not_eligible', 'Case 4: not hard ineligible');
  assert.strictEqual(result.eligibility.academic_pathway, null, 'Case 4: no active HYMS pathway');
  assert.strictEqual(result.eligibility.academic_pathway_id, null, 'Case 4: no active pathway id');
  assert.strictEqual(result.eligibility.epq_alternative_result, undefined, 'Case 4: EPQ route not evaluated');
  assert.strictEqual(
    result.eligibility.failures.includes('a_level_requirements_not_met'),
    false,
    'Case 4: no blocking A-level failure'
  );
  assert.ok(
    result.eligibility.manual_review_reasons.includes(
      HYMS_CONTEXTUAL_REDUCED_INFORMATION_NEEDED_REASON
    ),
    'Case 4: HYMS contextual information-needed reason'
  );
  assert.strictEqual(result.estimated_selection_score.status, 'not_applied');
  assert.strictEqual(result.canonical_interview_band, 'insufficient_evidence');

  assert.strictEqual(card.eligibility.status, 'manual_review');
  assert.strictEqual(card.academic_pathway, null);
  assert.strictEqual(card.academic_pathway_id, null);
  assert.strictEqual(card.alternative_academic_offer, null);
  assertPublicPost16(
    'Case 4 contextual reduced offer information needed',
    card,
    [['Contextual reduced offer: AAB', 'information_needed', 'a_level_contextual_reduced_offer']]
  );
  assertNoFirmAdvisory('Case 4 contextual reduced offer information needed', card);
  assert.ok(
    card.decision_transparency.information_needed_reason.includes(
      HYMS_CONTEXTUAL_REDUCED_INFORMATION_NEEDED_MESSAGE
    ),
    'Case 4: dedicated public information-needed reason'
  );

  assert.strictEqual(api.recommendation_display_state, 'manual_review');
  assert.strictEqual(api.academic_pathway, null);
  assert.strictEqual(api.academic_pathway_id, null);
  assert.strictEqual(api.alternative_academic_offer, null);
  assertPublicPost16(
    'API Case 4 contextual reduced offer information needed',
    api,
    [['Contextual reduced offer: AAB', 'information_needed', 'a_level_contextual_reduced_offer']]
  );
  assertNoFirmAdvisory('API Case 4 contextual reduced offer information needed', api);
  assert.ok(
    api.information_needed_reason.includes(HYMS_CONTEXTUAL_REDUCED_INFORMATION_NEEDED_MESSAGE),
    'Case 4: API public information-needed reason'
  );
  assert.doesNotMatch(JSON.stringify(api), /EPQ Alternative AAB \+ EPQ Grade A/i);
}

for (const [label, contextual_profile] of [
  ['AAB only UCAT bursary POLAR4 Q5', contextualProfile({
    ucatBursaryRecipient: 'yes',
    polar4Quintile: 'q5'
  })],
  ['AAB no contextual qualification', noContextualProfile()]
]) {
  const applicant = applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('psychology', 'B')
    ],
    contextual_profile
  });
  const result = evaluate(applicant);
  assert.notStrictEqual(
    result.eligibility.academic_pathway,
    'contextual_reduced_offer',
    `${label}: no contextual reduced route`
  );
  assert.notStrictEqual(
    result.eligibility.academic_pathway_id,
    CONTEXTUAL_REDUCED_PATHWAY_ID,
    `${label}: no contextual reduced pathway id`
  );
  assert.strictEqual(result.eligibility.status, 'not_eligible', `${label}: eligibility`);
  assert.ok(
    result.eligibility.failures.includes('a_level_requirements_not_met'),
    `${label}: standard AAB remains insufficient`
  );
}

{
  const applicant = applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('psychology', 'B')
    ],
    epq: { status: 'not_taken', grade: null },
    contextual_profile: contextualProfile({
      ucatBursaryRecipient: 'no',
      polar4Quintile: 'q2'
    })
  });
  const result = evaluate(applicant);
  assert.strictEqual(
    result.eligibility.contextual_eligibility.consequences.reduced_offer.status,
    'not_eligible',
    'AAB POLAR4 Q2 UCAT bursary no: no contextual reduced uncertainty'
  );
  assert.strictEqual(result.eligibility.status, 'not_eligible');
  assert.strictEqual(result.eligibility.academic_pathway, null);
  assert.ok(result.eligibility.failures.includes('a_level_requirements_not_met'));
}


{
  const applicant = applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('psychology', 'B')
    ],
    epq: { status: 'not_taken', grade: null },
    contextual_profile: merge(noContextualProfile(), {
      access_programmes: {
        participation_status: 'yes',
        ukwpmed: {
          status: 'yes',
          programme_id: 'birmingham_pathways_to_birmingham_medicine',
          programme_status: 'completed',
          provider_university_id: 'birmingham-a100',
          completion_year: 2026
        },
        other_programmes: []
      }
    })
  });

  const result = evaluate(applicant);
  const card = dedicatedCard(applicant);
  const api = apiCard(applicant);

  assert.strictEqual(
    result.eligibility.contextual_eligibility.consequences.alternative_wp_offer.status,
    'eligible',
    'Case 6: HYMS alternative WP consequence'
  );
  assert.strictEqual(result.eligibility.status, 'eligible', 'Case 6: academic eligibility');
  assert.strictEqual(result.eligibility.academic_pathway, 'alternative_wp_offer');
  assert.strictEqual(
    result.eligibility.academic_pathway_id,
    'hyms_alternative_wp_a_level_abb'
  );
  assert.strictEqual(
    result.eligibility.failures.includes('a_level_requirements_not_met'),
    false
  );
  assert.deepStrictEqual(
    result.eligibility.future_conditions,
    ['hyms_alternative_wp_offer_firm_choice_required']
  );

  assert.strictEqual(card.eligibility.status, 'eligible');
  assert.strictEqual(card.academic_pathway, 'alternative_wp_offer');
  assert.strictEqual(
    card.academic_pathway_id,
    'hyms_alternative_wp_a_level_abb'
  );
  assert.deepStrictEqual(
    card.future_conditions,
    ['hyms_alternative_wp_offer_firm_choice_required']
  );
  assert.ok(
    (card.future_condition_advisories || []).some((message) =>
      message.includes('alternative ABB widening-participation offer')
    ),
    'Case 6: HYMS ABB firm-choice advisory'
  );

  assert.strictEqual(api.academic_pathway, 'alternative_wp_offer');
  assert.strictEqual(
    api.academic_pathway_id,
    'hyms_alternative_wp_a_level_abb'
  );
  assert.notStrictEqual(api.recommendation_display_state, 'not_eligible');
  assert.doesNotMatch(JSON.stringify(api), /A-level requirements not met/i);
}

assertAcademicScenario({
  label: 'AAA non-contextual standard protection',
  applicant: applicantWith(),
  expectedStatus: 'eligible',
  expectedPathway: 'standard',
  expectedPathwayId: STANDARD_A_LEVEL_PATHWAY_ID
});

assertAcademicScenario({
  label: 'AAA unresolved contextual evidence standard protection',
  applicant: applicantWith({
    contextual_profile: contextualProfile({
      ucatBursaryRecipient: 'not_sure',
      polar4Quintile: 'q2'
    }),
    epq: { status: 'not_taken', grade: null }
  }),
  expectedStatus: 'eligible',
  expectedPathway: 'standard',
  expectedPathwayId: STANDARD_A_LEVEL_PATHWAY_ID
});

{
  const applicant = applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('psychology', 'B')
    ],
    contextual_profile: contextualProfile({
      ucatBursaryRecipient: 'yes',
      polar4Quintile: 'q2'
    }),
    epq: { status: 'achieved', grade: 'A' }
  });
  const result = evaluate(applicant);
  const card = dedicatedCard(applicant);
  assert.strictEqual(result.eligibility.academic_pathway, 'contextual_reduced_offer');
  assert.strictEqual(result.eligibility.academic_pathway_id, CONTEXTUAL_REDUCED_PATHWAY_ID);
  assert.strictEqual(result.eligibility.epq_alternative_result, undefined);
  assertPublicPost16(
    'AAB contextual reduced offer takes precedence over EPQ',
    card,
    [['Contextual reduced offer: AAB', 'met', 'a_level_contextual_reduced_offer']]
  );
}

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

{
  const applicant = applicantWith({
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'B')
    ],
    epq: { status: 'not_taken', grade: null }
  });

  assertAcademicScenario({
    label: 'AAB EPQ not taken',
    applicant,
    expectedStatus: 'not_eligible',
    expectedPathway: null,
    expectedPathwayId: null,
    expectedFailure: 'a_level_requirements_not_met'
  });

  const result = evaluate(applicant);
  const card = dedicatedCard(applicant);
  const api = apiCard(applicant);

  assert.strictEqual(result.eligibility.status, 'not_eligible');
  assert.strictEqual(result.eligibility.academic_pathway, null);
  assert.strictEqual(result.eligibility.academic_pathway_id, null);
  assert.ok(result.eligibility.failures.includes('a_level_requirements_not_met'));
  assert.strictEqual(result.eligibility.epq_alternative_result.status, 'not_applicable');
  assert.ok(result.eligibility.epq_alternative_result.reasons.includes('epq_not_taken'));
  assert.strictEqual(card.alternative_academic_offer, null);
  assertPublicPost16(
    'AAB EPQ not taken',
    card,
    [['A-level grades', 'not_met', 'a_level_standard_offer']]
  );
  assertNoFirmAdvisory('AAB EPQ not taken', card);

  assert.strictEqual(api.alternative_academic_offer, null);
  assertPublicPost16(
    'API AAB EPQ not taken',
    api,
    [['A-level grades', 'not_met', 'a_level_standard_offer']]
  );
  assertNoFirmAdvisory('API AAB EPQ not taken', api);
}

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
  expectedGenericPathway: 'standard',
  expectedGenericPathwayId: STANDARD_A_LEVEL_PATHWAY_ID,
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
