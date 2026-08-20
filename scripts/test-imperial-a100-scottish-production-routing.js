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

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, overrides) {
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

const course = readJson(
  'data/universities/imperial-college-london-a100.json'
);
const config = readJson(
  'data/interview-band-configs/imperial-college-london-a100.json'
);

function validAdvancedHighers() {
  return [
    { subject_id: 'biology', grade: 'A', sitting_id: '2026' },
    { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' },
    { subject_id: 'mathematics', grade: 'A', sitting_id: '2026' }
  ];
}

function scottishApplicant(overrides = {}) {
  const applicant = {
    profile_id: 'imperial_scottish_cross_qualification',
    qualification_route: 'scottish',
    application_year: 2026,

    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'Scotland',
      contextual: false,
      contextual_status_confirmed: false,
      widening_participation: false,
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },

    scottish_profile: {
      completed_in_one_sitting: true,
      national_5_subjects: [
        { subject_id: 'english_language', grade: 'B' }
      ],
      advanced_higher_subjects: validAdvancedHighers()
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
        sjt_band: 2
      }
    },

    graduate_profile: {
      is_graduate: false
    }
  };

  return merge(applicant, overrides);
}

function predictImperial(applicant) {
  const [result] = predict({
    universityIds: ['imperial-college-london-a100'],
    studentProfile: applicant
  });

  return result.result_card;
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function assertEligible(applicant) {
  const result = classify(applicant);

  assert.strictEqual(
    result.eligibility.status,
    'eligible',
    `Expected eligible but received ${JSON.stringify(result.eligibility)}`
  );

  assert.notStrictEqual(result.canonical_interview_band, 'not_eligible');

  const card = predictImperial(applicant);

  assert.notStrictEqual(card.recommendation_display_state, 'not_eligible');
  assert.notStrictEqual(card.prediction.result_band, 'not_eligible');

  return result;
}

function assertNotEligible(applicant, expectedFailure) {
  const result = classify(applicant);

  assert.ok(
    result.eligibility,
    'Expected classifier eligibility result.'
  );

  assert.strictEqual(
    result.eligibility.status,
    'not_eligible',
    `Expected eligibility status not_eligible; received ${result.eligibility.status}`
  );

  assert.strictEqual(
    result.canonical_interview_band,
    'not_eligible',
    `Expected canonical interview band not_eligible; received ${result.canonical_interview_band}`
  );

  assert.ok(
    Array.isArray(result.eligibility.failures) &&
      result.eligibility.failures.includes(expectedFailure),
    `Expected ${expectedFailure}; received ${(result.eligibility.failures || []).join(', ')}`
  );

  const academicCheck = (result.eligibility.checks || []).find(
    check => check.check_id === 'scottish_post_16_requirements'
  );

  if (expectedFailure === 'scottish_post_16_requirements_not_met') {
    assert.ok(
      academicCheck,
      'Expected Scottish post-16 eligibility check.'
    );

    assert.strictEqual(
      academicCheck.status,
      'fail',
      `Expected Scottish post-16 check to fail; received ${academicCheck.status}`
    );
  }

  return result;
}

const tests = [
  {
    id: 'scottish_route_uses_shared_course_eligibility',
    run() {
      assert.deepStrictEqual(
        config.eligibility.use_course_eligibility_for_qualification_routes,
        ['scottish']
      );

      assertEligible(scottishApplicant());
    }
  },

  {
    id: 'scotland_domicile_scottish_qualification_remains_home',
    run() {
      const result = assertEligible(scottishApplicant());

      assert.ok(result.applicant_group_ids.includes('home_fee'));
      assert.ok(result.applicant_group_ids.includes('scotland_domiciled'));
      assert.strictEqual(result.eligibility.qualification_route, 'scottish');
    }
  },

  {
    id: 'england_domicile_scottish_qualification_uses_same_academic_route',
    run() {
      const result = assertEligible(
        scottishApplicant({
          applicant_identity: {
            domicile: 'England'
          }
        })
      );

      assert.strictEqual(result.eligibility.qualification_route, 'scottish');
      assert.ok(result.applicant_group_ids.includes('home_fee'));

      assert.ok(
        !result.applicant_group_ids.includes('scotland_domiciled'),
        'Qualification route must not force Scotland domicile.'
      );
    }
  },

  {
    id: 'advanced_higher_aab_not_eligible',
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
    id: 'missing_advanced_higher_biology_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' },
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
    id: 'missing_advanced_higher_chemistry_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'biology', grade: 'A', sitting_id: '2026' },
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
    id: 'advanced_highers_not_same_sitting_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            completed_in_one_sitting: false,
            advanced_higher_subjects: validAdvancedHighers()
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  },

  {
    id: 'scotland_domicile_a_level_uses_a_level_route',
    run() {
      const applicant = {
        profile_id: 'imperial_scotland_domicile_a_level',
        qualification_route: 'a_level',
        application_year: 2026,

        applicant_identity: {
          applicant_type: 'standard_school_leaver',
          fee_status: 'Home',
          domicile: 'Scotland',
          contextual: false,
          contextual_status_confirmed: false,
          widening_participation: false,
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
            physics: '6'
          },
          additional_subjects: [],
          total_gcse_count: 5
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
            sjt_band: 2
          }
        },

        graduate_profile: {
          is_graduate: false
        }
      };

      const result = classify(applicant);

      assert.strictEqual(
        result.eligibility.qualification_route,
        'a_level'
      );

      assert.ok(
        result.applicant_group_ids.includes('scotland_domiciled'),
        'Scotland domicile should be preserved.'
      );

      assert.ok(
        result.applicant_group_ids.includes('home_fee'),
        'Scotland-domiciled applicant should remain Home.'
      );

      assert.notStrictEqual(
        result.eligibility.status,
        'not_eligible',
        `Expected A-level route to remain valid; received ${JSON.stringify(result.eligibility)}`
      );

      assert.ok(
        !(result.eligibility.checks || []).some(
          check => check.check_id === 'scottish_post_16_requirements'
        ),
        'A-level applicant must not be evaluated by the Scottish academic route.'
      );
    }
  },

  {
    id: 'different_advanced_higher_sitting_ids_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            completed_in_one_sitting: null,
            advanced_higher_subjects: [
              { subject_id: 'biology', grade: 'A', sitting_id: '2026' },
              { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' },
              { subject_id: 'mathematics', grade: 'A', sitting_id: '2025' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met'
      );
    }
  }
];

console.log('Imperial A100 Scottish production-path routing regression');
console.log('Path: shared course eligibility + classifyInterviewBand + server/src/predict');
console.log('');

let failures = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`PASS ${test.id}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${test.id}`);
    console.error(error.stack || error.message);
  }
}

console.log('');

if (failures > 0) {
  console.error(`${failures} Imperial Scottish production-routing test(s) failed.`);
  process.exit(1);
}

console.log(`PASS ${tests.length}/${tests.length} Imperial Scottish production-routing tests`);
