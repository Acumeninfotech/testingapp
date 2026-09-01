#!/usr/bin/env node

const assert = require('assert');
const {
  evaluateContextualEligibility,
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');

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

const course = {
  profile_id: 'contextual-framework-regression-a100',
  course: {
    ucas_code: 'A100',
    discipline: 'medicine'
  },
  stage_1_eligibility: {
    gcse: {
      minimum_count: null,
      grade_requirements: []
    },
    post_16: {
      accepted_qualifications: ['a_level'],
      a_level: {
        routes: [
          {
            route_id: 'standard_a_level',
            applies_to_group_ids: ['home_fee'],
            excluded_group_ids: ['contextual', 'widening_participation'],
            grade_profile: ['A', 'A', 'A'],
            required_subject_ids: ['chemistry', 'biology']
          }
        ]
      }
    },
    admissions_tests: {
      ucat: {
        required: false
      },
      sjt: {
        used_as_gate: false,
        excluded_bands: []
      }
    }
  }
};

const applicant = {
  profile_id: 'contextual-framework-standard-applicant',
  applicant_identity: {
    applicant_type: 'standard_school_leaver',
    fee_status: 'home_fee',
    domicile: 'england',
    english_language_exempt: true,
    graduate: false
  },
  course_target: {
    discipline: 'medicine',
    ucas_code: 'A100',
    course_route: 'standard'
  },
  qualification_route: 'a_level',
  gcse_profile: {
    subjects: {
      english_language: '8',
      mathematics: '8'
    }
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
      { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', predicted_grade: 'A' }
    ]
  },
  admissions_tests: {
    ucat: {
      taken: true,
      total_score: 2500,
      test_year: 2026
    }
  }
};

const standardResult = evaluateCourseEligibility(course, applicant);
const contextualFactsOnlyResult = evaluateCourseEligibility(
  course,
  merge(applicant, {
    contextual_profile: {
      home_area_region: {
        polar4_quintile: 'q1',
        imd_quintile: 'q2',
        tundra_quintile: 'q1'
      },
      financial_support: {
        free_school_meals: 'yes',
        ucat_bursary_recipient: 'yes'
      },
      personal_circumstances: {
        care_experienced: 'yes',
        refugee: 'yes',
        disability: 'yes'
      },
      access_programmes: {
        participation_status: 'yes',
        ukwpmed: {
          status: 'yes',
          programme_id: 'keele_steps2medicine',
          programme_status: 'completed'
        }
      },
      partner_schools: {
        status: 'yes',
        relationships: [
          {
            university_id: 'fixture-university-a100',
            school_name: 'Example Partner School',
            status: 'yes'
          }
        ]
      }
    }
  })
);

assert.deepStrictEqual(
  contextualFactsOnlyResult,
  standardResult,
  'contextual_profile facts alone must not alter standard eligibility output.'
);

const unsupported = evaluateContextualEligibility(course, applicant);
assert.strictEqual(unsupported.status, 'not_evaluated');
assert.strictEqual(unsupported.reason, 'unsupported_contextual_policy');
assert.strictEqual(unsupported.is_contextual, false);
assert.deepStrictEqual(unsupported.activated_applicant_group_ids, []);

const legacyDeclarationOnly = evaluateContextualEligibility(
  course,
  merge(applicant, {
    applicant_identity: {
      contextual: true,
      widening_participation: true
    }
  })
);
assert.strictEqual(legacyDeclarationOnly.is_contextual, false);
assert.strictEqual(
  legacyDeclarationOnly.evidence.legacy_declarations.contextual,
  true,
  'legacy contextual self-declaration should be preserved as evidence.'
);
assert.strictEqual(
  legacyDeclarationOnly.evidence.legacy_declarations.widening_participation,
  true,
  'legacy widening-participation self-declaration should be preserved as evidence.'
);

const fixtureCourse = merge(course, {
  contextual_eligibility: {
    evaluator_id: 'fixture_contextual_policy',
    criteria: {
      all_of: [
        {
          criterion_id: 'regional_policy_scope',
          evidence_path: 'home_area_region.home_region',
          equals: 'south_west_england',
          required: true
        }
      ],
      any_of: [
        {
          criterion_id: 'fsm',
          evidence_path: 'financial_support.free_school_meals',
          tri_state_yes: true
        },
        {
          criterion_id: 'care_experienced',
          evidence_path: 'personal_circumstances.care_experienced',
          tri_state_yes: true
        }
      ],
      exclusions: [
        {
          criterion_id: 'not_international_fee',
          evidence_path: 'legacy_declarations.contextual_flags.international_only_exclusion',
          equals: true
        }
      ]
    }
  }
});

const fixtureEvaluators = {
  fixture_contextual_policy({ criteria, helpers, evidence }) {
    const criteriaResult = helpers.evaluateCriteria(criteria, evidence);
    return {
      status: criteriaResult.excluded
        ? 'excluded'
        : criteriaResult.missing_information.length > 0
          ? 'insufficient_information'
          : criteriaResult.passed
            ? 'contextual'
            : 'not_contextual',
      is_contextual: criteriaResult.passed,
      qualifying_criteria: criteriaResult.qualifying_criteria,
      exclusions: criteriaResult.checks.exclusions
        .filter((check) => check.passed)
        .map((check) => check.criterion_id),
      missing_information: criteriaResult.missing_information,
      criteria_checks: criteriaResult.checks
    };
  }
};

const fixtureResult = evaluateContextualEligibility(
  fixtureCourse,
  merge(applicant, {
    applicant_identity: {
      contextual_status_confirmed: true
    },
    contextual_profile: {
      home_area_region: {
        home_region: 'south_west_england'
      },
      financial_support: {
        free_school_meals: 'yes'
      }
    }
  }),
  { evaluators: fixtureEvaluators }
);
assert.strictEqual(fixtureResult.status, 'contextual');
assert.strictEqual(fixtureResult.is_contextual, true);
assert.deepStrictEqual(fixtureResult.activated_applicant_group_ids, ['contextual']);
assert.ok(fixtureResult.qualifying_criteria.includes('fsm'));

const missingFixtureResult = evaluateContextualEligibility(
  fixtureCourse,
  merge(applicant, {
    contextual_profile: {
      financial_support: {
        free_school_meals: 'yes'
      }
    }
  }),
  { evaluators: fixtureEvaluators }
);
assert.strictEqual(missingFixtureResult.status, 'insufficient_information');
assert.strictEqual(missingFixtureResult.is_contextual, false);
assert.deepStrictEqual(missingFixtureResult.activated_applicant_group_ids, []);
assert.ok(missingFixtureResult.missing_information.includes('regional_policy_scope'));

console.log('Contextual eligibility framework: PASS');
