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

const course = readJson('data/universities/queen-mary-a100.json');
const config = readJson('data/interview-band-configs/queen-mary-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/queen-mary-a100.json');

function validGcseProfile() {
  return {
    subjects: {
      english_language: '7',
      mathematics: '7',
      biology: '7',
      chemistry: '7',
      physics: '6',
      history: '6'
    },
    additional_subjects: [],
    total_gcse_count: 6
  };
}

function aLevelApplicant(domicile = 'England') {
  return merge(fixture.base_applicant, {
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile,
      contextual: false,
      widening_participation: false,
      contextual_flags: {},
      graduate: false,
      resit: {
        has_resits: false
      }
    },
    qualification_route: 'a_level',
    gcse_profile: validGcseProfile(),
    a_level_profile: {
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A*' },
        { subject_id: 'chemistry', predicted_grade: 'A' },
        { subject_id: 'mathematics', predicted_grade: 'A' }
      ],
      sitting_status: 'first_sitting'
    },
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        sjt_band: 2,
        test_year: 2026
      }
    },
    contextual_profile: {}
  });
}

function higherSubjects(overrides = []) {
  return [
    { subject_id: 'biology', grade: 'A', achieved_grade: 'A', school_year: 's5', sitting_id: 's5' },
    { subject_id: 'chemistry', grade: 'A', achieved_grade: 'A', school_year: 's5', sitting_id: 's5' },
    { subject_id: 'mathematics', grade: 'A', achieved_grade: 'A', school_year: 's5', sitting_id: 's5' },
    ...overrides
  ];
}

function advancedHigherSubjects(subjects = ['biology', 'chemistry']) {
  return subjects.map((subjectId) => ({
    subject_id: subjectId,
    grade: 'A',
    predicted_grade: 'A',
    school_year: 's6',
    sitting_id: 's6'
  }));
}

function scottishApplicant(domicile = 'England', overrides = {}) {
  const applicant = merge(fixture.base_applicant, {
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile,
      contextual: false,
      widening_participation: false,
      contextual_flags: {},
      graduate: false,
      resit: {
        has_resits: false
      }
    },
    qualification_route: 'scottish',
    scottish_profile: {
      higher_subjects: higherSubjects(),
      advanced_higher_subjects: advancedHigherSubjects()
    },
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        sjt_band: 2,
        test_year: 2026
      }
    },
    contextual_profile: {}
  });

  delete applicant.a_level_profile;
  delete applicant.gcse_profile;
  delete applicant.ib_profile;

  return merge(applicant, overrides);
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function assertEligible(applicant, expectedRoute, label) {
  const direct = evaluateCourseEligibility(course, applicant);
  const classification = classify(applicant);

  assert.strictEqual(direct.qualification_route, expectedRoute, `${label}: direct route`);
  assert.strictEqual(classification.eligibility.qualification_route, expectedRoute, `${label}: classifier route`);
  assert.strictEqual(direct.status, 'eligible', `${label}: ${JSON.stringify(direct)}`);
  assert.strictEqual(
    classification.eligibility.status,
    'eligible',
    `${label}: ${JSON.stringify(classification.eligibility)}`
  );
  assert.strictEqual(classification.guidance_pool_id, 'qmul_home_standard_school_leaver_guidance');
  assert.ok(!classification.selection_route_id, `${label}: domicile must not select a Scottish medical-school route`);

  return { direct, classification };
}

function assertScottishNotEligible(applicant, label) {
  const direct = evaluateCourseEligibility(course, applicant);
  const classification = classify(applicant);

  assert.strictEqual(direct.qualification_route, 'scottish', `${label}: direct route`);
  assert.strictEqual(classification.eligibility.qualification_route, 'scottish', `${label}: classifier route`);
  assert.strictEqual(direct.status, 'not_eligible', `${label}: ${JSON.stringify(direct)}`);
  assert.strictEqual(classification.eligibility.status, 'not_eligible', `${label}: ${JSON.stringify(classification.eligibility)}`);
  assert.ok(direct.failures.includes('scottish_post_16_requirements_not_met'));
  assert.ok(!direct.failures.some((failure) => failure.startsWith('gcse_requirement_not_met')));
}

assert.deepStrictEqual(
  config.eligibility.qualification_routes.supported,
  ['a_level', 'international_baccalaureate', 'scottish']
);
assert.ok(!config.eligibility.qualification_routes.explicitly_blocked.includes('scottish'));
assert.deepStrictEqual(
  config.eligibility.use_course_eligibility_for_qualification_routes,
  ['scottish']
);

const scottishRules = course.stage_1_eligibility.post_16.scottish;
assert.strictEqual(scottishRules.route_implemented, true);
assert.strictEqual(scottishRules.contextual_route_implemented, false);
assert.strictEqual(scottishRules.grade_requirements.length, 1);
assert.strictEqual(
  scottishRules.grade_requirements[0].qualification_level,
  'scottish_highers_and_advanced_highers'
);

assertEligible(aLevelApplicant('England'), 'a_level', 'England domicile plus A levels');
assertEligible(aLevelApplicant('Scotland'), 'a_level', 'Scotland domicile plus A levels');

assertEligible(
  scottishApplicant('England'),
  'scottish',
  'England domicile plus valid Scottish qualifications'
);
assertEligible(
  scottishApplicant('Scotland'),
  'scottish',
  'Scotland domicile plus valid Scottish qualifications'
);

assertEligible(
  scottishApplicant('Scotland', {
    contextual_evidence: {
      external_assessments: [
        {
          provider_university_id: 'qmul',
          assessment_id: 'qmul_contextual_eligibility',
          result: 'contextual',
          verification_status: 'verified'
        }
      ]
    }
  }),
  'scottish',
  'Scottish contextual applicant remains on standard Scottish academic route'
);

assertScottishNotEligible(
  scottishApplicant('Scotland', {
    scottish_profile: {
      higher_subjects: higherSubjects().filter((subject) => subject.subject_id !== 'chemistry')
    }
  }),
  'Higher Chemistry absent'
);

assertScottishNotEligible(
  scottishApplicant('Scotland', {
    scottish_profile: {
      higher_subjects: higherSubjects().filter((subject) => subject.subject_id !== 'biology')
    }
  }),
  'Higher Biology absent'
);

assertScottishNotEligible(
  scottishApplicant('Scotland', {
    scottish_profile: {
      advanced_higher_subjects: advancedHigherSubjects(['biology'])
    }
  }),
  'Only one Advanced Higher'
);

assertScottishNotEligible(
  scottishApplicant('Scotland', {
    scottish_profile: {
      advanced_higher_subjects: advancedHigherSubjects(['biology', 'english'])
    }
  }),
  'Advanced Higher Biology plus non-science'
);

{
  const applicant = scottishApplicant('Scotland');
  delete applicant.gcse_profile;
  const { direct, classification } = assertEligible(
    applicant,
    'scottish',
    'Valid Scottish post-16 applicant with no GCSE payload'
  );
  assert.ok(!direct.failures.some((failure) => failure.includes('gcse')));
  assert.notStrictEqual(classification.canonical_interview_band, 'not_eligible');
}

console.log('Queen Mary A100 Scottish production routing regression: PASS');
