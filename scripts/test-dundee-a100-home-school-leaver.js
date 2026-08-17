#!/usr/bin/env node

const assert = require('assert');
const path = require('path');

const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');

const rootDir = path.resolve(__dirname, '..');
const course = require(path.join(rootDir, 'data', 'universities', 'dundee-a100.json'));
const config = require(path.join(rootDir, 'data', 'interview-band-configs', 'dundee-a100.json'));
const topTierApplicant = require(path.join(rootDir, 'data', 'regression-profiles', '16_top_tier_applicant.json'));
const internationalApplicant = require(path.join(rootDir, 'data', 'regression-profiles', '12_international_standard_applicant.json'));
const clone = (value) => JSON.parse(JSON.stringify(value));

const applicant = {
  profile_id: 'dundee_scotland_standard_aaaab_ucat_2200',
  qualification_route: 'scottish',
  application_year: 2027,
  applicant_identity: {
    applicant_type: 'school_leaver',
    fee_status: 'home_fee',
    domicile: 'scotland',
    contextual: false,
    contextual_flags: {},
    graduate: false,
    resit: { has_resits: false, subjects_resat: [] }
  },
  contextual_profile: {
    home_area_region: { simd_quintile: 'q5' },
    financial_support: { free_school_meals: 'no' },
    personal_circumstances: {
      young_or_adult_carer: 'no',
      care_experienced: 'no',
      care_over_three_months: 'no',
      estranged_from_family: 'no',
      refugee: 'no',
      uk_refugee_status_granted: 'no',
      seeking_asylum: 'no',
      asylum_seeker: 'no',
      disability: 'no'
    },
    access_programmes: {
      participation_status: 'no',
      other_programmes: [],
      other_programme_name: ''
    }
  },
  scottish_profile: {
    national_5_subjects: [
      { subject_id: 'english', grade: 'A' },
      { subject_id: 'mathematics', grade: 'A' },
      { subject_id: 'biology', grade: 'A' },
      { subject_id: 'chemistry', grade: 'A' },
      { subject_id: 'physics', grade: 'A' }
    ],
    higher_subjects: [
      { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'mathematics', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'english', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'physics', grade: 'B', school_year: 's5', first_attempt: true }
    ],
    advanced_higher_subjects: [
      { subject_id: 'chemistry', grade: 'B', school_year: 's6', first_attempt: true },
      { subject_id: 'biology', grade: 'B', school_year: 's6', first_attempt: true }
    ]
  },
  admissions_tests: {
    ucat: {
      total_score: 2200,
      score_scale: 2700,
      subtests: {
        verbal_reasoning: 730,
        decision_making: 730,
        quantitative_reasoning: 740
      },
      sjt_band: 2
    }
  },
  graduate_profile: {
    is_graduate: false
  }
};

function classifyApplicant(studentProfile) {
  return classifyInterviewBand(course, config, studentProfile);
}

function homeGuidanceComponent(classification) {
  return classification.ranking?.components?.home_school_leaver_guidance_index;
}

function assertNoHomePoolLeakage(classification) {
  assert.ok(!classification.applicant_group_ids.includes('rest_of_uk'));
  assert.ok(!classification.applicant_group_ids.includes('international_fee'));
  assert.notStrictEqual(classification.guidance_pool_id, 'home_rest_of_uk_standard_school_leaver');
  assert.notStrictEqual(classification.guidance_pool_id, 'home_rest_of_uk_contextual_school_leaver');
  assert.notStrictEqual(classification.guidance_pool_id, 'international');
}

function applicantWithUcat(ucatTotal) {
  const next = clone(applicant);
  next.admissions_tests.ucat.total_score = ucatTotal;
  return next;
}

function dundeeRukAlevelApplicant({
  profileId,
  contextual = false,
  grades = ['A', 'A', 'A'],
  ucatTotal = 2200
}) {
  const next = clone(topTierApplicant);
  next.profile_id = profileId;
  next.qualification_route = 'a_level';
  next.applicant_identity = {
    ...next.applicant_identity,
    applicant_type: 'school_leaver',
    fee_status: 'home_fee',
    domicile: 'england',
    contextual,
    widening_participation: contextual,
    contextual_flags: contextual ? { free_school_meals: true } : {},
    graduate: false,
    resit: { has_resits: false, subjects_resat: [] }
  };
  next.contextual_profile = {
    ...(next.contextual_profile || {}),
    financial_support: { free_school_meals: contextual ? 'yes' : 'no' },
    personal_circumstances: {
      care_over_three_months: 'no',
      care_experienced: 'no',
      uk_refugee_status_granted: 'no',
      refugee: 'no',
      ukrainian_visa_scheme: 'no'
    }
  };
  next.a_level_profile.subjects = [
    ['chemistry', grades[0]],
    ['biology', grades[1]],
    ['mathematics', grades[2]]
  ].map(([subjectId, predictedGrade]) => ({
    subject_id: subjectId,
    predicted_grade: predictedGrade,
    achieved_grade: null,
    sitting_status: 'first_sitting',
    practical_endorsement: subjectId === 'mathematics' ? null : 'pass'
  }));
  next.admissions_tests.ucat.total_score = ucatTotal;
  return next;
}

function dundeeEnglandScottishApplicant() {
  const next = clone(applicant);
  next.profile_id = 'dundee_england_home_scottish_standard_aaaab_ucat_2200';
  next.applicant_identity = {
    ...next.applicant_identity,
    domicile: 'england',
    contextual: false,
    widening_participation: false,
    contextual_flags: {},
    graduate: false
  };
  next.contextual_profile = {
    ...(next.contextual_profile || {}),
    financial_support: { free_school_meals: 'no' }
  };
  return next;
}

function dundeeScotlandAlevelApplicant() {
  const next = dundeeRukAlevelApplicant({
    profileId: 'dundee_scotland_home_a_level_standard_aaa_ucat_2200',
    contextual: false,
    grades: ['A', 'A', 'A'],
    ucatTotal: 2200
  });
  next.applicant_identity = {
    ...next.applicant_identity,
    domicile: 'scotland',
    contextual: false,
    widening_participation: false,
    contextual_flags: {},
    graduate: false
  };
  return next;
}

function academicBadgeLabels(card) {
  return (card.academic_requirement_checks || []).map((check) => check.label);
}

function applicantPoolSummaries(card) {
  return (card.decision_transparency?.decision_path || [])
    .flatMap((stage) => stage.checks || [])
    .filter((check) => check.label === 'Applicant pool')
    .map((check) => check.summary);
}

function factorUsage(card, factorId) {
  return (card.factor_usage || []).find((factor) => factor.factor_id === factorId) || null;
}

function assertNoDuplicateAcademicBadges(card) {
  const keys = (card.academic_requirement_checks || []).map((check) => {
    return [
      check.qualification_type,
      check.requirement_type,
      check.label,
      check.status
    ].join('|');
  });
  assert.strictEqual(new Set(keys).size, keys.length);
}

function assertScotlandStandardBoundary({
  ucatTotal,
  expectedUcatProxy,
  expectedProxyBand,
  expectedIndex,
  expectedBand
}) {
  const classification = classifyApplicant(applicantWithUcat(ucatTotal));
  const component = homeGuidanceComponent(classification);

  assert.strictEqual(classification.eligibility.status, 'eligible', `UCAT ${ucatTotal}: eligibility`);
  assert.strictEqual(
    classification.guidance_pool_id,
    'home_scotland_standard_school_leaver',
    `UCAT ${ucatTotal}: guidance pool`
  );
  assertNoHomePoolLeakage(classification);
  assert.strictEqual(
    component.components.academic.value,
    60,
    `UCAT ${ucatTotal}: academic proxy`
  );
  assert.strictEqual(
    component.components.ucat.value,
    expectedUcatProxy,
    `UCAT ${ucatTotal}: UCAT proxy`
  );
  assert.strictEqual(
    component.components.ucat.proxy_band,
    expectedProxyBand,
    `UCAT ${ucatTotal}: UCAT proxy band`
  );
  assert.strictEqual(
    component.components.ucat.benchmark_key,
    'scotland_standard',
    `UCAT ${ucatTotal}: UCAT benchmark`
  );
  assert.strictEqual(classification.ranking.value, expectedIndex, `UCAT ${ucatTotal}: guidance index`);
  assert.strictEqual(component.value, expectedIndex, `UCAT ${ucatTotal}: component value`);
  assert.strictEqual(
    classification.canonical_interview_band,
    expectedBand,
    `UCAT ${ucatTotal}: prediction tier`
  );

  return {
    ucatTotal,
    ucatProxy: component.components.ucat.value,
    index: classification.ranking.value,
    band: classification.canonical_interview_band,
    proxyBand: component.components.ucat.proxy_band
  };
}

function presentCardFor(classification, studentProfile) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: false,
    transparencyContext: {
      course_identity: {
        profile_id: 'dundee-a100',
        university_name: 'University of Dundee',
        course_name: 'MBChB Medicine (A100)',
        ucas_code: 'A100'
      },
      applicant_context: studentProfile,
      applicant_group_ids: classification.applicant_group_ids,
      readiness: course.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      academic_pathway: classification.eligibility.academic_pathway || null,
      academic_pathway_id: classification.eligibility.academic_pathway_id || null,
      eligibility: classification.eligibility,
      stage_1_eligibility: course.stage_1_eligibility,
      historical_admissions: course.historical_admissions,
      selection_approach_display: course.selection_approach_display,
      ranking: classification.ranking,
      band_metric: classification.band_metric,
      guidance_pool: classification.guidance_pool,
      matched_band_rule: classification.matched_band_rule,
      score_model: config.score_model,
      guidance_pool_id: classification.guidance_pool_id,
      warnings: classification.warnings || []
    }
  });
}

function collectApplicantFacingCardText(card) {
  const text = [
    card.primary_user_facing_recommendation,
    card.primary_explanation,
    card.trust_statement,
    card.historical_guidance_caveat,
    card.evidence_confidence?.summary,
    card.contextual_confirmation?.expanded_heading,
    card.contextual_confirmation?.expanded_body,
    card.alternative_academic_offer?.standard_offer,
    card.alternative_academic_offer?.alternative_offer,
    card.decision_transparency?.ucat_comparison?.caveat
  ];
  const transparency = card.decision_transparency || {};
  for (const stage of transparency.decision_path || []) {
    text.push(stage.stage, stage.status, stage.summary);
    for (const check of stage.checks || []) {
      text.push(check.label, check.status, check.summary);
    }
  }
  for (const check of card.academic_requirement_checks || []) {
    text.push(check.qualification_type, check.requirement_type, check.label, check.status, check.reason);
  }
  for (const factor of card.factor_usage || []) {
    text.push(factor.factor_id, factor.label, factor.role, factor.detail);
  }
  return text.filter(Boolean).join('\n');
}

const classification = classifyApplicant(applicant);
const guidanceComponent = homeGuidanceComponent(classification);
const academicComponent = guidanceComponent.components.academic;
const ucatComponent = guidanceComponent.components.ucat;

assert.strictEqual(classification.eligibility.status, 'eligible');
assert.strictEqual(classification.guidance_pool_id, 'home_scotland_standard_school_leaver');
assert.strictEqual(classification.eligibility.academic_pathway, 'standard');
assert.strictEqual(classification.eligibility.contextual_eligibility?.is_contextual, false);
assertNoHomePoolLeakage(classification);
assert.strictEqual(classification.canonical_interview_band, 'interview_likely');
assert.strictEqual(classification.ranking.value, 100);
assert.strictEqual(classification.ranking.max, 100);
assert.strictEqual(guidanceComponent.value, 100);
assert.strictEqual(guidanceComponent.max, 100);
assert.strictEqual(guidanceComponent.official, false);
assert.strictEqual(academicComponent.value, 60);
assert.strictEqual(academicComponent.max, 60);
assert.strictEqual(academicComponent.components.national_5.value, 30);
assert.strictEqual(academicComponent.components.national_5.band, 'all_presented_national_5s_grade_a');
assert.strictEqual(academicComponent.components.higher.value, 30);
assert.strictEqual(academicComponent.components.higher.band, 'confirmed_standard_route');
assert.strictEqual(ucatComponent.value, 40);
assert.strictEqual(ucatComponent.max, 40);
assert.strictEqual(ucatComponent.raw_value, 2200);
assert.strictEqual(ucatComponent.proxy_band, 'very_strong_proxy');
assert.strictEqual(
  ucatComponent.benchmark_key,
  'scotland_standard'
);

const card = presentCardFor(classification, applicant);

assert.strictEqual(card.prediction.available, true);
assert.strictEqual(card.prediction.result_band, classification.canonical_interview_band);
assert.strictEqual(card.academic_pathway, 'standard');
assert.strictEqual(card.contextual_status, null);
assert.strictEqual(card.decision_transparency?.score_breakdown ?? null, null);
assert.strictEqual(
  card.primary_explanation,
  "Based on ApplySmart's assessment, your academic profile appears competitive for this applicant group."
);
assert.strictEqual(card.trust_statement, null);

const publicText = collectApplicantFacingCardText(card);
assert.match(publicText, /60% academic(?: performance)? and 40% UCAT/i);
assert.match(publicText, /ApplySmart-derived(?: historical .*?)? guidance/i);
assert.match(publicText, /(?:not public|not published|not a current cut-off|not a guarantee of interview)/i);
assert.doesNotMatch(
  publicText,
  /ApplySmart cannot reproduce Dundee's exact internal score because the complete academic scoring table and current Dundee applicant-pool UCAT decile boundaries are not published/i
);
assert.doesNotMatch(publicText, /\b\d+(?:\.\d+)?\s*\/\s*100\b/);
assert.doesNotMatch(publicText, /12\/20\/28\/34\/40|60\/76\/88/);
assert.doesNotMatch(publicText, /International applicants|International score|Rest of UK \/ ROI|\bRUK\b/i);

const boundaryResults = [
  assertScotlandStandardBoundary({
    ucatTotal: 2150,
    expectedUcatProxy: 40,
    expectedProxyBand: 'very_strong_proxy',
    expectedIndex: 100,
    expectedBand: 'interview_likely'
  }),
  assertScotlandStandardBoundary({
    ucatTotal: 2149,
    expectedUcatProxy: 34,
    expectedProxyBand: 'strong_proxy',
    expectedIndex: 94,
    expectedBand: 'interview_likely'
  }),
  assertScotlandStandardBoundary({
    ucatTotal: 2000,
    expectedUcatProxy: 34,
    expectedProxyBand: 'strong_proxy',
    expectedIndex: 94,
    expectedBand: 'interview_likely'
  }),
  assertScotlandStandardBoundary({
    ucatTotal: 1999,
    expectedUcatProxy: 28,
    expectedProxyBand: 'minimum_competitive_proxy',
    expectedIndex: 88,
    expectedBand: 'interview_likely'
  }),
  assertScotlandStandardBoundary({
    ucatTotal: 1850,
    expectedUcatProxy: 28,
    expectedProxyBand: 'minimum_competitive_proxy',
    expectedIndex: 88,
    expectedBand: 'interview_likely'
  }),
  assertScotlandStandardBoundary({
    ucatTotal: 1849,
    expectedUcatProxy: 20,
    expectedProxyBand: 'near_minimum_proxy',
    expectedIndex: 80,
    expectedBand: 'realistic'
  })
];

const contextualApplicant = clone(applicant);
contextualApplicant.profile_id = 'dundee_scotland_contextual_aaabb_ucat_2100';
contextualApplicant.applicant_identity.contextual = true;
contextualApplicant.contextual_profile.home_area_region.simd_quintile = 'q2';
contextualApplicant.scottish_profile.higher_subjects = [
  { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
  { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
  { subject_id: 'mathematics', grade: 'A', school_year: 's5', first_attempt: true },
  { subject_id: 'english', grade: 'B', school_year: 's5', first_attempt: true },
  { subject_id: 'physics', grade: 'B', school_year: 's5', first_attempt: true }
];
contextualApplicant.admissions_tests.ucat.total_score = 2100;

const contextualClassification = classifyApplicant(contextualApplicant);
const contextualGuidanceComponent = homeGuidanceComponent(contextualClassification);
assert.strictEqual(contextualClassification.eligibility.status, 'eligible');
assert.strictEqual(
  contextualClassification.guidance_pool_id,
  'home_scotland_contextual_school_leaver'
);
assert.strictEqual(contextualClassification.eligibility.academic_pathway, 'contextual');
assert.strictEqual(
  contextualClassification.eligibility.contextual_eligibility?.contextual_category,
  'category_2'
);
assert.strictEqual(
  contextualGuidanceComponent.components.ucat.benchmark_key,
  'scotland_contextual_category_2'
);
assert.notStrictEqual(
  contextualGuidanceComponent.components.ucat.benchmark_key,
  'scotland_standard'
);
assert.strictEqual(contextualGuidanceComponent.components.ucat.value, 40);
assert.strictEqual(contextualClassification.canonical_interview_band, 'interview_likely');

const contextualCard = presentCardFor(contextualClassification, contextualApplicant);
const contextualPublicText = collectApplicantFacingCardText(contextualCard);
assert.strictEqual(contextualCard.contextual_status, 'confirmed');
assert.deepStrictEqual(contextualCard.contextual_confirmation, {
  collapsed_label: 'Dundee contextual route confirmed',
  expanded_heading: 'Contextual Route',
  expanded_body: "You meet Dundee's contextual admissions criteria and widening-access academic requirements."
});
assert.strictEqual(contextualCard.trust_statement, null);
assert.strictEqual(
  contextualCard.decision_transparency?.compact_status?.label,
  'You meet the academic requirements.'
);
assert.strictEqual(
  contextualCard.alternative_academic_offer?.standard_offer,
  'AAAAB Scottish Highers + BB Advanced Highers'
);
assert.strictEqual(
  contextualCard.alternative_academic_offer?.alternative_offer,
  'AAABB Scottish Highers + BB Advanced Highers'
);
assert.doesNotMatch(contextualCard.primary_explanation, /Contextual eligibility confirmed|contextual admissions criteria/i);
assert.doesNotMatch(
  contextualPublicText,
  /This is an ApplySmart prediction based on published contextual admissions evidence and historical UCAT guidance/i
);
assert.doesNotMatch(contextualPublicText, /Category 1\/2|ApplySmart-mapped/i);
assert.match(
  contextualPublicText,
  /You meet Dundee's contextual admissions criteria and widening-access academic requirements\./
);

const rukStandardApplicant = dundeeRukAlevelApplicant({
  profileId: 'dundee_ruk_standard_aaa_ucat_2200',
  contextual: false,
  grades: ['A', 'A', 'A'],
  ucatTotal: 2200
});
const rukStandardClassification = classifyApplicant(rukStandardApplicant);
const rukStandardComponent = homeGuidanceComponent(rukStandardClassification);
assert.strictEqual(rukStandardClassification.eligibility.status, 'eligible');
assert.strictEqual(
  rukStandardClassification.guidance_pool_id,
  'home_rest_of_uk_standard_school_leaver'
);
assert.strictEqual(rukStandardClassification.eligibility.academic_pathway, 'standard');
assert.strictEqual(
  rukStandardClassification.eligibility.academic_pathway_id,
  'dundee_ruk_standard_a_level'
);
assert.strictEqual(rukStandardComponent.components.academic.value, 60);
assert.strictEqual(rukStandardComponent.components.academic.components.a_level.band, 'aaa');
assert.strictEqual(rukStandardComponent.components.ucat.benchmark_key, 'ruk_standard');
assert.strictEqual(rukStandardClassification.ranking.value, 94);
assert.strictEqual(rukStandardClassification.canonical_interview_band, 'interview_likely');

const englandScottishApplicant = dundeeEnglandScottishApplicant();
const englandScottishClassification = classifyApplicant(englandScottishApplicant);
const englandScottishComponent = homeGuidanceComponent(englandScottishClassification);
const englandScottishCard = presentCardFor(
  englandScottishClassification,
  englandScottishApplicant
);
const englandScottishText = collectApplicantFacingCardText(englandScottishCard);
assert.strictEqual(englandScottishClassification.eligibility.status, 'eligible');
assert.strictEqual(
  englandScottishClassification.eligibility.academic_pathway_id,
  'dundee_scottish_standard_chemistry_anchor'
);
assert.strictEqual(
  englandScottishClassification.guidance_pool_id,
  'home_rest_of_uk_standard_school_leaver'
);
assert.ok(englandScottishClassification.applicant_group_ids.includes('rest_of_uk'));
assert.ok(!englandScottishClassification.applicant_group_ids.includes('scotland_domiciled'));
assert.strictEqual(
  englandScottishComponent.components.academic.route,
  'scottish_applysmart_academic_strength_estimate'
);
assert.strictEqual(
  englandScottishComponent.components.ucat.benchmark_key,
  'ruk_standard'
);
assert.strictEqual(englandScottishCard.prediction.available, true);
assert.notStrictEqual(englandScottishCard.prediction.result_band, 'insufficient_evidence');
assert.strictEqual(englandScottishCard.contextual_status, null);
assert.strictEqual(englandScottishCard.contextual_confirmation, null);
assert.deepStrictEqual(academicBadgeLabels(englandScottishCard), [
  'Dundee National 5 requirements',
  'Dundee Scottish standard route'
]);
assertNoDuplicateAcademicBadges(englandScottishCard);
assert.ok(applicantPoolSummaries(englandScottishCard).every((summary) => {
  return summary === 'Home/RUK Standard school-leaver applicants';
}));
assert.strictEqual(factorUsage(englandScottishCard, 'sjt')?.role, 'not_used');
assert.strictEqual(factorUsage(englandScottishCard, 'sjt')?.detail, 'SJT is not used for interview selection.');
assert.match(englandScottishText, /Home\/RUK Standard applicants/i);
assert.match(englandScottishText, /Dundee Scottish standard route/i);
assert.match(englandScottishText, /ApplySmart-derived.*guidance/i);
assert.match(englandScottishText, /not a Dundee cut-off or official ranking score/i);
assert.doesNotMatch(englandScottishText, /Scotland-domiciled applicants/i);
assert.doesNotMatch(englandScottishText, /A-level requirements|GCSE requirements/i);
assert.doesNotMatch(englandScottishText, /Contextual route confirmed|contextual admissions criteria/i);
assert.doesNotMatch(englandScottishText, /Prediction Unavailable|Not predicted/i);

const scotlandAlevelApplicant = dundeeScotlandAlevelApplicant();
const scotlandAlevelClassification = classifyApplicant(scotlandAlevelApplicant);
const scotlandAlevelComponent = homeGuidanceComponent(scotlandAlevelClassification);
const scotlandAlevelCard = presentCardFor(
  scotlandAlevelClassification,
  scotlandAlevelApplicant
);
const scotlandAlevelText = collectApplicantFacingCardText(scotlandAlevelCard);
assert.strictEqual(scotlandAlevelClassification.eligibility.status, 'eligible');
assert.strictEqual(
  scotlandAlevelClassification.eligibility.academic_pathway_id,
  'dundee_ruk_standard_a_level'
);
assert.strictEqual(
  scotlandAlevelClassification.guidance_pool_id,
  'home_scotland_standard_school_leaver'
);
assert.ok(scotlandAlevelClassification.applicant_group_ids.includes('scotland_domiciled'));
assert.ok(!scotlandAlevelClassification.applicant_group_ids.includes('rest_of_uk'));
assert.strictEqual(
  scotlandAlevelComponent.components.academic.route,
  'ruk_applysmart_academic_strength_estimate'
);
assert.strictEqual(
  scotlandAlevelComponent.components.ucat.benchmark_key,
  'scotland_standard'
);
assert.strictEqual(scotlandAlevelCard.prediction.available, true);
assert.notStrictEqual(scotlandAlevelCard.prediction.result_band, 'insufficient_evidence');
assert.strictEqual(scotlandAlevelCard.contextual_status, null);
assert.strictEqual(scotlandAlevelCard.contextual_confirmation, null);
assert.deepStrictEqual(academicBadgeLabels(scotlandAlevelCard), [
  'A-level requirements',
  'GCSE requirements'
]);
assertNoDuplicateAcademicBadges(scotlandAlevelCard);
assert.ok(applicantPoolSummaries(scotlandAlevelCard).every((summary) => {
  return summary === 'Home, Scotland-domiciled Standard school-leaver applicants';
}));
assert.strictEqual(factorUsage(scotlandAlevelCard, 'sjt')?.role, 'not_used');
assert.strictEqual(factorUsage(scotlandAlevelCard, 'sjt')?.detail, 'SJT is not used for interview selection.');
assert.match(scotlandAlevelText, /Home, Scotland-domiciled Standard applicants/i);
assert.match(scotlandAlevelText, /A-level requirements/i);
assert.match(scotlandAlevelText, /ApplySmart-derived historical Scotland UCAT guidance/i);
assert.doesNotMatch(scotlandAlevelText, /Home\/RUK|Rest of UK|\bRUK\b/i);
assert.doesNotMatch(
  scotlandAlevelText,
  /Dundee National 5 requirements|Dundee Scottish standard route|Advanced Higher/i
);
assert.doesNotMatch(scotlandAlevelText, /Contextual route confirmed|contextual admissions criteria/i);
assert.doesNotMatch(scotlandAlevelText, /Prediction Unavailable|Not predicted/i);

for (const ucatTotal of [2100, 2200]) {
  const rukContextualApplicant = dundeeRukAlevelApplicant({
    profileId: `dundee_ruk_contextual_abb_ucat_${ucatTotal}`,
    contextual: true,
    grades: ['A', 'B', 'B'],
    ucatTotal
  });
  const rukContextualClassification = classifyApplicant(rukContextualApplicant);
  const rukContextualComponent = homeGuidanceComponent(rukContextualClassification);
  const rukContextualAcademic = rukContextualComponent.components.academic;
  const rukContextualUcat = rukContextualComponent.components.ucat;
  const rukContextualCard = presentCardFor(rukContextualClassification, rukContextualApplicant);

  assert.strictEqual(rukContextualClassification.eligibility.status, 'eligible');
  assert.strictEqual(
    rukContextualClassification.eligibility.academic_pathway,
    'contextual'
  );
  assert.strictEqual(
    rukContextualClassification.eligibility.academic_pathway_id,
    'dundee_ruk_contextual_widening_access_a_level'
  );
  assert.strictEqual(
    rukContextualClassification.guidance_pool_id,
    'home_rest_of_uk_contextual_school_leaver'
  );
  assert.ok(Number.isFinite(rukContextualClassification.ranking.value));
  assert.notStrictEqual(
    rukContextualClassification.canonical_interview_band,
    'insufficient_evidence'
  );
  assert.strictEqual(rukContextualAcademic.value, 60);
  assert.strictEqual(
    rukContextualAcademic.route,
    'ruk_contextual_applysmart_academic_strength_estimate'
  );
  assert.strictEqual(rukContextualAcademic.official, false);
  assert.strictEqual(
    rukContextualAcademic.components.a_level.band,
    'confirmed_contextual_route'
  );
  assert.strictEqual(rukContextualAcademic.components.a_level.value, 30);
  assert.strictEqual(rukContextualAcademic.components.gcse.band, 'eight_grades_8_or_9');
  assert.strictEqual(rukContextualUcat.benchmark_key, 'ruk_contextual');
  assert.notStrictEqual(rukContextualUcat.benchmark_key, 'ruk_standard');
  assert.notStrictEqual(rukContextualUcat.benchmark_key, 'scotland_standard');
  assert.notStrictEqual(rukContextualUcat.benchmark_key, 'scotland_contextual');
  assert.notStrictEqual(rukContextualUcat.benchmark_key, 'international');
  assert.strictEqual(rukContextualCard.prediction.available, true);
  assert.strictEqual(rukContextualCard.prediction.result_band, 'interview_likely');
  assert.deepStrictEqual(rukContextualCard.contextual_confirmation, {
    collapsed_label: 'Dundee contextual route confirmed',
    expanded_heading: 'Contextual Route',
    expanded_body: "You meet Dundee's contextual admissions criteria and widening-access academic requirements."
  });
  assert.strictEqual(
    rukContextualCard.decision_transparency?.compact_status?.label,
    'You meet the academic requirements.'
  );
  assert.strictEqual(
    rukContextualCard.alternative_academic_offer?.standard_offer,
    'AAA'
  );
  assert.strictEqual(
    rukContextualCard.alternative_academic_offer?.alternative_offer,
    'ABB'
  );
  assert.doesNotMatch(
    rukContextualCard.primary_explanation,
    /Contextual eligibility confirmed|contextual admissions criteria|Standard offer AAA; applied contextual offer ABB/i
  );
  assert.doesNotMatch(
    collectApplicantFacingCardText(rukContextualCard),
    /Contextual eligibility confirmed/i
  );
  assert.match(
    collectApplicantFacingCardText(rukContextualCard),
    /You meet Dundee's contextual admissions criteria and widening-access academic requirements\./
  );
  assert.strictEqual(
    rukContextualCard.decision_transparency?.insufficient_evidence_reason_code ?? null,
    null
  );
  assert.strictEqual(rukContextualCard.decision_transparency?.score_breakdown ?? null, null);
  assert.doesNotMatch(collectApplicantFacingCardText(rukContextualCard), /\b\d+(?:\.\d+)?\s*\/\s*100\b/);
  assert.doesNotMatch(
    collectApplicantFacingCardText(rukContextualCard),
    /official academic score|exact RUK contextual academic scoring conversion/i
  );
}

const rukBelowContextualApplicant = dundeeRukAlevelApplicant({
  profileId: 'dundee_ruk_contextual_bbb_ucat_2200',
  contextual: true,
  grades: ['B', 'B', 'B'],
  ucatTotal: 2200
});
const rukBelowContextualClassification = classifyApplicant(rukBelowContextualApplicant);
assert.strictEqual(rukBelowContextualClassification.eligibility.status, 'not_eligible');
assert.strictEqual(rukBelowContextualClassification.ranking, null);
assert.strictEqual(rukBelowContextualClassification.canonical_interview_band, 'not_eligible');

const internationalClassification = classifyApplicant(clone(internationalApplicant));
const internationalHomeComponent = homeGuidanceComponent(internationalClassification);
assert.strictEqual(internationalClassification.eligibility.status, 'eligible');
assert.strictEqual(internationalClassification.guidance_pool_id, 'international');
assert.ok(internationalClassification.applicant_group_ids.includes('international_fee'));
assert.strictEqual(internationalHomeComponent.applicable, false);
assert.strictEqual(
  internationalHomeComponent.reason,
  'component_not_applicable_for_applicant_group'
);

console.log('PASS: Dundee Scotland Standard exact proxy calculation: academic 60/60 + UCAT 40/40 = 100, interview_likely');
console.log(
  `PASS: Scotland Standard boundary coverage: ${boundaryResults
    .map((result) => `${result.ucatTotal}->${result.ucatProxy}/40,${result.index},${result.band}`)
    .join('; ')}`
);
console.log('PASS: Dundee Scotland Contextual case uses contextual UCAT benchmark, not Scotland Standard');
console.log('PASS: Dundee Scotland Contextual Result Card uses one public confirmation message with internal Category 1/2 wording hidden');
console.log('PASS: Dundee Scotland Standard Result Card hides score breakdown and has no RUK/International leakage');
console.log('PASS: Dundee RUK Standard AAA keeps the existing academic matrix and RUK Standard UCAT benchmark');
console.log('PASS: Dundee England/Home Scottish qualifications use Scottish academics with Home/RUK Standard prediction guidance');
console.log('PASS: Dundee Scotland/Home A-levels use A-level academics with Home Scotland Standard prediction guidance');
console.log('PASS: Dundee RUK Contextual ABB resolves through the confirmed-route academic proxy and RUK Contextual UCAT benchmark');
console.log('PASS: Dundee RUK below-ABB contextual profile remains ineligible with no prediction');
console.log('PASS: Dundee International route does not use the Home school-leaver guidance-index component');
