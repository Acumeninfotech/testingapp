const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { predict } = require('../src/predict');
const {
  classifyInterviewBand
} = require('../../assets/js/engine/interview-band-classifier');

const rootDir = path.resolve(__dirname, '..', '..');
const courseIds = [
  'keele-a100',
  'kent-and-medway-a100',
  'city-st-george-s-of-london-a100',
  'edge-hill-a100',
  'anglia-ruskin-a100'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

const courses = Object.fromEntries(
  courseIds.map((id) => [id, readJson(`data/universities/${id}.json`)])
);
const configs = Object.fromEntries(
  courseIds.map((id) => [id, readJson(`data/interview-band-configs/${id}.json`)])
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, overrides = {}) {
  if (overrides === null || Array.isArray(overrides) || typeof overrides !== 'object') {
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

function national5(subjectId, grade = 'A') {
  return {
    subject_id: subjectId,
    grade,
    predicted_grade: grade,
    school_year: 's4',
    sitting_id: 's4',
    first_attempt: true
  };
}

function higher(subjectId, grade = 'A', overrides = {}) {
  const schoolYear = overrides.school_year || 's5';
  return {
    subject_id: subjectId,
    grade,
    achieved_grade: grade,
    predicted_grade: grade,
    school_year: schoolYear,
    sitting_id: overrides.sitting_id || schoolYear,
    first_attempt: overrides.first_attempt ?? true,
    ...(overrides.completion_year === undefined ? {} : { completion_year: overrides.completion_year })
  };
}

function advancedHigher(subjectId, grade = 'A', overrides = {}) {
  return higher(subjectId, grade, {
    school_year: 's6',
    sitting_id: 's6',
    ...overrides
  });
}

function fullNational5s(minimumGrade = 'A') {
  return [
    national5('english_language', minimumGrade),
    national5('mathematics', minimumGrade),
    national5('biology', minimumGrade),
    national5('chemistry', minimumGrade),
    national5('physics', minimumGrade),
    national5('history', minimumGrade)
  ];
}

function baseScottishApplicant(scottishProfile, overrides = {}) {
  return merge({
    profile_id: 'batch5_frontend_scottish_home',
    application_year: 2027,
    qualification_route: 'scottish',
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: 'home',
      domicile: 'england',
      contextual: false,
      widening_participation: false,
      graduate: false,
      contextual_flags: {},
      resit: { has_resits: false, subjects_resat: [] }
    },
    contextual_profile: {
      home_area_region: {},
      financial_support: {},
      school_education: {},
      personal_circumstances: {},
      access_programmes: {
        participation_status: 'no',
        ukwpmed: { status: 'no', programme_id: '', programme_status: '' },
        other_programmes: []
      }
    },
    gcse_profile: { subjects: {}, total_gcse_count: 0 },
    a_level_profile: {
      subjects: [],
      epq: { status: 'not_taken', grade: null }
    },
    epq: { status: 'not_taken', grade: null },
    scottish_profile: scottishProfile,
    admissions_tests: {
      ucat: {
        taken: true,
        test_year: 2026,
        total_score: 2400,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 800,
          decision_making: 800,
          quantitative_reasoning: 800
        },
        sjt_band: 2
      }
    }
  }, overrides);
}

function predictCard(courseId, applicant) {
  return predict({
    universityIds: [courseId],
    studentProfile: applicant
  })[0].result_card;
}

function classify(courseId, applicant) {
  return classifyInterviewBand(courses[courseId], configs[courseId], applicant);
}

function assertConfigDelegatesScottish(courseId) {
  const routes = configs[courseId].eligibility.qualification_routes;
  assert.ok(routes.supported.includes('scottish'), `${courseId}: Scottish route supported`);
  assert.ok(
    !(routes.explicitly_blocked || []).includes('scottish'),
    `${courseId}: Scottish route not explicitly blocked`
  );
  assert.ok(
    !(routes.manual_review || []).includes('scottish'),
    `${courseId}: Scottish route not classifier manual-review-only`
  );
  assert.deepStrictEqual(
    configs[courseId].eligibility.use_course_eligibility_for_qualification_routes,
    ['scottish'],
    `${courseId}: Scottish route delegates to course eligibility`
  );
}

function publicScottishChecks(card) {
  return (card.academic_requirement_checks || [])
    .filter((check) => check.qualification_type === 'scottish');
}

function assertNoAlevelEpqAlternative(card, label) {
  assert.strictEqual(card.alternative_academic_offer, null, `${label}: no A-level/EPQ alternative panel`);
  assert.strictEqual(
    (card.academic_requirement_checks || []).some((check) => {
      return check.qualification_type === 'a_level' || /epq/i.test(check.label || '');
    }),
    false,
    `${label}: no A-level or EPQ academic checks`
  );
}

const keeleScottish = {
  national_5_subjects: fullNational5s('A'),
  higher_subjects: [
    higher('biology', 'A'),
    higher('chemistry', 'A'),
    higher('physics', 'A'),
    higher('mathematics', 'A'),
    higher('english', 'A')
  ],
  advanced_higher_subjects: [
    advancedHigher('biology', 'A'),
    advancedHigher('chemistry', 'B')
  ]
};

const kmmsScottish = {
  national_5_subjects: [
    national5('english_language', 'A'),
    national5('mathematics', 'A')
  ],
  higher_subjects: [
    higher('biology', 'A'),
    higher('chemistry', 'A'),
    higher('physics', 'A'),
    higher('mathematics', 'A'),
    higher('english', 'B')
  ],
  advanced_higher_subjects: [
    advancedHigher('biology', 'A'),
    advancedHigher('chemistry', 'A'),
    advancedHigher('physics', 'B')
  ]
};

const cityScottish = {
  national_5_subjects: [
    national5('english_language', 'B'),
    national5('mathematics', 'B')
  ],
  higher_subjects: [
    higher('biology', 'A'),
    higher('chemistry', 'A'),
    higher('physics', 'A')
  ],
  advanced_higher_subjects: [
    advancedHigher('biology', 'A'),
    advancedHigher('chemistry', 'A')
  ]
};

const edgeHillScottish = {
  national_5_subjects: [],
  higher_subjects: [
    higher('biology', 'A'),
    higher('chemistry', 'A'),
    higher('physics', 'A'),
    higher('mathematics', 'A'),
    higher('english', 'B')
  ],
  advanced_higher_subjects: [
    advancedHigher('biology', 'A'),
    advancedHigher('chemistry', 'A'),
    advancedHigher('physics', 'A')
  ]
};

const aruScottish = {
  qualification_completion_year: 2026,
  national_5_subjects: [
    national5('english_language', 'B'),
    national5('mathematics', 'B'),
    national5('biology', 'B'),
    national5('chemistry', 'B')
  ],
  higher_subjects: [
    higher('biology', 'A'),
    higher('chemistry', 'A'),
    higher('physics', 'A'),
    higher('mathematics', 'A'),
    higher('english', 'A')
  ],
  advanced_higher_subjects: [
    advancedHigher('biology', 'A'),
    advancedHigher('chemistry', 'B'),
    advancedHigher('physics', 'B')
  ]
};

for (const courseId of courseIds) {
  assertConfigDelegatesScottish(courseId);
}

assert.strictEqual(
  configs['kent-and-medway-a100'].eligibility.scottish.post_16_routes,
  undefined,
  'KMMS legacy deterministic Scottish classifier threshold is retired'
);

{
  const applicant = baseScottishApplicant(keeleScottish);
  const classification = classify('keele-a100', applicant);
  const card = predictCard('keele-a100', applicant);

  assert.strictEqual(classification.eligibility.qualification_route, 'scottish');
  assert.strictEqual(classification.eligibility.status, 'eligible');
  assert.strictEqual(classification.eligibility.academic_pathway_id, 'keele_scottish_standard_s5_s6');
  assert.strictEqual(card.recommendation_display_state, 'insufficient_evidence');
  assert.strictEqual(card.academic_pathway_id, 'keele_scottish_standard_s5_s6');
  assert.ok(publicScottishChecks(card).every((check) => check.status === 'met'));
  assertNoAlevelEpqAlternative(card, 'Keele Scottish production Result Card');
  assert.doesNotMatch(JSON.stringify(card), /does not accept your qualification route|explicitly blocked/i);
}

{
  const applicant = baseScottishApplicant(kmmsScottish);
  const classification = classify('kent-and-medway-a100', applicant);
  const card = predictCard('kent-and-medway-a100', applicant);

  assert.strictEqual(classification.eligibility.qualification_route, 'scottish');
  assert.strictEqual(classification.eligibility.status, 'manual_review');
  assert.ok(
    classification.eligibility.manual_review_reasons.includes(
      'kmms_scottish_group_c_manual_equivalence'
    )
  );
  assert.strictEqual(card.recommendation_display_state, 'manual_review');
  assert.notStrictEqual(card.primary_user_facing_recommendation, 'Strong choice for your application');
  assert.strictEqual(card.prediction.result_band, 'insufficient_evidence');
}

{
  const applicant = baseScottishApplicant(cityScottish);
  const classification = classify('city-st-george-s-of-london-a100', applicant);
  const card = predictCard('city-st-george-s-of-london-a100', applicant);

  assert.strictEqual(classification.eligibility.qualification_route, 'scottish');
  assert.strictEqual(classification.eligibility.status, 'eligible');
  assert.strictEqual(classification.eligibility.academic_pathway_id, 'city_st_georges_scottish_standard');
  assert.deepStrictEqual(classification.eligibility.manual_review_reasons, []);
  assert.strictEqual(card.recommendation_display_state, 'standard');
  assert.strictEqual(card.academic_pathway_id, 'city_st_georges_scottish_standard');
  assert.doesNotMatch(JSON.stringify(card), /qualification route needs manual review/i);

  const failingApplicant = baseScottishApplicant(merge(cityScottish, {
    advanced_higher_subjects: [
      advancedHigher('biology', 'B'),
      advancedHigher('chemistry', 'A')
    ]
  }));
  const failingClassification = classify('city-st-george-s-of-london-a100', failingApplicant);
  const failingCard = predictCard('city-st-george-s-of-london-a100', failingApplicant);
  assert.strictEqual(failingClassification.eligibility.status, 'not_eligible');
  assert.ok(failingClassification.eligibility.failures.includes('scottish_post_16_requirements_not_met'));
  assert.strictEqual(failingCard.recommendation_display_state, 'not_eligible');
}

{
  const applicant = baseScottishApplicant(edgeHillScottish);
  const classification = classify('edge-hill-a100', applicant);
  const card = predictCard('edge-hill-a100', applicant);

  assert.strictEqual(classification.eligibility.qualification_route, 'scottish');
  assert.strictEqual(classification.eligibility.status, 'eligible');
  assert.strictEqual(classification.eligibility.academic_pathway_id, 'edge_hill_scottish_standard');
  assert.strictEqual(card.recommendation_display_state, 'standard');
  assert.strictEqual(card.academic_pathway_id, 'edge_hill_scottish_standard');
  assert.ok(publicScottishChecks(card).every((check) => check.status === 'met'));
  assert.doesNotMatch(JSON.stringify(card), /National 5.*not_met/i);
}

{
  const applicant = baseScottishApplicant(aruScottish);
  const classification = classify('anglia-ruskin-a100', applicant);
  const card = predictCard('anglia-ruskin-a100', applicant);

  assert.strictEqual(classification.eligibility.qualification_route, 'scottish');
  assert.strictEqual(classification.eligibility.status, 'eligible');
  assert.strictEqual(classification.eligibility.academic_pathway_id, 'aru_scottish_standard');
  assert.deepStrictEqual(classification.eligibility.manual_review_reasons, []);
  assert.strictEqual(card.recommendation_display_state, 'standard');
  assert.strictEqual(card.academic_pathway_id, 'aru_scottish_standard');
  assert.doesNotMatch(JSON.stringify(card), /qualification route needs manual review/i);

  const staleRecencyClassification = classify(
    'anglia-ruskin-a100',
    baseScottishApplicant(merge(aruScottish, { qualification_completion_year: 2021 }))
  );
  assert.strictEqual(staleRecencyClassification.eligibility.status, 'not_eligible');
  assert.ok(staleRecencyClassification.eligibility.failures.includes('scottish_post_16_requirements_not_met'));

  const failingApplicant = baseScottishApplicant(merge(aruScottish, {
    higher_subjects: [
      higher('biology', 'A'),
      higher('chemistry', 'A'),
      higher('physics', 'A'),
      higher('mathematics', 'B'),
      higher('english', 'B')
    ],
    advanced_higher_subjects: [
      advancedHigher('biology', 'B'),
      advancedHigher('chemistry', 'B'),
      advancedHigher('physics', 'B')
    ]
  }), {
    applicant_identity: {
      contextual: true,
      widening_participation: true,
      contextual_flags: {
        wams: true,
        free_school_meals: true
      }
    }
  });
  const failingClassification = classify('anglia-ruskin-a100', failingApplicant);
  const failingCard = predictCard('anglia-ruskin-a100', failingApplicant);
  assert.strictEqual(failingClassification.eligibility.status, 'not_eligible');
  assert.ok(failingClassification.eligibility.failures.includes('scottish_post_16_requirements_not_met'));
  assert.strictEqual(failingCard.recommendation_display_state, 'not_eligible');

  const missingRecencyProfile = clone(aruScottish);
  delete missingRecencyProfile.qualification_completion_year;
  const missingRecencyClassification = classify(
    'anglia-ruskin-a100',
    baseScottishApplicant(missingRecencyProfile)
  );
  const missingRecencyCard = predictCard(
    'anglia-ruskin-a100',
    baseScottishApplicant(missingRecencyProfile)
  );
  assert.strictEqual(missingRecencyClassification.eligibility.status, 'manual_review');
  assert.ok(
    missingRecencyClassification.eligibility.manual_review_reasons.includes(
      'aru_scottish_qualification_recency_requires_review'
    )
  );
  assert.strictEqual(missingRecencyCard.recommendation_display_state, 'manual_review');

  const subjectLevelRecencyProfile = merge(missingRecencyProfile, {
    higher_subjects: missingRecencyProfile.higher_subjects.map((subject) => ({
      ...subject,
      completion_year: 2025
    })),
    advanced_higher_subjects: missingRecencyProfile.advanced_higher_subjects.map((subject) => ({
      ...subject,
      completion_year: 2026
    }))
  });
  const subjectLevelRecencyClassification = classify(
    'anglia-ruskin-a100',
    baseScottishApplicant(subjectLevelRecencyProfile)
  );
  assert.strictEqual(subjectLevelRecencyClassification.eligibility.status, 'eligible');
  assert.strictEqual(
    subjectLevelRecencyClassification.eligibility.academic_pathway_id,
    'aru_scottish_standard'
  );

  const scotlandDomicileApplicant = baseScottishApplicant(aruScottish, {
    applicant_identity: { domicile: 'scotland' }
  });
  const scotlandDomicileClassification = classify('anglia-ruskin-a100', scotlandDomicileApplicant);
  const scotlandDomicileCard = predictCard('anglia-ruskin-a100', scotlandDomicileApplicant);
  assert.strictEqual(scotlandDomicileClassification.eligibility.qualification_route, 'scottish');
  assert.strictEqual(scotlandDomicileClassification.eligibility.status, 'eligible');
  assert.strictEqual(scotlandDomicileCard.academic_pathway_id, 'aru_scottish_standard');
}

console.log('Batch 5 production Scottish routing regression: PASS');
