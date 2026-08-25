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
    applicant.applicant_group_ids = ['contextual', 'widening_participation'];
    applicant.applicant_identity.contextual = true;
    applicant.applicant_identity.contextual_flags = {
      first_generation_higher_education: true
    };
    setNineGcsePoints(applicant, ['6', '6', '6', '6', '6', '7', '7', '7', '6']);
    applicant.admissions_tests.ucat.total_score = 1950;
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
      higher_subjects: [
        { subject_id: 'chemistry', grade: 'A', sitting_id: '2025' },
        { subject_id: 'biology', grade: 'A', sitting_id: '2025' },
        { subject_id: 'mathematics', grade: 'A', sitting_id: '2025' },
        { subject_id: 'english', grade: 'A', sitting_id: '2025' },
        { subject_id: 'history', grade: 'B', sitting_id: '2025' }
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
  [1960, 2108]
);
const APPROVED_BAND_BOUNDARIES = new Set([
  1879, 1880, 1959, 1960, 2009, 2010, 2099, 2100,
  2107, 2108, 2137, 2138, 2207, 2208
]);
assert.ok(config.guidance_pools.every((pool) => {
  return pool.band_rules.every((rule) => {
    const values = [rule.value, rule.min, rule.max].filter((v) => Number.isFinite(v));
    return values.every((value) => APPROVED_BAND_BOUNDARIES.has(value));
  });
}), 'Liverpool config must only use the approved Liverpool UCAT guidance boundaries.');

for (const boundary of [
  ['contextual_12_points', 1879, 'high_risk'],
  ['contextual_12_points', 1880, 'ambitious'],
  ['contextual_12_points', 1950, 'ambitious'],
  ['contextual_12_points', 1960, 'realistic'],
  ['contextual_12_points', 2010, 'interview_likely'],
  ['contextual_12_points', 2100, 'very_strong_interview_potential'],
  ['home_at_E2025_cutoff', 1879, 'high_risk'],
  ['home_at_E2025_cutoff', 1880, 'ambitious'],
  ['home_at_E2025_cutoff', 1935, 'ambitious'],
  ['home_at_E2025_cutoff', 1959, 'ambitious'],
  ['home_at_E2025_cutoff', 1960, 'realistic'],
  ['home_at_E2025_cutoff', 2000, 'realistic'],
  ['home_at_E2025_cutoff', 2009, 'realistic'],
  ['home_at_E2025_cutoff', 2010, 'interview_likely'],
  ['home_at_E2025_cutoff', 2099, 'interview_likely'],
  ['home_at_E2025_cutoff', 2100, 'very_strong_interview_potential'],
  ['international_band4_at_E2025_cutoff', 2107, 'ambitious'],
  ['international_band4_at_E2025_cutoff', 2108, 'realistic'],
  ['international_band4_at_E2025_cutoff', 2137, 'realistic'],
  ['international_band4_at_E2025_cutoff', 2138, 'interview_likely'],
  ['international_band4_at_E2025_cutoff', 2207, 'interview_likely'],
  ['international_band4_at_E2025_cutoff', 2208, 'very_strong_interview_potential']
]) {
  const [builderId, ucatTotal, expectedBand] = boundary;
  const applicant = builders[builderId]();
  applicant.admissions_tests.ucat.total_score = ucatTotal;
  const classification = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(
    classification.canonical_interview_band,
    expectedBand,
    `${builderId} UCAT ${ucatTotal}: boundary band`
  );
}
assert.strictEqual(config.offer_prediction, undefined);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(course.engine_notes.offer_prediction_ready, undefined);
assert.strictEqual(course.engine_notes.production_ready, true);
assert.deepStrictEqual(course.engine_notes.activation_blockers, []);
assert.strictEqual(resultCard.prediction.result_band, 'realistic');
assert.strictEqual(
  resultCard.decision_timeline.find((step) => step.step === 5).status,
  'Realistic Choice'
);
assert.strictEqual(resultCard.contextual_confirmation ?? null, null);
const standardApplicant1950 = builders.home_at_E2025_cutoff();
standardApplicant1950.admissions_tests.ucat.total_score = 1950;
const standardClassification1950 = classifyInterviewBand(course, config, standardApplicant1950);
const standardResultCard1950 = presentResultCard({
  eligibilityStatus: standardClassification1950.eligibility.status,
  interviewBand: standardClassification1950.canonical_interview_band,
  transparencyContext: {
    course_identity: {
      profile_id: 'liverpool-a100',
      university_name: 'University of Liverpool',
      course_name: 'Medicine and Surgery MBChB',
      ucas_code: 'A100'
    },
    applicant_context: standardApplicant1950,
    applicant_group_ids: standardClassification1950.applicant_group_ids,
    eligibility_checks: standardClassification1950.eligibility.checks || [],
    eligibility_failures: standardClassification1950.eligibility.failures || [],
    academic_pathway: standardClassification1950.eligibility.academic_pathway || null,
    academic_pathway_id: standardClassification1950.eligibility.academic_pathway_id || null,
    eligibility: standardClassification1950.eligibility,
    stage_1_eligibility: course.stage_1_eligibility,
    historical_admissions: course.historical_admissions,
    selection_approach_display: course.selection_approach_display,
    ranking: standardClassification1950.ranking,
    band_metric: standardClassification1950.band_metric,
    guidance_pool: standardClassification1950.guidance_pool,
    matched_band_rule: standardClassification1950.matched_band_rule,
    score_model: config.score_model,
    guidance_pool_id: standardClassification1950.guidance_pool_id,
    warnings: standardClassification1950.warnings || []
  }
});
const standardResultCardText = JSON.stringify(standardResultCard1950);
assert.strictEqual(standardClassification1950.canonical_interview_band, 'ambitious');
assert.strictEqual(
  standardResultCard1950.decision_timeline.find((step) => step.step === 5).status,
  'Ambitious Choice'
);
assert.ok(standardResultCardText.includes('1880-1959'));
assert.strictEqual(standardResultCard1950.contextual_confirmation ?? null, null);
assert.strictEqual(
  presentResultCard({
    eligibilityStatus: 'eligible',
    interviewBand: 'interview_likely',
    transparencyContext: { course_identity: { profile_id: 'liverpool-a100' } }
  }).decision_timeline.find((step) => step.step === 5).status,
  'Strong Choice'
);
assert.strictEqual(
  presentResultCard({
    eligibilityStatus: 'eligible',
    interviewBand: 'very_strong_interview_potential',
    transparencyContext: { course_identity: { profile_id: 'liverpool-a100' } }
  }).decision_timeline.find((step) => step.step === 5).status,
  'Very Strong Choice'
);
assert.strictEqual(resultCard.readiness.result_card_ready, true);
assert.strictEqual(resultCard.readiness.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(resultCard.readiness.production_ready, true);
assert.strictEqual(research.readiness.production_ready, true);
assert.strictEqual(research.readiness.offer_prediction_scope, 'out_of_scope');
const indexEntry = index.universities.find((entry) => entry.id === 'liverpool-a100');
assert.strictEqual(indexEntry.production_ready, true);
assert.match(readme, /\| Liverpool \| Ready/);

const contextualApplicant1950 = builders.contextual_12_points();
contextualApplicant1950.admissions_tests.ucat.total_score = 1950;
contextualApplicant1950.applicant_identity.contextual_flags.care_experienced = true;
contextualApplicant1950.contextual_profile = contextualApplicant1950.contextual_profile || {};
contextualApplicant1950.contextual_profile.personal_circumstances = contextualApplicant1950.contextual_profile.personal_circumstances || {};
contextualApplicant1950.contextual_profile.personal_circumstances.care_experienced = 'yes';
const contextualClassification1950 = classifyInterviewBand(course, config, contextualApplicant1950);
const contextualResultCard1950 = presentResultCard({
  eligibilityStatus: contextualClassification1950.eligibility.status,
  interviewBand: contextualClassification1950.canonical_interview_band,
  transparencyContext: {
    course_identity: {
      profile_id: 'liverpool-a100',
      university_name: 'University of Liverpool',
      course_name: 'Medicine and Surgery MBChB',
      ucas_code: 'A100'
    },
    applicant_context: contextualApplicant1950,
    applicant_group_ids: contextualClassification1950.applicant_group_ids,
    eligibility_checks: contextualClassification1950.eligibility.checks || [],
    eligibility_failures: contextualClassification1950.eligibility.failures || [],
    academic_pathway: contextualClassification1950.eligibility.academic_pathway || null,
    academic_pathway_id: contextualClassification1950.eligibility.academic_pathway_id || null,
    eligibility: contextualClassification1950.eligibility,
    stage_1_eligibility: course.stage_1_eligibility,
    historical_admissions: course.historical_admissions,
    selection_approach_display: course.selection_approach_display,
    ranking: contextualClassification1950.ranking,
    band_metric: contextualClassification1950.band_metric,
    guidance_pool: contextualClassification1950.guidance_pool,
    matched_band_rule: contextualClassification1950.matched_band_rule,
    score_model: config.score_model,
    guidance_pool_id: contextualClassification1950.guidance_pool_id,
    warnings: contextualClassification1950.warnings || []
  }
});
const contextualResultCardText = JSON.stringify(contextualResultCard1950);
const liverpoolContextualCollapsedHeading = 'Contextual eligibility confirmed';
const liverpoolContextualCollapsedSupportingText = 'Liverpool may apply contextual UCAT flexibility, but it does not publish how many UCAT points of flexibility may be applied.';
const liverpoolContextualExpandedBody = 'Contextual consideration may allow flexibility below the standard UCAT level, but Liverpool does not publish how many UCAT points of flexibility may be applied and determines this annually.';
assert.strictEqual(contextualClassification1950.canonical_interview_band, 'ambitious');
assert.strictEqual(contextualResultCard1950.prediction.result_band, 'ambitious');
assert.strictEqual(
  contextualResultCard1950.decision_timeline.find((step) => step.step === 5).status,
  'Ambitious Choice'
);
assert.strictEqual(contextualResultCard1950.contextual_confirmation.collapsed_label, liverpoolContextualCollapsedHeading);
assert.strictEqual(
  contextualResultCard1950.decision_transparency.compact_status.label,
  liverpoolContextualCollapsedSupportingText
);
assert.strictEqual(
  [
    contextualResultCard1950.contextual_confirmation.collapsed_label,
    contextualResultCard1950.decision_transparency.compact_status.label
  ].filter((text) => text === liverpoolContextualCollapsedHeading).length,
  1
);
assert.ok(contextualResultCardText.includes('Ambitious Choice'));
assert.ok(contextualResultCardText.includes('1880-1959'));
assert.ok(
  contextualResultCard1950.contextual_confirmation.expanded_body.includes(
    liverpoolContextualExpandedBody
  )
);
assert.strictEqual(contextualResultCard1950.contextual_confirmation.warning, undefined);
for (const forbiddenText of [
  '1733-1762',
  '+217',
  'historical interview range',
  'highly competitive'
]) {
  assert.ok(!contextualResultCardText.includes(forbiddenText), `contextual 1950 Result Card must not include ${forbiddenText}`);
}

const contextualPresentation = presentResultCard({
  eligibilityStatus: 'eligible',
  interviewBand: 'ambitious',
  transparencyContext: {
    course_identity: { profile_id: 'liverpool-a100' },
    eligibility: {
      contextual_eligibility: {
        status: 'contextual'
      }
    }
  }
});
assert.strictEqual(contextualPresentation.prediction.result_band, 'ambitious');
assert.strictEqual(contextualPresentation.contextual_confirmation.expanded_body, liverpoolContextualExpandedBody);
assert.strictEqual(contextualPresentation.contextual_confirmation.warning, undefined);

console.log(`Liverpool A100 readiness regression: PASS (${fixture.cases.length} cases)`);
