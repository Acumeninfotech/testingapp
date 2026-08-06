#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateContextualEligibility,
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const { predict } = require('../server/src/predict');

const rootDir = path.resolve(__dirname, '..');
const course = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'data', 'universities', 'aston-a100.json'), 'utf8')
);

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

function baseApplicant() {
  return {
    profile_id: 'aston_contextual_matrix_applicant',
    qualification_route: 'a_level',
    application_year: 2026,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      contextual_status_confirmed: false,
      widening_participation: false,
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
    contextual_profile: {
      school_education: {
        independent_school: 'no'
      }
    },
    gcse_profile: {
      subjects: {
        english_language: '6',
        mathematics: '6',
        biology: '6',
        chemistry: '6',
        physics: '6',
        history: '6',
        geography: '6'
      }
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A*', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'biology', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'history', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: null }
      ]
    },
    admissions_tests: {
      ucat: {
        total_score: 2100,
        score_scale: 2700,
        test_year: 2026,
        sjt_band: 4
      }
    },
    graduate_profile: {
      is_graduate: false
    }
  };
}

function setALevels(applicant, grades) {
  applicant.a_level_profile.subjects = Object.entries(grades).map(([subjectId, grade]) => ({
    subject_id: subjectId,
    predicted_grade: grade,
    sitting_status: 'first_sitting',
    practical_endorsement: ['biology', 'chemistry', 'physics'].includes(subjectId) ? 'pass' : null
  }));
  return applicant;
}

function withContextualProfile(overrides) {
  return merge(baseApplicant(), {
    contextual_profile: merge(
      {
        school_education: {
          independent_school: 'no'
        }
      },
      overrides
    )
  });
}

function contextualResult(overrides) {
  return evaluateContextualEligibility(course, withContextualProfile(overrides));
}

function assertContextual(result, criterionId) {
  assert.strictEqual(result.status, 'contextual');
  assert.strictEqual(result.is_contextual, true);
  assert.deepStrictEqual(result.activated_applicant_group_ids, ['contextual']);
  assert.ok(
    result.qualifying_criteria.some((criterion) => criterion.criterion_id === criterionId),
    `Expected matched criterion ${criterionId}.`
  );
}

function assertNotContextual(result) {
  assert.strictEqual(result.is_contextual, false);
  assert.deepStrictEqual(result.activated_applicant_group_ids, []);
}

const criterionCases = [
  {
    id: 'ucat_bursary_qualifies',
    criterionId: 'ucat_bursary',
    overrides: { financial_support: { ucat_bursary_recipient: 'yes' } }
  },
  {
    id: 'polar4_q1_qualifies',
    criterionId: 'polar4_quintile_1_2',
    overrides: { home_area_region: { polar4_quintile: 'q1' } }
  },
  {
    id: 'polar4_q2_qualifies',
    criterionId: 'polar4_quintile_1_2',
    overrides: { home_area_region: { polar4_quintile: 'q2' } }
  },
  {
    id: 'declared_disability_qualifies',
    criterionId: 'declared_disability_ucas',
    overrides: { personal_circumstances: { disability: 'yes' } }
  },
  {
    id: 'care_experience_qualifies',
    criterionId: 'care_experienced_or_care_leaver',
    overrides: { personal_circumstances: { care_experienced: 'yes' } }
  },
  {
    id: 'care_leaver_qualifies',
    criterionId: 'care_experienced_or_care_leaver',
    overrides: { personal_circumstances: { care_leaver: 'yes' } }
  },
  {
    id: 'refugee_status_qualifies',
    criterionId: 'refugee_status_home_office',
    overrides: { personal_circumstances: { refugee: 'yes' } }
  },
  {
    id: 'aston_pathways_exact_completed_year_12_qualifies',
    criterionId: 'aston_pathways_year_12_13',
    overrides: {
      access_programmes: {
        participation_status: 'yes',
        other_programmes: [
          {
            programme_id: 'aston_pathways_medicine',
            status: 'completed',
            year_group: 'year_12'
          }
        ]
      }
    }
  },
  {
    id: 'aston_stem_trust_school_exact_match_qualifies',
    criterionId: 'aston_stem_education_academy_trust_school',
    overrides: {
      partner_schools: {
        status: 'yes',
        relationships: [
          {
            school_name: 'Aston University Engineering Academy',
            status: 'yes'
          }
        ]
      }
    }
  },
  {
    id: 'fsm_exact_timing_qualifies',
    criterionId: 'free_school_meals_end_ks4_last_six_years',
    overrides: {
      financial_support: {
        free_school_meals_end_ks4_last_six_years: 'yes'
      }
    }
  }
];

for (const testCase of criterionCases) {
  assertContextual(contextualResult(testCase.overrides), testCase.criterionId);
}

let result = contextualResult({ home_area_region: { polar4_quintile: 'q3' } });
assertNotContextual(result);
assert.strictEqual(
  result.qualifying_criteria.some((criterion) => criterion.criterion_id === 'polar4_quintile_1_2'),
  false,
  'POLAR4 Q3 must not qualify through the POLAR4 criterion.'
);

result = contextualResult({ financial_support: { free_school_meals: 'yes' } });
assertNotContextual(result);
assert.strictEqual(result.status, 'information_needed');
assert.ok(result.missing_information.some((entry) => entry.criterion_id === 'free_school_meals_end_ks4_last_six_years'));

result = contextualResult({
  school_education: { independent_school: 'yes' },
  financial_support: { ucat_bursary_recipient: 'yes' }
});
assertNotContextual(result);
assert.ok(result.failed_exclusions.some((entry) => entry.criterion_id === 'independent_school_attendance'));

assertContextual(
  contextualResult({
    school_education: { grammar_school: 'yes' },
    financial_support: { ucat_bursary_recipient: 'yes' }
  }),
  'ucat_bursary'
);

result = evaluateContextualEligibility(
  course,
  merge(baseApplicant(), {
    applicant_identity: {
      graduate: true,
      applicant_type: 'graduate'
    },
    graduate_profile: {
      is_graduate: true,
      degree_status: 'completed',
      degree_classification: '2:1'
    },
    contextual_profile: {
      school_education: { independent_school: 'no' },
      financial_support: { ucat_bursary_recipient: 'yes' }
    }
  })
);
assertNotContextual(result);
assert.ok(result.failed_exclusions.some((entry) => entry.criterion_id === 'graduate_applicant'));

result = evaluateContextualEligibility(
  course,
  merge(baseApplicant(), {
    applicant_identity: {
      applicant_type: 'final_year_undergraduate'
    },
    graduate_profile: {
      is_graduate: false,
      degree_status: 'final_year'
    },
    contextual_profile: {
      school_education: { independent_school: 'no' },
      financial_support: { ucat_bursary_recipient: 'yes' }
    }
  })
);
assertNotContextual(result);
assert.ok(result.failed_exclusions.some((entry) => entry.criterion_id === 'final_year_undergraduate'));

result = contextualResult({
  financial_support: { ucat_bursary_recipient: 'yes' },
  home_area_region: { polar4_quintile: 'q1' }
});
assertContextual(result, 'ucat_bursary');
assert.deepStrictEqual(result.activated_applicant_group_ids, ['contextual']);

result = contextualResult({});
assertNotContextual(result);
assert.strictEqual(result.reason, 'no_aston_ready_criterion_matched');

result = evaluateContextualEligibility(
  course,
  merge(baseApplicant(), {
    applicant_identity: {
      contextual: true,
      widening_participation: true
    },
    contextual_profile: {
      school_education: { independent_school: 'no' }
    }
  })
);
assertNotContextual(result);
assert.strictEqual(result.evidence.legacy_declarations.contextual, true);
assert.strictEqual(result.reason, 'no_aston_ready_criterion_matched');

result = evaluateContextualEligibility(
  course,
  merge(baseApplicant(), {
    contextual_profile: {}
  })
);
assertNotContextual(result);

result = evaluateContextualEligibility(
  course,
  merge(baseApplicant(), {
    applicant_identity: {
      contextual_flags: {
        ucat_bursary: true
      }
    },
    contextual_profile: {
      school_education: { independent_school: 'no' }
    }
  })
);
assertContextual(result, 'ucat_bursary');

function contextualAabApplicant() {
  return setALevels(
    withContextualProfile({
      financial_support: { ucat_bursary_recipient: 'yes' }
    }),
    {
      chemistry: 'A',
      biology: 'A',
      history: 'B'
    }
  );
}

let eligibility = evaluateCourseEligibility(course, contextualAabApplicant());
assert.strictEqual(eligibility.status, 'eligible');
assert.strictEqual(eligibility.academic_pathway, 'contextual');
assert.strictEqual(eligibility.academic_pathway_id, 'contextual_school_leaver_a_level');
assert.ok(eligibility.applicant_group_ids.includes('contextual'));
assert.strictEqual(eligibility.contextual_eligibility.reason, 'aston_ready_eligible');

eligibility = evaluateCourseEligibility(
  course,
  setALevels(
    withContextualProfile({ financial_support: { ucat_bursary_recipient: 'yes' } }),
    { chemistry: 'A', biology: 'B', history: 'A' }
  )
);
assert.strictEqual(eligibility.status, 'not_eligible');
assert.ok(eligibility.failures.includes('a_level_requirements_not_met'));

eligibility = evaluateCourseEligibility(
  course,
  setALevels(
    withContextualProfile({ financial_support: { ucat_bursary_recipient: 'yes' } }),
    { chemistry: 'A', biology: 'B', history: 'B' }
  )
);
assert.strictEqual(eligibility.status, 'not_eligible');
assert.ok(eligibility.failures.includes('a_level_requirements_not_met'));

eligibility = evaluateCourseEligibility(
  course,
  setALevels(
    withContextualProfile({ financial_support: { ucat_bursary_recipient: 'yes' } }),
    { chemistry: 'A*', biology: 'A', history: 'A' }
  )
);
assert.strictEqual(eligibility.status, 'eligible');
assert.strictEqual(eligibility.academic_pathway, 'standard');
assert.strictEqual(eligibility.academic_pathway_id, 'standard_school_leaver_a_level');

eligibility = evaluateCourseEligibility(
  course,
  setALevels(baseApplicant(), { chemistry: 'A', biology: 'A', history: 'B' })
);
assert.strictEqual(eligibility.status, 'not_eligible');
assert.strictEqual(eligibility.applicant_group_ids.includes('contextual'), false);

eligibility = evaluateCourseEligibility(
  course,
  merge(contextualAabApplicant(), {
    applicant_identity: {
      fee_status: 'International'
    },
    english_language_profile: {
      test: 'IELTS Academic',
      scores: { overall: 7, reading: 7, writing: 7, listening: 7, speaking: 7 },
      valid_at_course_start: true
    }
  })
);
assert.strictEqual(eligibility.contextual_eligibility.is_contextual, false);
assert.strictEqual(eligibility.applicant_group_ids.includes('contextual'), false);

eligibility = evaluateCourseEligibility(
  course,
  merge(contextualAabApplicant(), {
    applicant_identity: {
      applicant_type: 'graduate',
      graduate: true
    },
    graduate_profile: {
      is_graduate: true,
      degree_status: 'completed',
      degree_classification: '2:1'
    }
  })
);
assert.strictEqual(eligibility.contextual_eligibility.is_contextual, false);
assert.strictEqual(eligibility.applicant_group_ids.includes('contextual'), false);

eligibility = evaluateCourseEligibility(
  course,
  merge(contextualAabApplicant(), {
    gcse_profile: {
      subjects: {
        english_language: '5',
        mathematics: '6',
        biology: '6',
        chemistry: '6',
        physics: '6',
        history: '6',
        geography: '6'
      }
    }
  })
);
assert.strictEqual(eligibility.status, 'not_eligible');
assert.ok(eligibility.failures.includes('gcse_requirement_not_met:english_language'));

eligibility = evaluateCourseEligibility(
  course,
  merge(contextualAabApplicant(), {
    admissions_tests: {
      ucat: null
    }
  })
);
assert.strictEqual(eligibility.status, 'not_eligible');
assert.ok(eligibility.failures.includes('required_admissions_test_missing:ucat'));

const standardEmpty = evaluateCourseEligibility(
  course,
  merge(baseApplicant(), {
    contextual_profile: {}
  })
);
assert.strictEqual(standardEmpty.status, 'eligible');
assert.strictEqual(standardEmpty.academic_pathway, 'standard');
assert.strictEqual(standardEmpty.academic_pathway_id, 'standard_school_leaver_a_level');

const standardIncompleteContext = evaluateCourseEligibility(
  course,
  merge(baseApplicant(), {
    contextual_profile: {
      school_education: {
        independent_school: 'not_sure'
      },
      financial_support: {
        free_school_meals: 'yes'
      }
    }
  })
);
assert.strictEqual(standardIncompleteContext.status, 'eligible');
assert.strictEqual(standardIncompleteContext.academic_pathway, 'standard');

const standardExcludedFromAstonReady = evaluateCourseEligibility(
  course,
  merge(baseApplicant(), {
    contextual_profile: {
      school_education: {
        independent_school: 'yes'
      },
      financial_support: {
        ucat_bursary_recipient: 'yes'
      }
    }
  })
);
assert.strictEqual(standardExcludedFromAstonReady.status, 'eligible');
assert.strictEqual(standardExcludedFromAstonReady.academic_pathway, 'standard');
assert.strictEqual(standardExcludedFromAstonReady.contextual_eligibility.is_contextual, false);

const syntheticNonAstonCourse = {
  profile_id: 'non-aston-a100',
  course: {
    ucas_code: 'A100',
    discipline: 'medicine'
  },
  stage_1_eligibility: {
    gcse: { minimum_count: null, grade_requirements: [] },
    post_16: {
      accepted_qualifications: ['a_level'],
      a_level: {
        grade_requirements: [
          {
            requirement_id: 'standard_school_leaver_a_level',
            applies_to_group_ids: ['school_leaver'],
            grade_profile: ['A*', 'A', 'A'],
            required_subject_ids: ['chemistry', 'biology']
          }
        ]
      }
    },
    admissions_tests: {
      ucat: { required: false },
      sjt: { used_as_gate: false, excluded_bands: [] }
    }
  }
};
const nonAstonApplicant = baseApplicant();
const nonAstonWithAstonReadyFacts = merge(nonAstonApplicant, {
  contextual_profile: {
    school_education: { independent_school: 'no' },
    financial_support: { ucat_bursary_recipient: 'yes' },
    home_area_region: { polar4_quintile: 'q1' }
  }
});
assert.deepStrictEqual(
  evaluateCourseEligibility(syntheticNonAstonCourse, nonAstonWithAstonReadyFacts),
  evaluateCourseEligibility(syntheticNonAstonCourse, nonAstonApplicant),
  'Aston Ready contextual_profile facts must not alter a non-Aston course.'
);

const astonContextualPredictionApplicant = merge(
  withContextualProfile({
    financial_support: { ucat_bursary_recipient: 'yes' }
  }),
  {
    admissions_tests: {
      ucat: {
        subtests: {
          verbal_reasoning: 700,
          decision_making: 700,
          quantitative_reasoning: 700
        }
      }
    }
  }
);
const [astonContextualPrediction] = predict({
  universityIds: ['aston-a100'],
  studentProfile: astonContextualPredictionApplicant
});
assert.strictEqual(
  astonContextualPrediction.result_card.contextual_status,
  'confirmed',
  'Aston contextual applicants should expose contextual_status=confirmed for presentation.'
);

console.log('Aston A100 contextual eligibility framework tests: PASS');
