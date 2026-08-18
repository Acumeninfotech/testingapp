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

const course = readJson('data/universities/edinburgh-a100.json');
const config = readJson('data/interview-band-configs/edinburgh-a100.json');

function ucat(totalScore, sjtBand = 2) {
  return {
    total_score: totalScore,
    score_scale: 2700,
    sjt_band: sjtBand,
    subtests: {
      verbal_reasoning: totalScore,
      decision_making: 0,
      quantitative_reasoning: 0
    }
  };
}

function contextualProfile(overrides = {}) {
  return merge({
    home_area_region: {
      simd_quintile: 'q5'
    },
    financial_support: {
      ucat_bursary_recipient: 'no'
    },
    personal_circumstances: {
      care_experienced: 'no',
      care_over_three_months: 'no',
      refugee: 'no',
      uk_refugee_status_granted: 'no',
      seeking_asylum: 'no',
      asylum_seeker: 'no'
    },
    access_programmes: {
      participation_status: 'no',
      other_programmes: [],
      other_programme_name: ''
    }
  }, overrides);
}

function aLevelApplicant(overrides = {}) {
  return merge({
    profile_id: 'edinburgh_a100_contextual_migration_a_level',
    qualification_route: 'a_level',
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: 'home_fee',
      domicile: 'england',
      contextual_flags: {},
      graduate: false,
      resit: { has_resits: false, subjects_resat: [] }
    },
    gcse_profile: {
      total_gcse_count: 8,
      subjects: {
        biology: '7',
        chemistry: '7',
        english_language: '7',
        mathematics: '7'
      },
      additional_subjects: [
        { subject_id: 'history', grade: '7' },
        { subject_id: 'geography', grade: '7' },
        { subject_id: 'physics', grade: '7' },
        { subject_id: 'spanish', grade: '7' }
      ]
    },
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A' },
        { subject_id: 'biology', predicted_grade: 'A' },
        { subject_id: 'mathematics', predicted_grade: 'A' }
      ]
    },
    admissions_tests: {
      ucat: ucat(1900)
    },
    contextual_profile: contextualProfile()
  }, overrides);
}

function scottishApplicant(overrides = {}) {
  return merge({
    profile_id: 'edinburgh_a100_contextual_migration_scottish',
    qualification_route: 'scottish',
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: 'home_fee',
      domicile: 'scotland',
      contextual_flags: {},
      graduate: false,
      resit: { has_resits: false, subjects_resat: [] }
    },
    scottish_profile: {
      completed_in_one_sitting: true,
      national_5_subjects: [
        { subject_id: 'biology', grade: 'B' },
        { subject_id: 'chemistry', grade: 'B' },
        { subject_id: 'english_language', grade: 'B' }
      ],
      higher_subjects: [
        { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'physics', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'english', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'history', grade: 'B', school_year: 's5', first_attempt: true },
        { subject_id: 'applications_of_mathematics', grade: 'C', school_year: 's5', first_attempt: true }
      ],
      advanced_higher_subjects: [
        { subject_id: 'chemistry', grade: 'B', school_year: 's6', first_attempt: true },
        { subject_id: 'biology', grade: 'B', school_year: 's6', first_attempt: true }
      ]
    },
    admissions_tests: {
      ucat: ucat(1900)
    },
    contextual_profile: contextualProfile()
  }, overrides);
}

function assertNoLegacyContextualGroups(result) {
  assert.ok(!result.applicant_group_ids.includes('contextual'));
  assert.ok(!result.applicant_group_ids.includes('widening_participation'));
  assert.ok(!result.applicant_group_ids.includes('edinburgh_plus_flag'));
  assert.ok(!result.applicant_group_ids.includes('edinburgh_flag'));
}

const legacyPlusOnly = evaluateCourseEligibility(course, aLevelApplicant({
  profile_id: 'edinburgh_a100_legacy_plus_only',
  applicant_identity: {
    contextual_flags: {
      contextual: true,
      widening_participation: true,
      plus_flag: true
    }
  },
  gcse_profile: {
    subjects: {
      biology: '6',
      chemistry: '6',
      english_language: '6',
      mathematics: '6'
    }
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'mathematics', predicted_grade: 'B' }
    ]
  }
}));
assert.strictEqual(legacyPlusOnly.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(legacyPlusOnly.contextual_eligibility.academic_contextual_treatment, 'standard');
assert.strictEqual(legacyPlusOnly.status, 'not_eligible');
assert.ok(legacyPlusOnly.failures.includes('gcse_requirement_not_met:biology'));
assert.ok(legacyPlusOnly.failures.includes('a_level_requirements_not_met'));
assertNoLegacyContextualGroups(legacyPlusOnly);

const flagResult = evaluateCourseEligibility(course, aLevelApplicant({
  profile_id: 'edinburgh_a100_structured_flag',
  admissions_tests: { ucat: ucat(1850) },
  contextual_profile: contextualProfile({
    edinburgh: {
      contextual_level: 'flag',
      confirmation_status: 'confirmed'
    }
  })
}));
assert.strictEqual(flagResult.status, 'eligible');
assert.strictEqual(flagResult.contextual_eligibility.status, 'contextual');
assert.strictEqual(flagResult.contextual_eligibility.contextual_level, 'flag');
assert.strictEqual(flagResult.contextual_eligibility.academic_contextual_treatment, 'standard');
assert.strictEqual(flagResult.contextual_eligibility.adjusted_selection_ucat.adjusted_ucat, 1943);
assert.strictEqual(flagResult.scottish_medical_school_route.route_id, 'ruk_contextual');
assert.ok(flagResult.applicant_group_ids.includes('edinburgh_flag'));
assert.ok(!flagResult.applicant_group_ids.includes('edinburgh_plus_flag'));

const polar2StateSchoolFlag = evaluateCourseEligibility(course, aLevelApplicant({
  profile_id: 'edinburgh_a100_step6_polar2_state_school_flag',
  applicant_identity: {
    current_uk_residence: 'yes'
  },
  admissions_tests: { ucat: ucat(1850) },
  contextual_profile: contextualProfile({
    home_area_region: {
      polar4_quintile: 'q2'
    },
    school_education: {
      state_non_fee_paying_school: 'yes'
    }
  })
}));
assert.strictEqual(polar2StateSchoolFlag.status, 'eligible');
assert.strictEqual(polar2StateSchoolFlag.contextual_eligibility.status, 'contextual');
assert.strictEqual(polar2StateSchoolFlag.contextual_eligibility.contextual_level, 'flag');
assert.strictEqual(polar2StateSchoolFlag.contextual_eligibility.academic_contextual_treatment, 'standard');
assert.strictEqual(
  polar2StateSchoolFlag.contextual_eligibility.matched_contextual_pathway,
  'edinburgh_flag_polar2_state_school'
);
assert.strictEqual(polar2StateSchoolFlag.contextual_eligibility.adjusted_selection_ucat.adjusted_ucat, 1943);
assert.strictEqual(polar2StateSchoolFlag.scottish_medical_school_route.route_id, 'ruk_contextual');
assert.ok(polar2StateSchoolFlag.applicant_group_ids.includes('edinburgh_flag'));
assert.ok(!polar2StateSchoolFlag.applicant_group_ids.includes('edinburgh_plus_flag'));

const polar2MissingSchoolEvidence = evaluateCourseEligibility(course, aLevelApplicant({
  profile_id: 'edinburgh_a100_step6_polar2_school_evidence_missing',
  applicant_identity: {
    current_uk_residence: 'yes'
  },
  contextual_profile: contextualProfile({
    home_area_region: {
      polar4_quintile: 'q2'
    }
  })
}));
assert.strictEqual(polar2MissingSchoolEvidence.contextual_eligibility.status, 'information_needed');
assert.ok(polar2MissingSchoolEvidence.contextual_eligibility.missing_information.some((entry) => {
  return (
    entry.criterion_id === 'edinburgh_flag_polar2_state_school' &&
    entry.evidence_path === 'school_education.state_non_fee_paying_school'
  );
}));

const plusApplicant = aLevelApplicant({
  profile_id: 'edinburgh_a100_structured_plus_flag',
  admissions_tests: { ucat: ucat(1700) },
  gcse_profile: {
    subjects: {
      biology: '6',
      chemistry: '6',
      english_language: '6',
      mathematics: '6'
    }
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'mathematics', predicted_grade: 'B' }
    ]
  },
  contextual_profile: contextualProfile({
    edinburgh: {
      contextual_level: 'plus_flag',
      confirmation_status: 'confirmed'
    }
  })
});
const plusResult = classifyInterviewBand(course, config, plusApplicant);
assert.strictEqual(plusResult.eligibility.status, 'eligible');
assert.strictEqual(plusResult.eligibility.academic_pathway, 'contextual');
assert.strictEqual(plusResult.selection_route_id, 'ruk_contextual');
assert.strictEqual(plusResult.guidance_pool_id, 'ruk_contextual');
assert.strictEqual(plusResult.eligibility.contextual_eligibility.contextual_level, 'plus_flag');
assert.strictEqual(
  plusResult.eligibility.contextual_eligibility.ucat_contextual_treatment.minimum_total_score_required,
  false
);
assert.strictEqual(plusResult.eligibility.contextual_eligibility.adjusted_selection_ucat.adjusted_ucat, 1870);
assert.strictEqual(plusResult.ranking.components.ucat_decile_score.band, 3);
assert.strictEqual(plusResult.ranking.components.ucat_decile_score.value, 4.2);
assert.ok(!plusResult.eligibility.failures.includes('ucat_total_below_minimum'));

const careDerivedPlus = classifyInterviewBand(course, config, aLevelApplicant({
  profile_id: 'edinburgh_a100_step6_care_experienced_plus_flag',
  admissions_tests: { ucat: ucat(1700) },
  gcse_profile: {
    subjects: {
      biology: '6',
      chemistry: '6',
      english_language: '6',
      mathematics: '6'
    }
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'mathematics', predicted_grade: 'B' }
    ]
  },
  contextual_profile: contextualProfile({
    personal_circumstances: {
      care_experienced: 'yes'
    }
  })
}));
assert.strictEqual(careDerivedPlus.eligibility.status, 'eligible');
assert.strictEqual(careDerivedPlus.eligibility.contextual_eligibility.status, 'contextual');
assert.strictEqual(careDerivedPlus.eligibility.contextual_eligibility.contextual_level, 'plus_flag');
assert.strictEqual(
  careDerivedPlus.eligibility.contextual_eligibility.matched_contextual_pathway,
  'edinburgh_plus_flag_care_experienced'
);
assert.ok(careDerivedPlus.eligibility.applicant_group_ids.includes('edinburgh_plus_flag'));
assert.ok(!careDerivedPlus.eligibility.failures.includes('ucat_total_below_minimum'));

const validRukPlusFlagAabApplicant = aLevelApplicant({
  profile_id: 'edinburgh_a100_manual_regression_ruk_plus_flag_aab',
  admissions_tests: { ucat: ucat(2100, 1) },
  gcse_profile: {
    total_gcse_count: 8,
    subjects: {
      biology: '9',
      chemistry: '9',
      english_language: '9',
      mathematics: '9',
      physics: '9'
    },
    additional_subjects: [
      { subject_id: 'history', grade: '9' },
      { subject_id: 'geography', grade: '9' },
      { subject_id: 'spanish', grade: '9' }
    ]
  },
  a_level_profile: {
    completed_in_one_sitting: true,
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'mathematics', predicted_grade: 'B' }
    ]
  },
  contextual_profile: contextualProfile({
    personal_circumstances: {
      care_experienced: 'yes'
    }
  })
});
const validRukPlusFlagAab = classifyInterviewBand(
  course,
  config,
  validRukPlusFlagAabApplicant
);
assert.strictEqual(validRukPlusFlagAab.eligibility.status, 'eligible');
assert.strictEqual(validRukPlusFlagAab.eligibility.academic_pathway, 'contextual');
assert.strictEqual(validRukPlusFlagAab.selection_route_id, 'ruk_contextual');
assert.strictEqual(validRukPlusFlagAab.guidance_pool_id, 'ruk_contextual');
assert.strictEqual(
  validRukPlusFlagAab.eligibility.contextual_eligibility.matched_contextual_pathway,
  'edinburgh_plus_flag_care_experienced'
);
assert.strictEqual(
  validRukPlusFlagAab.eligibility.contextual_eligibility.adjusted_selection_ucat.raw_ucat,
  2100
);
assert.strictEqual(
  validRukPlusFlagAab.eligibility.contextual_eligibility.adjusted_selection_ucat.adjusted_ucat,
  2310
);
assert.strictEqual(validRukPlusFlagAab.ranking.status, 'calculated');
assert.strictEqual(validRukPlusFlagAab.ranking.components.academic_score.value, 14);
assert.strictEqual(
  validRukPlusFlagAab.ranking.components.academic_score.components.a_level.band,
  'edinburgh_plus_flag_reduced_aab'
);
assert.strictEqual(validRukPlusFlagAab.ranking.components.ucat_decile_score.band, 10);
assert.strictEqual(validRukPlusFlagAab.ranking.components.ucat_decile_score.value, 14);
assert.strictEqual(validRukPlusFlagAab.ranking.components.sjt_score.value, 6);
assert.strictEqual(validRukPlusFlagAab.ranking.value, 34);
assert.strictEqual(validRukPlusFlagAab.ranking.max, 40);
assert.strictEqual(validRukPlusFlagAab.canonical_interview_band, 'interview_likely');

const validRukPlusFlagAabPrediction = predict({
  universityIds: ['edinburgh-a100'],
  studentProfile: validRukPlusFlagAabApplicant
})[0].result_card;
assert.notStrictEqual(
  validRukPlusFlagAabPrediction.primary_user_facing_recommendation,
  'Prediction Unavailable'
);
assert.strictEqual(validRukPlusFlagAabPrediction.prediction.result_band, 'interview_likely');
assert.strictEqual(validRukPlusFlagAabPrediction.decision_transparency.score_breakdown.value, 34);
assert.strictEqual(validRukPlusFlagAabPrediction.decision_transparency.score_breakdown.max, 40);
assert.strictEqual(validRukPlusFlagAabPrediction.ucat_adjustment.label, 'Edinburgh adjusted scoring UCAT');
assert.strictEqual(validRukPlusFlagAabPrediction.ucat_adjustment.raw_ucat, 2100);
assert.strictEqual(validRukPlusFlagAabPrediction.ucat_adjustment.max_ucat, 2700);
assert.strictEqual(validRukPlusFlagAabPrediction.ucat_adjustment.adjusted_selection_ucat, 2310);
assert.doesNotMatch(
  JSON.stringify(validRukPlusFlagAabPrediction),
  /Aberdeen adjusted selection UCAT/
);

const asylumDerivedPlus = evaluateCourseEligibility(course, aLevelApplicant({
  profile_id: 'edinburgh_a100_step6_asylum_plus_flag',
  admissions_tests: { ucat: ucat(1700) },
  gcse_profile: {
    subjects: {
      biology: '6',
      chemistry: '6',
      english_language: '6',
      mathematics: '6'
    }
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'mathematics', predicted_grade: 'B' }
    ]
  },
  contextual_profile: contextualProfile({
    personal_circumstances: {
      seeking_asylum: 'yes'
    }
  })
}));
assert.strictEqual(asylumDerivedPlus.status, 'eligible');
assert.strictEqual(asylumDerivedPlus.contextual_eligibility.contextual_level, 'plus_flag');
assert.strictEqual(
  asylumDerivedPlus.contextual_eligibility.matched_contextual_pathway,
  'edinburgh_plus_flag_refugee_or_asylum'
);

const accessEdinburghDerivedPlus = evaluateCourseEligibility(course, aLevelApplicant({
  profile_id: 'edinburgh_a100_step6_access_edinburgh_plus_flag',
  admissions_tests: { ucat: ucat(1700) },
  gcse_profile: {
    subjects: {
      biology: '6',
      chemistry: '6',
      english_language: '6',
      mathematics: '6'
    }
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'mathematics', predicted_grade: 'B' }
    ]
  },
  contextual_profile: contextualProfile({
    access_programmes: {
      participation_status: 'yes',
      other_programmes: [
        {
          programme_id: 'edinburgh_access_edinburgh',
          status: 'participating'
        }
      ]
    }
  })
}));
assert.strictEqual(accessEdinburghDerivedPlus.status, 'eligible');
assert.strictEqual(accessEdinburghDerivedPlus.contextual_eligibility.contextual_level, 'plus_flag');
assert.strictEqual(
  accessEdinburghDerivedPlus.contextual_eligibility.matched_contextual_pathway,
  'edinburgh_plus_flag_access_edinburgh'
);

const accessEdinburghOffered = evaluateCourseEligibility(course, aLevelApplicant({
  profile_id: 'edinburgh_a100_step6_access_edinburgh_offered',
  contextual_profile: contextualProfile({
    access_programmes: {
      participation_status: 'yes',
      other_programmes: [
        {
          programme_id: 'edinburgh_access_edinburgh',
          status: 'offered'
        }
      ]
    }
  })
}));
assert.strictEqual(accessEdinburghOffered.contextual_eligibility.status, 'information_needed');
assert.ok(accessEdinburghOffered.contextual_eligibility.missing_information.some((entry) => {
  return entry.criterion_id === 'access_edinburgh_evidence';
}));

const legacyRefugeeOnly = evaluateCourseEligibility(course, aLevelApplicant({
  profile_id: 'edinburgh_a100_legacy_refugee_only',
  applicant_identity: {
    contextual_flags: {
      refugee: true
    }
  },
  admissions_tests: { ucat: ucat(1700) },
  gcse_profile: {
    subjects: {
      biology: '6',
      chemistry: '6',
      english_language: '6',
      mathematics: '6'
    }
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'mathematics', predicted_grade: 'B' }
    ]
  }
}));
assert.strictEqual(legacyRefugeeOnly.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(legacyRefugeeOnly.contextual_eligibility.contextual_level, null);
assert.strictEqual(legacyRefugeeOnly.status, 'not_eligible');
assertNoLegacyContextualGroups(legacyRefugeeOnly);

const bursaryResult = classifyInterviewBand(course, config, aLevelApplicant({
  profile_id: 'edinburgh_a100_ucat_bursary_only',
  admissions_tests: { ucat: ucat(1700) },
  contextual_profile: contextualProfile({
    financial_support: {
      ucat_bursary_recipient: 'yes'
    }
  })
}));
assert.strictEqual(bursaryResult.eligibility.status, 'eligible');
assert.strictEqual(bursaryResult.eligibility.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(bursaryResult.guidance_pool_id, 'ruk_standard');
assert.strictEqual(
  bursaryResult.eligibility.contextual_eligibility.ucat_contextual_treatment.treatment_id,
  'ucat_bursary_10_percent'
);
assert.strictEqual(
  bursaryResult.eligibility.contextual_eligibility.ucat_contextual_treatment.minimum_total_score_required,
  false
);
assert.strictEqual(bursaryResult.eligibility.contextual_eligibility.adjusted_selection_ucat.adjusted_ucat, 1870);
assert.strictEqual(bursaryResult.ranking.components.ucat_decile_score.band, 3);
assertNoLegacyContextualGroups(bursaryResult);

const simdBelowMinimum = evaluateCourseEligibility(course, scottishApplicant({
  profile_id: 'edinburgh_a100_simd40_below_ucat_minimum',
  admissions_tests: { ucat: ucat(1849) },
  contextual_profile: contextualProfile({
    home_area_region: {
      simd_quintile: 'q2'
    }
  })
}));
assert.strictEqual(simdBelowMinimum.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(
  simdBelowMinimum.contextual_eligibility.ucat_contextual_treatment.treatment_id,
  'simd40_10_percent'
);
assert.strictEqual(
  simdBelowMinimum.contextual_eligibility.ucat_contextual_treatment.minimum_total_score_required,
  true
);
assert.strictEqual(simdBelowMinimum.status, 'not_eligible');
assert.ok(simdBelowMinimum.failures.includes('minimum_ucat_total_not_met'));

const manualRegressionScotlandStandardApplicant = scottishApplicant({
  profile_id: 'edinburgh_a100_manual_regression_scotland_standard',
  admissions_tests: { ucat: ucat(2100, 1) },
  scottish_profile: {
    national_5_subjects: [
      { subject_id: 'biology', grade: 'B' },
      { subject_id: 'chemistry', grade: 'B' },
      { subject_id: 'english_language', grade: 'B' },
      { subject_id: 'mathematics', grade: 'B' }
    ],
    higher_subjects: [
      { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'physics', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'english', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'mathematics', grade: 'A', school_year: 's5', first_attempt: true }
    ],
    advanced_higher_subjects: [
      { subject_id: 'chemistry', grade: 'B', school_year: 's6', first_attempt: true },
      { subject_id: 'biology', grade: 'B', school_year: 's6', first_attempt: true }
    ]
  }
});
const manualRegressionScotlandStandard = classifyInterviewBand(
  course,
  config,
  manualRegressionScotlandStandardApplicant
);
assert.strictEqual(manualRegressionScotlandStandard.eligibility.status, 'eligible');
assert.strictEqual(
  manualRegressionScotlandStandard.eligibility.scottish_medical_school_route.route_id,
  'scotland_standard'
);
assert.strictEqual(manualRegressionScotlandStandard.selection_route_id, 'scotland_standard');
assert.strictEqual(manualRegressionScotlandStandard.guidance_pool_id, 'scotland_standard');
assert.strictEqual(
  manualRegressionScotlandStandard.eligibility.contextual_eligibility.status,
  'not_contextual'
);
assertNoLegacyContextualGroups(manualRegressionScotlandStandard.eligibility);
assert.strictEqual(manualRegressionScotlandStandard.ranking.status, 'calculated');
assert.strictEqual(manualRegressionScotlandStandard.ranking.components.academic_score.value, 12);
assert.strictEqual(
  manualRegressionScotlandStandard.ranking.components.academic_score.components.higher_advanced_higher.band,
  'aaaaa_bb_advanced_highers_chemistry_b_or_higher'
);
assert.strictEqual(manualRegressionScotlandStandard.ranking.components.ucat_decile_score.value, 9.8);
assert.strictEqual(manualRegressionScotlandStandard.ranking.components.sjt_score.value, 6);
assert.strictEqual(manualRegressionScotlandStandard.ranking.value, 27.8);
assert.strictEqual(manualRegressionScotlandStandard.canonical_interview_band, 'realistic');

const scottishPlus = evaluateCourseEligibility(course, scottishApplicant({
  profile_id: 'edinburgh_a100_scottish_plus_flag_n5_substitution',
  admissions_tests: { ucat: ucat(1700) },
  scottish_profile: {
    higher_subjects: [
      { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'physics', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'english', grade: 'B', school_year: 's5', first_attempt: true },
      { subject_id: 'history', grade: 'B', school_year: 's5', first_attempt: true },
      { subject_id: 'applications_of_mathematics', grade: 'C', school_year: 's5', first_attempt: true }
    ],
    advanced_higher_subjects: [
      { subject_id: 'chemistry', grade: 'C', school_year: 's6', first_attempt: true },
      { subject_id: 'biology', grade: 'C', school_year: 's6', first_attempt: true }
    ]
  },
  contextual_profile: contextualProfile({
    edinburgh: {
      contextual_level: 'plus_flag',
      confirmation_status: 'confirmed'
    }
  })
}));
assert.strictEqual(scottishPlus.status, 'eligible');
assert.strictEqual(scottishPlus.academic_pathway, 'contextual');
assert.strictEqual(scottishPlus.scottish_medical_school_route.route_id, 'scotland_contextual');
assert.ok(!scottishPlus.failures.includes('national_5_requirements_not_met'));

const prediction = predict({
  universityIds: ['edinburgh-a100'],
  studentProfile: plusApplicant
})[0].result_card;
assert.strictEqual(prediction.contextual_confirmation.collapsed_label, 'Edinburgh Plus Flag confirmed');
assert.strictEqual(prediction.alternative_academic_offer.pathway_id, 'edinburgh_a_level_plus_flag_minimum');
assert.strictEqual(prediction.ucat_adjustment.label, 'Edinburgh adjusted scoring UCAT');
assert.strictEqual(prediction.ucat_adjustment.raw_ucat, 1700);
assert.strictEqual(prediction.ucat_adjustment.adjusted_selection_ucat, 1870);
assert.match(prediction.primary_explanation, /Edinburgh Plus Flag confirmed/);

const scotlandStandardPrediction = predict({
  universityIds: ['edinburgh-a100'],
  studentProfile: manualRegressionScotlandStandardApplicant
})[0].result_card;
assert.strictEqual(scotlandStandardPrediction.prediction.result_band, 'realistic');
assert.notStrictEqual(
  scotlandStandardPrediction.primary_user_facing_recommendation,
  'Prediction Unavailable'
);
assert.doesNotMatch(scotlandStandardPrediction.primary_explanation, /insufficient/i);

const validScotlandPlusFlagReducedSqaApplicant = scottishApplicant({
  profile_id: 'edinburgh_a100_manual_regression_scotland_plus_flag_aaabb_ab',
  admissions_tests: { ucat: ucat(1800, 1) },
  scottish_profile: {
    completed_in_one_sitting: true,
    national_5_subjects: [
      { subject_id: 'biology', grade: 'B' },
      { subject_id: 'chemistry', grade: 'B' },
      { subject_id: 'english_language', grade: 'B' },
      { subject_id: 'mathematics', grade: 'B' }
    ],
    higher_subjects: [
      { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'physics', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'english', grade: 'B', school_year: 's5', first_attempt: true },
      { subject_id: 'history', grade: 'B', school_year: 's5', first_attempt: true }
    ],
    advanced_higher_subjects: [
      { subject_id: 'chemistry', grade: 'A', school_year: 's6', first_attempt: true },
      { subject_id: 'biology', grade: 'B', school_year: 's6', first_attempt: true }
    ]
  },
  contextual_profile: contextualProfile({
    home_area_region: {
      simd_quintile: 'q2'
    },
    personal_circumstances: {
      care_experienced: 'yes'
    }
  })
});
const validScotlandPlusFlagReducedSqa = classifyInterviewBand(
  course,
  config,
  validScotlandPlusFlagReducedSqaApplicant
);
assert.strictEqual(validScotlandPlusFlagReducedSqa.eligibility.status, 'eligible');
assert.strictEqual(validScotlandPlusFlagReducedSqa.eligibility.academic_pathway, 'contextual');
assert.strictEqual(validScotlandPlusFlagReducedSqa.selection_route_id, 'scotland_contextual');
assert.strictEqual(validScotlandPlusFlagReducedSqa.guidance_pool_id, 'scotland_contextual');
assert.strictEqual(
  validScotlandPlusFlagReducedSqa.eligibility.contextual_eligibility.matched_contextual_pathway,
  'edinburgh_plus_flag_care_experienced'
);
assert.strictEqual(
  validScotlandPlusFlagReducedSqa.eligibility.contextual_eligibility.ucat_contextual_treatment.treatment_id,
  'plus_flag_10_percent'
);
assert.strictEqual(
  validScotlandPlusFlagReducedSqa.eligibility.contextual_eligibility.ucat_contextual_treatment.minimum_total_score_required,
  false
);
assert.strictEqual(
  validScotlandPlusFlagReducedSqa.eligibility.contextual_eligibility.adjusted_selection_ucat.raw_ucat,
  1800
);
assert.strictEqual(
  validScotlandPlusFlagReducedSqa.eligibility.contextual_eligibility.adjusted_selection_ucat.adjusted_ucat,
  1980
);
assert.strictEqual(validScotlandPlusFlagReducedSqa.ranking.status, 'calculated');
assert.strictEqual(validScotlandPlusFlagReducedSqa.ranking.components.academic_score.value, 6);
assert.strictEqual(
  validScotlandPlusFlagReducedSqa.ranking.components.academic_score.components.higher_advanced_higher.band,
  'edinburgh_plus_flag_reduced_sqa'
);
assert.strictEqual(
  validScotlandPlusFlagReducedSqa.ranking.components.academic_score.components.higher_advanced_higher.reference_band,
  'aaaab_or_aaabb_no_advanced_highers'
);
assert.strictEqual(validScotlandPlusFlagReducedSqa.ranking.components.ucat_decile_score.value, 7);
assert.strictEqual(validScotlandPlusFlagReducedSqa.ranking.components.ucat_decile_score.band, 5);
assert.strictEqual(validScotlandPlusFlagReducedSqa.ranking.components.sjt_score.value, 6);
assert.strictEqual(validScotlandPlusFlagReducedSqa.ranking.value, 19);
assert.strictEqual(validScotlandPlusFlagReducedSqa.ranking.max, 40);
assert.strictEqual(validScotlandPlusFlagReducedSqa.canonical_interview_band, 'high_risk');

const validScotlandPlusFlagReducedSqaPrediction = predict({
  universityIds: ['edinburgh-a100'],
  studentProfile: validScotlandPlusFlagReducedSqaApplicant
})[0].result_card;
assert.notStrictEqual(
  validScotlandPlusFlagReducedSqaPrediction.primary_user_facing_recommendation,
  'Prediction Unavailable'
);
assert.strictEqual(validScotlandPlusFlagReducedSqaPrediction.prediction.result_band, 'high_risk');
assert.strictEqual(validScotlandPlusFlagReducedSqaPrediction.decision_transparency.score_breakdown.value, 19);
assert.strictEqual(validScotlandPlusFlagReducedSqaPrediction.decision_transparency.score_breakdown.max, 40);
assert.deepStrictEqual(
  validScotlandPlusFlagReducedSqaPrediction.decision_transparency.score_breakdown.checks
    .map((check) => check.summary),
  [
    '6 out of 20.',
    '7 out of 14.',
    '6 out of 6.'
  ]
);
assert.strictEqual(validScotlandPlusFlagReducedSqaPrediction.ucat_adjustment.label, 'Edinburgh adjusted scoring UCAT');
assert.strictEqual(validScotlandPlusFlagReducedSqaPrediction.ucat_adjustment.raw_ucat, 1800);
assert.strictEqual(validScotlandPlusFlagReducedSqaPrediction.ucat_adjustment.adjusted_selection_ucat, 1980);

console.log('Edinburgh A100 contextual migration regression: PASS');
