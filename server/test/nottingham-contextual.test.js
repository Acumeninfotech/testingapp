const assert = require('assert');

const nottinghamA100 = require('../../data/universities/nottingham-a100.json');
const nottinghamA101 = require('../../data/universities/nottingham-a101.json');
const nottinghamA108 = require('../../data/universities/nottingham-a108.json');
const {
  evaluateContextualEligibility
} = require('../../assets/js/engine/eligibility-evaluator');
const {
  evaluateNottinghamA100
} = require('../../assets/js/engine/nottingham-a100-consumer');

function baseApplicant(overrides = {}) {
  return merge({
    profile_id: 'nottingham-contextual-fixture',
    application_year: 2027,
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: 'home',
      age_at_course_start_band: 'age_18'
    },
    contextual_profile: {
      home_area_region: {},
      financial_support: {},
      school_education: {
        current_or_most_recent_uk_school_independent_fee_paying: 'no'
      },
      personal_circumstances: {},
      access_programmes: {
        participation_status: 'no',
        other_programmes: []
      }
    },
    gcse_profile: {
      subjects: {
        biology: '7',
        chemistry: '7',
        mathematics: '6',
        english_language: '6',
        physics: '7',
        history: '7',
        geography: '7',
        spanish: '7'
      }
    },
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A', practical_endorsement: 'not_applicable' }
      ]
    },
    admissions_tests: {
      ucat: {
        taken: true,
        test_year: 2026,
        subtests: {
          verbal_reasoning: 700,
          quantitative_reasoning: 700,
          decision_making: 700
        },
        sjt_band: 2
      }
    }
  }, overrides);
}

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

function withALevelGrades(gradesBySubject) {
  return {
    a_level_profile: {
      subjects: Object.entries(gradesBySubject).map(([subject_id, predicted_grade]) => ({
        subject_id,
        predicted_grade,
        practical_endorsement: ['biology', 'human_biology', 'chemistry'].includes(subject_id)
          ? 'pass'
          : 'not_applicable'
      }))
    }
  };
}

function evaluate(overrides = {}) {
  return evaluateNottinghamA100(nottinghamA100, baseApplicant(overrides));
}

function contextual(overrides = {}) {
  return evaluateContextualEligibility(nottinghamA100, baseApplicant(overrides));
}

function assertPathway(name, overrides, expectedPathwayId, expectedEligibilityStatus = 'eligible') {
  const result = evaluate(overrides);
  assert.strictEqual(
    result.eligibility.status,
    expectedEligibilityStatus,
    `${name}: eligibility status`
  );
  assert.strictEqual(
    result.eligibility.academic_pathway_id,
    expectedPathwayId,
    `${name}: academic pathway`
  );
  return result;
}

assertPathway(
  'standard non-contextual applicant',
  {},
  'nottingham_standard_aaa_offer'
);

assert.strictEqual(
  contextual({
    contextual_profile: {
      school_education: {
        current_or_most_recent_uk_school_independent_fee_paying: 'not_sure'
      }
    }
  }).status,
  'not_contextual',
  'unknown school type is not material when no Nottingham contextual signal is present'
);

assertPathway(
  'confirmed standard contextual applicant',
  merge(
    withALevelGrades({ biology: 'A', chemistry: 'B', mathematics: 'A' }),
    {
      contextual_profile: {
        access_programmes: {
          participation_status: 'yes',
          other_programmes: [
            { programme_id: 'sutton_trust_online', status: 'completed' }
          ]
        }
      }
    }
  ),
  'nottingham_standard_contextual_aab_offer'
);

assertPathway(
  'confirmed Nottingham postcode route from exact eligibility flag',
  merge(
    withALevelGrades({ biology: 'A', chemistry: 'B', mathematics: 'A' }),
    {
      contextual_profile: {
        home_area_region: {
          postcode: 'NG7 2RD',
          nottingham_contextual_postcode_eligible: 'yes'
        }
      }
    }
  ),
  'nottingham_standard_contextual_aab_offer'
);

assertPathway(
  'confirmed enhanced contextual applicant',
  merge(
    withALevelGrades({ biology: 'A', chemistry: 'B', mathematics: 'B' }),
    {
      contextual_profile: {
        access_programmes: {
          participation_status: 'yes',
          other_programmes: [
            { programme_id: 'nottingham_sutton_trust_summer_school', status: 'completed' }
          ]
        }
      }
    }
  ),
  'nottingham_enhanced_contextual_abb_offer'
);

const both = assertPathway(
  'enhanced wins over standard',
  merge(
    withALevelGrades({ biology: 'A', chemistry: 'B', mathematics: 'B' }),
    {
      contextual_profile: {
        personal_circumstances: {
          care_over_three_months: 'yes'
        },
        access_programmes: {
          participation_status: 'yes',
          other_programmes: [
            { programme_id: 'nottingham_ambition_16_18_tier_1', status: 'completed' }
          ]
        }
      }
    }
  ),
  'nottingham_enhanced_contextual_abb_offer'
);
assert.strictEqual(
  both.eligibility.contextual_eligibility.matched_contextual_pathway,
  'nottingham_enhanced_contextual'
);

assertPathway(
  'standard refugee exception with independent school',
  merge(
    withALevelGrades({ biology: 'A', chemistry: 'B', mathematics: 'A' }),
    {
      contextual_profile: {
        school_education: {
          current_or_most_recent_uk_school_independent_fee_paying: 'yes'
        },
        personal_circumstances: {
          uk_refugee_status_granted: 'yes'
        }
      }
    }
  ),
  'nottingham_standard_contextual_aab_offer'
);

assertPathway(
  'standard care exception with independent school',
  merge(
    withALevelGrades({ biology: 'A', chemistry: 'B', mathematics: 'A' }),
    {
      contextual_profile: {
        school_education: {
          current_or_most_recent_uk_school_independent_fee_paying: 'yes'
        },
        personal_circumstances: {
          care_over_three_months: 'yes'
        }
      }
    }
  ),
  'nottingham_standard_contextual_aab_offer'
);

const independentEnhanced = evaluate(merge(
  withALevelGrades({ biology: 'A', chemistry: 'B', mathematics: 'B' }),
  {
    contextual_profile: {
      school_education: {
        current_or_most_recent_uk_school_independent_fee_paying: 'yes'
      },
      access_programmes: {
        participation_status: 'yes',
        other_programmes: [
          { programme_id: 'nottingham_ambition_16_18_tier_1_plus', status: 'completed' }
        ]
      }
    }
  }
));
assert.notStrictEqual(
  independentEnhanced.eligibility.contextual_eligibility.matched_contextual_pathway,
  'nottingham_enhanced_contextual',
  'independent-school exception must not apply to enhanced route'
);
assert.strictEqual(independentEnhanced.eligibility.status, 'not_eligible');

assert.strictEqual(
  contextual({ applicant_identity: { fee_status: 'international' } }).status,
  'not_contextual',
  'Home fee requirement must be enforced'
);

const unknownSchool = contextual({
  contextual_profile: {
    school_education: {
      current_or_most_recent_uk_school_independent_fee_paying: 'not_sure'
    },
    access_programmes: {
      participation_status: 'yes',
      other_programmes: [
        { programme_id: 'sutton_trust_online', status: 'completed' }
      ]
    }
  }
});
assert.strictEqual(unknownSchool.status, 'information_needed');

const genericFsm = contextual({
  contextual_profile: {
    financial_support: {
      free_school_meals: 'yes'
    }
  }
});
assert.strictEqual(genericFsm.status, 'information_needed');
assert.notStrictEqual(genericFsm.matched_contextual_pathway, 'nottingham_enhanced_contextual');

const standardCareOnly = contextual({
  contextual_profile: {
    personal_circumstances: {
      care_over_three_months: 'yes'
    }
  }
});
assert.strictEqual(standardCareOnly.status, 'contextual');
assert.strictEqual(standardCareOnly.matched_contextual_pathway, 'nottingham_standard_contextual');

const unresolvedPostcode = contextual({
  contextual_profile: {
    home_area_region: {
      postcode: 'NG7 2RD',
      imd_quintile: 'q1',
      polar4_quintile: 'q1',
      tundra_quintile: 'q1'
    }
  }
});
assert.strictEqual(unresolvedPostcode.status, 'information_needed');
assert.notStrictEqual(unresolvedPostcode.matched_contextual_pathway, 'nottingham_standard_contextual');

assert.strictEqual(
  evaluate(merge(
    withALevelGrades({ biology: 'B', chemistry: 'B', mathematics: 'A' }),
    {
      contextual_profile: {
        access_programmes: {
          participation_status: 'yes',
          other_programmes: [
            { programme_id: 'sutton_trust_online', status: 'completed' }
          ]
        }
      }
    }
  )).eligibility.status,
  'not_eligible',
  'AAB route must still require an A in Biology/Human Biology or Chemistry'
);

assert.strictEqual(
  evaluate(merge(
    withALevelGrades({ biology: 'B', chemistry: 'B', mathematics: 'A' }),
    {
      contextual_profile: {
        access_programmes: {
          participation_status: 'yes',
          other_programmes: [
            { programme_id: 'nottingham_sutton_trust_pathways_to_medicine', status: 'completed' }
          ]
        }
      }
    }
  )).eligibility.status,
  'not_eligible',
  'ABB route must still require an A in Biology/Human Biology or Chemistry'
);

assert.strictEqual(
  evaluate(merge(
    withALevelGrades({ biology: 'A', chemistry: 'B', mathematics: 'B' }),
    {
      contextual_profile: {
        access_programmes: {
          participation_status: 'yes',
          other_programmes: [
            { programme_id: 'nottingham_sutton_trust_pathways_to_medicine', status: 'completed' }
          ]
        }
      },
      admissions_tests: {
        ucat: {
          sjt_band: 4
        }
      }
    }
  )).eligibility.status,
  'not_eligible',
  'SJT Band 4 remains excluded even when enhanced contextual applies'
);

assert.strictEqual(
  evaluate({
    gcse_profile: {
      subjects: {
        biology: '7',
        chemistry: '7',
        mathematics: '5',
        english_language: '6',
        physics: '7',
        history: '7',
        geography: '7',
        spanish: '7'
      }
    },
    contextual_profile: {
      access_programmes: {
        participation_status: 'yes',
        other_programmes: [
          { programme_id: 'nottingham_sutton_trust_pathways_to_medicine', status: 'completed' }
        ]
      }
    }
  }).eligibility.status,
  'not_eligible',
  'GCSE requirements remain unchanged for contextual applicants'
);

for (const course of [nottinghamA101, nottinghamA108]) {
  const result = evaluateContextualEligibility(course, baseApplicant({
    contextual_profile: {
      access_programmes: {
        participation_status: 'yes',
        other_programmes: [
          { programme_id: 'nottingham_sutton_trust_pathways_to_medicine', status: 'completed' }
        ]
      }
    }
  }));
  assert.strictEqual(result.status, 'not_evaluated', `${course.profile_id} remains unaffected`);
}

const eliteAthleteAdjustment = nottinghamA100.contextual_admissions.adjustments.find((adjustment) => {
  return adjustment.adjustment_id === 'elite_athlete_contextual_offer';
});
assert.ok(eliteAthleteAdjustment, 'elite-athlete adjustment remains present');
assert.strictEqual(eliteAthleteAdjustment.offer_grade_profile, 'AAB');

console.log('PASS: Nottingham A100 contextual evaluator and academic routes');
