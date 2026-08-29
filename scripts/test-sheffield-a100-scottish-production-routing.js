#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  evaluateContextualEligibility
} = require('../assets/js/engine/eligibility-evaluator');
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

function merge(base, overrides = {}) {
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

const course = readJson('data/universities/sheffield-a100.json');
const config = readJson('data/interview-band-configs/sheffield-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/sheffield-a100.json');

function validGcseProfile() {
  return {
    subjects: {
      english_language: '7',
      mathematics: '7',
      biology: '7',
      chemistry: '7',
      physics: '7'
    },
    additional_subjects: [],
    total_gcse_count: 5
  };
}

function contextualProfile(overrides = {}) {
  return merge({
    home_area_region: {
      imd_quintile: 'q1'
    }
  }, overrides);
}

function validHigherSubjects(grades = ['A', 'A', 'A', 'B', 'B']) {
  return [
    { subject_id: 'english', grade: grades[0] },
    { subject_id: 'mathematics', grade: grades[1] },
    { subject_id: 'biology', grade: grades[2] },
    { subject_id: 'chemistry', grade: grades[3] },
    { subject_id: 'history', grade: grades[4] }
  ];
}

function validAdvancedHigherSubjects(grades = ['A', 'A'], subjects = ['biology', 'chemistry']) {
  return subjects.map((subjectId, index) => ({
    subject_id: subjectId,
    grade: grades[index]
  }));
}

function baseApplicant(overrides = {}) {
  return merge(merge(fixture.base_applicant, {
    applicant_identity: {
      contextual: false,
      widening_participation: false,
      contextual_flags: {},
      contextual_status_confirmed: true
    },
    admissions_tests: {
      ucat: {
        total_score: 2200
      }
    },
    contextual_profile: {}
  }), overrides);
}

function aLevelApplicant(overrides = {}) {
  const applicant = baseApplicant({
    qualification_route: 'a_level',
    gcse_profile: validGcseProfile(),
    a_level_profile: {
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A' }
      ],
      sitting_status: 'first_sitting'
    }
  });
  return merge(applicant, overrides);
}

function scottishApplicant(overrides = {}) {
  const applicant = baseApplicant({
    qualification_route: 'scottish',
    scottish_profile: {
      higher_subjects: validHigherSubjects(),
      advanced_higher_subjects: validAdvancedHigherSubjects()
    }
  });
  delete applicant.gcse_profile;
  delete applicant.a_level_profile;
  return merge(applicant, overrides);
}

function predictSheffield(applicant) {
  const [result] = predict({
    universityIds: ['sheffield-a100'],
    studentProfile: applicant
  });
  return result.result_card;
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function assertHomeEligible(applicant, expectedQualificationRoute, expectedPathwayId = null) {
  const classification = classify(applicant);
  assert.strictEqual(
    classification.eligibility.status,
    'eligible',
    `Expected eligible; received ${JSON.stringify(classification.eligibility)}`
  );
  assert.strictEqual(classification.eligibility.qualification_route, expectedQualificationRoute);
  assert.strictEqual(classification.guidance_pool_id, 'home_a100');
  assert.ok(classification.applicant_group_ids.includes('home_fee'));
  assert.ok(
    ![
      'scotland_standard',
      'scotland_contextual',
      'ruk_standard',
      'ruk_contextual'
    ].includes(classification.selection_route_id),
    'Sheffield must not resolve a Scotland/RUK medical-school selection route.'
  );

  const card = predictSheffield(applicant);
  assert.notStrictEqual(card.recommendation_display_state, 'not_eligible');
  assert.notStrictEqual(card.prediction.result_band, 'not_eligible');
  assert.strictEqual(card.prediction.guidance_pool_id, 'home_a100');

  if (expectedPathwayId) {
    assert.strictEqual(classification.eligibility.academic_pathway_id, expectedPathwayId);
    assert.strictEqual(card.academic_pathway_id, expectedPathwayId);
  }

  return classification;
}

function assertScottishNotEligible(applicant, message) {
  const classification = classify(applicant);
  assert.strictEqual(classification.eligibility.qualification_route, 'scottish');
  assert.strictEqual(classification.eligibility.status, 'not_eligible', message);
  assert.ok(
    classification.eligibility.failures.includes('scottish_post_16_requirements_not_met'),
    `Expected Scottish academic failure; received ${classification.eligibility.failures.join(', ')}`
  );
  assert.ok(
    !classification.eligibility.failures.includes('qualification_route_explicitly_blocked:scottish'),
    'Scottish route must fail through academic eligibility, not explicit route blocking.'
  );
  const check = classification.eligibility.checks.find((candidate) => {
    return candidate.check_id === 'scottish_post_16_requirements';
  });
  assert.ok(check, 'Expected Scottish post-16 check.');
  assert.strictEqual(check.status, 'fail');
}

function assertNoAccessMedicineBypass(classification) {
  assert.ok(!classification.applicant_group_ids.includes('sheffield_access_to_sheffield_medicine'));
  assert.notStrictEqual(classification.guidance_pool_id, 'access_to_sheffield_medicine');
}

const tests = [
  {
    id: 'configuration_routes_scottish_through_shared_course_eligibility',
    run() {
      assert.deepStrictEqual(
        config.eligibility.qualification_routes.supported,
        [
          'a_level',
          'international_baccalaureate',
          'international_qualification',
          'scottish'
        ]
      );
      assert.ok(!config.eligibility.qualification_routes.explicitly_blocked.includes('scottish'));
      assert.deepStrictEqual(
        config.eligibility.use_course_eligibility_for_qualification_routes,
        ['scottish']
      );
      const requirements = course.stage_1_eligibility.post_16.scottish.grade_requirements;
      assert.strictEqual(course.stage_1_eligibility.post_16.scottish.route_implemented, true);
      assert.strictEqual(course.stage_1_eligibility.post_16.scottish.contextual_route_implemented, true);
      assert.strictEqual(requirements.length, 2);
      assert.strictEqual(
        requirements[0].qualification_level,
        'scottish_highers_and_advanced_highers'
      );
    }
  },
  {
    id: 'four_domicile_and_qualification_combinations_use_home_pool',
    run() {
      assertHomeEligible(aLevelApplicant(), 'a_level');
      const scotlandALevel = assertHomeEligible(
        aLevelApplicant({
          applicant_identity: {
            domicile: 'Scotland'
          }
        }),
        'a_level'
      );
      assert.ok(scotlandALevel.applicant_group_ids.includes('scotland_domiciled'));

      const englandScottish = assertHomeEligible(
        scottishApplicant(),
        'scottish',
        'sheffield_scottish_standard_highers_and_advanced_highers'
      );
      assert.ok(!englandScottish.applicant_group_ids.includes('scotland_domiciled'));

      const scotlandScottish = assertHomeEligible(
        scottishApplicant({
          applicant_identity: {
            domicile: 'Scotland'
          }
        }),
        'scottish',
        'sheffield_scottish_standard_highers_and_advanced_highers'
      );
      assert.ok(scotlandScottish.applicant_group_ids.includes('scotland_domiciled'));
    }
  },
  {
    id: 'scottish_standard_regressions',
    run() {
      assertHomeEligible(
        scottishApplicant(),
        'scottish',
        'sheffield_scottish_standard_highers_and_advanced_highers'
      );
      assertScottishNotEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: validHigherSubjects(['A', 'A', 'B', 'B', 'B'])
          }
        }),
        'Highers below AAABB must fail.'
      );
      assertScottishNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: validAdvancedHigherSubjects(['A', 'B'])
          }
        }),
        'Advanced Highers below AA must fail on the standard route.'
      );
      assertScottishNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: validAdvancedHigherSubjects(['A', 'A'], ['mathematics', 'physics'])
          }
        }),
        'Advanced Highers without Chemistry or Biology must fail.'
      );
      assertScottishNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: validAdvancedHigherSubjects(['A', 'A'], ['biology', 'english'])
          }
        }),
        'A primary science without an accepted second science must fail.'
      );
    }
  },
  {
    id: 'scottish_contextual_regressions',
    run() {
      assertHomeEligible(
        scottishApplicant({
          contextual_profile: contextualProfile(),
          scottish_profile: {
            higher_subjects: validHigherSubjects(['A', 'A', 'B', 'B', 'B']),
            advanced_higher_subjects: validAdvancedHigherSubjects(['A', 'B'], ['biology', 'chemistry'])
          }
        }),
        'scottish',
        'sheffield_scottish_contextual_highers_and_advanced_highers'
      );
      assertScottishNotEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: validHigherSubjects(['A', 'A', 'B', 'B', 'B']),
            advanced_higher_subjects: validAdvancedHigherSubjects(['A', 'B'], ['biology', 'chemistry'])
          }
        }),
        'Reduced Scottish grades without Step 6 contextual evidence must fail.'
      );
      assertScottishNotEligible(
        scottishApplicant({
          contextual_profile: contextualProfile(),
          scottish_profile: {
            higher_subjects: validHigherSubjects(['A', 'A', 'B', 'B', 'B']),
            advanced_higher_subjects: validAdvancedHigherSubjects(['B', 'A'], ['biology', 'mathematics'])
          }
        }),
        'Contextual route must still require Chemistry or Biology at A.'
      );
    }
  },
  {
    id: 'legacy_contextual_fields_do_not_poison_sheffield_aab_route',
    run() {
      const legacyCases = [
        { applicant_identity: { contextual: true } },
        { applicant_identity: { widening_participation: true } },
        { applicant_identity: { contextual_flags: { imd_quintile: 'q1' } } },
        { applicant_identity: { contextual_flags: { care_experienced: true } } },
        { applicant_identity: { contextual_flags: { refugee: true } } }
      ];

      for (const legacyOverride of legacyCases) {
        const classification = classify(aLevelApplicant(merge({
          a_level_profile: {
            subjects: [
              { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
              { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
              { subject_id: 'mathematics', predicted_grade: 'B' }
            ]
          }
        }, legacyOverride)));
        assert.strictEqual(classification.eligibility.status, 'not_eligible');
        assert.ok(classification.eligibility.failures.includes('a_level_requirements_not_met'));
        assert.ok(!classification.applicant_group_ids.includes('sheffield_contextual_offer'));
        assertNoAccessMedicineBypass(classification);
      }

      const structured = assertHomeEligible(
        aLevelApplicant({
          contextual_profile: contextualProfile(),
          a_level_profile: {
            subjects: [
              { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
              { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
              { subject_id: 'mathematics', predicted_grade: 'B' }
            ]
          }
        }),
        'a_level'
      );
      assert.ok(structured.applicant_group_ids.includes('sheffield_contextual_offer'));
      assertNoAccessMedicineBypass(structured);
    }
  },
  {
    id: 'frontend_shaped_fsm_contextual_a_level_remains_standard_aaa',
    run() {
      const applicant = aLevelApplicant({
        applicant_identity: {
          fee_status: 'home_fee',
          domicile: 'england',
          contextual: false,
          contextual_flags: {
            care_experienced: false,
            free_school_meals: false
          }
        },
        contextual_profile: {
          financial_support: {
            free_school_meals: 'yes'
          }
        },
        a_level_profile: {
          subjects: [
            { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
            { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
            { subject_id: 'mathematics', predicted_grade: 'A' }
          ],
          sitting_status: 'first_sitting',
          completed_in_one_sitting: true,
          epq: {
            status: 'not_taken',
            grade: null,
            taken_alongside_a_levels: null
          }
        },
        admissions_tests: {
          ucat: {
            total_score: 2280,
            score_scale: 2700,
            subtests: {
              verbal_reasoning: 760,
              decision_making: 760,
              quantitative_reasoning: 760
            },
            sjt_band: 2,
            test_year: 2026
          }
        }
      });
      const contextual = evaluateContextualEligibility(course, applicant);
      const classification = classify(applicant);
      const fsmCriterion = contextual.qualifying_criteria.find((criterion) => {
        return criterion.criterion_id === 'access_sheffield_free_school_meals';
      });

      assert.strictEqual(contextual.status, 'contextual');
      assert.ok(fsmCriterion, `Expected confirmed FSM criterion; received ${JSON.stringify(contextual)}`);
      assert.strictEqual(fsmCriterion.status, 'matched');
      assert.strictEqual(fsmCriterion.actual, 'yes');
      assert.ok(contextual.contextual_evidence.matched_criteria.includes('access_sheffield_free_school_meals'));
      assert.deepStrictEqual(contextual.missing_information, []);
      assert.strictEqual(classification.eligibility.status, 'eligible');
      assert.ok(!classification.eligibility.manual_review_reasons.includes('sheffield_contextual_evidence_needs_review'));
      assert.strictEqual(classification.eligibility.academic_pathway, 'standard');
      assert.strictEqual(classification.eligibility.academic_pathway_id, 'standard_aaa_biology_route');
      assert.strictEqual(classification.eligibility.epq_alternative_result ?? null, null);
      assert.ok(classification.applicant_group_ids.includes('sheffield_contextual_offer'));
      assert.strictEqual(classification.eligibility.checks.find((check) => check.check_id === 'sjt_policy')?.status, 'pass');
    }
  },
  {
    id: 'access_to_sheffield_medicine_requires_completed_status',
    run() {
      const accessProgramme = (status) => ({
        contextual_profile: {
          access_programmes: {
            participation_status: 'yes',
            other_programmes: [
              {
                programme_id: 'sheffield_access_to_sheffield_medicine',
                status
              }
            ]
          }
        }
      });
      const completed = classify(aLevelApplicant(merge({
          gcse_profile: {
            subjects: {
              english_language: '4',
              mathematics: '4',
              biology: '6',
              chemistry: '6',
              physics: '6',
              history: '6',
              geography: '6'
            },
            total_gcse_count: 7
          },
          a_level_profile: {
            subjects: [
              { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
              { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
              { subject_id: 'mathematics', predicted_grade: 'B' }
            ]
          },
          admissions_tests: {
            ucat: {
              total_score: 1800
            }
          }
        }, accessProgramme('completed'))),
      );
      assert.strictEqual(
        completed.eligibility.status,
        'eligible',
        `Expected completed Access to Sheffield Medicine to stay eligible; received ${JSON.stringify(completed.eligibility)}`
      );
      assert.strictEqual(completed.eligibility.qualification_route, 'a_level');
      assert.ok(completed.applicant_group_ids.includes('sheffield_access_to_sheffield_medicine'));
      assert.strictEqual(completed.guidance_pool_id, 'access_to_sheffield_medicine');

      for (const status of ['participating', 'offered']) {
        const classification = classify(aLevelApplicant(merge({
          a_level_profile: {
            subjects: [
              { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
              { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
              { subject_id: 'mathematics', predicted_grade: 'B' }
            ]
          }
        }, accessProgramme(status))));
        assert.strictEqual(classification.eligibility.status, 'manual_review');
        assert.ok(
          classification.eligibility.manual_review_reasons.includes(
            'sheffield_contextual_evidence_needs_review'
          )
        );
        assertNoAccessMedicineBypass(classification);
      }
    }
  }
];

let passed = 0;
for (const test of tests) {
  test.run();
  passed += 1;
}

console.log(`Sheffield A100 Scottish production routing regression: PASS (${passed} cases)`);
