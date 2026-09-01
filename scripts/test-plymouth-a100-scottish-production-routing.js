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

const course = readJson('data/universities/plymouth-a100.json');
const config = readJson('data/interview-band-configs/plymouth-a100.json');
const shared = readJson(
  'data/fixtures/interview-band-classification/shared-standard-school-leaver.json'
).applicant;

function validAdvancedHigherSubjects() {
  return [
    { subject_id: 'biology', grade: 'A' },
    { subject_id: 'chemistry', grade: 'A' },
    { subject_id: 'mathematics', grade: 'A' }
  ];
}

function baseApplicant(overrides = {}) {
  const applicant = clone(shared);
  applicant.profile_id = 'plymouth_a100_cross_qualification_routing';
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
    total_score: 2200,
    score_scale: 2700,
    subtests: {
      verbal_reasoning: 740,
      decision_making: 730,
      quantitative_reasoning: 730
    },
    sjt_band: 2
  };
  return merge(applicant, overrides);
}

function scottishApplicant(overrides = {}) {
  const applicant = baseApplicant({
    qualification_route: 'scottish',
    scottish_profile: {
      advanced_higher_subjects: validAdvancedHigherSubjects()
    }
  });
  delete applicant.a_level_profile;
  return merge(applicant, overrides);
}

function aLevelApplicant(overrides = {}) {
  const applicant = baseApplicant({
    qualification_route: 'a_level',
    a_level_profile: {
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
  delete applicant.scottish_profile;
  return merge(applicant, overrides);
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function predictPlymouth(applicant) {
  const [result] = predict({
    universityIds: ['plymouth-a100'],
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
  assert.strictEqual(classification.guidance_pool_id, 'home_a100');
  assert.ok(
    ![
      'scotland_standard',
      'scotland_contextual',
      'ruk_standard',
      'ruk_contextual'
    ].includes(classification.selection_route_id),
    'Plymouth must not resolve a Scotland/RUK medical-school selection route.'
  );

  const card = predictPlymouth(applicant);
  assert.notStrictEqual(card.recommendation_display_state, 'not_eligible');
  assert.notStrictEqual(card.prediction.result_band, 'not_eligible');
  assert.strictEqual(card.prediction.ranking_metric, 'ucat_total');
  const cardText = JSON.stringify(card);
  assert.ok(cardText.includes('home_a100') || cardText.includes('Home'));
  assert.doesNotMatch(
    cardText,
    /scotland_standard|scotland_contextual|ruk_standard|ruk_contextual/,
    'Result Card must not present a Scotland/RUK medical-school route.'
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

  const card = predictPlymouth(applicant);
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
        'plymouth_scottish_advanced_highers_aaa'
      );
      assert.strictEqual(scottishRequirements[0].qualification_level, 'advanced_higher');
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
      assert.strictEqual(result.eligibility.academic_pathway_id, 'plymouth_scottish_advanced_highers_aaa');
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
      assert.ok(!result.applicant_group_ids.includes('international_fee'));
      assert.strictEqual(result.eligibility.academic_pathway_id, 'plymouth_scottish_advanced_highers_aaa');
    }
  },
  {
    id: 'england_domicile_valid_a_levels_remain_a_level_route',
    run() {
      const result = assertEligible(aLevelApplicant(), 'a_level');
      assert.ok(!result.applicant_group_ids.includes('scotland_domiciled'));
      assert.strictEqual(result.eligibility.academic_pathway_id, 'plymouth_standard_a_level_a_star_aa');
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
      assert.strictEqual(result.eligibility.academic_pathway_id, 'plymouth_standard_a_level_a_star_aa');
    }
  },
  {
    id: 'advanced_higher_aab_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'biology', grade: 'A' },
              { subject_id: 'chemistry', grade: 'A' },
              { subject_id: 'mathematics', grade: 'B' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
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
              { subject_id: 'chemistry', grade: 'A' },
              { subject_id: 'mathematics', grade: 'A' },
              { subject_id: 'physics', grade: 'A' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
      );
    }
  },
  {
    id: 'missing_accepted_second_advanced_higher_subject_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'biology', grade: 'A' },
              { subject_id: 'english', grade: 'A' },
              { subject_id: 'history', grade: 'A' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
      );
    }
  },
  {
    id: 'highers_only_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: [
              { subject_id: 'biology', grade: 'A' },
              { subject_id: 'chemistry', grade: 'A' },
              { subject_id: 'mathematics', grade: 'A' },
              { subject_id: 'physics', grade: 'A' }
            ],
            advanced_higher_subjects: []
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

console.log(`Plymouth A100 Scottish production routing regression: PASS (${tests.length} cases)`);
