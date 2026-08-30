const assert = require('assert');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const courses = Object.fromEntries(
  [
    'keele-a100',
    'kent-and-medway-a100',
    'city-st-george-s-of-london-a100',
    'edge-hill-a100',
    'anglia-ruskin-a100'
  ].map((id) => [id, require(path.join(rootDir, 'data', 'universities', `${id}.json`))])
);
const {
  evaluateCourseEligibility,
  evaluateContextualEligibility
} = require('../../assets/js/engine/eligibility-evaluator');

function merge(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return source === undefined ? structuredClone(target) : source;
  }
  const output = Array.isArray(target) ? [...target] : { ...target };
  for (const [key, value] of Object.entries(source)) {
    output[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge(output[key] || {}, value)
      : value;
  }
  return output;
}

function aLevelSubjects(grades) {
  return Object.entries(grades).map(([subject_id, predicted_grade]) => ({
    subject_id,
    predicted_grade,
    practical_endorsement: ['biology', 'chemistry', 'human_biology'].includes(subject_id)
      ? 'pass'
      : 'not_applicable'
  }));
}

function baseApplicant(overrides = {}) {
  return merge({
    profile_id: 'batch5-base',
    application_year: 2027,
    qualification_route: 'a_level',
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: 'home',
      domicile: 'england',
      contextual: false,
      contextual_flags: {},
      graduate: false,
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
    gcse_profile: {
      subjects: {
        english_language: '7',
        mathematics: '7',
        biology: '7',
        chemistry: '7',
        physics: '7',
        history: '7',
        geography: '7'
      }
    },
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: aLevelSubjects({ biology: 'A', chemistry: 'A', mathematics: 'A*' })
    },
    admissions_tests: {
      ucat: {
        taken: true,
        test_year: 2026,
        total_score: 2400,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 600,
          decision_making: 600,
          quantitative_reasoning: 600
        },
        sjt_band: 2
      }
    }
  }, overrides);
}

function scottishApplicant(overrides = {}) {
  return baseApplicant(merge({
    qualification_route: 'scottish',
    applicant_identity: {
      domicile: 'england',
      contextual: false,
      contextual_flags: {}
    },
    a_level_profile: undefined,
    scottish_profile: {
      qualification_recency_confirmed: true,
      national_5_subjects: [
        { subject_id: 'english_language', grade: 'A', completion_year: 2024 },
        { subject_id: 'mathematics', grade: 'A', completion_year: 2024 },
        { subject_id: 'biology', grade: 'A', completion_year: 2024 },
        { subject_id: 'chemistry', grade: 'A', completion_year: 2024 },
        { subject_id: 'physics', grade: 'A', completion_year: 2024 },
        { subject_id: 'history', grade: 'A', completion_year: 2024 }
      ],
      higher_subjects: [
        { subject_id: 'biology', achieved_grade: 'A', school_year: 's5', completion_year: 2025 },
        { subject_id: 'chemistry', achieved_grade: 'A', school_year: 's5', completion_year: 2025 },
        { subject_id: 'physics', achieved_grade: 'A', school_year: 's5', completion_year: 2025 },
        { subject_id: 'mathematics', achieved_grade: 'A', school_year: 's5', completion_year: 2025 },
        { subject_id: 'english', achieved_grade: 'A', school_year: 's5', completion_year: 2025 }
      ],
      advanced_higher_subjects: [
        { subject_id: 'biology', predicted_grade: 'A', school_year: 's6', completion_year: 2026 },
        { subject_id: 'chemistry', predicted_grade: 'A', school_year: 's6', completion_year: 2026 },
        { subject_id: 'physics', predicted_grade: 'A', school_year: 's6', completion_year: 2026 }
      ]
    }
  }, overrides));
}

function evaluate(courseId, applicant) {
  return evaluateCourseEligibility(courses[courseId], applicant);
}

function contextual(courseId, applicant) {
  return evaluateContextualEligibility(courses[courseId], applicant);
}

for (const courseId of Object.keys(courses)) {
  const englandAlevel = evaluate(courseId, baseApplicant({
    applicant_identity: { domicile: 'england' }
  }));
  assert.strictEqual(englandAlevel.qualification_route, 'a_level', `${courseId}: England domicile + A levels uses A-level route`);

  const scotlandAlevel = evaluate(courseId, baseApplicant({
    applicant_identity: { domicile: 'scotland' }
  }));
  assert.strictEqual(scotlandAlevel.qualification_route, 'a_level', `${courseId}: Scotland domicile + A levels uses A-level route`);

  const englandScottish = evaluate(courseId, scottishApplicant({
    applicant_identity: { domicile: 'england' }
  }));
  assert.strictEqual(englandScottish.qualification_route, 'scottish', `${courseId}: England domicile + Scottish qualifications uses Scottish route`);

  const scotlandScottish = evaluate(courseId, scottishApplicant({
    applicant_identity: { domicile: 'scotland' }
  }));
  assert.strictEqual(scotlandScottish.qualification_route, 'scottish', `${courseId}: Scotland domicile + Scottish qualifications uses Scottish route`);
}

assert.strictEqual(
  contextual('keele-a100', baseApplicant({
    applicant_identity: { contextual: true, contextual_flags: { free_school_meals: true } }
  })).status,
  'not_contextual',
  'Keele legacy contextual flags alone must not activate ordinary contextual eligibility'
);
assert.strictEqual(
  contextual('keele-a100', baseApplicant({
    contextual_profile: {
      financial_support: { free_school_meals: 'yes' }
    }
  })).status,
  'contextual',
  'Keele one Step 6 indicator is sufficient'
);
assert.strictEqual(
  contextual('keele-a100', baseApplicant({
    contextual_profile: {
      school_education: {
        current_or_most_recent_uk_school_independent_fee_paying: 'yes'
      },
      home_area_region: { polar4_quintile: 'q1' }
    }
  })).status,
  'not_contextual',
  'Keele POLAR/IMD route requires state-school evidence'
);
assert.strictEqual(
  contextual('keele-a100', baseApplicant({
    contextual_profile: {
      school_education: {
        current_or_most_recent_uk_school_independent_fee_paying: 'not_sure'
      },
      home_area_region: { polar4_quintile: 'q1' }
    }
  })).status,
  'information_needed',
  'Keele unresolved state-school status is material when low-area evidence is present'
);
assert.strictEqual(
  evaluate('keele-a100', baseApplicant({
    contextual_profile: {
      financial_support: { free_school_meals: 'yes' }
    },
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: aLevelSubjects({ biology: 'A', chemistry: 'A', mathematics: 'B' })
    }
  })).academic_pathway_id,
  'keele_contextual_a_level_aab',
  'Keele contextual A-level route applies AAB without weakening subjects'
);
assert.strictEqual(
  evaluate('keele-a100', scottishApplicant()).status,
  'eligible',
  'Keele positive Scottish S5/S6 route is deterministic'
);
assert.strictEqual(
  evaluate('keele-a100', scottishApplicant({
    scottish_profile: {
      higher_subjects: [
        { subject_id: 'biology', achieved_grade: 'A' },
        { subject_id: 'chemistry', achieved_grade: 'A' },
        { subject_id: 'physics', achieved_grade: 'A' },
        { subject_id: 'mathematics', achieved_grade: 'A' },
        { subject_id: 'english', achieved_grade: 'A' }
      ]
    }
  })).status,
  'manual_review',
  'Keele missing S5/S6 timing evidence is manual review, not invented eligibility'
);

const kmmsScottish = evaluate('kent-and-medway-a100', scottishApplicant());
assert.strictEqual(kmmsScottish.status, 'manual_review', 'KMMS Scottish qualifications use Group C/manual equivalence');
assert.ok(
  kmmsScottish.manual_review_reasons.includes('kmms_scottish_group_c_manual_equivalence'),
  'KMMS Scottish route must not promote a deterministic Scottish grade threshold'
);
assert.strictEqual(
  contextual('kent-and-medway-a100', baseApplicant({
    contextual_profile: {
      financial_support: { free_school_meals: 'yes' },
      home_area_region: { polar4_quintile: 'q1' }
    }
  })).is_contextual,
  false,
  'KMMS ordinary Step 6 markers must not create a binary lower-offer contextual route'
);

assert.strictEqual(
  contextual('city-st-george-s-of-london-a100', baseApplicant({
    contextual_profile: {
      personal_circumstances: { care_experienced: 'yes' }
    }
  })).matched_contextual_pathway,
  'city_st_georges_group_1_contextual_offer',
  'City St George Group 1 one criterion qualifies'
);
assert.strictEqual(
  contextual('city-st-george-s-of-london-a100', baseApplicant({
    contextual_profile: {
      home_area_region: { polar4_quintile: 'q1' }
    }
  })).status,
  'not_contextual',
  'City St George Group 2 one criterion does not qualify'
);
assert.strictEqual(
  evaluate('city-st-george-s-of-london-a100', baseApplicant({
    contextual_profile: {
      personal_circumstances: { care_experienced: 'yes' }
    },
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: aLevelSubjects({ biology: 'A', chemistry: 'B', mathematics: 'B' })
    }
  })).academic_pathway_id,
  'city_st_georges_contextual_a_level_abb',
  'City St George Group 1/2 contextual route can apply ABB while preserving Biology and Chemistry'
);
assert.strictEqual(
  contextual('city-st-george-s-of-london-a100', baseApplicant({
    contextual_profile: {
      personal_circumstances: { service_child: 'yes' }
    }
  })).is_contextual,
  false,
  'City St George Group 3 support-only status must not activate grade reduction'
);
assert.strictEqual(
  evaluate('city-st-george-s-of-london-a100', scottishApplicant({
    scottish_profile: {
      advanced_higher_subjects: [
        { subject_id: 'biology', predicted_grade: 'A', completion_year: 2026 },
        { subject_id: 'chemistry', predicted_grade: 'B', completion_year: 2026 }
      ]
    }
  })).status,
  'not_eligible',
  'City St George Advanced Higher below AA is not eligible'
);

assert.strictEqual(
  evaluate('edge-hill-a100', scottishApplicant()).status,
  'eligible',
  'Edge Hill positive Scottish route is deterministic'
);
assert.strictEqual(
  evaluate('edge-hill-a100', scottishApplicant({
    scottish_profile: {
      national_5_subjects: [],
      higher_subjects: [
        { subject_id: 'biology', achieved_grade: 'A' },
        { subject_id: 'chemistry', achieved_grade: 'A' },
        { subject_id: 'physics', achieved_grade: 'A' },
        { subject_id: 'mathematics', achieved_grade: 'A' },
        { subject_id: 'english', achieved_grade: 'B' }
      ],
      advanced_higher_subjects: [
        { subject_id: 'biology', predicted_grade: 'A' },
        { subject_id: 'chemistry', predicted_grade: 'A' },
        { subject_id: 'physics', predicted_grade: 'A' }
      ]
    }
  })).status,
  'eligible',
  'Edge Hill must not fail on an invented National 5 rule'
);
assert.strictEqual(
  contextual('edge-hill-a100', baseApplicant({
    contextual_profile: {
      access_programmes: {
        participation_status: 'yes',
        other_programmes: [
          { programme_id: 'edge_hill_wam', status: 'completed' }
        ]
      }
    }
  })).matched_contextual_pathway,
  'edge_hill_wam_threshold_extension',
  'Edge Hill WAM completion triggers only the verified threshold-extension pathway'
);
assert.strictEqual(
  contextual('edge-hill-a100', baseApplicant({
    contextual_profile: {
      access_programmes: {
        edge_hill_a100_wp_criteria_review_requested: 'yes'
      }
    }
  })).status,
  'information_needed',
  'Edge Hill exact A100 WP criteria remain an evidence gap when needed'
);

assert.strictEqual(
  contextual('anglia-ruskin-a100', baseApplicant({
    contextual_profile: {
      personal_circumstances: {
        permanent_right_to_remain_in_uk: 'yes',
        ordinarily_resident_uk_three_years: 'yes'
      },
      financial_support: { free_school_meals_last_five_years: 'yes' }
    }
  })).matched_contextual_pathway,
  'aru_wams',
  'ARU direct WAMS criteria work without the state-school prerequisite'
);
assert.strictEqual(
  contextual('anglia-ruskin-a100', baseApplicant({
    contextual_profile: {
      personal_circumstances: {
        permanent_right_to_remain_in_uk: 'yes',
        ordinarily_resident_uk_three_years: 'yes'
      },
      financial_support: { ucat_bursary_recipient: 'yes' }
    }
  })).status,
  'not_contextual',
  'ARU conditional criteria require non-selective state GCSE school evidence'
);
assert.strictEqual(
  evaluate('anglia-ruskin-a100', baseApplicant({
    contextual_profile: {
      personal_circumstances: {
        permanent_right_to_remain_in_uk: 'yes',
        ordinarily_resident_uk_three_years: 'yes'
      },
      financial_support: { free_school_meals_last_five_years: 'yes' }
    },
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: aLevelSubjects({ biology: 'A', chemistry: 'B', mathematics: 'B' })
    }
  })).academic_pathway_id,
  'aru_a_level_wams_abb_science_route',
  'ARU WAMS gives the ABB A-level route'
);
assert.strictEqual(
  evaluate('anglia-ruskin-a100', scottishApplicant({
    contextual_profile: {
      personal_circumstances: {
        permanent_right_to_remain_in_uk: 'yes',
        ordinarily_resident_uk_three_years: 'yes'
      },
      financial_support: { free_school_meals_last_five_years: 'yes' }
    },
    scottish_profile: {
      advanced_higher_subjects: [
        { subject_id: 'biology', predicted_grade: 'B', completion_year: 2026 },
        { subject_id: 'chemistry', predicted_grade: 'B', completion_year: 2026 },
        { subject_id: 'physics', predicted_grade: 'B', completion_year: 2026 }
      ]
    }
  })).status,
  'not_eligible',
  'ARU WAMS must not invent a reduced Scottish grade profile'
);
assert.strictEqual(
  evaluate('anglia-ruskin-a100', scottishApplicant({
    scottish_profile: {
      qualification_recency_confirmed: false,
      higher_subjects: [
        { subject_id: 'biology', achieved_grade: 'A', school_year: 's5', completion_year: 2021 },
        { subject_id: 'chemistry', achieved_grade: 'A', school_year: 's5', completion_year: 2021 },
        { subject_id: 'physics', achieved_grade: 'A', school_year: 's5', completion_year: 2021 },
        { subject_id: 'mathematics', achieved_grade: 'A', school_year: 's5', completion_year: 2021 },
        { subject_id: 'english', achieved_grade: 'A', school_year: 's5', completion_year: 2021 }
      ]
    }
  })).status,
  'not_eligible',
  'ARU Scottish qualifications outside the verified recency window are not eligible'
);

console.log('PASS: Batch 5 contextual and Scottish cross-qualification regression');
