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

const course = readJson('data/universities/sunderland-a100.json');
const config = readJson('data/interview-band-configs/sunderland-a100.json');

function validNational5Subjects(overrides = {}) {
  const subjects = {
    english_language: 'A',
    mathematics: 'A',
    biology: 'A',
    chemistry: 'A',
    physics: 'A'
  };
  Object.assign(subjects, overrides);
  return Object.entries(subjects).map(([subject_id, grade]) => ({ subject_id, grade }));
}

function validHigherSubjects(overrides = []) {
  return [
    { subject_id: 'biology', achieved_grade: 'A', school_year: 's5' },
    { subject_id: 'chemistry', achieved_grade: 'A', school_year: 's5' },
    { subject_id: 'mathematics', achieved_grade: 'A', school_year: 's5' },
    { subject_id: 'english', achieved_grade: 'A', school_year: 's5' },
    { subject_id: 'history', achieved_grade: 'B', school_year: 's5' },
    ...overrides
  ];
}

function validAdvancedHigherSubjects(overrides = []) {
  return [
    { subject_id: 'biology', predicted_grade: 'A', school_year: 's6' },
    { subject_id: 'chemistry', predicted_grade: 'B', school_year: 's6' },
    ...overrides
  ];
}

function baseApplicant(overrides = {}) {
  return merge({
    profile_id: 'sunderland_a100_cross_qualification_routing',
    qualification_route: 'a_level',
    application_year: 2026,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      contextual_status_confirmed: true,
      widening_participation: false,
      graduate: false,
      english_language_exempt: true,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
    contextual_profile: {
      financial_support: {
        free_school_meals: 'no',
        ucat_bursary_recipient: 'no'
      },
      home_area_region: {
        home_region: 'none'
      },
      access_programmes: {
        participation_status: 'no'
      }
    },
    admissions_tests: {
      ucat: {
        total_score: 1800,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 600,
          decision_making: 600,
          quantitative_reasoning: 600
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

function aLevelApplicant(overrides = {}) {
  const applicant = baseApplicant({
    qualification_route: 'a_level',
    gcse_profile: {
      subjects: {
        english_language: '7',
        mathematics: '7',
        biology: '7',
        chemistry: '7',
        physics: '7'
      },
      additional_subjects: [],
      total_gcse_count: 5
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A', practical_endorsement: 'not_applicable' }
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
      national_5_subjects: validNational5Subjects(),
      higher_subjects: validHigherSubjects(),
      advanced_higher_subjects: validAdvancedHigherSubjects()
    }
  });
  delete applicant.a_level_profile;
  delete applicant.gcse_profile;
  return merge(applicant, overrides);
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function predictSunderland(applicant) {
  const [result] = predict({
    universityIds: ['sunderland-a100'],
    studentProfile: applicant
  });
  return result.result_card;
}

function assertNoScottishMedicalSchoolRoute(value, message) {
  assert.ok(
    !blockedScottishMedicalSchoolRoutes.includes(value),
    message || `Unexpected Scotland/RUK selection route: ${value}`
  );
}

function assertNoScottishMedicalSchoolRouteInCard(card) {
  assert.doesNotMatch(
    JSON.stringify(card),
    /scotland_standard|scotland_contextual|ruk_standard|ruk_contextual/,
    'Sunderland must not present a Scottish-medical-school Scotland/RUK route.'
  );
}

function assertEligible(applicant, expectedQualificationRoute) {
  const classification = classify(applicant);
  assert.strictEqual(
    classification.eligibility.status,
    'eligible',
    `Expected eligible; received ${JSON.stringify(classification.eligibility)}`
  );
  assert.strictEqual(classification.eligibility.qualification_route, expectedQualificationRoute);
  assert.strictEqual(classification.guidance_pool_id, 'home_a100_eligibility_gate');
  assert.strictEqual(classification.canonical_interview_band, 'realistic');
  assert.ok(classification.applicant_group_ids.includes('home_fee'));
  assertNoScottishMedicalSchoolRoute(classification.selection_route_id);

  const card = predictSunderland(applicant);
  assert.notStrictEqual(card.recommendation_display_state, 'not_eligible');
  assert.strictEqual(card.prediction.result_band, 'realistic');
  assertNoScottishMedicalSchoolRouteInCard(card);

  if (expectedQualificationRoute === 'scottish') {
    assert.strictEqual(
      classification.eligibility.academic_pathway_id,
      'sunderland_scottish_highers_and_advanced_highers'
    );
    assert.strictEqual(
      card.academic_pathway_id,
      'sunderland_scottish_highers_and_advanced_highers'
    );
    assert.ok(
      card.academic_requirement_checks.some((check) => {
        return check.qualification_type === 'scottish' &&
          check.requirement_type === 'scottish_post_16_requirements' &&
          check.status === 'met';
      }),
      'Result Card should expose the shared Scottish post-16 academic check.'
    );
    assert.match(
      JSON.stringify(card.academic_requirement_checks),
      /Scottish|National 5s/,
      'Result Card should expose shared Scottish academic presentation labels.'
    );
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

  const card = predictSunderland(applicant);
  assert.strictEqual(card.recommendation_display_state, 'not_eligible');
  assert.strictEqual(card.prediction.result_band, 'not_eligible');
}

function expectScottishNotEligible(overrides, message) {
  assertNotEligible(
    scottishApplicant(overrides),
    'scottish_post_16_requirements_not_met',
    'scottish_post_16_requirements',
    message
  );
}

const tests = [
  {
    id: 'configuration_routes_scottish_through_shared_course_eligibility',
    run() {
      assert.deepStrictEqual(
        config.eligibility.use_course_eligibility_for_qualification_routes,
        ['a_level', 'scottish']
      );
      const requirements = course.stage_1_eligibility.post_16.scottish.grade_requirements;
      assert.strictEqual(requirements.length, 1);
      assert.strictEqual(
        requirements[0].requirement_id,
        'sunderland_scottish_highers_and_advanced_highers'
      );
      assert.strictEqual(
        requirements[0].qualification_level,
        'scottish_highers_and_advanced_highers'
      );
      assert.deepStrictEqual(requirements[0].higher_grade_profile, ['A', 'A', 'A', 'A', 'B']);
      assert.deepStrictEqual(requirements[0].advanced_higher_grade_profile, ['A', 'B']);
      assert.ok(
        !JSON.stringify(requirements).includes('sunderland_advanced_higher_ab_two_sciences'),
        'Advanced-Higher-only shortcut must not remain.'
      );
    }
  },
  {
    id: 'four_domicile_and_qualification_combinations_use_home_pool',
    run() {
      assertEligible(aLevelApplicant(), 'a_level');
      assertEligible(scottishApplicant(), 'scottish');
      assert.ok(
        !assertEligible(scottishApplicant(), 'scottish').applicant_group_ids.includes('scotland_domiciled'),
        'Scottish qualifications must not imply Scotland domicile.'
      );
      const scotlandScottish = assertEligible(
        scottishApplicant({ applicant_identity: { domicile: 'Scotland' } }),
        'scottish'
      );
      assert.ok(scotlandScottish.applicant_group_ids.includes('scotland_domiciled'));
      const scotlandALevel = assertEligible(
        aLevelApplicant({ applicant_identity: { domicile: 'Scotland' } }),
        'a_level'
      );
      assert.ok(scotlandALevel.applicant_group_ids.includes('scotland_domiciled'));
      assert.strictEqual(scotlandALevel.eligibility.qualification_route, 'a_level');
    }
  },
  {
    id: 'national_5_exact_requirements',
    run() {
      assertEligible(scottishApplicant(), 'scottish');
      assertNotEligible(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: validNational5Subjects({ physics: 'B' })
          }
        }),
        'national_5_requirements_not_met',
        'national_5_requirements'
      );
      for (const subjectId of ['english_language', 'mathematics', 'biology', 'chemistry', 'physics']) {
        const national5 = validNational5Subjects({ [subjectId]: 'C' });
        national5.push({ subject_id: 'history', grade: 'A' });
        assertNotEligible(
          scottishApplicant({
            scottish_profile: {
              national_5_subjects: national5
            }
          }),
          'national_5_requirements_not_met',
          'national_5_requirements'
        );
      }
    }
  },
  {
    id: 'standard_grade_2_science_fallback_is_accepted',
    run() {
      const national5 = validNational5Subjects().filter((subject) => {
        return subject.subject_id !== 'physics';
      });
      national5.push({ subject_id: 'history', grade: 'A' });
      const result = assertEligible(
        scottishApplicant({
          scottish_profile: {
            national_5_subjects: national5,
            standard_grade_subjects: [
              { subject_id: 'physics', qualification_level: 'standard_grade', grade: '2' }
            ]
          }
        }),
        'scottish'
      );
      const national5Check = result.eligibility.checks.find(
        (check) => check.check_id === 'national_5_requirements'
      );
      assert.strictEqual(national5Check.status, 'pass');
    }
  },
  {
    id: 's5_highers_exact_requirements',
    run() {
      assertEligible(scottishApplicant(), 'scottish');
      expectScottishNotEligible({
        scottish_profile: {
          higher_subjects: [
            { subject_id: 'biology', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'chemistry', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'mathematics', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'english', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'history', achieved_grade: 'C', school_year: 's5' }
          ]
        }
      });
      expectScottishNotEligible({
        scottish_profile: {
          higher_subjects: [
            { subject_id: 'biology', achieved_grade: 'B', school_year: 's5' },
            { subject_id: 'chemistry', achieved_grade: 'B', school_year: 's5' },
            { subject_id: 'mathematics', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'english', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'history', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'geography', achieved_grade: 'A', school_year: 's5' }
          ]
        }
      });
      expectScottishNotEligible({
        scottish_profile: {
          higher_subjects: [
            { subject_id: 'biology', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'chemistry', achieved_grade: 'B', school_year: 's5' },
            { subject_id: 'mathematics', achieved_grade: 'B', school_year: 's5' },
            { subject_id: 'english', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'history', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'geography', achieved_grade: 'A', school_year: 's5' }
          ]
        }
      });
      expectScottishNotEligible({
        scottish_profile: {
          higher_subjects: [
            { subject_id: 'biology', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'chemistry', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'mathematics', achieved_grade: 'B', school_year: 's5' },
            { subject_id: 'english', achieved_grade: 'A', school_year: 's5' },
            { subject_id: 'history', achieved_grade: 'B', school_year: 's5' },
            { subject_id: 'geography', achieved_grade: 'A', school_year: 's6' }
          ]
        }
      });
      expectScottishNotEligible({
        scottish_profile: {
          higher_subjects: validHigherSubjects().map((subject) => ({
            subject_id: subject.subject_id,
            predicted_grade: subject.achieved_grade,
            school_year: subject.school_year
          }))
        }
      });
    }
  },
  {
    id: 's6_advanced_highers_exact_requirements',
    run() {
      assertEligible(scottishApplicant(), 'scottish');
      assertEligible(
        scottishApplicant({
          scottish_profile: {
            advanced_higher_subjects: [
              { subject_id: 'biology', predicted_grade: 'A', school_year: 's6' },
              { subject_id: 'chemistry', predicted_grade: 'A', school_year: 's6' }
            ]
          }
        }),
        'scottish'
      );
      expectScottishNotEligible({
        scottish_profile: {
          advanced_higher_subjects: [
            { subject_id: 'biology', predicted_grade: 'B', school_year: 's6' },
            { subject_id: 'chemistry', predicted_grade: 'B', school_year: 's6' }
          ]
        }
      });
      expectScottishNotEligible({
        scottish_profile: {
          advanced_higher_subjects: [
            { subject_id: 'biology', predicted_grade: 'A', school_year: 's6' },
            { subject_id: 'history', predicted_grade: 'B', school_year: 's6' }
          ]
        }
      });
      expectScottishNotEligible({
        scottish_profile: {
          advanced_higher_subjects: [
            { subject_id: 'biology', predicted_grade: 'A', school_year: 's5' },
            { subject_id: 'chemistry', predicted_grade: 'B', school_year: 's5' }
          ]
        }
      });
    }
  },
  {
    id: 'additional_s6_highers_floor',
    run() {
      assertEligible(scottishApplicant(), 'scottish');
      assertEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: validHigherSubjects([
              { subject_id: 'geography', predicted_grade: 'B', school_year: 's6' }
            ])
          }
        }),
        'scottish'
      );
      assertEligible(
        scottishApplicant({
          scottish_profile: {
            higher_subjects: validHigherSubjects([
              { subject_id: 'geography', predicted_grade: 'B', school_year: 's6' },
              { subject_id: 'french', predicted_grade: 'A', school_year: 's6' }
            ])
          }
        }),
        'scottish'
      );
      expectScottishNotEligible({
        scottish_profile: {
          higher_subjects: validHigherSubjects([
            { subject_id: 'geography', predicted_grade: 'C', school_year: 's6' }
          ])
        }
      });
      expectScottishNotEligible({
        scottish_profile: {
          higher_subjects: validHigherSubjects([
            { subject_id: 'geography', predicted_grade: 'A', school_year: 's6' },
            { subject_id: 'french', predicted_grade: 'C', school_year: 's6' }
          ])
        }
      });
      expectScottishNotEligible({
        scottish_profile: {
          higher_subjects: validHigherSubjects([
            { subject_id: 'geography', school_year: 's6' }
          ])
        }
      });
    }
  },
  {
    id: 'routing_and_presentation_forward_scottish_route',
    run() {
      const result = assertEligible(scottishApplicant(), 'scottish');
      const post16Check = result.eligibility.checks.find((check) => {
        return check.check_id === 'scottish_post_16_requirements';
      });
      assert.strictEqual(post16Check.qualification_level, 'scottish_highers_and_advanced_highers');
      const card = predictSunderland(scottishApplicant());
      assert.ok(
        card.academic_requirement_checks.some((check) => check.qualification_type === 'scottish'),
        'qualification_type: scottish should be forwarded to academic checks.'
      );
      assertNoScottishMedicalSchoolRouteInCard(card);
    }
  }
];

let passed = 0;
for (const test of tests) {
  test.run();
  passed += 1;
}

console.log(`Sunderland A100 Scottish production-routing checks passed (${passed} tests).`);
