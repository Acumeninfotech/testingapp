#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const course = require(path.resolve(__dirname, '..', 'data/universities/st-andrews-a100.json'));
const config = require(path.resolve(__dirname, '..', 'data/interview-band-configs/st-andrews-a100.json'));
const {
  evaluateContextualEligibility,
  evaluateCourseEligibility,
  supportedScottishMedicalSchoolRouteIds
} = require('../assets/js/engine/eligibility-evaluator');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');

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

function sqaSubject(subjectId, grade, schoolYear, extra = {}) {
  return {
    subject_id: subjectId,
    predicted_grade: grade,
    school_year: schoolYear,
    sitting_id: schoolYear,
    first_attempt: true,
    ...extra
  };
}

function contextualProfile(overrides = {}) {
  return merge({
    home_area_region: {
      imd_quintile: 'q5',
      simd_quintile: 'q5'
    },
    school_education: {
      low_progression_to_higher_education_school: 'no'
    },
    personal_circumstances: {
      care_experienced: 'no',
      care_over_three_months: 'no',
      looked_after: 'no',
      young_or_adult_carer: 'no',
      young_carer: 'no',
      carer: 'no',
      unpaid_carer: 'no',
      estranged_from_family: 'no',
      estranged: 'no',
      refugee: 'no',
      uk_refugee_status_granted: 'no'
    },
    access_programmes: {
      participation_status: 'no',
      other_programmes: [],
      other_programme_name: ''
    }
  }, overrides);
}

function ucat(totalScore = 2500) {
  return {
    total_score: totalScore,
    score_scale: 2700,
    sjt_band: 2,
    subtests: {
      verbal_reasoning: 830,
      decision_making: 835,
      quantitative_reasoning: 835
    }
  };
}

function baseApplicant(overrides = {}) {
  return merge({
    profile_id: 'st_andrews_a100_four_route_migration',
    application_year: 2027,
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: 'home_fee',
      domicile: 'scotland',
      contextual_flags: {},
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
    admissions_tests: {
      ucat: ucat()
    },
    contextual_profile: contextualProfile()
  }, overrides);
}

function standardScottishApplicant(overrides = {}) {
  return baseApplicant(merge({
    qualification_route: 'scottish',
    scottish_profile: {
      completed_in_one_sitting: true,
      national_5_subjects: [
        { subject_id: 'english_language', grade: 'B' },
        { subject_id: 'mathematics', grade: 'B' }
      ],
      higher_subjects: [
        sqaSubject('chemistry', 'A', 's5'),
        sqaSubject('biology', 'A', 's5'),
        sqaSubject('physics', 'A', 's5'),
        sqaSubject('english', 'A', 's5'),
        sqaSubject('history', 'B', 's5'),
        sqaSubject('geography', 'B', 's6'),
        sqaSubject('modern_studies', 'B', 's6')
      ],
      advanced_higher_subjects: [
        sqaSubject('chemistry', 'B', 's6')
      ]
    }
  }, overrides));
}

function contextualScottishApplicant(overrides = {}) {
  return standardScottishApplicant(merge({
    contextual_profile: contextualProfile({
      personal_circumstances: {
        young_or_adult_carer: 'yes'
      }
    }),
    scottish_profile: {
      higher_subjects: [
        sqaSubject('chemistry', 'A', 's5'),
        sqaSubject('biology', 'A', 's5'),
        sqaSubject('physics', 'A', 's5'),
        sqaSubject('english', 'B', 's5'),
        sqaSubject('history', 'B', 's5'),
        sqaSubject('geography', 'B', 's6')
      ],
      advanced_higher_subjects: [
        sqaSubject('chemistry', 'B', 's6')
      ]
    }
  }, overrides));
}

function standardALevelApplicant(overrides = {}) {
  return baseApplicant(merge({
    qualification_route: 'a_level',
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A' },
        { subject_id: 'biology', predicted_grade: 'A' },
        { subject_id: 'mathematics', predicted_grade: 'A' }
      ]
    },
    gcse_profile: {
      subjects: {
        english_language: '7',
        mathematics: '7',
        biology: '7',
        chemistry: '7',
        physics: '7'
      }
    }
  }, overrides));
}

function contextualALevelApplicant(overrides = {}) {
  return standardALevelApplicant(merge({
    contextual_profile: contextualProfile({
      personal_circumstances: {
        young_or_adult_carer: 'yes'
      }
    }),
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A' },
        { subject_id: 'biology', predicted_grade: 'A' },
        { subject_id: 'mathematics', predicted_grade: 'B' }
      ]
    }
  }, overrides));
}

function assertRoute(applicant, expectedRouteId, expectedStatus = 'eligible') {
  const result = evaluateCourseEligibility(course, applicant);
  assert.strictEqual(result.status, expectedStatus, JSON.stringify(result, null, 2));
  assert.strictEqual(result.selection_route_id, expectedRouteId, JSON.stringify(result, null, 2));
  assert.strictEqual(
    result.scottish_medical_school_route?.route_id,
    expectedRouteId,
    JSON.stringify(result, null, 2)
  );
  return result;
}

function presentClassification(classification, applicant) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    insufficientEvidenceReasonCode: classification.insufficient_evidence_reason_code || null,
    missingInformation: classification.missing_information || null,
    transparencyContext: {
      course_identity: {
        profile_id: course.profile_id,
        university_name: course.university.name
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids,
      eligibility: classification.eligibility,
      selection_route_id: classification.selection_route_id,
      academic_pathway: classification.eligibility.academic_pathway,
      academic_pathway_id: classification.eligibility.academic_pathway_id,
      eligibility_checks: classification.eligibility.checks,
      stage_1_eligibility: course.stage_1_eligibility,
      stage_2_interview_selection: course.stage_2_interview_selection,
      selection_approach_display: course.selection_approach_display,
      ranking: classification.ranking,
      band_metric: classification.band_metric,
      guidance_pool: classification.guidance_pool,
      matched_band_rule: classification.matched_band_rule,
      score_model: config.score_model,
      guidance_pool_id: classification.guidance_pool_id,
      warnings: classification.warnings || []
    }
  });
}

assert.deepStrictEqual(supportedScottishMedicalSchoolRouteIds(course), [
  'scotland_standard',
  'scotland_contextual',
  'ruk_standard',
  'ruk_contextual'
]);

const routeMatrix = [
  [standardScottishApplicant(), 'scotland_standard'],
  [contextualScottishApplicant(), 'scotland_contextual'],
  [standardALevelApplicant(), 'scotland_standard'],
  [contextualALevelApplicant(), 'scotland_contextual'],
  [standardALevelApplicant({ applicant_identity: { domicile: 'england' } }), 'ruk_standard'],
  [contextualALevelApplicant({ applicant_identity: { domicile: 'england' } }), 'ruk_contextual'],
  [standardScottishApplicant({ applicant_identity: { domicile: 'england' } }), 'ruk_standard'],
  [contextualScottishApplicant({ applicant_identity: { domicile: 'england' } }), 'ruk_contextual']
];

for (const [applicant, expectedRouteId] of routeMatrix) {
  assertRoute(applicant, expectedRouteId);
}

const youngCarerContextual = evaluateContextualEligibility(course, contextualALevelApplicant());
assert.strictEqual(youngCarerContextual.status, 'contextual');
assert.strictEqual(youngCarerContextual.minimum_entry_eligible, true);
assert.strictEqual(youngCarerContextual.ucat_contextual_adjustment_eligible, false);
assert.strictEqual(youngCarerContextual.ucat_uplift_percent, 0);

const legacyRawContextualOnly = evaluateCourseEligibility(course, contextualALevelApplicant({
  applicant_identity: {
    contextual_flags: {
      care_experienced: true
    }
  },
  contextual_profile: contextualProfile(),
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'mathematics', predicted_grade: 'B' }
    ]
  }
}));
assert.strictEqual(legacyRawContextualOnly.selection_route_id, 'scotland_standard');
assert.ok(!legacyRawContextualOnly.applicant_group_ids.includes('contextual'));
assert.ok(legacyRawContextualOnly.failures.includes('a_level_requirements_not_met'));

const mixedS6 = assertRoute(standardScottishApplicant(), 'scotland_standard');
assert.ok(!mixedS6.failures.includes('scottish_post_16_requirements_not_met'));

const belowS5 = evaluateCourseEligibility(course, standardScottishApplicant({
  scottish_profile: {
    higher_subjects: [
      sqaSubject('chemistry', 'A', 's5'),
      sqaSubject('biology', 'A', 's5'),
      sqaSubject('physics', 'A', 's5'),
      sqaSubject('english', 'B', 's5'),
      sqaSubject('history', 'C', 's5'),
      sqaSubject('geography', 'B', 's6'),
      sqaSubject('modern_studies', 'B', 's6')
    ]
  }
}));
assert.ok(belowS5.failures.includes('scottish_post_16_requirements_not_met'));

const minimumGradesWithoutContextualEvidenceApplicant = standardScottishApplicant({
  admissions_tests: {
    ucat: ucat(2100)
  },
  scottish_profile: {
    higher_subjects: [
      sqaSubject('chemistry', 'A', 's5'),
      sqaSubject('biology', 'A', 's5'),
      sqaSubject('physics', 'A', 's5'),
      sqaSubject('english', 'B', 's5'),
      sqaSubject('history', 'B', 's5'),
      sqaSubject('geography', 'B', 's6'),
      sqaSubject('modern_studies', 'B', 's6')
    ],
    advanced_higher_subjects: []
  }
});
delete minimumGradesWithoutContextualEvidenceApplicant.contextual_profile;
const minimumGradesWithoutContextualEvidence = evaluateCourseEligibility(
  course,
  minimumGradesWithoutContextualEvidenceApplicant
);
assert.strictEqual(minimumGradesWithoutContextualEvidence.status, 'not_eligible');
assert.strictEqual(minimumGradesWithoutContextualEvidence.selection_route_id, 'scotland_standard');
assert.ok(
  minimumGradesWithoutContextualEvidence.failures.includes('scottish_post_16_requirements_not_met')
);
assert.ok(!minimumGradesWithoutContextualEvidence.manual_review_reasons.includes(
  'st_andrews_contextual_evidence_needs_review'
));
assert.notStrictEqual(minimumGradesWithoutContextualEvidence.academic_pathway, 'contextual');
assert.ok(minimumGradesWithoutContextualEvidence.checks.every((check) => {
  return check.contextual_route_under_review !== 'st_andrews_sqa_minimum_contextual_entry';
}));
const minimumGradesWithoutContextualEvidenceClassification = classifyInterviewBand(
  course,
  config,
  minimumGradesWithoutContextualEvidenceApplicant
);
assert.strictEqual(
  minimumGradesWithoutContextualEvidenceClassification.eligibility.status,
  'not_eligible'
);
assert.strictEqual(
  minimumGradesWithoutContextualEvidenceClassification.canonical_interview_band,
  'not_eligible'
);
assert.strictEqual(
  minimumGradesWithoutContextualEvidenceClassification.manual_review_required,
  undefined
);

const differentScienceYears = evaluateCourseEligibility(course, standardScottishApplicant({
  scottish_profile: {
    higher_subjects: [
      sqaSubject('chemistry', 'A', 's5'),
      sqaSubject('english', 'A', 's5'),
      sqaSubject('history', 'A', 's5'),
      sqaSubject('geography', 'A', 's5'),
      sqaSubject('modern_studies', 'B', 's5'),
      sqaSubject('biology', 'B', 's6'),
      sqaSubject('psychology', 'B', 's6'),
      sqaSubject('business_management', 'B', 's6')
    ],
    advanced_higher_subjects: []
  }
}));
assert.ok(differentScienceYears.failures.includes('scottish_post_16_requirements_not_met'));

const sameYearInS6 = assertRoute(standardScottishApplicant({
  scottish_profile: {
    higher_subjects: [
      sqaSubject('chemistry', 'A', 's5'),
      sqaSubject('english', 'A', 's5'),
      sqaSubject('history', 'A', 's5'),
      sqaSubject('geography', 'A', 's5'),
      sqaSubject('modern_studies', 'B', 's5'),
      sqaSubject('biology', 'B', 's6'),
      sqaSubject('psychology', 'B', 's6')
    ],
    advanced_higher_subjects: [
      sqaSubject('chemistry', 'B', 's6')
    ]
  }
}), 'scotland_standard');
assert.ok(!sameYearInS6.failures.includes('scottish_post_16_requirements_not_met'));

const sameSittingExceptionUnresolved = evaluateCourseEligibility(course, standardScottishApplicant({
  scottish_profile: {
    completed_in_one_sitting: false
  }
}));
assert.strictEqual(sameSittingExceptionUnresolved.status, 'manual_review');
assert.ok(
  sameSittingExceptionUnresolved.manual_review_reasons.includes(
    'st_andrews_s5_same_sitting_school_exception_requires_review'
  )
);

const sameSittingExceptionDenied = evaluateCourseEligibility(course, standardScottishApplicant({
  scottish_profile: {
    completed_in_one_sitting: false,
    same_sitting: {
      school_exception_confirmed: false
    }
  }
}));
assert.strictEqual(sameSittingExceptionDenied.status, 'not_eligible');
assert.ok(sameSittingExceptionDenied.failures.includes('scottish_post_16_requirements_not_met'));

const national5FallbackFailure = evaluateCourseEligibility(course, standardScottishApplicant({
  scottish_profile: {
    national_5_subjects: [
      { subject_id: 'english_language', grade: 'B' }
    ]
  }
}));
assert.ok(national5FallbackFailure.failures.includes('national_5_requirements_not_met'));

const result = assertRoute(standardScottishApplicant({
  applicant_identity: {
    domicile: 'england'
  }
}), 'ruk_standard');
const card = presentResultCard({
  eligibilityStatus: result.status,
  interviewBand: 'interview_possible',
  transparencyContext: {
    course_identity: { profile_id: course.profile_id },
    applicant_context: { qualification_route: 'scottish' },
    applicant_group_ids: result.applicant_group_ids,
    eligibility: result,
    selection_route_id: result.selection_route_id,
    academic_pathway: result.academic_pathway,
    academic_pathway_id: result.academic_pathway_id,
    eligibility_checks: result.checks,
    stage_1_eligibility: course.stage_1_eligibility,
    guidance_pool: { pool_id: 'home_rest_of_uk_standard_school_leaver' }
  }
});
assert.strictEqual(card.scottish_route.route_id, 'ruk_standard');
assert.ok(card.academic_requirement_checks.some((check) => {
  return check.requirement_type === 'scottish_post_16_requirements' &&
    check.qualification_type === 'scottish';
}));

const scotlandContextualCareApplicant = contextualScottishApplicant({
  admissions_tests: {
    ucat: ucat(1900)
  },
  contextual_profile: contextualProfile({
    personal_circumstances: {
      care_experienced: 'yes',
      care_over_three_months: 'yes',
      looked_after: 'yes'
    }
  })
});
const scotlandContextualCare = classifyInterviewBand(
  course,
  config,
  scotlandContextualCareApplicant
);
assert.strictEqual(scotlandContextualCare.eligibility.status, 'eligible');
assert.strictEqual(scotlandContextualCare.selection_route_id, 'scotland_contextual');
assert.strictEqual(
  scotlandContextualCare.eligibility.contextual_eligibility.status,
  'contextual'
);
assert.ok(
  scotlandContextualCare.eligibility.contextual_eligibility.activated_applicant_group_ids.includes(
    'care_experienced'
  )
);
assert.strictEqual(
  scotlandContextualCare.guidance_pool_id,
  'scottish_home_contextual_school_leaver'
);
assert.notStrictEqual(scotlandContextualCare.canonical_interview_band, 'insufficient_evidence');
assert.strictEqual(scotlandContextualCare.canonical_interview_band, 'interview_likely');
assert.strictEqual(scotlandContextualCare.ranking.raw_value, 1900);
assert.strictEqual(scotlandContextualCare.ranking.value, 2090);
assert.strictEqual(scotlandContextualCare.ranking.total_uplift_percent, 10);
assert.strictEqual(
  scotlandContextualCare.band_metric.metric,
  'contextual_adjusted_selection_ucat_total'
);

const scotlandContextualCareCard = presentClassification(
  scotlandContextualCare,
  scotlandContextualCareApplicant
);
assert.strictEqual(scotlandContextualCareCard.prediction.available, true);
assert.strictEqual(scotlandContextualCareCard.prediction.result_band, 'interview_likely');
assert.strictEqual(
  scotlandContextualCareCard.alternative_academic_offer.standard_offer,
  'AAAAB in S5 + BBB in S6 (Highers, Advanced Highers or a mixture)'
);
assert.strictEqual(
  scotlandContextualCareCard.alternative_academic_offer.alternative_offer,
  'AAABB in S5 + BB in S6 (Highers, Advanced Highers or a mixture)'
);
assert.strictEqual(
  scotlandContextualCareCard.alternative_academic_offer.alternative_offer_label,
  'Your minimum requirements'
);
assert.deepStrictEqual(
  scotlandContextualCareCard.alternative_academic_offer.conditions,
  ['Minimum entry requirements apply to eligible applicants based on their circumstances.']
);
assert.ok(!/AAAAB Scottish Highers \+ BBB Advanced Highers/.test(
  scotlandContextualCareCard.primary_explanation
));
assert.ok(!/applied contextual offer AAABB Scottish Highers/.test(
  scotlandContextualCareCard.primary_explanation
));
assert.ok(!/applied contextual offer/i.test(
  scotlandContextualCareCard.primary_explanation
));
assert.ok(/your minimum requirements AAABB in S5 \+ BB in S6/.test(
  scotlandContextualCareCard.primary_explanation
));
assert.ok(!/Step 6|structured evidence|route activated|contextual route confirmed/i.test(
  JSON.stringify(scotlandContextualCareCard)
));
assert.deepStrictEqual(scotlandContextualCareCard.contextual_confirmation, {
  collapsed_label: 'Minimum entry requirements apply',
  expanded_heading: 'Minimum entry requirements apply',
  consideration_label: null,
  expanded_body:
    "You qualify for St Andrews' minimum entry requirements. Applicants who meet the academic requirements are then ranked by UCAT for interview."
});
assert.ok(scotlandContextualCareCard.academic_requirement_checks.some((check) => {
  return check.requirement_type === 'scottish_post_16_requirements' &&
    check.label === 'Scottish Highers';
}));
assert.strictEqual(
  scotlandContextualCareCard.ucat_adjustment.label,
  'Contextual adjusted ranking UCAT'
);

console.log('St Andrews A100 four-route migration regression checks passed.');
