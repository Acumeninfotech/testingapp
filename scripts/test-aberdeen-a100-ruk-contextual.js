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

function contextualProfile(overrides = {}) {
  return merge({
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
  }, overrides);
}

const course = readJson('data/universities/aberdeen-a100.json');
const config = readJson('data/interview-band-configs/aberdeen-a100.json');
const baseApplicant = readJson(
  'data/fixtures/interview-band-classification/shared-standard-school-leaver.json'
).applicant;

function rukAabApplicant(overrides = {}) {
  return merge(baseApplicant, merge({
    profile_id: 'aberdeen_ruk_contextual_manual_target',
    qualification_route: 'a_level',
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      contextual_status_confirmed: false,
      contextual_flags: {
        plus_flag: false,
        flag: false,
        simd20: false,
        simd40: false,
        care_experienced: false,
        refugee: false,
        asylum_seeker: false,
        ucat_bursary: false,
        school_contextual_indicator: false,
        free_school_meals: false,
        first_generation_higher_education: false
      }
    },
    a_level_profile: {
      subjects: [
        {
          subject_id: 'chemistry',
          predicted_grade: 'A',
          achieved_grade: null,
          sitting_status: 'first_sitting',
          practical_endorsement: 'pass'
        },
        {
          subject_id: 'biology',
          predicted_grade: 'A',
          achieved_grade: null,
          sitting_status: 'first_sitting',
          practical_endorsement: 'pass'
        },
        {
          subject_id: 'mathematics',
          predicted_grade: 'B',
          achieved_grade: null,
          sitting_status: 'first_sitting',
          practical_endorsement: null
        }
      ],
      sitting_status: 'first_sitting'
    },
    admissions_tests: {
      ucat: {
        total_score: 2050,
        score_scale: 2700,
        sjt_band: 2,
        subtests: {
          verbal_reasoning: 680,
          decision_making: 685,
          quantitative_reasoning: 685,
          abstract_reasoning: 0
        }
      }
    },
    contextual_profile: contextualProfile({
      home_area_region: {
        polar4_quintile: 'q1'
      }
    })
  }, overrides));
}

assert.strictEqual(
  course.contextual_admissions.contextual_eligibility.evaluator_id,
  'aberdeen_contextual_medicine_a100'
);
assert.strictEqual(
  course.contextual_admissions.contextual_eligibility.controls_group_routing,
  true
);

const polarApplicant = rukAabApplicant();
const polarContextual = evaluateContextualEligibility(course, polarApplicant);
assert.strictEqual(polarContextual.status, 'contextual');
assert.strictEqual(polarContextual.evaluator_id, 'aberdeen_contextual_medicine_a100');
assert.strictEqual(polarContextual.matched_contextual_pathway, 'polar4_quintile_1');
assert.deepStrictEqual(
  polarContextual.activated_applicant_group_ids,
  ['contextual', 'widening_participation']
);
assert.strictEqual(polarContextual.ucat_uplift_percent, null);

const polarEligibility = evaluateCourseEligibility(course, polarApplicant);
assert.strictEqual(polarEligibility.status, 'eligible');
assert.strictEqual(polarEligibility.academic_pathway, 'contextual');
assert.strictEqual(
  polarEligibility.academic_pathway_id,
  'aberdeen_a_level_widening_access_offer'
);
assert.ok(polarEligibility.applicant_group_ids.includes('contextual'));
assert.ok(polarEligibility.applicant_group_ids.includes('widening_participation'));
assert.ok(!polarEligibility.applicant_group_ids.includes('care_experienced'));
assert.ok(!polarEligibility.guaranteed_interview);

const polarClassification = classifyInterviewBand(course, config, polarApplicant);
assert.strictEqual(polarClassification.eligibility.status, 'eligible');
assert.strictEqual(polarClassification.guidance_pool_id, 'home_rest_of_uk_school_leaver');
assert.strictEqual(polarClassification.ranking.value, 2050);
assert.strictEqual(polarClassification.band_metric.value, 2050);
assert.strictEqual(polarClassification.interview_outcome || null, null);
assert.strictEqual(polarClassification.guaranteed_interview_notice || null, null);

const polarPrediction = predict({
  universityIds: ['aberdeen-a100'],
  studentProfile: polarApplicant
})[0].result_card;
const polarDecisionText = JSON.stringify(polarPrediction.decision_transparency || {});
assert.match(
  polarDecisionText,
  /Contextual eligibility confirmed/
);
assert.match(
  polarDecisionText,
  /applied contextual offer AAB/
);
assert.match(
  polarDecisionText,
  /Rest of UK applicants/
);
assert.ok(!/Scotland|guaranteed interview/i.test(polarDecisionText));

const nonQualifyingPolar = rukAabApplicant({
  contextual_profile: contextualProfile({
    home_area_region: {
      polar4_quintile: 'q2'
    }
  })
});
const nonQualifyingEligibility = evaluateCourseEligibility(course, nonQualifyingPolar);
assert.strictEqual(nonQualifyingEligibility.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(nonQualifyingEligibility.status, 'not_eligible');
assert.ok(!nonQualifyingEligibility.applicant_group_ids.includes('widening_participation'));
assert.ok(nonQualifyingEligibility.failures.includes('a_level_requirements_not_met'));

const legacyWpApplicant = rukAabApplicant({
  applicant_group_ids: ['widening_participation', 'contextual'],
  applicant_identity: {
    contextual: true,
    widening_participation: true,
    contextual_status_confirmed: true,
    contextual_flags: {
      widening_participation: true,
      care_experienced: true,
      simd20: true,
      polar4_quintile_1: true
    }
  },
  contextual_profile: contextualProfile({
    home_area_region: {
      polar4_quintile: 'q2'
    }
  })
});
const legacyWpEligibility = evaluateCourseEligibility(course, legacyWpApplicant);
assert.strictEqual(legacyWpEligibility.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(legacyWpEligibility.status, 'not_eligible');
assert.ok(!legacyWpEligibility.applicant_group_ids.includes('widening_participation'));
assert.ok(!legacyWpEligibility.applicant_group_ids.includes('contextual'));
assert.ok(!legacyWpEligibility.applicant_group_ids.includes('care_experienced'));
assert.ok(!legacyWpEligibility.applicant_group_ids.includes('simd20'));

const careApplicant = rukAabApplicant({
  contextual_profile: contextualProfile({
    personal_circumstances: {
      care_experienced: 'yes'
    }
  })
});
const careContextual = evaluateContextualEligibility(course, careApplicant);
assert.strictEqual(careContextual.status, 'contextual');
assert.strictEqual(careContextual.matched_contextual_pathway, 'care_experienced');
assert.ok(careContextual.activated_applicant_group_ids.includes('care_experienced'));
assert.strictEqual(careContextual.ucat_uplift_percent, 10);
const careClassification = classifyInterviewBand(course, config, careApplicant);
assert.strictEqual(careClassification.guidance_pool_id, 'home_rest_of_uk_school_leaver');
assert.strictEqual(careClassification.ranking.value, 2050);
assert.strictEqual(careClassification.interview_outcome || null, null);

const youngCarerApplicant = rukAabApplicant({
  contextual_profile: contextualProfile({
    personal_circumstances: {
      young_or_adult_carer: 'yes'
    }
  })
});
const youngCarerContextual = evaluateContextualEligibility(course, youngCarerApplicant);
assert.strictEqual(youngCarerContextual.status, 'information_needed');
assert.ok(
  youngCarerContextual.missing_information.some((entry) => {
    return entry.criterion_id === 'young_or_adult_carer';
  })
);
assert.deepStrictEqual(youngCarerContextual.activated_applicant_group_ids, []);

const guaranteedRule = course.contextual_admissions.guaranteed_interview_rules.find((rule) => {
  return rule.rule_id === 'scottish_widening_access_guaranteed_interview';
});
assert.deepStrictEqual(
  guaranteedRule.applies_to_group_ids,
  ['scotland_domiciled', 'widening_participation']
);

console.log(
  'Aberdeen A100 RUK contextual regression: PASS ' +
  '(POLAR4 Q1 AAB, non-qualifying POLAR4 denial, legacy denial, care confirmation, RUK pool)'
);
