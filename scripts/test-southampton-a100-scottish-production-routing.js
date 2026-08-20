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

const course = readJson('data/universities/southampton-a100.json');
const config = readJson('data/interview-band-configs/southampton-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/southampton-a100.json');

function validNational5Subjects() {
  return [
    { subject_id: 'english_language', grade: 'B' },
    { subject_id: 'mathematics', grade: 'B' },
    { subject_id: 'history', grade: 'B' }
  ];
}

function validHigherSubjects() {
  return [
    { subject_id: 'biology', grade: 'A', sitting_id: '2026' },
    { subject_id: 'chemistry', grade: 'A', sitting_id: '2026' },
    { subject_id: 'mathematics', grade: 'A', sitting_id: '2026' },
    { subject_id: 'english', grade: 'A', sitting_id: '2026' },
    { subject_id: 'history', grade: 'B', sitting_id: '2026' }
  ];
}

function baseApplicant(overrides = {}) {
  const applicant = merge(fixture.base_applicant, {
    profile_id: 'southampton_a100_cross_qualification_routing',
    applicant_identity: {
      contextual: false,
      contextual_status_confirmed: true,
      fee_status: 'Home',
      domicile: 'England',
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 730,
          decision_making: 735,
          quantitative_reasoning: 735
        },
        sjt_band: 2,
        test_year: 2026
      }
    }
  });

  return merge(applicant, overrides);
}

function scottishApplicant(overrides = {}) {
  const applicant = baseApplicant({
    qualification_route: 'scottish',
    scottish_profile: {
      national_5_subjects: validNational5Subjects(),
      higher_subjects: validHigherSubjects(),
      advanced_higher_subjects: []
    }
  });
  delete applicant.a_level_profile;
  delete applicant.gcse_profile;
  return merge(applicant, overrides);
}

function aLevelApplicant(overrides = {}) {
  const applicant = baseApplicant({
    qualification_route: 'a_level',
    a_level_profile: {
      subjects: [
        {
          subject_id: 'biology',
          predicted_grade: 'A',
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
      ],
      sitting_status: 'first_sitting'
    }
  });
  delete applicant.scottish_profile;
  return merge(applicant, overrides);
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function predictSouthampton(applicant) {
  const [result] = predict({
    universityIds: ['southampton-a100'],
    studentProfile: applicant
  });
  return result.result_card;
}

function assertGuidanceEligible(applicant, expectedQualificationRoute) {
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
    'Southampton must not resolve a Scottish medical-school selection route.'
  );

  const card = predictSouthampton(applicant);
  assert.notStrictEqual(card.recommendation_display_state, 'not_eligible');
  assert.notStrictEqual(card.prediction.result_band, 'not_eligible');
  assert.strictEqual(card.prediction.ranking_metric, 'ucat_total');
  assert.doesNotMatch(
    JSON.stringify(card),
    /scotland_standard|scotland_contextual|ruk_standard|ruk_contextual/,
    'Result Card must not present a Scottish medical-school route.'
  );

  return classification;
}

function assertScottishManualReview(applicant) {
  const classification = classify(applicant);
  assert.strictEqual(
    classification.eligibility.status,
    'manual_review',
    `Expected manual review; received ${JSON.stringify(classification.eligibility)}`
  );
  assert.strictEqual(classification.eligibility.qualification_route, 'scottish');
  assert.strictEqual(classification.eligibility.academic_pathway_id, 'southampton_scottish_higher_aaaab');
  assert.strictEqual(classification.canonical_interview_band, 'insufficient_evidence');
  assert.strictEqual(classification.manual_review_required, true);
  assert.ok(classification.applicant_group_ids.includes('home_fee'));
  assert.strictEqual(classification.guidance_pool_id, 'home_a100');
  assert.ok(
    classification.eligibility.manual_review_reasons.includes('qualification_route_requires_manual_review:scottish'),
    `Expected Scottish route manual review reason; received ${classification.eligibility.manual_review_reasons.join(', ')}`
  );
  assert.ok(
    ![
      'scotland_standard',
      'scotland_contextual',
      'ruk_standard',
      'ruk_contextual'
    ].includes(classification.selection_route_id),
    'Southampton must not resolve a Scottish medical-school selection route.'
  );

  for (const checkId of ['national_5_requirements', 'scottish_post_16_requirements']) {
    const check = classification.eligibility.checks.find(
      (candidate) => candidate.check_id === checkId
    );
    assert.ok(check, `Expected ${checkId} check.`);
    assert.strictEqual(check.status, 'pass');
  }

  const card = predictSouthampton(applicant);
  assert.strictEqual(card.recommendation_display_state, 'manual_review');
  assert.match(card.primary_user_facing_recommendation, /More information is required|Needs review/i);
  assert.match(
    card.primary_explanation,
    /meet Southampton's published minimum Scottish academic requirements/i
  );
  assert.match(
    card.primary_explanation,
    /case-by-case/i
  );
  assert.strictEqual(card.prediction.result_band, 'insufficient_evidence');
  assert.strictEqual(card.prediction.ranking_metric, 'ucat_total');
  assert.doesNotMatch(
    JSON.stringify(card),
    /scotland_standard|scotland_contextual|ruk_standard|ruk_contextual/,
    'Result Card must not present a Scottish medical-school route.'
  );

  const academicChecks = card.academic_requirement_checks || [];
  for (const requirementType of ['national_5_requirements', 'scottish_post_16_requirements']) {
    const check = academicChecks.find((candidate) => candidate.requirement_type === requirementType);
    assert.ok(check, `Expected Result Card ${requirementType} row.`);
    assert.strictEqual(check.status, 'met');
  }

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

  const card = predictSouthampton(applicant);
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
      assert.strictEqual(course.stage_1_eligibility.national_5, undefined);
      assert.deepStrictEqual(
        course.stage_1_eligibility.gcse.grade_requirements
          .filter((requirement) => requirement.qualification_level === 'national_5')
          .map((requirement) => requirement.requirement_id),
        ['national_5_english_minimum', 'national_5_maths_minimum']
      );

      const scottishRequirements =
        course.stage_1_eligibility.post_16.scottish.grade_requirements;
      assert.strictEqual(scottishRequirements.length, 1);
      assert.strictEqual(
        scottishRequirements[0].requirement_id,
        'southampton_scottish_higher_aaaab'
      );
      assert.strictEqual(scottishRequirements[0].qualification_level, 'higher');
      assert.strictEqual(
        course.stage_1_eligibility.post_16.scottish.advanced_higher_offer,
        'case_by_case'
      );
    }
  },
  {
    id: 'england_domicile_valid_scottish_qualifications_use_scottish_route_and_home_pool',
    run() {
      const result = assertScottishManualReview(scottishApplicant());
      assert.ok(
        !result.applicant_group_ids.includes('scotland_domiciled'),
        'Scottish qualification route must not create Scotland domicile.'
      );
      assert.strictEqual(
        result.eligibility.academic_pathway_id,
        'southampton_scottish_higher_aaaab'
      );
    }
  },
  {
    id: 'scotland_domicile_valid_scottish_qualifications_use_same_scottish_route_and_home_pool',
    run() {
      const result = assertScottishManualReview(
        scottishApplicant({
          applicant_identity: {
            domicile: 'Scotland'
          }
        }),
      );
      assert.ok(result.applicant_group_ids.includes('scotland_domiciled'));
      assert.ok(!result.applicant_group_ids.includes('international_fee'));
      assert.strictEqual(
        result.eligibility.academic_pathway_id,
        'southampton_scottish_higher_aaaab'
      );
    }
  },
  {
    id: 'england_domicile_valid_a_levels_remain_a_level_route',
    run() {
      const result = assertGuidanceEligible(aLevelApplicant(), 'a_level');
      assert.ok(!result.applicant_group_ids.includes('scotland_domiciled'));
      assert.strictEqual(
        result.eligibility.academic_pathway_id,
        'southampton_standard_home_aaa'
      );
    }
  },
  {
    id: 'scotland_domicile_valid_a_levels_remain_a_level_route',
    run() {
      const result = assertGuidanceEligible(
        aLevelApplicant({
          applicant_identity: {
            domicile: 'Scotland'
          }
        }),
        'a_level'
      );
      assert.ok(result.applicant_group_ids.includes('scotland_domiciled'));
      assert.strictEqual(
        result.eligibility.academic_pathway_id,
        'southampton_standard_home_aaa'
      );
    }
  },
  {
    id: 'higher_grade_profile_below_aaaab_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: [
              { subject_id: 'biology', grade: 'A' },
              { subject_id: 'chemistry', grade: 'A' },
              { subject_id: 'mathematics', grade: 'A' },
              { subject_id: 'english', grade: 'B' },
              { subject_id: 'history', grade: 'B' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
      );
    }
  },
  {
    id: 'missing_higher_biology_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: [
              { subject_id: 'chemistry', grade: 'A' },
              { subject_id: 'mathematics', grade: 'A' },
              { subject_id: 'physics', grade: 'A' },
              { subject_id: 'english', grade: 'A' },
              { subject_id: 'history', grade: 'B' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
      );
    }
  },
  {
    id: 'missing_accepted_second_higher_subject_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: [
              { subject_id: 'biology', grade: 'A' },
              { subject_id: 'mathematics', grade: 'A' },
              { subject_id: 'english', grade: 'A' },
              { subject_id: 'history', grade: 'A' },
              { subject_id: 'french', grade: 'B' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
      );
    }
  },
  {
    id: 'national_5_english_below_b_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: [
              { subject_id: 'english_language', grade: 'C' },
              { subject_id: 'mathematics', grade: 'B' }
            ]
          }
        }),
        'national_5_requirements_not_met',
        'national_5_requirements'
      );
    }
  },
  {
    id: 'missing_national_5_english_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: [
              { subject_id: 'mathematics', grade: 'B' },
              { subject_id: 'history', grade: 'B' }
            ]
          }
        }),
        'national_5_requirements_not_met',
        'national_5_requirements'
      );
    }
  },
  {
    id: 'national_5_mathematics_below_b_not_eligible',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: [
              { subject_id: 'english_language', grade: 'B' },
              { subject_id: 'mathematics', grade: 'C' }
            ]
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
            national_5_subjects: [
              { subject_id: 'english_language', grade: 'B' },
              { subject_id: 'history', grade: 'B' }
            ]
          }
        }),
        'national_5_requirements_not_met',
        'national_5_requirements'
      );
    }
  },
  {
    id: 'national_5_biology_chemistry_physics_not_required',
    run() {
      const result = assertScottishManualReview(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: [
              { subject_id: 'english_language', grade: 'B' },
              { subject_id: 'mathematics', grade: 'B' },
              { subject_id: 'history', grade: 'B' }
            ]
          }
        }),
      );
      const national5Check = result.eligibility.checks.find(
        (check) => check.check_id === 'national_5_requirements'
      );
      assert.deepStrictEqual(
        national5Check.evaluated_requirement_ids,
        ['national_5_english_minimum', 'national_5_maths_minimum']
      );
    }
  },
  {
    id: 'advanced_higher_only_profile_not_silently_accepted',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: [],
            advanced_higher_subjects: [
              { subject_id: 'biology', grade: 'A' },
              { subject_id: 'chemistry', grade: 'A' },
              { subject_id: 'mathematics', grade: 'A' }
            ]
          }
        }),
        'scottish_post_16_requirements_not_met',
        'scottish_post_16_requirements'
      );
    }
  },
  {
    id: 'advanced_highers_do_not_compensate_for_below_higher_profile',
    run() {
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: [
              { subject_id: 'biology', grade: 'A' },
              { subject_id: 'chemistry', grade: 'A' },
              { subject_id: 'mathematics', grade: 'B' },
              { subject_id: 'english', grade: 'B' },
              { subject_id: 'history', grade: 'B' }
            ],
            advanced_higher_subjects: [
              { subject_id: 'biology', grade: 'A' },
              { subject_id: 'chemistry', grade: 'A' },
              { subject_id: 'mathematics', grade: 'A' }
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

console.log(`Southampton A100 Scottish production routing regression: PASS (${tests.length} cases)`);
