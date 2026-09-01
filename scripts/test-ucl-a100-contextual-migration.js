#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  evaluateContextualEligibility,
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const { predict } = require('../server/src/predict');

const rootDir = path.resolve(__dirname, '..');
const course = require(path.join(rootDir, 'data/universities/ucl-a100.json'));
const config = require(path.join(rootDir, 'data/interview-band-configs/ucl-a100.json'));
const fixture = require(path.join(rootDir, 'data/fixtures/interview-band-classification/ucl-a100.json'));

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

function withUcat(applicant, totalScore) {
  const first = Math.floor(totalScore / 3);
  const second = Math.floor((totalScore - first) / 2);
  const third = totalScore - first - second;
  return merge(applicant, {
    admissions_tests: {
      ucat: {
        total_score: totalScore,
        score_scale: 2700,
        test_year: 2026,
        subtests: {
          verbal_reasoning: first,
          decision_making: second,
          quantitative_reasoning: third
        }
      }
    }
  });
}

function withALevelGrades(applicant, biology, chemistry, third = 'B') {
  return merge(applicant, {
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: [
        { subject_id: 'biology', predicted_grade: biology, sitting_status: 'first_sitting' },
        { subject_id: 'chemistry', predicted_grade: chemistry, sitting_status: 'first_sitting' },
        { subject_id: 'mathematics', predicted_grade: third, sitting_status: 'first_sitting' }
      ]
    }
  });
}

function baseStep6(overrides = {}) {
  return merge({
    school_education: {
      state_non_fee_paying_school: 'yes',
      current_or_most_recent_uk_school_independent_fee_paying: 'no',
      attended_uk_school_or_college_for_post16_or_equivalent: 'yes'
    },
    home_area_region: {
      imd_quintile: 'q5',
      tundra_quintile: 'q5',
      polar4_quintile: 'q5'
    },
    financial_support: {
      free_school_meals: 'no',
      free_school_meals_at_level3_completion: 'no',
      ucat_bursary_recipient: 'no'
    },
    personal_circumstances: {
      care_experienced: 'no',
      care_over_three_months: 'no',
      care_leaver: 'no',
      looked_after: 'no',
      estranged_from_family: 'no',
      estranged_over_six_months: 'no',
      permanently_estranged: 'no',
      no_parental_contact_or_support: 'no',
      estranged_during_level3_study: 'no'
    },
    access_programmes: {
      participation_status: 'no',
      other_programmes: []
    },
    partner_schools: {
      status: 'no',
      relationships: []
    }
  }, overrides);
}

function applicant(overrides = {}) {
  return merge(fixture.base_applicant, {
    contextual_profile: baseStep6(),
    ...overrides
  });
}

function classify(candidate) {
  return classifyInterviewBand(course, config, candidate);
}

function assertNoAccessUclRouting(result, message) {
  assert.ok(!result.applicant_group_ids.includes('access_ucl_confirmed'), message);
  assert.notStrictEqual(result.guidance_pool_id, 'access_ucl_a100', message);
}

const postcodeContextual = withUcat(withALevelGrades(applicant({
  contextual_profile: baseStep6({
    home_area_region: {
      imd_quintile: 'q1',
      tundra_quintile: 'q5',
      polar4_quintile: 'q5'
    }
  })
}), 'A', 'A', 'B'), 2080);

const postcodeContextualEligibility = evaluateContextualEligibility(course, postcodeContextual);
assert.strictEqual(postcodeContextualEligibility.status, 'contextual');
assert.strictEqual(postcodeContextualEligibility.is_contextual, true);
assert.ok(postcodeContextualEligibility.activated_applicant_group_ids.includes('access_ucl_confirmed'));

const postcodeClassification = classify(postcodeContextual);
assert.strictEqual(postcodeClassification.eligibility.status, 'eligible');
assert.strictEqual(postcodeClassification.eligibility.academic_pathway, 'contextual');
assert.strictEqual(postcodeClassification.guidance_pool_id, 'access_ucl_a100');
assert.strictEqual(postcodeClassification.canonical_interview_band, 'realistic');
assert.ok(postcodeClassification.applicant_group_ids.includes('access_ucl_confirmed'));

const fsmContextual = withALevelGrades(applicant({
  contextual_profile: baseStep6({
    home_area_region: {
      imd_quintile: 'q5',
      tundra_quintile: 'q5',
      polar4_quintile: 'q5'
    },
    financial_support: {
      free_school_meals: 'yes',
      free_school_meals_at_level3_completion: 'yes'
    }
  })
}), 'A', 'A', 'B');
assert.strictEqual(evaluateContextualEligibility(course, fsmContextual).status, 'contextual');

const genericFsmOnly = applicant({
  contextual_profile: baseStep6({
    financial_support: {
      free_school_meals: 'yes',
      free_school_meals_at_level3_completion: 'not_sure'
    }
  })
});
assert.strictEqual(evaluateContextualEligibility(course, genericFsmOnly).status, 'information_needed');

const multipleOrContextual = applicant({
  contextual_profile: baseStep6({
    home_area_region: {
      imd_quintile: 'q1',
      tundra_quintile: 'q5',
      polar4_quintile: 'q5'
    },
    financial_support: {
      free_school_meals: 'yes',
      free_school_meals_at_level3_completion: 'yes'
    }
  })
});
assert.strictEqual(evaluateContextualEligibility(course, multipleOrContextual).status, 'contextual');

const missingPostcodeCouldChange = withALevelGrades(applicant({
  contextual_profile: baseStep6({
    home_area_region: {
      imd_quintile: 'not_sure',
      tundra_quintile: 'not_sure',
      polar4_quintile: 'q5'
    }
  })
}), 'A', 'A', 'B');
const missingPostcodeEligibility = evaluateContextualEligibility(course, missingPostcodeCouldChange);
assert.strictEqual(missingPostcodeEligibility.status, 'information_needed');
assert.ok(missingPostcodeEligibility.missing_information.some((entry) =>
  entry.criterion_id === 'ucl_postcode_deprivation_status'
));
const missingPostcodeClassification = classify(missingPostcodeCouldChange);
assert.strictEqual(missingPostcodeClassification.eligibility.status, 'manual_review');
assert.ok(missingPostcodeClassification.eligibility.manual_review_reasons.includes(
  'ucl_access_ucl_contextual_evidence_needs_review'
));

const strongStandard = applicant();
const strongStandardEligibility = evaluateContextualEligibility(course, strongStandard);
assert.strictEqual(strongStandardEligibility.status, 'not_contextual');
const strongStandardClassification = classify(strongStandard);
assert.strictEqual(strongStandardClassification.eligibility.status, 'eligible');
assert.strictEqual(strongStandardClassification.eligibility.academic_pathway, 'standard');
assert.strictEqual(strongStandardClassification.guidance_pool_id, 'home_a100');
assertNoAccessUclRouting(strongStandardClassification, 'standard applicant must not route to Access UCL');

const explicitNoStandard = withALevelGrades(applicant(), 'A', 'A', 'B');
const explicitNoEligibility = evaluateContextualEligibility(course, explicitNoStandard);
assert.strictEqual(explicitNoEligibility.status, 'not_contextual');
assert.strictEqual(classify(explicitNoStandard).eligibility.status, 'not_eligible');

const polarOnly = applicant({
  contextual_profile: baseStep6({
    home_area_region: {
      polar4_quintile: 'q1',
      imd_quintile: 'q5',
      tundra_quintile: 'q5'
    }
  })
});
assert.strictEqual(evaluateContextualEligibility(course, polarOnly).status, 'not_contextual');

const independentSchoolFsm = applicant({
  contextual_profile: baseStep6({
    school_education: {
      state_non_fee_paying_school: 'no',
      current_or_most_recent_uk_school_independent_fee_paying: 'yes'
    },
    financial_support: {
      free_school_meals: 'yes',
      free_school_meals_at_level3_completion: 'yes'
    }
  })
});
assert.strictEqual(evaluateContextualEligibility(course, independentSchoolFsm).status, 'not_contextual');

const independentSchoolCare = withALevelGrades(applicant({
  contextual_profile: baseStep6({
    school_education: {
      state_non_fee_paying_school: 'no',
      current_or_most_recent_uk_school_independent_fee_paying: 'yes'
    },
    personal_circumstances: {
      care_experienced: 'yes',
      care_over_three_months: 'yes',
      formal_local_authority_care: 'yes',
      care_leaver: 'no',
      looked_after: 'no',
      estranged_from_family: 'no'
    }
  })
}), 'A', 'A', 'B');
assert.strictEqual(evaluateContextualEligibility(course, independentSchoolCare).status, 'contextual');
assert.strictEqual(classify(independentSchoolCare).guidance_pool_id, 'access_ucl_a100');

const incompleteCare = applicant({
  contextual_profile: baseStep6({
    personal_circumstances: {
      care_experienced: 'yes',
      care_over_three_months: 'not_sure',
      care_leaver: 'no',
      looked_after: 'no',
      estranged_from_family: 'no'
    }
  })
});
assert.strictEqual(evaluateContextualEligibility(course, incompleteCare).status, 'information_needed');

const completeEstrangement = withALevelGrades(applicant({
  contextual_profile: baseStep6({
    personal_circumstances: {
      care_experienced: 'no',
      estranged_from_family: 'yes',
      estranged_over_six_months: 'yes',
      permanently_estranged: 'yes',
      no_parental_contact_or_support: 'yes',
      estranged_during_level3_study: 'yes'
    }
  })
}), 'A', 'A', 'B');
assert.strictEqual(evaluateContextualEligibility(course, completeEstrangement).status, 'contextual');

const incompleteEstrangement = applicant({
  contextual_profile: baseStep6({
    personal_circumstances: {
      care_experienced: 'no',
      estranged_from_family: 'yes',
      estranged_over_six_months: 'not_sure',
      permanently_estranged: 'yes',
      no_parental_contact_or_support: 'yes',
      estranged_during_level3_study: 'yes'
    }
  })
});
assert.strictEqual(evaluateContextualEligibility(course, incompleteEstrangement).status, 'information_needed');

const rawLegacyAab = withALevelGrades(applicant({
  applicant_group_ids: ['access_ucl_confirmed'],
  applicant_identity: {
    contextual: true,
    widening_participation: true,
    contextual_status_confirmed: true,
    contextual_flags: {
      access_ucl_confirmed: true,
      free_school_meals: true
    }
  }
}), 'A', 'A', 'B');
const rawLegacyAabClassification = classify(rawLegacyAab);
assert.strictEqual(rawLegacyAabClassification.eligibility.contextual_eligibility.status, 'not_contextual');
assertNoAccessUclRouting(rawLegacyAabClassification, 'raw legacy Access UCL flag must not route to Access UCL');
assert.strictEqual(rawLegacyAabClassification.eligibility.status, 'not_eligible');

const rawLegacyStrong = applicant({
  applicant_group_ids: ['access_ucl_confirmed'],
  applicant_identity: {
    contextual: true,
    widening_participation: true,
    contextual_status_confirmed: true,
    contextual_flags: {
      access_ucl_confirmed: true
    }
  }
});
const rawLegacyStrongClassification = classify(rawLegacyStrong);
assert.strictEqual(rawLegacyStrongClassification.eligibility.status, 'eligible');
assert.strictEqual(rawLegacyStrongClassification.guidance_pool_id, 'home_a100');
assertNoAccessUclRouting(rawLegacyStrongClassification, 'legacy flag must not override shared evaluator');

const contextualCard = predict({
  universityIds: ['ucl-a100'],
  studentProfile: postcodeContextual
})[0].result_card;
assert.strictEqual(contextualCard.contextual_status, 'confirmed');
assert.strictEqual(contextualCard.contextual_confirmation?.collapsed_label, 'You qualify for Access UCL');

const standardCard = predict({
  universityIds: ['ucl-a100'],
  studentProfile: strongStandard
})[0].result_card;
assert.strictEqual(standardCard.contextual_status, null);
assert.strictEqual(standardCard.contextual_confirmation, null);

const scottishPredictedA1Review = applicant({
  qualification_route: 'scottish',
  a_level_profile: null,
  applicant_identity: {
    domicile: 'Scotland',
    fee_status: 'Home'
  },
  scottish_profile: {
    advanced_higher_subjects: [
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'mathematics', predicted_grade: 'A' }
    ]
  }
});
const scottishPredictedClassification = classify(scottishPredictedA1Review);
assert.strictEqual(scottishPredictedClassification.eligibility.status, 'manual_review');
assert.ok(scottishPredictedClassification.eligibility.manual_review_reasons.includes(
  'ucl_scottish_predicted_a1_confirmation_required'
));

const scottishAchievedStrictFail = applicant({
  qualification_route: 'scottish',
  a_level_profile: null,
  applicant_identity: {
    domicile: 'Scotland',
    fee_status: 'Home'
  },
  scottish_profile: {
    advanced_higher_subjects: [
      { subject_id: 'biology', achieved_grade: 'A' },
      { subject_id: 'chemistry', achieved_grade: 'A' },
      { subject_id: 'mathematics', achieved_grade: 'A' }
    ]
  }
});
const scottishAchievedStrictFailClassification = classify(scottishAchievedStrictFail);
assert.strictEqual(scottishAchievedStrictFailClassification.eligibility.status, 'not_eligible');
assert.ok(scottishAchievedStrictFailClassification.eligibility.failures.includes(
  'scottish_post_16_requirements_not_met'
));

const scottishAchievedStrictPass = applicant({
  qualification_route: 'scottish',
  a_level_profile: null,
  applicant_identity: {
    domicile: 'Scotland',
    fee_status: 'Home'
  },
  scottish_profile: {
    advanced_higher_subjects: [
      { subject_id: 'biology', achieved_grade: 'A*' },
      { subject_id: 'chemistry', achieved_grade: 'A' },
      { subject_id: 'mathematics', achieved_grade: 'A' }
    ]
  }
});
assert.strictEqual(classify(scottishAchievedStrictPass).eligibility.status, 'eligible');

const directEligibility = evaluateCourseEligibility(course, postcodeContextual);
assert.ok(directEligibility.applicant_group_ids.includes('access_ucl_confirmed'));
assert.strictEqual(directEligibility.contextual_eligibility.status, 'contextual');

console.log('PASS: UCL A100 contextual migration evaluator, routing, result-card and Scottish regressions');
