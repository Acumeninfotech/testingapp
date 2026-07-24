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

const rootDir = path.resolve(__dirname, '..');
const readJson = (relativePath) => JSON.parse(
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
);
const clone = (value) => JSON.parse(JSON.stringify(value));

const course = readJson('data/universities/liverpool-a100.json');
const config = readJson('data/interview-band-configs/liverpool-a100.json');
const fixture = readJson('data/fixtures/liverpool-a100-readiness.json');
const shared = readJson(
  'data/fixtures/interview-band-classification/shared-standard-school-leaver.json'
).applicant;
const resultCard = readJson('data/examples/liverpool-a100-result-card.example.json');
const research = readJson('data/research/liverpool-a100-research.json');
const index = readJson('data/index.json');
const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');

function baseApplicant() {
  const applicant = clone(shared);
  applicant.qualification_route = 'a_level';
  applicant.applicant_identity.contextual_status_confirmed = true;
  return applicant;
}

function setNineGcsePoints(applicant, grades) {
  applicant.gcse_profile.subjects = {
    english_language: grades[0],
    mathematics: grades[1],
    biology: grades[2],
    chemistry: grades[3],
    physics: grades[4]
  };
  applicant.gcse_profile.additional_subjects = [
    { subject_id: 'history', grade: grades[5] },
    { subject_id: 'geography', grade: grades[6] },
    { subject_id: 'computer_science', grade: grades[7] },
    { subject_id: 'french', grade: grades[8] }
  ];
  applicant.gcse_profile.total_gcse_count = 9;
}

const builders = {
  home_at_E2025_cutoff() {
    const applicant = baseApplicant();
    applicant.admissions_tests.ucat.total_score = 1935;
    return applicant;
  },
  home_below_E2025_cutoff() {
    const applicant = baseApplicant();
    applicant.admissions_tests.ucat.total_score = 1934;
    return applicant;
  },
  ruk_fee_alias_routes_home() {
    const applicant = baseApplicant();
    applicant.applicant_identity.fee_status = 'RUK';
    applicant.admissions_tests.ucat.total_score = 2200;
    return applicant;
  },
  contextual_12_points() {
    const applicant = baseApplicant();
    applicant.applicant_identity.contextual = true;
    setNineGcsePoints(applicant, ['6', '6', '6', '6', '6', '7', '7', '7', '6']);
    applicant.admissions_tests.ucat.total_score = 1733;
    return applicant;
  },
  contextual_11_points() {
    const applicant = builders.contextual_12_points();
    applicant.gcse_profile.additional_subjects[3].grade = '5';
    return applicant;
  },
  combined_science() {
    const applicant = baseApplicant();
    applicant.gcse_profile.subjects = {
      english_language: '6',
      mathematics: '6',
      combined_science: '7/7'
    };
    applicant.gcse_profile.additional_subjects = [
      { subject_id: 'history', grade: '7' },
      { subject_id: 'geography', grade: '7' },
      { subject_id: 'computer_science', grade: '7' },
      { subject_id: 'french', grade: '7' },
      { subject_id: 'religious_studies', grade: '7' }
    ];
    applicant.gcse_profile.total_gcse_count = 9;
    return applicant;
  },
  astar_wrong_subject() {
    const applicant = baseApplicant();
    applicant.a_level_profile.subjects = [
      { subject_id: 'history', predicted_grade: 'A*' },
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'biology', predicted_grade: 'B' }
    ];
    return applicant;
  },
  astar_correct_subject() {
    const applicant = baseApplicant();
    applicant.a_level_profile.subjects = [
      { subject_id: 'chemistry', predicted_grade: 'A*' },
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'history', predicted_grade: 'B' }
    ];
    return applicant;
  },
  general_studies_excluded() {
    const applicant = baseApplicant();
    applicant.a_level_profile.subjects = [
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'general_studies', predicted_grade: 'A' }
    ];
    return applicant;
  },
  international_band4_at_E2025_cutoff() {
    const applicant = baseApplicant();
    applicant.qualification_route = 'international_qualification';
    delete applicant.a_level_profile;
    applicant.applicant_identity.fee_status = 'International';
    applicant.international_qualification = {
      equivalence_status: 'verified',
      verified_by_institution: true,
      requirements_met: true
    };
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
    applicant.admissions_tests.ucat.total_score = 2108;
    applicant.admissions_tests.ucat.sjt_band = 4;
    return applicant;
  },
  international_unverified_blocked() {
    const applicant = builders.international_band4_at_E2025_cutoff();
    applicant.international_qualification.verified_by_institution = false;
    return applicant;
  },
  approved_access_route() {
    const applicant = baseApplicant();
    applicant.qualification_route = 'access_to_medicine';
    delete applicant.a_level_profile;
    applicant.access_to_medicine_profile = {
      provider_approved_by_institution: true,
      requirements_met: true
    };
    applicant.admissions_tests.ucat.total_score = 1935;
    return applicant;
  },
  unverified_access_blocked() {
    const applicant = builders.approved_access_route();
    applicant.access_to_medicine_profile.provider_approved_by_institution = false;
    return applicant;
  },
  graduate_gamsat_route() {
    const applicant = baseApplicant();
    applicant.qualification_route = 'graduate';
    applicant.applicant_identity.graduate = true;
    delete applicant.a_level_profile;
    delete applicant.admissions_tests.ucat;
    applicant.graduate_profile = {
      is_graduate: true,
      degree_classification: '2:1'
    };
    applicant.admissions_tests.gamsat = {
      overall_score: 60,
      section_scores: [55, 60, 58]
    };
    return applicant;
  },
  graduate_gamsat_section_fail() {
    const applicant = builders.graduate_gamsat_route();
    applicant.admissions_tests.gamsat.section_scores = [55, 49, 58];
    return applicant;
  },
  scottish_without_physics() {
    const applicant = baseApplicant();
    applicant.qualification_route = 'scottish';
    applicant.applicant_identity.domicile = 'Scotland';
    delete applicant.a_level_profile;
    delete applicant.gcse_profile;
    applicant.scottish_profile = {
      national_5_subjects: [
        { subject_id: 'english_language', grade: 'B' },
        { subject_id: 'mathematics', grade: 'B' },
        { subject_id: 'biology', grade: 'B' },
        { subject_id: 'chemistry', grade: 'B' },
        { subject_id: 'history', grade: 'C' },
        { subject_id: 'geography', grade: 'C' },
        { subject_id: 'french', grade: 'C' }
      ],
      advanced_higher_subjects: [
        { subject_id: 'chemistry', grade: 'A' },
        { subject_id: 'biology', grade: 'A' }
      ]
    };
    return applicant;
  },
  ib_666() {
    const applicant = baseApplicant();
    applicant.qualification_route = 'international_baccalaureate';
    delete applicant.a_level_profile;
    applicant.ib_profile = {
      total_points: 36,
      higher_level_subjects: [
        { subject_id: 'chemistry', higher_level_grade: '6' },
        { subject_id: 'biology', higher_level_grade: '6' },
        { subject_id: 'history', higher_level_grade: '6' }
      ]
    };
    return applicant;
  },
  a_level_resit_ABB_first_sitting() {
    const applicant = builders.astar_correct_subject();
    applicant.applicant_identity.resit = {
      has_resits: true,
      applicant_form_submitted: true,
      first_sitting_grade_profile: ['A', 'B', 'B']
    };
    return applicant;
  },
  a_level_resit_below_ABB() {
    const applicant = builders.a_level_resit_ABB_first_sitting();
    applicant.applicant_identity.resit.first_sitting_grade_profile = ['B', 'B', 'B'];
    return applicant;
  },
  unsupported_btec_explicitly_blocked() {
    const applicant = baseApplicant();
    applicant.qualification_route = 'btec';
    delete applicant.a_level_profile;
    applicant.btec_profile = {
      qualification: 'BTEC Level 3 National Extended Diploma',
      grade: 'D*D*D*',
      subject_id: 'applied_science'
    };
    return applicant;
  },
  mature_exception_explicitly_blocked() {
    const applicant = baseApplicant();
    applicant.applicant_identity.applicant_type = 'mature_applicant';
    return applicant;
  }
};

for (const testCase of fixture.cases) {
  const applicant = builders[testCase.case_id]();
  const classification = classifyInterviewBand(course, config, applicant);
  const eligibility = evaluateCourseEligibility(course, applicant);

  assert.strictEqual(
    classification.eligibility.status,
    testCase.expected_eligibility,
    `${testCase.case_id}: classifier eligibility`
  );
  assert.strictEqual(
    eligibility.status,
    testCase.expected_eligibility,
    `${testCase.case_id}: eligibility evaluator (${eligibility.failures}; ${eligibility.manual_review_reasons})`
  );
  if (testCase.expected_pool) {
    assert.strictEqual(classification.guidance_pool_id, testCase.expected_pool);
  }
  if (testCase.expected_band) {
    assert.strictEqual(classification.canonical_interview_band, testCase.expected_band);
  }
}

assert.deepStrictEqual(
  config.guidance_pools
    .filter((pool) => pool.historical_cutoff)
    .map((pool) => pool.historical_cutoff.value)
    .sort((a, b) => a - b),
  [1733, 1935, 2108]
);
const OFFICIAL_LIVERPOOL_CUTOFFS = [1733, 1935, 2108];
const APPROVED_APPLYSMART_OFFSETS = [0, 30, 100];
const APPROVED_BAND_BOUNDARIES = new Set(
  OFFICIAL_LIVERPOOL_CUTOFFS.flatMap((cutoff) =>
    APPROVED_APPLYSMART_OFFSETS.flatMap((offset) => [cutoff + offset, cutoff + offset - 1])
  )
);
assert.ok(config.guidance_pools.every((pool) => {
  return pool.band_rules.every((rule) => {
    const values = [rule.value, rule.min, rule.max].filter((v) => Number.isFinite(v));
    return values.every((value) => APPROVED_BAND_BOUNDARIES.has(value));
  });
}), 'Liverpool config must only use the official FOI-verified cutoffs and the approved ApplySmart point-offset boundaries (+30, +100) derived from them.');
assert.strictEqual(config.offer_prediction, undefined);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(course.engine_notes.offer_prediction_ready, undefined);
assert.strictEqual(course.engine_notes.production_ready, true);
assert.deepStrictEqual(course.engine_notes.activation_blockers, []);
assert.strictEqual(resultCard.prediction.result_band, 'interview_likely');
assert.strictEqual(resultCard.readiness.result_card_ready, true);
assert.strictEqual(resultCard.readiness.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(resultCard.readiness.production_ready, true);
assert.strictEqual(research.readiness.production_ready, true);
assert.strictEqual(research.readiness.offer_prediction_scope, 'out_of_scope');
const indexEntry = index.universities.find((entry) => entry.id === 'liverpool-a100');
assert.strictEqual(indexEntry.production_ready, true);
assert.match(readme, /\| Liverpool \| Ready/);

console.log(`Liverpool A100 readiness regression: PASS (${fixture.cases.length} cases)`);
