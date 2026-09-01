#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  predict
} = require('../server/src/predict');

const rootDir = path.resolve(__dirname, '..');
const blockedScottishMedicalSchoolRoutes = [
  'scotland_standard',
  'scotland_contextual',
  'ruk_standard',
  'ruk_contextual'
];

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
  for (const [key, value] of Object.entries(overrides || {})) {
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

const course = readJson('data/universities/ucl-a100.json');
const config = readJson('data/interview-band-configs/ucl-a100.json');

function baseApplicant(overrides = {}) {
  return merge({
    profile_id: 'ucl_a100_cross_qualification_routing',
    application_year: 2026,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      contextual_status_confirmed: true,
      widening_participation: false,
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
    admissions_tests: {
      ucat: {
        total_score: 2400,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 800,
          decision_making: 800,
          quantitative_reasoning: 800
        },
        sjt_band: 2,
        test_year: 2026
      }
    },
    graduate_profile: {
      is_graduate: false
    }
  }, overrides);
}

function route1AdvancedHighers() {
  return [
    { subject_id: 'biology', grade: 'A*', sitting_id: '2026' },
    { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' },
    { subject_id: 'mathematics', grade: 'A', sitting_id: '2026' }
  ];
}

function route1PredictedAdvancedHighers() {
  return [
    { subject_id: 'biology', predicted_grade: 'A', sitting_id: '2026' },
    { subject_id: 'chemistry', predicted_grade: 'A', sitting_id: '2026' },
    { subject_id: 'mathematics', predicted_grade: 'A', sitting_id: '2026' }
  ];
}

function route1AchievedAdvancedHighers(grades = ['A*', 'A', 'A']) {
  return [
    { subject_id: 'biology', achieved_grade: grades[0], sitting_id: '2026' },
    { subject_id: 'chemistry', achieved_grade: grades[1], sitting_id: '2026' },
    { subject_id: 'mathematics', achieved_grade: grades[2], sitting_id: '2026' }
  ];
}

function route2AdvancedHighers() {
  return [
    { subject_id: 'biology', grade: 'A*', sitting_id: '2026' },
    { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' }
  ];
}

function route2PredictedAdvancedHighers() {
  return [
    { subject_id: 'biology', predicted_grade: 'A', sitting_id: '2026' },
    { subject_id: 'chemistry', predicted_grade: 'A', sitting_id: '2026' }
  ];
}

function route2Highers() {
  return [
    { subject_id: 'mathematics', grade: 'A', sitting_id: '2025' },
    { subject_id: 'english', grade: 'A', sitting_id: '2025' },
    { subject_id: 'history', grade: 'A', sitting_id: '2025' }
  ];
}

function scottishApplicant(overrides = {}) {
  const applicant = baseApplicant({
    qualification_route: 'scottish',
    scottish_profile: {
      national_5_subjects: [],
      higher_subjects: [],
      advanced_higher_subjects: route1AdvancedHighers()
    }
  });
  return merge(applicant, overrides);
}

function scottishRoute2Applicant(overrides = {}) {
  return scottishApplicant(merge({
    scottish_profile: {
      national_5_subjects: [],
      higher_subjects: route2Highers(),
      advanced_higher_subjects: route2AdvancedHighers()
    }
  }, overrides));
}

function aLevelApplicant(overrides = {}) {
  const applicant = baseApplicant({
    qualification_route: 'a_level',
    gcse_profile: {
      subjects: {
        english_language: '6',
        mathematics: '6'
      },
      additional_subjects: [],
      total_gcse_count: 2
    },
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: [
        {
          subject_id: 'biology',
          predicted_grade: 'A*',
          sitting_status: 'first_sitting',
          practical_endorsement: 'pass'
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
  return merge(applicant, overrides);
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function predictUcl(applicant) {
  const [result] = predict({
    universityIds: ['ucl-a100'],
    studentProfile: applicant
  });
  return result.result_card;
}

function assertNoScottishMedicalSchoolRoute(value, message) {
  assert.ok(
    !blockedScottishMedicalSchoolRoutes.includes(value),
    message || `Unexpected Scottish medical-school route: ${value}`
  );
}

function assertNoScottishMedicalSchoolRouteInCard(card) {
  assert.doesNotMatch(
    JSON.stringify(card),
    /scotland_standard|scotland_contextual|ruk_standard|ruk_contextual/,
    'Result Card must not present a Scotland/RUK medical-school route.'
  );
}

function assertEligible(applicant, {
  expectedQualificationRoute,
  expectedPoolId,
  expectedPathwayId
}) {
  const classification = classify(applicant);
  assert.strictEqual(
    classification.eligibility.status,
    'eligible',
    `Expected eligible; received ${JSON.stringify(classification.eligibility)}`
  );
  assert.strictEqual(classification.eligibility.qualification_route, expectedQualificationRoute);
  assert.strictEqual(classification.guidance_pool_id, expectedPoolId);
  assert.strictEqual(classification.eligibility.academic_pathway_id, expectedPathwayId);
  assert.ok(classification.applicant_group_ids.includes('home_fee'));
  assert.notStrictEqual(classification.canonical_interview_band, 'not_eligible');
  assert.strictEqual(classification.ranking?.value, 2400);
  assert.strictEqual(classification.band_metric?.metric, 'ucat_total');
  assertNoScottishMedicalSchoolRoute(classification.selection_route_id);

  const card = predictUcl(applicant);
  assert.notStrictEqual(card.recommendation_display_state, 'not_eligible');
  assert.notStrictEqual(card.prediction.result_band, 'not_eligible');
  assert.strictEqual(card.prediction.ranking_metric, 'ucat_total');
  assert.strictEqual(card.academic_pathway_id, expectedPathwayId);
  assertNoScottishMedicalSchoolRouteInCard(card);

  if (expectedQualificationRoute === 'scottish') {
    assert.ok(
      card.academic_requirement_checks.some((check) => {
        return check.qualification_type === 'scottish' &&
          check.requirement_type === 'scottish_post_16_requirements' &&
          check.status === 'met';
      }),
      'Expected Result Card to expose a met Scottish post-16 requirement.'
    );
  }

  return { classification, card };
}

function assertScottishEligible(applicant, expectedPathwayId, expectedPoolId = 'home_a100') {
  return assertEligible(applicant, {
    expectedQualificationRoute: 'scottish',
    expectedPoolId,
    expectedPathwayId
  });
}

function assertNotEligible(applicant, expectedFailure) {
  const classification = classify(applicant);
  assert.strictEqual(classification.eligibility.status, 'not_eligible');
  assert.strictEqual(classification.canonical_interview_band, 'not_eligible');
  assert.ok(
    classification.eligibility.failures.includes(expectedFailure),
    `Expected ${expectedFailure}; received ${classification.eligibility.failures.join(', ')}`
  );

  const check = classification.eligibility.checks.find(
    (candidate) => candidate.check_id === 'scottish_post_16_requirements'
  );
  assert.ok(check, 'Expected Scottish post-16 eligibility check.');
  assert.strictEqual(check.status, 'fail');

  const card = predictUcl(applicant);
  assert.strictEqual(card.recommendation_display_state, 'not_eligible');
  assert.strictEqual(card.prediction.result_band, 'not_eligible');
  assertNoScottishMedicalSchoolRouteInCard(card);
}

function assertUclPredictedA1ManualReview(applicant, expectedPathwayId, expectedRequiredProfile) {
  const reason = 'ucl_scottish_predicted_a1_confirmation_required';
  const expectedExplanation =
    `Manual review required: You meet the assessable Scottish Advanced Higher requirements. UCL requires ${expectedRequiredProfile}, but the A1 element cannot be confirmed from predicted grades in ApplySmart. Manual confirmation of the A1 requirement is therefore required.`;
  const classification = classify(applicant);
  assert.strictEqual(
    classification.eligibility.status,
    'manual_review',
    `Expected manual review; received ${JSON.stringify(classification.eligibility)}`
  );
  assert.ok(classification.eligibility.manual_review_reasons.includes(reason));
  assert.strictEqual(classification.eligibility.academic_pathway_id, expectedPathwayId);
  assert.strictEqual(classification.eligibility.qualification_route, 'scottish');
  assert.strictEqual(classification.guidance_pool_id, 'home_a100');
  assert.strictEqual(classification.ranking?.value, 2400);
  assert.strictEqual(classification.band_metric?.metric, 'ucat_total');
  assert.notStrictEqual(classification.canonical_interview_band, 'not_eligible');
  assertNoScottishMedicalSchoolRoute(classification.selection_route_id);

  const card = predictUcl(applicant);
  assert.strictEqual(card.recommendation_display_state, 'manual_review');
  assert.strictEqual(card.primary_user_facing_recommendation, 'Information Needed / Manual Review');
  assert.strictEqual(
    card.primary_explanation,
    expectedExplanation
  );
  assert.strictEqual(
    card.selection_approach_display,
    "Academic eligibility is pending manual confirmation of UCL's A1 Advanced Higher requirement. If confirmed, UCL ranks applicants in the relevant applicant pool using UCAT cognitive total, with SJT used only as a tie-break."
  );
  assert.strictEqual(card.prediction.ranking_metric, 'ucat_total');
  assert.strictEqual(card.academic_pathway_id, expectedPathwayId);
  assert.ok(
    card.academic_requirement_checks.some((check) => {
      return check.qualification_type === 'scottish' &&
        check.requirement_type === 'scottish_post_16_requirements' &&
        check.status === 'information_needed';
    }),
    'Expected Scottish post-16 requirement to require information, not fail.'
  );
  assert.ok(
    !card.academic_requirement_checks.some((check) => {
      return check.qualification_type === 'scottish' &&
        check.requirement_type === 'scottish_post_16_requirements' &&
        check.status === 'not_met';
    }),
    'Predicted A1 confirmation gap must not render a failed Scottish post-16 badge.'
  );
  assertNoScottishMedicalSchoolRouteInCard(card);

  return { classification, card };
}

const tests = [
  {
    id: 'configuration_routes_scottish_through_shared_course_eligibility',
    run() {
      assert.deepStrictEqual(
        config.eligibility.use_course_eligibility_for_qualification_routes,
        ['scottish']
      );
      assert.strictEqual(course.stage_1_eligibility.national_5, undefined);
      assert.strictEqual(course.stage_1_eligibility.gcse.minimum_count, null);
      assert.deepStrictEqual(
        course.stage_1_eligibility.gcse.grade_requirements.map((requirement) => {
          return requirement.qualification_level;
        }),
        ['gcse_or_equivalent', 'gcse_or_equivalent']
      );

      const scottishRequirements =
        course.stage_1_eligibility.post_16.scottish.grade_requirements;
      assert.strictEqual(scottishRequirements.length, 2);
      assert.strictEqual(
        scottishRequirements[0].route_id,
        'ucl_scottish_advanced_highers_a1aa_biology_chemistry'
      );
      assert.strictEqual(
        scottishRequirements[1].route_id,
        'ucl_scottish_two_advanced_highers_plus_highers'
      );
    }
  },
  {
    id: 'england_domicile_valid_scottish_route_1_uses_home_pool',
    run() {
      const { classification } = assertScottishEligible(
        scottishApplicant(),
        'ucl_scottish_advanced_highers_a1aa_biology_chemistry'
      );
      assert.ok(classification.applicant_group_ids.includes('england_domiciled'));
      assert.ok(!classification.applicant_group_ids.includes('scotland_domiciled'));
    }
  },
  {
    id: 'route_1_predicted_aaa_biology_chemistry_requires_a1_manual_review',
    run() {
      assertUclPredictedA1ManualReview(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: [],
            higher_subjects: [],
            advanced_higher_subjects: route1PredictedAdvancedHighers()
          }
        }),
        'ucl_scottish_advanced_highers_a1aa_biology_chemistry',
        'A1, A, A'
      );
    }
  },
  {
    id: 'route_1_predicted_aab_remains_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'biology', predicted_grade: 'A', sitting_id: '2026' },
              { subject_id: 'chemistry', predicted_grade: 'A', sitting_id: '2026' },
              { subject_id: 'mathematics', predicted_grade: 'B', sitting_id: '2026' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  },
  {
    id: 'route_1_achieved_aaa_without_a1_remains_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: route1AchievedAdvancedHighers(['A', 'A', 'A'])
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  },
  {
    id: 'scotland_domicile_valid_scottish_route_1_uses_home_pool',
    run() {
      const { classification } = assertScottishEligible(
        scottishApplicant({
          applicant_identity: {
            domicile: 'Scotland'
          }
        }),
        'ucl_scottish_advanced_highers_a1aa_biology_chemistry'
      );
      assert.ok(classification.applicant_group_ids.includes('scotland_domiciled'));
      assert.ok(!classification.applicant_group_ids.includes('international_fee'));
    }
  },
  {
    id: 'england_domicile_valid_scottish_route_2_uses_home_pool',
    run() {
      const { classification } = assertScottishEligible(
        scottishRoute2Applicant(),
        'ucl_scottish_two_advanced_highers_plus_highers'
      );
      assert.ok(classification.applicant_group_ids.includes('england_domiciled'));
      assert.ok(!classification.applicant_group_ids.includes('scotland_domiciled'));
    }
  },
  {
    id: 'route_2_predicted_aa_plus_highers_aaa_requires_a1_manual_review',
    run() {
      assertUclPredictedA1ManualReview(
        scottishRoute2Applicant({
          scottish_profile: {
            national_5_subjects: [],
            higher_subjects: route2Highers(),
            advanced_higher_subjects: route2PredictedAdvancedHighers()
          }
        }),
        'ucl_scottish_two_advanced_highers_plus_highers',
        'A1, A at Advanced Higher plus Highers AAA'
      );
    }
  },
  {
    id: 'scotland_domicile_valid_scottish_route_2_uses_home_pool',
    run() {
      const { classification } = assertScottishEligible(
        scottishRoute2Applicant({
          applicant_identity: {
            domicile: 'Scotland'
          }
        }),
        'ucl_scottish_two_advanced_highers_plus_highers'
      );
      assert.ok(classification.applicant_group_ids.includes('scotland_domiciled'));
      assert.ok(!classification.applicant_group_ids.includes('international_fee'));
    }
  },
  {
    id: 'international_fee_valid_scottish_route_1_uses_overseas_pool',
    run() {
      const applicant = scottishApplicant({
        applicant_identity: {
          fee_status: 'International',
          domicile: 'International',
          english_language_exempt: true
        }
      });
      const classification = classify(applicant);
      assert.strictEqual(classification.eligibility.status, 'eligible');
      assert.strictEqual(classification.eligibility.qualification_route, 'scottish');
      assert.strictEqual(
        classification.eligibility.academic_pathway_id,
        'ucl_scottish_advanced_highers_a1aa_biology_chemistry'
      );
      assert.strictEqual(classification.guidance_pool_id, 'overseas_a100');
      assert.ok(classification.applicant_group_ids.includes('international_fee'));
      assert.ok(!classification.applicant_group_ids.includes('home_fee'));
      assertNoScottishMedicalSchoolRoute(classification.selection_route_id);

      const card = predictUcl(applicant);
      assert.notStrictEqual(card.recommendation_display_state, 'not_eligible');
      assert.strictEqual(card.prediction.ranking_metric, 'ucat_total');
      assert.strictEqual(card.academic_pathway_id, 'ucl_scottish_advanced_highers_a1aa_biology_chemistry');
      assertNoScottishMedicalSchoolRouteInCard(card);
    }
  },
  {
    id: 'england_domicile_valid_a_levels_remain_a_level_route',
    run() {
      const { classification } = assertEligible(aLevelApplicant(), {
        expectedQualificationRoute: 'a_level',
        expectedPoolId: 'home_a100',
        expectedPathwayId: 'ucl_standard_a_level_astar_aa_biology_chemistry'
      });
      assert.ok(classification.applicant_group_ids.includes('england_domiciled'));
      assert.ok(!classification.applicant_group_ids.includes('scotland_domiciled'));
    }
  },
  {
    id: 'scotland_domicile_valid_a_levels_remain_a_level_route',
    run() {
      const { classification } = assertEligible(
        aLevelApplicant({
          applicant_identity: {
            domicile: 'Scotland'
          }
        }),
        {
          expectedQualificationRoute: 'a_level',
          expectedPoolId: 'home_a100',
          expectedPathwayId: 'ucl_standard_a_level_astar_aa_biology_chemistry'
        }
      );
      assert.ok(classification.applicant_group_ids.includes('scotland_domiciled'));
      assert.ok(!classification.eligibility.checks.some((check) => {
        return check.check_id === 'scottish_post_16_requirements';
      }));
    }
  },
  {
    id: 'route_1_advanced_higher_profile_below_astar_aa_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'biology', grade: 'A', sitting_id: '2026' },
              { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' },
              { subject_id: 'mathematics', grade: 'B', sitting_id: '2026' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  },
  {
    id: 'route_1_missing_advanced_higher_biology_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'chemistry', grade: 'A*', sitting_id: '2026' },
              { subject_id: 'mathematics', grade: 'A', sitting_id: '2026' },
              { subject_id: 'physics', grade: 'A', sitting_id: '2026' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  },
  {
    id: 'route_1_missing_advanced_higher_chemistry_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'biology', grade: 'A*', sitting_id: '2026' },
              { subject_id: 'mathematics', grade: 'A', sitting_id: '2026' },
              { subject_id: 'physics', grade: 'A', sitting_id: '2026' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  },
  {
    id: 'route_1_astar_not_in_biology_or_chemistry_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'biology', grade: 'A', sitting_id: '2026' },
              { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' },
              { subject_id: 'mathematics', grade: 'A*', sitting_id: '2026' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  },
  {
    id: 'route_2_advanced_higher_profile_below_astar_a_not_eligible',
    run() {
      assertNotEligible(
        scottishRoute2Applicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'biology', grade: 'A', sitting_id: '2026' },
              { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  },
  {
    id: 'route_2_missing_advanced_higher_biology_not_eligible',
    run() {
      assertNotEligible(
        scottishRoute2Applicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'chemistry', grade: 'A*', sitting_id: '2026' },
              { subject_id: 'mathematics', grade: 'A', sitting_id: '2026' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  },
  {
    id: 'route_2_missing_advanced_higher_chemistry_not_eligible',
    run() {
      assertNotEligible(
        scottishRoute2Applicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'biology', grade: 'A*', sitting_id: '2026' },
              { subject_id: 'mathematics', grade: 'A', sitting_id: '2026' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  },
  {
    id: 'route_2_higher_profile_below_aaa_not_eligible',
    run() {
      assertNotEligible(
        scottishRoute2Applicant({
          scottish_profile: {
            higher_subjects: [
              { subject_id: 'mathematics', grade: 'A', sitting_id: '2025' },
              { subject_id: 'english', grade: 'A', sitting_id: '2025' },
              { subject_id: 'history', grade: 'B', sitting_id: '2025' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  },
  {
    id: 'generic_contextual_evidence_does_not_create_access_ucl_pool',
    run() {
      const { classification } = assertScottishEligible(
        scottishApplicant({
          applicant_identity: {
            contextual: true,
            contextual_status_confirmed: false,
            widening_participation: true,
            contextual_flags: {}
          }
        }),
        'ucl_scottish_advanced_highers_a1aa_biology_chemistry',
        'home_a100'
      );
      assert.ok(!classification.applicant_group_ids.includes('access_ucl_confirmed'));
    }
  },
  {
    id: 'step6_access_ucl_scottish_applicant_uses_existing_access_pool',
    run() {
      const { classification } = assertScottishEligible(
        scottishApplicant({
          applicant_identity: {
            contextual: false,
            contextual_status_confirmed: false,
            widening_participation: false,
            contextual_flags: {}
          },
          applicant_group_ids: [],
          contextual_profile: {
            school_education: {
              state_non_fee_paying_school: 'yes',
              current_or_most_recent_uk_school_independent_fee_paying: 'no',
              attended_uk_school_or_college_for_post16_or_equivalent: 'yes'
            },
            home_area_region: {
              imd_quintile: 'q1',
              tundra_quintile: 'q5',
              polar4_quintile: 'q5'
            },
            financial_support: {
              free_school_meals: 'no',
              free_school_meals_at_level3_completion: 'no'
            },
            personal_circumstances: {
              care_experienced: 'no',
              care_over_three_months: 'no',
              estranged_from_family: 'no'
            }
          }
        }),
        'ucl_scottish_advanced_highers_a1aa_biology_chemistry',
        'access_ucl_a100'
      );
      assert.ok(classification.applicant_group_ids.includes('access_ucl_confirmed'));
    }
  },
  {
    id: 'sjt_band_4_remains_tiebreaker_only_for_scottish_route',
    run() {
      const { classification, card } = assertScottishEligible(
        scottishApplicant({
          admissions_tests: {
            ucat: {
              sjt_band: 4
            }
          }
        }),
        'ucl_scottish_advanced_highers_a1aa_biology_chemistry'
      );
      assert.strictEqual(classification.eligibility.status, 'eligible');
      assert.strictEqual(card.decision_transparency.ucat_comparison.sjt_outcome, 'ignored');
    }
  }
];

for (const test of tests) {
  test.run();
}

console.log(`UCL A100 Scottish production routing regression: PASS (${tests.length} cases)`);
