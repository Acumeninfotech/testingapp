#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const {
  presentResultCard
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

function hasPolicyLeak(value) {
  const text = JSON.stringify(value);
  return /compensatory_admissions_test_policy|compensable_deficiencies|maximum_compensable_deficiencies|ucat_remains_required|sjt_remains_required|manual_review_required|prediction_confidence/.test(text);
}

const course = {
  profile_id: 'generic-compensatory-a100',
  course: {
    ucas_code: 'A100'
  },
  stage_1_eligibility: {
    explicitly_blocked_applicant_group_ids: [],
    gcse: {
      minimum_count: 5,
      grade_requirements: [
        {
          requirement_id: 'gcse_english_language_minimum',
          subject_id: 'english_language',
          minimum_grade: '6'
        },
        {
          requirement_id: 'gcse_mathematics_minimum',
          subject_id: 'mathematics',
          minimum_grade: '6'
        }
      ],
      science_requirement: {
        requirement_id: 'gcse_science_minimum',
        requirement_type: 'any_of',
        minimum_options_required: 1,
        accepted_options: [
          {
            option_id: 'separate_biology_chemistry_physics',
            grade_requirements: [
              { subject_id: 'biology', minimum_grade: '6' },
              { subject_id: 'chemistry', minimum_grade: '6' },
              { subject_id: 'physics', minimum_grade: '6' }
            ]
          },
          {
            option_id: 'combined_science_double_award',
            subject_id: 'combined_science',
            minimum_grade_profile: ['6', '6'],
            counts_as_gcse_subjects: 2
          }
        ]
      }
    },
    post_16: {
      graduate: {
        compensatory_admissions_test_policy: {
          enabled: true,
          policy_type: 'graduate_standard_route_then_single_academic_deficiency_compensation',
          standard_route_evaluated_first: true,
          compensable_deficiencies: [
            'a_level_requirements_not_met',
            'gcse_science_alternative_not_met'
          ],
          maximum_compensable_deficiencies: 1,
          ucat_remains_required: true,
          sjt_remains_required: true,
          standard_route: {
            degree_requirement: {
              minimum_classification: '2_1',
              recognised_institution_required: true,
              accepted_degree_statuses: ['completed', 'achieved', 'predicted'],
              maximum_age_at_course_start_years: 5
            },
            a_level_requirement: {
              grade_profile: ['B', 'B', 'B'],
              one_of_subject_groups: [
                {
                  group_id: 'biology_or_chemistry_primary',
                  minimum_required: 1,
                  subject_ids: ['biology', 'chemistry']
                },
                {
                  group_id: 'two_designated_sciences',
                  minimum_required: 2,
                  subject_ids: [
                    'biology',
                    'chemistry',
                    'physics',
                    'mathematics',
                    'further_mathematics'
                  ]
                }
              ]
            }
          },
          compensatory_test: {
            test_id: 'gamsat',
            minimum_section_score: 50,
            section_count: 3,
            accepted_thresholds: [
              {
                threshold_id: 'overall_55_section_3_58',
                overall_minimum: 55,
                section_minimums: [{ section: 3, minimum: 58 }]
              },
              {
                threshold_id: 'overall_58_section_3_55',
                overall_minimum: 58,
                section_minimums: [{ section: 3, minimum: 55 }]
              }
            ]
          }
        }
      }
    },
    admissions_tests: {
      ucat: {
        required: true,
        minimum_total_score: 2100
      },
      sjt: {
        used_as_gate: true,
        excluded_bands: [4]
      },
      other_tests: []
    }
  },
  engine_notes: {
    do_not_infer: []
  }
};

const config = {
  schema_version: '1.0.0',
  course_profile_id: course.profile_id,
  confidence: 'low',
  evidence: {
    classification: 'synthetic_policy_regression',
    summary: 'Synthetic regression fixture for the generic graduate compensatory admissions-test policy.',
    source_ids: []
  },
  eligibility: {
    qualification_routes: {
      supported: ['graduate']
    },
    ucat: {
      required_test_year: 2026
    }
  },
  score_model: {
    type: 'ranking_metric',
    basis: 'UCAT gate only regression metric',
    metric: 'ucat_total',
    scale: { min: 900, max: 2700 }
  },
  guidance_pools: [
    {
      pool_id: 'home_graduate',
      priority: 1,
      applicant_match: {
        all_group_ids: ['home_fee', 'graduate_applicant']
      },
      metric: 'ucat_total',
      band_rules: [
        {
          band: 'realistic',
          operator: 'greater_than_or_equal',
          value: 2100
        }
      ]
    }
  ]
};

const baseApplicant = {
  profile_id: 'generic_compensatory_base',
  qualification_route: 'graduate',
  applicant_identity: {
    applicant_type: 'graduate',
    fee_status: 'Home',
    domicile: 'England',
    graduate: true,
    resit: { has_resits: false }
  },
  course_target: {
    ucas_code: 'A100'
  },
  application_year: 2026,
  gcse_profile: {
    subjects: {
      english_language: '6',
      mathematics: '6',
      biology: '6',
      chemistry: '6',
      physics: '6'
    },
    total_gcse_count: 5
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'biology', predicted_grade: 'B' },
      { subject_id: 'chemistry', predicted_grade: 'B' },
      { subject_id: 'mathematics', predicted_grade: 'B' }
    ]
  },
  graduate_profile: {
    is_graduate: true,
    degree_classification: '2_1',
    degree_status: 'completed',
    recognised_institution: true,
    degree_age_at_course_start_years: 3
  },
  admissions_tests: {
    ucat: {
      total_score: 2150,
      score_scale: 2700,
      sjt_band: 2,
      test_year: 2026
    },
    gamsat: {
      taken: false,
      overall_score: null,
      section_scores: []
    }
  }
};

const validGamsatA = {
  taken: true,
  overall_score: 55,
  section_scores: [50, 50, 58]
};
const validGamsatB = {
  taken: true,
  overall_score: 58,
  section_scores: [50, 50, 55]
};

const scenarios = [
  {
    id: 'standard_route_passes_without_gamsat',
    overrides: {},
    eligibility: 'eligible',
    band: 'realistic',
    absentFailures: ['graduate_compensatory_test_required']
  },
  {
    id: 'a_level_only_deficiency_rescued_by_gamsat',
    overrides: {
      a_level_profile: {
        subjects: [
          { subject_id: 'biology', predicted_grade: 'B' },
          { subject_id: 'chemistry', predicted_grade: 'C' },
          { subject_id: 'mathematics', predicted_grade: 'B' }
        ]
      },
      admissions_tests: { gamsat: validGamsatA }
    },
    eligibility: 'eligible',
    band: 'realistic'
  },
  {
    id: 'gcse_science_only_deficiency_rescued_by_gamsat',
    overrides: {
      gcse_profile: {
        subjects: {
          english_language: '6',
          mathematics: '6',
          biology: '6',
          chemistry: '6',
          physics: '5',
          history: '7'
        },
        total_gcse_count: 6
      },
      admissions_tests: { gamsat: validGamsatA }
    },
    eligibility: 'eligible',
    band: 'realistic'
  },
  {
    id: 'both_threshold_combinations_pass',
    overrides: {
      gcse_profile: {
        subjects: {
          english_language: '6',
          mathematics: '6',
          biology: '6',
          chemistry: '6',
          physics: '5',
          history: '7'
        },
        total_gcse_count: 6
      },
      admissions_tests: { gamsat: validGamsatB }
    },
    eligibility: 'eligible',
    band: 'realistic'
  },
  {
    id: 'both_academic_deficiencies_rejected',
    overrides: {
      gcse_profile: {
        subjects: {
          english_language: '6',
          mathematics: '6',
          biology: '6',
          chemistry: '6',
          physics: '5',
          history: '7'
        },
        total_gcse_count: 6
      },
      a_level_profile: {
        subjects: [
          { subject_id: 'biology', predicted_grade: 'B' },
          { subject_id: 'chemistry', predicted_grade: 'C' },
          { subject_id: 'mathematics', predicted_grade: 'B' }
        ]
      },
      admissions_tests: { gamsat: validGamsatA }
    },
    eligibility: 'not_eligible',
    band: 'not_eligible',
    failure: 'graduate_compensatory_test_multiple_deficiencies'
  },
  {
    id: 'degree_deficiency_rejected',
    overrides: {
      graduate_profile: {
        degree_classification: '2_2'
      },
      admissions_tests: { gamsat: validGamsatA }
    },
    eligibility: 'not_eligible',
    band: 'not_eligible',
    failure: 'graduate_degree_requirements_not_met'
  },
  {
    id: 'ucat_deficiency_rejected_even_with_gamsat',
    overrides: {
      admissions_tests: {
        ucat: { total_score: 2090 },
        gamsat: validGamsatA
      }
    },
    eligibility: 'not_eligible',
    band: 'not_eligible',
    failure: 'minimum_ucat_total_not_met'
  },
  {
    id: 'sjt_band_4_rejected_even_with_gamsat',
    overrides: {
      admissions_tests: {
        ucat: { sjt_band: 4 },
        gamsat: validGamsatA
      }
    },
    eligibility: 'not_eligible',
    band: 'not_eligible',
    failure: 'disqualifying_sjt_rule',
    eligibilityOnlyFailure: 'sjt_band_excluded'
  },
  {
    id: 'missing_gamsat_required_for_single_deficiency',
    overrides: {
      a_level_profile: {
        subjects: [
          { subject_id: 'biology', predicted_grade: 'B' },
          { subject_id: 'chemistry', predicted_grade: 'C' },
          { subject_id: 'mathematics', predicted_grade: 'B' }
        ]
      }
    },
    eligibility: 'not_eligible',
    band: 'not_eligible',
    failure: 'graduate_compensatory_test_required'
  },
  {
    id: 'invalid_gamsat_overall_fails',
    overrides: {
      a_level_profile: {
        subjects: [
          { subject_id: 'biology', predicted_grade: 'B' },
          { subject_id: 'chemistry', predicted_grade: 'C' },
          { subject_id: 'mathematics', predicted_grade: 'B' }
        ]
      },
      admissions_tests: {
        gamsat: {
          taken: true,
          overall_score: 54,
          section_scores: [50, 50, 60]
        }
      }
    },
    eligibility: 'not_eligible',
    band: 'not_eligible',
    failure: 'graduate_compensatory_test_threshold_not_met'
  },
  {
    id: 'invalid_gamsat_section_iii_fails',
    overrides: {
      a_level_profile: {
        subjects: [
          { subject_id: 'biology', predicted_grade: 'B' },
          { subject_id: 'chemistry', predicted_grade: 'C' },
          { subject_id: 'mathematics', predicted_grade: 'B' }
        ]
      },
      admissions_tests: {
        gamsat: {
          taken: true,
          overall_score: 55,
          section_scores: [50, 50, 57]
        }
      }
    },
    eligibility: 'not_eligible',
    band: 'not_eligible',
    failure: 'graduate_compensatory_test_threshold_not_met'
  },
  {
    id: 'section_below_50_fails',
    overrides: {
      a_level_profile: {
        subjects: [
          { subject_id: 'biology', predicted_grade: 'B' },
          { subject_id: 'chemistry', predicted_grade: 'C' },
          { subject_id: 'mathematics', predicted_grade: 'B' }
        ]
      },
      admissions_tests: {
        gamsat: {
          taken: true,
          overall_score: 60,
          section_scores: [49, 60, 58]
        }
      }
    },
    eligibility: 'not_eligible',
    band: 'not_eligible',
    failure: 'graduate_compensatory_test_threshold_not_met'
  }
];

for (const scenario of scenarios) {
  const applicant = merge(baseApplicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(result.eligibility.status, scenario.eligibility, scenario.id);
  assert.strictEqual(result.canonical_interview_band, scenario.band, scenario.id);
  if (scenario.failure) {
    assert.ok(result.eligibility.failures.includes(scenario.failure), scenario.id);
  }
  for (const absentFailure of scenario.absentFailures || []) {
    assert.ok(!result.eligibility.failures.includes(absentFailure), scenario.id);
  }

  const eligibilityOnly = evaluateCourseEligibility(course, applicant);
  assert.strictEqual(eligibilityOnly.status, scenario.eligibility, `${scenario.id}: eligibility-only path`);
  if (scenario.failure) {
    assert.ok(
      eligibilityOnly.failures.includes(scenario.eligibilityOnlyFailure || scenario.failure),
      `${scenario.id}: eligibility-only path`
    );
  }
}

const inactiveCourse = merge(course, {
  stage_1_eligibility: {
    post_16: {
      graduate: {
        compensatory_admissions_test_policy: {
          enabled: false
        }
      }
    }
  }
});
const inactiveResult = classifyInterviewBand(
  inactiveCourse,
  { ...config, course_profile_id: inactiveCourse.profile_id },
  merge(baseApplicant, scenarios[1].overrides)
);
assert.ok(
  !inactiveResult.eligibility.failures.some((failure) => failure.startsWith('graduate_compensatory')),
  'Policy-specific failures must be inactive unless explicitly configured.'
);

const legacyGamsatCourse = merge(course, {
  stage_1_eligibility: {
    post_16: {
      graduate: {
        compensatory_admissions_test_policy: null
      }
    },
    admissions_tests: {
      other_tests: [
        {
          test_id: 'gamsat',
          required: true
        }
      ]
    }
  }
});
const legacyGamsat = classifyInterviewBand(
  legacyGamsatCourse,
  { ...config, course_profile_id: legacyGamsatCourse.profile_id },
  merge(baseApplicant, {
    admissions_tests: {
      ucat: { total_score: null },
      gamsat: validGamsatA
    }
  })
);
assert.ok(
  !legacyGamsat.eligibility.failures.includes('required_admissions_test_missing:ucat'),
  'Existing required-GAMSAT behavior must continue to suppress UCAT unless the new policy opts into UCAT coexistence.'
);

const plymouthCourse = readJson('data/universities/plymouth-a100.json');
const plymouthConfig = readJson('data/interview-band-configs/plymouth-a100.json');
const plymouthFixture = readJson('data/fixtures/interview-band-classification/plymouth-a100.json');
const plymouthScenario = plymouthFixture.scenarios.find((scenario) => {
  return scenario.scenario_id === 'gamsat_route_cannot_enter_ucat_pool';
});
assert.ok(plymouthScenario, 'Plymouth GAMSAT manual-review fixture must exist.');
const plymouthResult = classifyInterviewBand(
  plymouthCourse,
  plymouthConfig,
  merge(plymouthFixture.base_applicant, plymouthScenario.overrides)
);
assert.strictEqual(plymouthResult.eligibility.status, 'manual_review');
assert.ok(
  plymouthResult.eligibility.manual_review_reasons.includes('qualification_route_requires_manual_review:graduate')
);

const card = presentResultCard({
  eligibilityStatus: 'not_eligible',
  interviewBand: 'not_eligible',
  transparencyContext: {
    course_profile_id: course.profile_id,
    eligibility: {
      status: 'not_eligible',
      failures: ['graduate_compensatory_test_threshold_not_met'],
      manual_review_reasons: []
    },
    eligibility_failures: ['graduate_compensatory_test_threshold_not_met'],
    applicant_context: merge(baseApplicant, scenarios[9].overrides),
    applicant_group_ids: ['home_fee', 'graduate_applicant'],
    score_model: config.score_model
  }
});
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);
assert.strictEqual(hasPolicyLeak(card), false);

console.log('Graduate compensatory admissions-test policy regression: PASS');
console.log(`Policy scenarios checked: ${scenarios.length}`);
console.log('Default inactive behavior, legacy required-GAMSAT behavior, Plymouth graduate manual-review behavior and public leakage safeguards: PASS');
