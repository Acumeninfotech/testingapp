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

const course = readJson('data/universities/liverpool-a100.json');
const config = readJson('data/interview-band-configs/liverpool-a100.json');
const shared = readJson(
  'data/fixtures/interview-band-classification/shared-standard-school-leaver.json'
).applicant;

function validNational5Subjects() {
  return [
    { subject_id: 'english_language', grade: 'C' },
    { subject_id: 'mathematics', grade: 'C' },
    { subject_id: 'biology', grade: 'C' },
    { subject_id: 'chemistry', grade: 'C' },
    { subject_id: 'history', grade: 'C' },
    { subject_id: 'geography', grade: 'C' },
    { subject_id: 'french', grade: 'C' }
  ];
}

function validHigherSubjects() {
  return [
    { subject_id: 'chemistry', grade: 'A', sitting_id: '2025' },
    { subject_id: 'biology', grade: 'A', sitting_id: '2025' },
    { subject_id: 'mathematics', grade: 'A', sitting_id: '2025' },
    { subject_id: 'english', grade: 'A', sitting_id: '2025' },
    { subject_id: 'history', grade: 'B', sitting_id: '2025' }
  ];
}

function validAdvancedHigherSubjects() {
  return [
    { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' },
    { subject_id: 'biology', grade: 'A', sitting_id: '2026' }
  ];
}

function baseApplicant(overrides = {}) {
  const applicant = clone(shared);
  applicant.profile_id = 'liverpool_a100_production_routing';
  applicant.applicant_identity.contextual = false;
  applicant.applicant_identity.contextual_status_confirmed = true;
  applicant.applicant_identity.fee_status = 'Home';
  applicant.applicant_identity.domicile = 'England';
  applicant.applicant_identity.graduate = false;
  applicant.applicant_identity.resit = {
    has_resits: false,
    subjects_resat: []
  };
  applicant.admissions_tests.ucat = {
    total_score: 2000,
    score_scale: 2700,
    subtests: {
      verbal_reasoning: 700,
      decision_making: 650,
      quantitative_reasoning: 650
    },
    sjt_band: 2
  };
  return merge(applicant, overrides);
}

function scottishApplicant(overrides = {}) {
  const applicant = baseApplicant({
    qualification_route: 'scottish',
    scottish_profile: {
      national_5_subjects: validNational5Subjects(),
      higher_subjects: validHigherSubjects(),
      advanced_higher_subjects: validAdvancedHigherSubjects()
    }
  });
  delete applicant.a_level_profile;
  delete applicant.gcse_profile;
  return merge(applicant, overrides);
}

function aLevelApplicant(overrides = {}) {
  return merge(baseApplicant({
    qualification_route: 'a_level',
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A' },
        { subject_id: 'biology', predicted_grade: 'A' },
        { subject_id: 'mathematics', predicted_grade: 'A' }
      ]
    }
  }), overrides);
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function predictLiverpool(applicant) {
  const [result] = predict({
    universityIds: ['liverpool-a100'],
    studentProfile: applicant
  });
  return result.result_card;
}

function assertEligible(applicant, expectedQualificationRoute) {
  const classification = classify(applicant);
  assert.strictEqual(
    classification.eligibility.status,
    'eligible',
    `Expected eligible; received ${JSON.stringify(classification.eligibility)}`
  );
  assert.strictEqual(
    classification.eligibility.qualification_route,
    expectedQualificationRoute
  );
  assert.notStrictEqual(classification.canonical_interview_band, 'not_eligible');
  assert.ok(classification.applicant_group_ids.includes('home_fee'));
  assert.strictEqual(
    classification.guidance_pool_id,
    'home_standard_non_graduate'
  );
  assert.ok(
    ![
      'scotland_standard',
      'scotland_contextual',
      'ruk_standard',
      'ruk_contextual'
    ].includes(classification.selection_route_id),
    'Liverpool must not resolve a Scotland/RUK medical-school selection route.'
  );

  const card = predictLiverpool(applicant);
  assert.notStrictEqual(card.recommendation_display_state, 'not_eligible');
  assert.notStrictEqual(card.prediction.result_band, 'not_eligible');
  assert.strictEqual(
    card.prediction.ranking_metric,
    'ucat_total'
  );

  return classification;
}

function assertNotEligible(applicant, expectedFailure, expectedCheckId) {
  const classification = classify(applicant);
  assert.strictEqual(classification.eligibility.status, 'not_eligible');
  assert.strictEqual(classification.canonical_interview_band, 'not_eligible');
  assert.ok(
    classification.eligibility.failures.includes(expectedFailure),
    `Expected ${expectedFailure}; received ${classification.eligibility.failures.join(', ')}`
  );

  if (expectedCheckId) {
    const check = classification.eligibility.checks.find(
      (candidate) => candidate.check_id === expectedCheckId
    );
    assert.ok(check, `Expected ${expectedCheckId} check.`);
    assert.strictEqual(check.status, 'fail');
  }

  const card = predictLiverpool(applicant);
  assert.strictEqual(card.recommendation_display_state, 'not_eligible');
  assert.strictEqual(card.prediction.result_band, 'not_eligible');
}

const tests = [
  {
    id: 'configuration_routes_scottish_through_shared_course_eligibility',
    run() {
      assert.deepStrictEqual(
        config.eligibility.use_course_eligibility_for_qualification_routes,
        ['scottish']
      );
      const scottishRequirements =
        course.stage_1_eligibility.post_16.scottish.grade_requirements;
      assert.strictEqual(scottishRequirements.length, 1);
      assert.strictEqual(
        scottishRequirements[0].requirement_id,
        'liverpool_scottish_highers_and_advanced_highers'
      );
      assert.deepStrictEqual(
        scottishRequirements[0].applies_to_group_ids,
        ['school_leaver']
      );
    }
  },
  {
    id: 'england_domicile_valid_scottish_qualifications_use_scottish_route_and_home_pool',
    run() {
      const result = assertEligible(scottishApplicant(), 'scottish');
      assert.ok(
        !result.applicant_group_ids.includes('scotland_domiciled'),
        'Scottish qualification route must not create Scotland domicile.'
      );
    }
  },
  {
    id: 'scotland_domicile_valid_scottish_qualifications_use_same_scottish_route_and_home_pool',
    run() {
      const result = assertEligible(
        scottishApplicant({
          applicant_identity: {
            domicile: 'Scotland'
          }
        }),
        'scottish'
      );
      assert.ok(result.applicant_group_ids.includes('scotland_domiciled'));
      assert.ok(
        !result.applicant_group_ids.includes('international_fee'),
        'Scotland domicile must remain a Home applicant pool case.'
      );
    }
  },
  {
    id: 'england_domicile_valid_a_levels_remain_a_level_route',
    run() {
      const result = assertEligible(aLevelApplicant(), 'a_level');
      assert.ok(!result.applicant_group_ids.includes('scotland_domiciled'));
    }
  },
  {
    id: 'scotland_domicile_valid_a_levels_remain_a_level_route',
    run() {
      const result = assertEligible(
        aLevelApplicant({
          applicant_identity: {
            domicile: 'Scotland'
          }
        }),
        'a_level'
      );
      assert.ok(result.applicant_group_ids.includes('scotland_domiciled'));
    }
  },
  {
    id: 'fewer_than_seven_national_5_subjects_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: validNational5Subjects().slice(0, 6)
          }
        }),
        'national_5_requirements_not_met',
        'national_5_requirements'
      );
    }
  },
  {
    id: 'missing_national_5_english_language_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: validNational5Subjects()
              .filter((subject) => subject.subject_id !== 'english_language')
              .concat({ subject_id: 'art', grade: 'C' })
          }
        }),
        'national_5_requirements_not_met',
        'national_5_requirements'
      );
    }
  },
  {
    id: 'missing_national_5_mathematics_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: validNational5Subjects()
              .filter((subject) => subject.subject_id !== 'mathematics')
              .concat({ subject_id: 'art', grade: 'C' })
          }
        }),
        'national_5_requirements_not_met',
        'national_5_requirements'
      );
    }
  },
  {
    id: 'missing_national_5_biology_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: validNational5Subjects()
              .filter((subject) => subject.subject_id !== 'biology')
              .concat({ subject_id: 'art', grade: 'C' })
          }
        }),
        'national_5_requirements_not_met',
        'national_5_requirements'
      );
    }
  },
  {
    id: 'missing_national_5_chemistry_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: validNational5Subjects()
              .filter((subject) => subject.subject_id !== 'chemistry')
              .concat({ subject_id: 'art', grade: 'C' })
          }
        }),
        'national_5_requirements_not_met',
        'national_5_requirements'
      );
    }
  },
  {
    id: 'national_5_physics_is_not_required',
    run() {
      const result = assertEligible(scottishApplicant(), 'scottish');
      const national5Check = result.eligibility.checks.find(
        (check) => check.check_id === 'national_5_requirements'
      );
      assert.strictEqual(national5Check.status, 'pass');
      assert.ok(
        !validNational5Subjects().some((subject) => subject.subject_id === 'physics'),
        'Positive fixture intentionally omits National 5 Physics.'
      );
    }
  },
  {
    id: 'insufficient_higher_profile_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: [
              { subject_id: 'chemistry', grade: 'A', sitting_id: '2025' },
              { subject_id: 'biology', grade: 'A', sitting_id: '2025' },
              { subject_id: 'mathematics', grade: 'A', sitting_id: '2025' },
              { subject_id: 'english', grade: 'B', sitting_id: '2025' },
              { subject_id: 'history', grade: 'B', sitting_id: '2025' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
      );
    }
  },
  {
    id: 'missing_higher_chemistry_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: [
              { subject_id: 'biology', grade: 'A', sitting_id: '2025' },
              { subject_id: 'mathematics', grade: 'A', sitting_id: '2025' },
              { subject_id: 'physics', grade: 'A', sitting_id: '2025' },
              { subject_id: 'english', grade: 'A', sitting_id: '2025' },
              { subject_id: 'history', grade: 'B', sitting_id: '2025' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
      );
    }
  },
  {
    id: 'missing_higher_biology_physics_mathematics_alternative_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: [
              { subject_id: 'chemistry', grade: 'A', sitting_id: '2025' },
              { subject_id: 'english', grade: 'A', sitting_id: '2025' },
              { subject_id: 'history', grade: 'A', sitting_id: '2025' },
              { subject_id: 'geography', grade: 'A', sitting_id: '2025' },
              { subject_id: 'french', grade: 'B', sitting_id: '2025' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
      );
    }
  },
  {
    id: 'insufficient_advanced_higher_profile_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' },
              { subject_id: 'biology', grade: 'B', sitting_id: '2026' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
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
              { subject_id: 'mathematics', grade: 'A', sitting_id: '2026' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
      );
    }
  },
  {
    id: 'missing_advanced_higher_biology_physics_mathematics_alternative_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' },
              { subject_id: 'english', grade: 'A', sitting_id: '2026' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
      );
    }
  }
];

for (const test of tests) {
  test.run();
}

console.log(`Liverpool A100 Scottish production routing regression: PASS (${tests.length} cases)`);
