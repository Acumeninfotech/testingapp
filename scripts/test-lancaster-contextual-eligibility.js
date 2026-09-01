#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateContextualEligibility,
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');
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

const course = readJson('data/universities/lancaster-a100.json');
const config = readJson('data/interview-band-configs/lancaster-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/lancaster-a100.json');

function baselineApplicant(overrides = {}) {
  return merge(fixture.base_applicant, overrides);
}

function untouchedUiContextualProfile() {
  return {
    home_area_region: {
      postcode: '',
      polar4_quintile: 'unknown',
      imd_quintile: 'unknown',
      tundra_quintile: 'unknown',
      simd_quintile: 'unknown',
      home_region: null,
      specific_home_area: null,
      school_area: null,
      regional_flags: {},
      postcode_lookup: {
        status: 'not_checked',
        values: {
          polar4: { value: null, source: 'unknown' },
          tundra: { value: null, source: 'unknown' },
          imd: { value: null, source: 'unknown', dataset_year: 2019 }
        }
      }
    },
    financial_support: {},
    school_education: {},
    personal_circumstances: {},
    access_programmes: {
      participation_status: 'no',
      ukwpmed: {
        status: 'no',
        programme_id: '',
        programme_status: '',
        provider_university_id: '',
        completion_year: '',
        not_sure_programme: false
      },
      other_programmes: [],
      other_programme_name: ''
    },
    partner_schools: {
      status: 'no',
      relationships: []
    }
  };
}

function uiShapedStandardApplicant(overrides = {}) {
  return baselineApplicant(merge({
    profile_id: 'wizard_profile',
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: 'home_fee',
      domicile: 'england',
      age_at_course_start_band: 'age_19',
      current_uk_residence: 'yes',
      contextual: false,
      contextual_flags: {
        care_experienced: false,
        refugee_or_asylum_seeker: false,
        free_school_meals: false,
        first_generation_higher_education: false,
        school_contextual_indicator: false,
        ucat_bursary: false
      },
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
    contextual_profile: untouchedUiContextualProfile(),
    gcse_profile: {
      subjects: {
        english_language: '9',
        english_literature: '8',
        mathematics: '9',
        biology: '9',
        chemistry: '9',
        physics: '8'
      },
      additional_subjects: [
        { subject_id: 'geography', grade: '9' },
        { subject_id: 'history', grade: '8' },
        { subject_id: 'french', grade: '9' },
        { subject_id: 'computer_science', grade: '8' },
        { subject_id: 'religious_studies', grade: '9' }
      ],
      total_gcse_count: 11,
      top_9_gcse_grades: ['9', '9', '9', '9', '9', '8', '8', '8', '8']
    },
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 740,
          decision_making: 730,
          quantitative_reasoning: 730
        },
        sjt_band: 1,
        test_year: 2026
      }
    }
  }, overrides));
}

{
  const applicant = baselineApplicant({
    contextual_profile: {
      personal_circumstances: {
        care_experienced: 'yes'
      }
    }
  });
  const result = evaluateContextualEligibility(course, applicant);
  assert.strictEqual(result.status, 'contextual');
  assert.strictEqual(result.policy_decision, 'automatic_care_route_confirmed');
  assert.deepStrictEqual(result.activated_applicant_group_ids, ['contextual', 'widening_participation']);
}

{
  const applicant = baselineApplicant({
    contextual_profile: {
      personal_circumstances: {
        uk_refugee_status_granted: 'yes'
      }
    }
  });
  const result = evaluateContextualEligibility(course, applicant);
  assert.strictEqual(result.status, 'contextual');
  assert.strictEqual(result.policy_decision, 'automatic_refugee_route_confirmed');
}

{
  const applicant = baselineApplicant({
    contextual_profile: {
      financial_support: {
        free_school_meals: 'yes',
        means_tested_benefits: 'yes',
        ema_or_16_19_bursary: 'yes'
      }
    }
  });
  const result = evaluateContextualEligibility(course, applicant);
  assert.strictEqual(result.status, 'not_contextual');
  assert.deepStrictEqual(result.contextual_evidence.confirmed_wp_categories, ['low_income_household']);
  assert.strictEqual(
    result.qualifying_criteria.filter((entry) => entry.criterion_id === 'low_income_household').length,
    1,
    'Low-income evidence should deduplicate to a single Lancaster WP category.'
  );
}

{
  const applicant = baselineApplicant({
    contextual_profile: {
      financial_support: {
        free_school_meals: 'yes'
      },
      school_education: {
        low_progression_to_higher_education_school: 'yes',
        low_attainment_school: 'yes'
      }
    }
  });
  const result = evaluateContextualEligibility(course, applicant);
  assert.strictEqual(result.status, 'contextual');
  assert.strictEqual(result.policy_decision, 'two_distinct_wp_categories_confirmed');
  assert.deepStrictEqual(
    result.contextual_evidence.confirmed_wp_categories.sort(),
    ['low_income_household', 'school_disadvantage'].sort()
  );
  assert.strictEqual(
    result.qualifying_criteria.filter((entry) => entry.criterion_id === 'school_disadvantage').length,
    1,
    'School evidence should deduplicate to a single Lancaster WP category.'
  );
}

{
  const applicant = baselineApplicant({
    contextual_profile: untouchedUiContextualProfile()
  });
  const result = evaluateContextualEligibility(course, applicant);
  assert.strictEqual(result.status, 'not_contextual');
  assert.strictEqual(result.policy_decision, 'published_subset_not_confirmed');
  assert.strictEqual(result.is_contextual, false);
  assert.ok(
    !result.missing_information.some((entry) => entry.criterion_id === 'area_disadvantage'),
    'Untouched UI Step 6 defaults must not create Lancaster area-disadvantage manual review.'
  );
}

{
  const applicant = uiShapedStandardApplicant();
  const classification = classifyInterviewBand(course, config, applicant);
  const [apiResult] = predict({
    universityIds: ['lancaster-a100'],
    studentProfile: applicant
  });
  assert.strictEqual(classification.eligibility.contextual_eligibility.status, 'not_contextual');
  assert.strictEqual(classification.eligibility.status, 'eligible');
  assert.strictEqual(classification.manual_review_required === true, false);
  assert.strictEqual(classification.guidance_pool_id, 'home_standard_school_leaver');
  assert.notStrictEqual(classification.canonical_interview_band, 'insufficient_evidence');
  assert.strictEqual(apiResult.result_card.recommendation_display_state, 'standard');
  assert.notStrictEqual(apiResult.result_card.primary_user_facing_recommendation, 'More information is required');
}

{
  const applicant = baselineApplicant({
    contextual_profile: {
      home_area_region: {
        postcode: 'LA1 4YW',
        imd_quintile: 'q1',
        postcode_lookup: {
          status: 'checked',
          values: {
            imd: { value: 1, source: 'postcode_lookup', dataset_year: 2019 }
          }
        }
      },
      financial_support: {
        free_school_meals: 'yes'
      }
    }
  });
  const result = evaluateContextualEligibility(course, applicant);
  assert.strictEqual(result.status, 'information_needed');
  assert.strictEqual(result.is_contextual, false);
  assert.ok(
    result.missing_information.some((entry) => entry.reason === 'lancaster_area_disadvantage_requires_manual_review'),
    'Area evidence without a Lancaster-published executable cutoff should stay manual-review only.'
  );
}

{
  const applicant = baselineApplicant({
    applicant_identity: {
      contextual_flags: {
        care_experienced: true,
        free_school_meals: true,
        first_generation_higher_education: true,
        school_contextual_indicator: true,
        ucat_bursary: true
      }
    }
  });
  const result = evaluateContextualEligibility(course, applicant);
  assert.strictEqual(result.status, 'not_contextual');
  assert.deepStrictEqual(result.activated_applicant_group_ids, []);
}

{
  const applicant = baselineApplicant({
    applicant_identity: {
      contextual_flags: {
        refugee_or_asylum_seeker: true
      }
    }
  });

  const result = evaluateContextualEligibility(course, applicant);

  assert.strictEqual(result.status, 'not_contextual');
  assert.strictEqual(result.is_contextual, false);
  assert.deepStrictEqual(result.activated_applicant_group_ids, []);
  assert.ok(
    !result.missing_information.some(
      (entry) =>
        entry.reason ===
        'lancaster_refugee_status_confirmation_required'
    ),
    'Legacy refugee/asylum flags must not alter Lancaster contextual decision state.'
  );
}

{
  const applicant = baselineApplicant({
    applicant_identity: {
      contextual_flags: {
        care_experienced: true
      }
    },
    admissions_tests: {
      ucat: {
        total_score: 1870
      }
    }
  });
  const eligibility = evaluateCourseEligibility(course, applicant);
  const classification = classifyInterviewBand(course, config, applicant);
  assert.ok(!eligibility.applicant_group_ids.includes('contextual'));
  assert.ok(!eligibility.applicant_group_ids.includes('widening_participation'));
  assert.strictEqual(classification.guidance_pool_id, 'home_standard_school_leaver');
}

{
  const applicant = baselineApplicant({
    contextual_profile: {
      financial_support: {
        free_school_meals: 'yes'
      },
      school_education: {
        low_progression_to_higher_education_school: 'yes'
      }
    },
    admissions_tests: {
      ucat: {
        total_score: 1920
      }
    }
  });
  const classification = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(classification.guidance_pool_id, 'home_contextual_wp_school_leaver');
  assert.notStrictEqual(classification.interview_outcome, 'guaranteed_interview');
}

{
  const applicant = baselineApplicant({
    contextual_profile: {
      personal_circumstances: {
        first_in_family_at_university: 'yes'
      }
    }
  });

  const result = evaluateContextualEligibility(course, applicant);

  assert.strictEqual(result.status, 'information_needed');
  assert.strictEqual(result.is_contextual, false);
  assert.ok(
    result.missing_information.some(
      (entry) =>
        entry.criterion_id ===
          'first_generation_higher_education' &&
        entry.reason ===
          'lancaster_parental_he_history_confirmation_required'
    ),
    'Generic first-in-family evidence must not over-confirm Lancaster parental HE eligibility.'
  );
}

{
  const applicant = baselineApplicant({
    contextual_profile: {
      personal_circumstances: {
        young_or_adult_carer: 'yes'
      }
    }
  });

  const result = evaluateContextualEligibility(course, applicant);

  assert.strictEqual(result.status, 'information_needed');
  assert.strictEqual(result.is_contextual, false);
  assert.ok(
    result.missing_information.some(
      (entry) =>
        entry.criterion_id === 'young_carer' &&
        entry.reason ===
          'lancaster_young_carer_relationship_confirmation_required'
    ),
    'Generic carer evidence must not over-confirm Lancaster young-carer-to-parent-or-sibling eligibility.'
  );
}

function withLancasterAccess(status, overrides = {}) {
  return baselineApplicant(merge({
    contextual_profile: {
      personal_circumstances: {
        care_experienced: 'yes'
      },
      access_programmes: {
        other_programmes: [
          {
            programme_id: 'lancaster_access_to_medicine',
            status
          }
        ]
      }
    }
  }, overrides));
}

function assertNotLancasterAccessGuarantee(classification, message) {
  assert.notStrictEqual(
    classification.interview_outcome,
    'guaranteed_interview',
    message
  );
  assert.notStrictEqual(
    classification.selection_route_id,
    'lancaster_access_to_medicine_guaranteed_interview',
    message
  );
}

{
  const classification = classifyInterviewBand(
    course,
    config,
    withLancasterAccess('completed')
  );
  assert.strictEqual(classification.eligibility.status, 'eligible');
  assert.strictEqual(classification.guidance_pool_id, null);
  assert.strictEqual(classification.canonical_interview_band, null);
  assert.strictEqual(classification.interview_outcome, 'guaranteed_interview');
  assert.strictEqual(
    classification.selection_route_id,
    'lancaster_access_to_medicine_guaranteed_interview'
  );
  assert.strictEqual(
    classification.source_interview_band_id,
    'lancaster_access_to_medicine_guaranteed_interview'
  );
}

for (const status of ['participating', 'offered', 'not_sure']) {
  const classification = classifyInterviewBand(
    course,
    config,
    withLancasterAccess(status)
  );
  assert.strictEqual(
    classification.guidance_pool_id,
    'home_contextual_wp_school_leaver',
    `Lancaster Access status ${status} must fall back to the contextual UCAT pool.`
  );
  assertNotLancasterAccessGuarantee(
    classification,
    `Lancaster Access status ${status} must not guarantee an interview.`
  );
}

{
  const classification = classifyInterviewBand(
    course,
    config,
    baselineApplicant({
      contextual_profile: {
        access_programmes: {
          other_programmes: [
            {
              programme_id: 'lancaster_access_to_medicine',
              status: 'completed'
            }
          ]
        }
      }
    })
  );
  assert.strictEqual(classification.eligibility.status, 'manual_review');
  assertNotLancasterAccessGuarantee(
    classification,
    'Lancaster Access completion alone must not guarantee an interview without confirmed contextual eligibility.'
  );
}

{
  const classification = classifyInterviewBand(
    course,
    config,
    withLancasterAccess('completed', {
      contextual_profile: {
        access_programmes: {
          ukwpmed: {
            programme_id: 'ukwpmed',
            status: 'completed'
          },
          other_programmes: [
            {
              programme_id: 'ukwpmed',
              status: 'completed'
            }
          ]
        }
      }
    })
  );
  assert.strictEqual(
    classification.guidance_pool_id,
    'home_contextual_wp_school_leaver'
  );
  assertNotLancasterAccessGuarantee(
    classification,
    'UKWPMED completion must not be treated as Lancaster Access to Medicine.'
  );
}

{
  const classification = classifyInterviewBand(
    course,
    config,
    withLancasterAccess('completed', {
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
            predicted_grade: 'B',
            sitting_status: 'first_sitting',
            practical_endorsement: 'pass'
          },
          {
            subject_id: 'mathematics',
            predicted_grade: 'B',
            sitting_status: 'first_sitting'
          }
        ]
      }
    })
  );
  assert.strictEqual(classification.eligibility.status, 'not_eligible');
  assertNotLancasterAccessGuarantee(
    classification,
    'Lancaster Access completion must not rescue a Stage 1 academic failure.'
  );
}

{
  const classification = classifyInterviewBand(
    course,
    config,
    withLancasterAccess('completed', {
      admissions_tests: {
        ucat: {
          total_score: null
        }
      }
    })
  );
  assert.strictEqual(classification.eligibility.status, 'not_eligible');
  assert.ok(classification.eligibility.failures.includes('required_admissions_test_missing:ucat'));
  assertNotLancasterAccessGuarantee(
    classification,
    'Lancaster Access completion must not bypass the required UCAT condition.'
  );
}

{
  const classification = classifyInterviewBand(
    course,
    config,
    withLancasterAccess('completed', {
      admissions_tests: {
        ucat: {
          sjt_band: 4
        }
      }
    })
  );
  assert.strictEqual(classification.eligibility.status, 'not_eligible');
  assert.ok(classification.eligibility.failures.includes('sjt_band_excluded'));
  assertNotLancasterAccessGuarantee(
    classification,
    'Lancaster Access completion must not bypass the SJT Band 4 exclusion.'
  );
}

console.log('Lancaster contextual eligibility regression: PASS');
