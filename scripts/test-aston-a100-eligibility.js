#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateCourseEligibility,
  groupRuleApplies
} = require('../assets/js/engine/eligibility-evaluator');

const rootDir = path.resolve(__dirname, '..');
const profile = JSON.parse(
  fs.readFileSync(
    path.join(rootDir, 'data', 'universities', 'aston-a100.json'),
    'utf8'
  )
);

const ELIGIBLE = 'eligible';
const NOT_ELIGIBLE = 'not_eligible';
const MANUAL_REVIEW = 'manual_review';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseApplicant() {
  return {
    profile_id: 'aston_acceptance_applicant',
    qualification_route: 'a_level',
    application_year: 2026,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      contextual_status_confirmed: false,
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
    gcse_profile: {
      subjects: {
        english_language: '6',
        mathematics: '6',
        biology: '6',
        chemistry: '6',
        physics: '6',
        history: '6',
        geography: '6'
      }
    },
    a_level_profile: {
      subjects: [
        {
          subject_id: 'chemistry',
          predicted_grade: 'A*',
          sitting_status: 'first_sitting',
          practical_endorsement: 'pass'
        },
        {
          subject_id: 'biology',
          predicted_grade: 'A',
          sitting_status: 'first_sitting',
          practical_endorsement: 'pass'
        },
        {
          subject_id: 'history',
          predicted_grade: 'A',
          sitting_status: 'first_sitting',
          practical_endorsement: null
        }
      ]
    },
    admissions_tests: {
      ucat: {
        total_score: 2100,
        score_scale: 2700,
        test_year: 2026,
        sjt_band: 4
      }
    },
    graduate_profile: {
      is_graduate: false
    }
  };
}

function setALevels(applicant, grades) {
  applicant.a_level_profile.subjects = Object.entries(grades).map(([subjectId, grade]) => ({
    subject_id: subjectId,
    predicted_grade: grade,
    sitting_status: 'first_sitting',
    practical_endorsement:
      ['biology', 'human_biology', 'chemistry', 'physics'].includes(subjectId)
        ? 'pass'
        : null
  }));
  return applicant;
}

function standardNational5Subjects() {
  return [
    { subject_id: 'english_language', grade: 'B' },
    { subject_id: 'mathematics', grade: 'B' },
    { subject_id: 'chemistry', grade: 'B' },
    { subject_id: 'biology', grade: 'B' },
    { subject_id: 'history', grade: 'B' },
    { subject_id: 'geography', grade: 'B' }
  ];
}

function scottishApplicant({
  domicile = 'England',
  advancedHighers = {
    chemistry: 'A',
    biology: 'A',
    mathematics: 'A'
  },
  contextual = false,
  includeGcse = true,
  includeNational5 = true,
  national5Subjects = standardNational5Subjects()
} = {}) {
  const applicant = baseApplicant();
  applicant.qualification_route = 'scottish';
  applicant.applicant_identity.domicile = domicile;
  delete applicant.a_level_profile;
  if (!includeGcse) {
    delete applicant.gcse_profile;
  }
  if (contextual) {
    applicant.contextual_profile = {
      school_education: {
        independent_school: 'no'
      },
      financial_support: {
        ucat_bursary_recipient: 'yes'
      }
    };
  }
  applicant.scottish_profile = {
    ...(includeNational5
      ? {
          national_5_subjects: national5Subjects
        }
      : {}),
    advanced_higher_subjects: Object.entries(advancedHighers).map(([subjectId, grade]) => ({
      subject_id: subjectId,
      grade
    }))
  };
  return applicant;
}

function contextualApplicant(grades) {
  const applicant = setALevels(baseApplicant(), grades);
  applicant.contextual_profile = {
    school_education: {
      state_non_fee_paying_school: 'yes'
    },
    financial_support: {
      ucat_bursary_recipient: 'yes'
    }
  };
  return applicant;
}

function internationalApplicant() {
  const applicant = baseApplicant();
  applicant.applicant_identity.fee_status = 'International';
  applicant.international_qualification = {
    equivalence_status: 'verified'
  };
  applicant.english_language_profile = {
    test: 'IELTS Academic',
    scores: {
      overall: 7,
      reading: 7,
      writing: 7,
      listening: 7,
      speaking: 7
    },
    valid_at_course_start: true
  };
  return applicant;
}

function ibApplicant() {
  const applicant = baseApplicant();
  applicant.qualification_route = 'international_baccalaureate';
  applicant.ib_profile = {
    total_points: 37,
    higher_level_subjects: [
      { subject_id: 'chemistry', grade: '7' },
      { subject_id: 'biology', grade: '6' },
      { subject_id: 'history', grade: '6' }
    ]
  };
  return applicant;
}

function btecApplicant() {
  const applicant = setALevels(baseApplicant(), {
    chemistry: 'A*',
    biology: 'A'
  });
  applicant.qualification_route = 'btec';
  applicant.btec_profile = {
    qualification: 'BTEC National Extended Diploma in Applied Science',
    subject_id: 'applied_science',
    grade: 'DDD'
  };
  return applicant;
}

function graduateApplicant(grades = {
  chemistry: 'A',
  biology: 'B',
  history: 'B'
}) {
  const applicant = setALevels(baseApplicant(), grades);
  applicant.qualification_route = 'graduate';
  applicant.applicant_identity.applicant_type = 'graduate';
  applicant.applicant_identity.graduate = true;
  applicant.graduate_profile = {
    is_graduate: true,
    degree_classification: '2:1',
    degree_subject: 'history',
    degree_status: 'completed'
  };
  return applicant;
}

function assertNoPredictionOutput(result) {
  for (const field of [
    'interview_score',
    'interview_band',
    'canonical_interview_band',
    'cutoff',
    'probability',
    'offer_prediction',
    'ranking',
    'selection_score'
  ]) {
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(result, field),
      false,
      `Eligibility result must not emit ${field}.`
    );
  }
  assert.strictEqual(result.mode, 'eligibility_only');
  assert.strictEqual(result.safeguards.eligibility_only, true);
  assert.strictEqual(result.safeguards.interview_prediction_ready, false);
  assert.strictEqual(result.safeguards.offer_prediction_scope, 'out_of_scope');
  assert.strictEqual(result.safeguards.offer_prediction_ready, undefined);
  assert.strictEqual(result.safeguards.result_card_ready, false);
  assert.deepStrictEqual(
    result.safeguards.do_not_infer,
    profile.engine_notes.do_not_infer
  );
}

const cases = [
  {
    id: 'standard_a_level_eligible',
    expected: ELIGIBLE,
    assertResult(result) {
      assert.strictEqual(result.qualification_route, 'a_level');
      assert.ok(result.applicant_group_ids.includes('england_domiciled'));
    },
    applicant: baseApplicant()
  },
  {
    id: 'scotland_domicile_a_level_uses_a_level_route',
    expected: ELIGIBLE,
    mutate(applicant) {
      applicant.applicant_identity.domicile = 'Scotland';
      return applicant;
    },
    assertResult(result) {
      assert.strictEqual(result.qualification_route, 'a_level');
      assert.ok(result.applicant_group_ids.includes('scotland_domiciled'));
      assert.ok(!result.applicant_group_ids.includes('england_domiciled'));
      assert.strictEqual(result.academic_pathway_id, 'standard_school_leaver_a_level');
    }
  },
  {
    id: 'england_domicile_scottish_advanced_highers_eligible',
    expected: ELIGIBLE,
    applicant: scottishApplicant({
      domicile: 'England',
      includeGcse: false
    }),
    assertResult(result) {
      assert.strictEqual(result.qualification_route, 'scottish');
      assert.ok(result.applicant_group_ids.includes('england_domiciled'));
      assert.ok(result.applicant_group_ids.includes('rest_of_uk'));
      assert.ok(!result.applicant_group_ids.includes('scotland_domiciled'));
      assert.strictEqual(result.academic_pathway_id, 'scottish_advanced_higher');
    }
  },
  {
    id: 'scotland_domicile_scottish_advanced_highers_eligible',
    expected: ELIGIBLE,
    applicant: scottishApplicant({
      domicile: 'Scotland',
      includeGcse: false
    }),
    assertResult(result) {
      assert.strictEqual(result.qualification_route, 'scottish');
      assert.ok(result.applicant_group_ids.includes('scotland_domiciled'));
      assert.ok(!result.applicant_group_ids.includes('rest_of_uk'));
      assert.strictEqual(result.academic_pathway_id, 'scottish_advanced_higher');
    }
  },
  {
    id: 'scottish_national_5_combined_science_counts_as_two_awards',
    expected: ELIGIBLE,
    applicant: scottishApplicant({
      domicile: 'Scotland',
      includeGcse: false,
      national5Subjects: [
        { subject_id: 'english_language', grade: 'B' },
        { subject_id: 'mathematics', grade: 'B' },
        { subject_id: 'combined_science', grade: 'B/B' },
        { subject_id: 'history', grade: 'B' },
        { subject_id: 'geography', grade: 'B' }
      ]
    }),
    assertResult(result) {
      const check = result.checks.find((entry) => entry.check_id === 'national_5_requirements');
      assert.strictEqual(check.minimum_count_met, true);
      assert.deepStrictEqual(check.failed_requirement_ids, []);
    }
  },
  {
    id: 'scottish_only_five_qualifying_national_5_awards_not_eligible',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'national_5_requirements_not_met',
    applicant: scottishApplicant({
      domicile: 'Scotland',
      includeGcse: false,
      national5Subjects: [
        { subject_id: 'english_language', grade: 'B' },
        { subject_id: 'mathematics', grade: 'B' },
        { subject_id: 'chemistry', grade: 'B' },
        { subject_id: 'biology', grade: 'B' },
        { subject_id: 'history', grade: 'B' }
      ]
    })
  },
  {
    id: 'scottish_national_5_english_below_b_not_eligible',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'national_5_requirements_not_met',
    applicant: scottishApplicant({
      domicile: 'Scotland',
      includeGcse: false,
      national5Subjects: [
        { subject_id: 'english_language', grade: 'C' },
        { subject_id: 'mathematics', grade: 'B' },
        { subject_id: 'chemistry', grade: 'B' },
        { subject_id: 'biology', grade: 'B' },
        { subject_id: 'history', grade: 'B' },
        { subject_id: 'geography', grade: 'B' }
      ]
    })
  },
  {
    id: 'scottish_national_5_mathematics_below_b_not_eligible',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'national_5_requirements_not_met',
    applicant: scottishApplicant({
      domicile: 'Scotland',
      includeGcse: false,
      national5Subjects: [
        { subject_id: 'english_language', grade: 'B' },
        { subject_id: 'mathematics', grade: 'C' },
        { subject_id: 'chemistry', grade: 'B' },
        { subject_id: 'biology', grade: 'B' },
        { subject_id: 'history', grade: 'B' },
        { subject_id: 'geography', grade: 'B' }
      ]
    })
  },
  {
    id: 'scottish_national_5_missing_science_route_not_eligible',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'national_5_requirements_not_met',
    applicant: scottishApplicant({
      domicile: 'Scotland',
      includeGcse: false,
      national5Subjects: [
        { subject_id: 'english_language', grade: 'B' },
        { subject_id: 'mathematics', grade: 'B' },
        { subject_id: 'physics', grade: 'B' },
        { subject_id: 'history', grade: 'B' },
        { subject_id: 'geography', grade: 'B' },
        { subject_id: 'modern_studies', grade: 'B' }
      ]
    })
  },
  {
    id: 'scottish_advanced_highers_below_aaa_not_eligible',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'scottish_post_16_requirements_not_met',
    applicant: scottishApplicant({
      domicile: 'Scotland',
      includeGcse: false,
      advancedHighers: {
        chemistry: 'A',
        biology: 'A',
        mathematics: 'B'
      }
    })
  },
  {
    id: 'scottish_advanced_highers_missing_chemistry_not_eligible',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'scottish_post_16_requirements_not_met',
    applicant: scottishApplicant({
      domicile: 'England',
      includeGcse: false,
      advancedHighers: {
        biology: 'A',
        mathematics: 'A',
        physics: 'A'
      }
    })
  },
  {
    id: 'scottish_advanced_highers_missing_biology_not_eligible',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'scottish_post_16_requirements_not_met',
    applicant: scottishApplicant({
      domicile: 'England',
      advancedHighers: {
        chemistry: 'A',
        mathematics: 'A',
        physics: 'A'
      }
    })
  },
  {
    id: 'scottish_contextual_aab_not_inferred',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'scottish_post_16_requirements_not_met',
    applicant: scottishApplicant({
      domicile: 'Scotland',
      contextual: true,
      advancedHighers: {
        chemistry: 'A',
        biology: 'A',
        mathematics: 'B'
      }
    }),
    assertResult(result) {
      assert.strictEqual(result.contextual_eligibility.is_contextual, true);
      assert.ok(result.applicant_group_ids.includes('contextual'));
      assert.notStrictEqual(result.academic_pathway, 'contextual');
    }
  },
  {
    id: 'national_5_equivalence_manual_review_retired',
    expected: ELIGIBLE,
    applicant: scottishApplicant({
      domicile: 'Scotland',
      includeGcse: false,
      includeNational5: true
    }),
    assertResult(result) {
      assert.strictEqual(
        result.manual_review_reasons.includes('national_5_equivalence_requires_manual_review'),
        false
      );
      assert.strictEqual(result.academic_pathway_id, 'scottish_advanced_higher');
    }
  },
  {
    id: 'a_level_a_star_outside_chemistry_biology',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'a_level_requirements_not_met',
    applicant: setALevels(baseApplicant(), {
      chemistry: 'A',
      biology: 'A',
      mathematics: 'A*'
    })
  },
  {
    id: 'missing_gcse_science_alternative',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'gcse_science_alternative_not_met',
    mutate(applicant) {
      delete applicant.gcse_profile.subjects.chemistry;
      return applicant;
    }
  },
  {
    id: 'gcse_english_below_6',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'gcse_requirement_not_met:english_language',
    mutate(applicant) {
      applicant.gcse_profile.subjects.english_language = '5';
      return applicant;
    }
  },
  {
    id: 'double_science_6_6_eligible',
    expected: ELIGIBLE,
    mutate(applicant) {
      applicant.gcse_profile.subjects = {
        english_language: '6',
        mathematics: '6',
        combined_science: '6/6',
        history: '6',
        geography: '6'
      };
      return applicant;
    }
  },
  {
    id: 'contextual_aab_with_aa_in_chemistry_biology',
    expected: ELIGIBLE,
    applicant: contextualApplicant({
      chemistry: 'A',
      biology: 'A',
      history: 'B'
    })
  },
  {
    id: 'contextual_aab_without_aa_in_chemistry_biology',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'a_level_requirements_not_met',
    applicant: contextualApplicant({
      chemistry: 'A',
      biology: 'B',
      history: 'A'
    })
  },
  {
    id: 'standard_ib_eligible',
    expected: ELIGIBLE,
    applicant: ibApplicant()
  },
  {
    id: 'wp_ib_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'wp_ib_overall_score_unknown',
    mutate(applicant) {
      applicant.contextual_profile = {
        school_education: {
          state_non_fee_paying_school: 'yes'
        },
        financial_support: {
          ucat_bursary_recipient: 'yes'
        }
      };
      return applicant;
    },
    applicant: ibApplicant()
  },
  {
    id: 'published_btec_combination_eligible',
    expected: ELIGIBLE,
    applicant: btecApplicant()
  },
  {
    id: 'published_btec_combination_biology_a_star_eligible',
    expected: ELIGIBLE,
    mutate(applicant) {
      return setALevels(applicant, {
        chemistry: 'A',
        biology: 'A*'
      });
    },
    applicant: btecApplicant()
  },
  {
    id: 'other_btec_route_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'unlisted_btec_combination',
    mutate(applicant) {
      applicant.btec_profile.grade = 'DDM';
      return applicant;
    },
    applicant: btecApplicant()
  },
  {
    id: 'graduate_route_eligible',
    expected: ELIGIBLE,
    applicant: graduateApplicant()
  },
  {
    id: 'graduate_a_outside_chemistry_biology',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'graduate_route_requirements_not_met',
    applicant: graduateApplicant({
      chemistry: 'B',
      biology: 'B',
      history: 'A'
    })
  },
  {
    id: 'resit_within_one_permitted_resit_year',
    expected: ELIGIBLE,
    mutate(applicant) {
      applicant.applicant_identity.resit = {
        has_resits: true,
        resit_year_attempt_cycles: 1,
        total_academic_years: 3,
        subjects_resat: ['chemistry', 'biology', 'history']
      };
      return applicant;
    }
  },
  {
    id: 'ambiguous_resit_sequence_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'ambiguous_resit_sequence',
    mutate(applicant) {
      applicant.applicant_identity.resit = {
        has_resits: true,
        subjects_resat: ['chemistry']
      };
      return applicant;
    }
  },
  {
    id: 'ielts_7_all_components_eligible',
    expected: ELIGIBLE,
    applicant: internationalApplicant()
  },
  {
    id: 'ielts_below_component_minimum_not_eligible',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'ielts_academic_requirements_not_met',
    mutate(applicant) {
      applicant.english_language_profile.scores.writing = 6.5;
      return applicant;
    },
    applicant: internationalApplicant()
  },
  {
    id: 'lower_gcse_english_with_ielts_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'lower_gcse_english_ielts_equivalence_conflict',
    mutate(applicant) {
      applicant.gcse_profile.subjects.english_language = '5';
      return applicant;
    },
    applicant: internationalApplicant()
  },
  {
    id: 'alternative_english_test_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'alternative_english_test_requires_review',
    mutate(applicant) {
      applicant.english_language_profile = {
        test: 'TOEFL iBT',
        scores: { overall: 110 }
      };
      return applicant;
    },
    applicant: internationalApplicant()
  },
  {
    id: 'international_ucat_only_ranking_remains_descriptive',
    expected: ELIGIBLE,
    assertResult(result) {
      assert.strictEqual(result.checks.some((check) => check.check_id === 'ucat_required'), true);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'ranking'), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'interview_probability'), false);
    },
    applicant: internationalApplicant()
  },
  {
    id: 'sjt_band_4_accepted',
    expected: ELIGIBLE,
    assertResult(result) {
      const sjt = result.checks.find((check) => check.check_id === 'sjt_policy');
      assert.strictEqual(sjt?.status, 'pass');
      assert.strictEqual(sjt?.band, 4);
      assert.strictEqual(sjt?.used_in_selection, false);
    },
    applicant: baseApplicant()
  },
  {
    id: 'foundation_applicant_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'foundation_applicant',
    mutate(applicant) {
      applicant.qualification_route = 'foundation';
      applicant.foundation_profile = { programme: 'unlisted_foundation' };
      return applicant;
    }
  },
  {
    id: 'unlisted_international_equivalence_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'unlisted_international_equivalence',
    mutate(applicant) {
      applicant.international_qualification.equivalence_status = 'unlisted';
      return applicant;
    },
    applicant: internationalApplicant()
  },
  {
    id: 'english_exemption_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'english_language_exemption_requires_review',
    mutate(applicant) {
      applicant.english_language_profile = { exemption_claimed: true };
      return applicant;
    },
    applicant: internationalApplicant()
  },
  {
    id: 'mixed_t_level_a_level_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'mixed_t_level_a_level_case',
    mutate(applicant) {
      applicant.qualification_route = 'mixed_t_level_a_level';
      applicant.t_level_profile = { grade: 'Distinction' };
      return applicant;
    }
  },
  {
    id: 'ambiguous_fee_status_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'ambiguous_fee_status',
    mutate(applicant) {
      applicant.applicant_group_ids = ['home_fee', 'international_fee'];
      applicant.english_language_profile = {
        test: 'IELTS Academic',
        scores: {
          overall: 7,
          reading: 7,
          writing: 7,
          listening: 7,
          speaking: 7
        }
      };
      return applicant;
    }
  },
  {
    id: 'post_offer_deferral_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'post_offer_deferral_requires_review',
    mutate(applicant) {
      applicant.deferred_entry_profile = {
        post_offer_deferral_request: true
      };
      return applicant;
    }
  },
  {
    id: 'unsupported_repeat_applicant_manual_review',
    expected: MANUAL_REVIEW,
    expectedManualReview: 'repeat_application_policy_not_fully_published',
    mutate(applicant) {
      applicant.repeat_application = {
        is_repeat_applicant: true,
        previous_aston_mmi_red_flag_rejection: false
      };
      return applicant;
    }
  },
  {
    id: 't_level_not_eligible',
    expected: NOT_ELIGIBLE,
    expectedFailure: 't_level_not_accepted',
    mutate(applicant) {
      applicant.qualification_route = 't_level';
      applicant.t_level_profile = { grade: 'Distinction' };
      delete applicant.a_level_profile;
      return applicant;
    }
  },
  {
    id: 'access_to_he_not_eligible',
    expected: NOT_ELIGIBLE,
    expectedFailure: 'access_to_he_not_accepted',
    mutate(applicant) {
      applicant.qualification_route = 'access_to_he';
      applicant.access_to_he_profile = { qualification: 'Access to HE Diploma' };
      delete applicant.a_level_profile;
      return applicant;
    }
  }
];

assert.strictEqual(
  groupRuleApplies(
    {
      applies_to_group_ids: ['home_fee', 'school_leaver'],
      any_group_ids: ['contextual', 'widening_participation'],
      excluded_group_ids: ['graduate_applicant']
    },
    ['home_fee', 'school_leaver', 'contextual']
  ),
  true,
  'Applicant-group matching must apply required AND, alternative OR and exclusion logic.'
);
assert.strictEqual(
  groupRuleApplies(
    {
      applies_to_group_ids: ['home_fee', 'school_leaver'],
      any_group_ids: ['contextual', 'widening_participation'],
      excluded_group_ids: ['graduate_applicant']
    },
    ['home_fee', 'school_leaver', 'graduate_applicant', 'contextual']
  ),
  false,
  'Excluded applicant groups must prevent a rule from applying.'
);

let passed = 0;
console.log('Aston A100 eligibility consumer acceptance tests');
console.log('Mode: eligibility-only; interview prediction disabled.\n');

for (const testCase of cases) {
  const applicant = clone(testCase.applicant || baseApplicant());
  const preparedApplicant = testCase.mutate ? testCase.mutate(applicant) : applicant;
  const result = evaluateCourseEligibility(profile, preparedApplicant);

  assert.strictEqual(
    result.status,
    testCase.expected,
    `${testCase.id}: expected ${testCase.expected}, received ${result.status}. ` +
      `Failures=${result.failures.join(',')}; manual=${result.manual_review_reasons.join(',')}`
  );
  if (testCase.expectedFailure) {
    assert.ok(
      result.failures.includes(testCase.expectedFailure),
      `${testCase.id}: missing expected failure ${testCase.expectedFailure}.`
    );
  }
  if (testCase.expectedManualReview) {
    assert.ok(
      result.manual_review_reasons.includes(testCase.expectedManualReview),
      `${testCase.id}: missing expected manual-review reason ${testCase.expectedManualReview}.`
    );
  }

  assertNoPredictionOutput(result);
  testCase.assertResult?.(result);
  passed += 1;
  console.log(`PASS ${testCase.id}: ${result.status}`);
}

console.log(`\nAston A100 eligibility acceptance tests passed: ${passed}/${cases.length}.`);
