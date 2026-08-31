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

const course = readJson('data/universities/cardiff-a100.json');
const config = readJson('data/interview-band-configs/cardiff-a100.json');

function productionCard(profile) {
  return predict({
    universityIds: ['cardiff-a100'],
    studentProfile: profile
  })[0].result_card;
}

function applicant(overrides = {}) {
  return merge({
    profile_id: 'cardiff_contextual_test_applicant',
    applicant_group_ids: [],
    qualification_route: 'a_level',
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      contextual_status_confirmed: false,
      contextual_flags: {},
      graduate: false,
      resit: {
        has_resits: false
      }
    },
    course_target: {
      discipline: 'medicine',
      ucas_code: 'A100',
      course_route: 'standard',
      entry_route: 'standard_entry'
    },
    contextual_profile: {
      access_programmes: {
        participation_status: 'no',
        other_programmes: [],
        other_programme_name: ''
      }
    },
    gcse_profile: {
      subjects: {
        english_language: '8',
        mathematics: '8',
        biology: '8',
        chemistry: '8',
        physics: '8'
      },
      additional_subjects: [
        { subject_id: 'history', grade: '8' },
        { subject_id: 'geography', grade: '8' },
        { subject_id: 'computer_science', grade: '8' },
        { subject_id: 'french', grade: '8' }
      ],
      total_gcse_count: 8
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A' }
      ],
      sitting_status: 'first_sitting'
    },
    admissions_tests: {
      ucat: {
        taken: true,
        total_score: 2100,
        score_scale: 2700,
        test_year: 2026,
        sjt_band: 2,
        subtests: {
          verbal_reasoning: 700,
          decision_making: 700,
          quantitative_reasoning: 700
        }
      }
    },
    graduate_profile: {
      is_graduate: false
    }
  }, overrides);
}

assert.strictEqual(
  course.contextual_admissions.contextual_eligibility.evaluator_id,
  'cardiff_contextual_medicine_a100'
);
assert.strictEqual(course.engine_notes.contextual_logic, true);
assert.strictEqual(config.eligibility.contextual_evaluator_controls_group_routing, false);

const standard = applicant();
const standardContextual = evaluateContextualEligibility(course, standard);
assert.strictEqual(standardContextual.status, 'not_contextual');
assert.strictEqual(standardContextual.is_contextual, false);
const standardClassification = classifyInterviewBand(course, config, standard);
assert.strictEqual(standardClassification.eligibility.status, 'eligible');
assert.strictEqual(standardClassification.eligibility.academic_pathway, 'standard');
assert.strictEqual(standardClassification.guidance_pool_id, 'home_non_contextual');
assert.strictEqual(standardClassification.ranking.value, 27);
assert.ok(!standardClassification.applicant_group_ids.includes('contextual'));
const standardCard = productionCard(standard);
assert.strictEqual(standardCard.contextual_status, null);
assert.strictEqual(standardCard.alternative_academic_offer, null);

function assertOrdinaryContextual(profile, expectedPathway) {
  assert.deepStrictEqual(profile.applicant_group_ids, []);
  assert.strictEqual(profile.contextual_profile.cardiff, undefined);

  const contextualEligibility = evaluateCourseEligibility(profile.course || course, profile)
    .contextual_eligibility;
  assert.strictEqual(contextualEligibility.status, 'contextual');
  assert.strictEqual(contextualEligibility.matched_contextual_pathway, expectedPathway);
  assert.deepStrictEqual(contextualEligibility.activated_applicant_group_ids, ['contextual']);
  assert.strictEqual(contextualEligibility.interview_outcome, null);

  const classification = classifyInterviewBand(course, config, profile);
  assert.strictEqual(classification.eligibility.status, 'eligible');
  assert.strictEqual(classification.eligibility.academic_pathway, 'standard');
  assert.strictEqual(classification.guidance_pool_id, 'home_contextual');
  assert.ok(classification.applicant_group_ids.includes('contextual'));
  assert.notStrictEqual(classification.interview_outcome, 'guaranteed_interview');
  assert.strictEqual(classification.ranking.value, 27);

  const card = productionCard(profile);
  assert.strictEqual(card.contextual_status, 'confirmed');
  assert.match(
    card.contextual_confirmation.collapsed_label,
    /Additional contextual consideration/
  );
  assert.match(
    card.contextual_confirmation.expanded_body,
    /no reduced contextual A100 academic offer is assumed/i
  );
  assert.strictEqual(card.alternative_academic_offer, null);
  assert.strictEqual(card.prediction.guidance_pool_id, 'home_contextual');
}

const welsh = applicant({
  applicant_identity: {
    domicile: 'Welsh'
  }
});
const welshContextual = evaluateContextualEligibility(course, welsh);
assert.strictEqual(welshContextual.status, 'contextual');
assert.strictEqual(welshContextual.matched_contextual_pathway, 'welsh_domiciled');
assert.deepStrictEqual(welshContextual.activated_applicant_group_ids, ['wales_domiciled']);
const welshClassification = classifyInterviewBand(course, config, welsh);
assert.strictEqual(welshClassification.eligibility.status, 'eligible');
assert.strictEqual(welshClassification.eligibility.academic_pathway, 'standard');
assert.strictEqual(welshClassification.guidance_pool_id, 'welsh_domiciled');
assert.ok(welshClassification.applicant_group_ids.includes('wales_domiciled'));
assert.ok(!welshClassification.applicant_group_ids.includes('contextual'));
assert.strictEqual(welshClassification.ranking.value, 27);
const welshCard = productionCard(welsh);
assert.strictEqual(welshCard.contextual_status, 'confirmed');
assert.match(welshCard.contextual_confirmation.expanded_heading, /Additional contextual consideration/);
assert.match(welshCard.contextual_confirmation.expanded_body, /standard published academic requirements still apply/i);
assert.strictEqual(welshCard.alternative_academic_offer, null);
assert.strictEqual(welshCard.prediction.guidance_pool_id, 'welsh_domiciled');

const careExperienced = applicant({
  contextual_profile: {
    personal_circumstances: {
      care_experienced: 'yes'
    }
  }
});
assertOrdinaryContextual(careExperienced, 'care_experienced');

const careLeaver = applicant({
  contextual_profile: {
    personal_circumstances: {
      care_leaver: 'yes'
    }
  }
});
assertOrdinaryContextual(careLeaver, 'care_leaver');

const refugeeStatus = applicant({
  contextual_profile: {
    personal_circumstances: {
      refugee: 'yes',
      uk_refugee_status_granted: 'yes'
    }
  }
});
assertOrdinaryContextual(refugeeStatus, 'refugee_or_asylum_status');

const welshWithOtherContextualCriterion = applicant({
  applicant_identity: {
    domicile: 'Wales'
  },
  contextual_profile: {
    personal_circumstances: {
      care_experienced: 'yes'
    }
  }
});
const welshWithOtherContextualEligibility =
  evaluateCourseEligibility(course, welshWithOtherContextualCriterion);
assert.strictEqual(
  welshWithOtherContextualEligibility.contextual_eligibility.matched_contextual_pathway,
  'welsh_domiciled'
);
assert.deepStrictEqual(
  welshWithOtherContextualEligibility.contextual_eligibility.activated_applicant_group_ids,
  ['wales_domiciled']
);
const welshWithOtherContextualClassification =
  classifyInterviewBand(course, config, welshWithOtherContextualCriterion);
assert.strictEqual(welshWithOtherContextualClassification.guidance_pool_id, 'welsh_domiciled');
assert.ok(welshWithOtherContextualClassification.applicant_group_ids.includes('wales_domiciled'));
assert.ok(!welshWithOtherContextualClassification.applicant_group_ids.includes('contextual'));
assert.strictEqual(welshWithOtherContextualClassification.ranking.value, 27);

const genericOnly = applicant({
  applicant_identity: {
    contextual: true,
    contextual_status_confirmed: true,
    contextual_flags: {
      care_experienced: true,
      refugee: true,
      free_school_meals: true
    }
  },
  contextual_profile: {
    cardiff: {
      contextual_applicant: 'yes',
      confirmed: true
    },
    financial_support: {
      free_school_meals: 'yes'
    },
    school_education: {
      low_progression_to_higher_education_school: 'yes'
    }
  }
});
assert.strictEqual(evaluateContextualEligibility(course, genericOnly).status, 'not_contextual');
assert.strictEqual(
  classifyInterviewBand(course, config, genericOnly).guidance_pool_id,
  'home_non_contextual'
);

const wpProgramme = applicant({
  applicant_identity: {
    widening_participation: true
  },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: [
        {
          programme_id: 'step_up_to_university',
          programme_name: 'Cardiff University Step-Up to University',
          status: 'completed'
        }
      ]
    }
  }
});
const wpContextual = evaluateContextualEligibility(course, wpProgramme);
assert.strictEqual(wpContextual.status, 'contextual');
assert.strictEqual(wpContextual.interview_outcome, 'guaranteed_interview');
assert.deepStrictEqual(
  wpContextual.activated_applicant_group_ids,
  ['contextual', 'widening_participation']
);
const wpClassification = classifyInterviewBand(course, config, wpProgramme);
assert.strictEqual(wpClassification.interview_outcome, 'guaranteed_interview');
assert.strictEqual(wpClassification.canonical_interview_band, null);

for (const status of ['participating', 'in_progress']) {
  const unconfirmedWpProgramme = applicant({
    contextual_profile: {
      access_programmes: {
        participation_status: status,
        other_programmes: [
          {
            programme_id: 'step_up_to_university',
            programme_name: 'Cardiff University Step-Up to University',
            status
          }
        ]
      }
    }
  });
  const unconfirmedWpContextual =
    evaluateContextualEligibility(course, unconfirmedWpProgramme);
  assert.strictEqual(unconfirmedWpContextual.status, 'information_needed');
  assert.strictEqual(
    unconfirmedWpContextual.reason,
    'cardiff_named_wp_programme_confirmation_required'
  );
  const unconfirmedWpClassification =
    classifyInterviewBand(course, config, unconfirmedWpProgramme);
  assert.notStrictEqual(unconfirmedWpClassification.interview_outcome, 'guaranteed_interview');
  assert.strictEqual(unconfirmedWpClassification.canonical_interview_band, 'insufficient_evidence');
}

const wpBelowMinimumAcademic = applicant({
  contextual_profile: {
    access_programmes: {
      participation_status: 'completed',
      other_programmes: [
        {
          programme_id: 'step_up_to_university',
          programme_name: 'Cardiff University Step-Up to University',
          status: 'completed'
        }
      ]
    }
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
      { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', predicted_grade: 'B' }
    ]
  }
});
const wpBelowMinimumClassification = classifyInterviewBand(course, config, wpBelowMinimumAcademic);
assert.strictEqual(wpBelowMinimumClassification.eligibility.status, 'not_eligible');
assert.notStrictEqual(wpBelowMinimumClassification.interview_outcome, 'guaranteed_interview');
assert.strictEqual(wpBelowMinimumClassification.canonical_interview_band, 'not_eligible');

const international = applicant({
  applicant_identity: {
    applicant_type: 'international_standard_school_leaver',
    fee_status: 'International',
    domicile: 'International',
    english_language_exempt: true
  }
});
const internationalContextual = evaluateContextualEligibility(course, international);
assert.strictEqual(internationalContextual.status, 'not_contextual');
assert.strictEqual(
  internationalContextual.reason,
  'cardiff_contextual_not_applicable_to_international_pool'
);
assert.strictEqual(classifyInterviewBand(course, config, international).guidance_pool_id, 'international');

console.log('Cardiff A100 contextual eligibility regression: PASS');
