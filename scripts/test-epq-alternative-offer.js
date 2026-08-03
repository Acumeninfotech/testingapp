#!/usr/bin/env node

const assert = require('assert');
const {
  evaluateStandardALevelRequirement
} = require('../assets/js/engine/eligibility-evaluator');

const {
  evaluateEpqAlternativeOffer,
  normaliseEpqAlternativeOfferPolicy,
  normaliseEpqQualification
} = require('../assets/js/engine/epq-alternative-offer');

function clone(value) {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function applicant(overrides = {}) {
  const base = {
    qualification_route: 'a_level',
    a_level_profile: {
      completed_in_one_sitting: true,
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A', sitting_status: 'first_sitting' },
        { subject_id: 'biology', predicted_grade: 'A', sitting_status: 'first_sitting' },
        { subject_id: 'mathematics', predicted_grade: 'B', sitting_status: 'first_sitting' }
      ],
      epq: {
        status: 'predicted',
        grade: 'A'
      }
    }
  };

  return merge(base, overrides);
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

const policy = {
  enabled: true,
  pathway_id: 'epq_aab_a',
  a_level_grades: ['A', 'A', 'B'],
  epq_minimum_grade: 'A'
};

{
  const standard = evaluateStandardALevelRequirement(
    applicant(),
    {
      requirement_id: 'standard_aaa_offer',
      grade_profile: ['A', 'A', 'A']
    }
  );
  const epqAlternative = evaluateEpqAlternativeOffer(applicant(), policy);
  assert.strictEqual(standard.met, false);
  assert.ok(standard.failures.includes('a_level_requirements_not_met'));
  assert.strictEqual(epqAlternative.status, 'met');
}

{
  assert.strictEqual(normaliseEpqAlternativeOfferPolicy(null), null);
  assert.deepStrictEqual(
    normaliseEpqAlternativeOfferPolicy({
      enabled: true,
      pathway_id: 'legacy_epq',
      grade_profile: ['A', 'A', 'B'],
      epq_grade: 'A'
    }),
    {
      enabled: true,
      pathway_id: 'legacy_epq',
      grade_profile: ['A', 'A', 'B'],
      epq_grade: 'A',
      a_level_grades: ['A', 'A', 'B'],
      epq_minimum_grade: 'A',
      subject_grade_requirements: {},
      required_subject_grade_options: [],
      conditions: {}
    }
  );
  assert.deepStrictEqual(normaliseEpqQualification(undefined), {
    status: 'not_taken',
    grade: null
  });
  assert.deepStrictEqual(normaliseEpqQualification({ status: 'achieved', grade: 'x' }), {
    status: 'achieved',
    grade: null
  });
}

{
  const missing = evaluateEpqAlternativeOffer(applicant(), null);
  assert.strictEqual(missing.status, 'not_applicable');
  assert.deepStrictEqual(missing.reasons, ['epq_alternative_policy_missing']);

  const disabled = evaluateEpqAlternativeOffer(applicant(), {
    ...policy,
    enabled: false
  });
  assert.strictEqual(disabled.status, 'not_applicable');
  assert.deepStrictEqual(disabled.reasons, ['epq_alternative_policy_disabled']);
}

{
  const noEpq = evaluateEpqAlternativeOffer(applicant({ a_level_profile: { epq: undefined } }), policy);
  assert.strictEqual(noEpq.status, 'not_applicable');
  assert.deepStrictEqual(noEpq.reasons, ['epq_not_taken']);

  const planning = evaluateEpqAlternativeOffer(
    applicant({ a_level_profile: { epq: { status: 'planning', grade: null } } }),
    policy
  );
  assert.strictEqual(planning.status, 'information_needed');
  assert.ok(planning.reasons.includes('epq_grade_evidence_pending'));

  const invalidGrade = evaluateEpqAlternativeOffer(
    applicant({ a_level_profile: { epq: { status: 'predicted', grade: 'A+' } } }),
    policy
  );
  assert.strictEqual(invalidGrade.status, 'information_needed');
  assert.ok(invalidGrade.reasons.includes('epq_grade_unrecognised'));

  const missingPolicyGrade = evaluateEpqAlternativeOffer(
    applicant(),
    {
      enabled: true,
      pathway_id: 'epq_missing_minimum',
      a_level_grades: ['A', 'A', 'B']
    }
  );
  assert.strictEqual(missingPolicyGrade.status, 'information_needed');
  assert.ok(missingPolicyGrade.reasons.includes('epq_minimum_grade_missing_from_policy'));
  assert.deepStrictEqual(missingPolicyGrade.failed_conditions, []);
}

{
  const achievedAStar = evaluateEpqAlternativeOffer(
    applicant({ a_level_profile: { epq: { status: 'achieved', grade: 'A*' } } }),
    policy
  );
  assert.strictEqual(achievedAStar.status, 'met');
  assert.strictEqual(achievedAStar.a_level_requirement_met, true);
  assert.strictEqual(achievedAStar.epq_requirement_met, true);

  const epqB = evaluateEpqAlternativeOffer(
    applicant({ a_level_profile: { epq: { status: 'predicted', grade: 'B' } } }),
    policy
  );
  assert.strictEqual(epqB.status, 'not_met');
  assert.strictEqual(epqB.epq_requirement_met, false);
  assert.ok(epqB.failed_conditions.includes('epq_minimum_grade'));
}

{
  assert.strictEqual(evaluateEpqAlternativeOffer(applicant(), policy).status, 'met');
  assert.strictEqual(
    evaluateEpqAlternativeOffer(
      applicant({
        a_level_profile: {
          subjects: [
            { subject_id: 'chemistry', predicted_grade: 'A' },
            { subject_id: 'biology', predicted_grade: 'A' },
            { subject_id: 'mathematics', predicted_grade: 'A' }
          ]
        }
      }),
      policy
    ).status,
    'met'
  );
  assert.strictEqual(
    evaluateEpqAlternativeOffer(
      applicant({
        a_level_profile: {
          subjects: [
            { subject_id: 'chemistry', predicted_grade: 'A*' },
            { subject_id: 'biology', predicted_grade: 'A' },
            { subject_id: 'mathematics', predicted_grade: 'B' }
          ]
        }
      }),
      policy
    ).status,
    'met'
  );

  const aStarAC = evaluateEpqAlternativeOffer(
    applicant({
      a_level_profile: {
        subjects: [
          { subject_id: 'chemistry', predicted_grade: 'A*' },
          { subject_id: 'biology', predicted_grade: 'A' },
          { subject_id: 'mathematics', predicted_grade: 'C' }
        ]
      }
    }),
    {
      ...policy,
      conditions: {
        equivalent_grade_combinations_allowed: false
      }
    }
  );
  assert.strictEqual(aStarAC.status, 'not_met');
  assert.ok(aStarAC.failed_conditions.includes('a_level_grade_profile'));

  const abb = evaluateEpqAlternativeOffer(
    applicant({
      a_level_profile: {
        subjects: [
          { subject_id: 'chemistry', predicted_grade: 'A' },
          { subject_id: 'biology', predicted_grade: 'B' },
          { subject_id: 'mathematics', predicted_grade: 'B' }
        ]
      }
    }),
    policy
  );
  assert.strictEqual(abb.status, 'not_met');
  assert.ok(abb.reasons.includes('a_level_grade_profile_not_met'));
}

{
  const subjectPolicy = {
    ...policy,
    subject_grade_requirements: {
      Chemistry: 'A',
      biology: 'A'
    }
  };
  assert.strictEqual(evaluateEpqAlternativeOffer(applicant(), subjectPolicy).status, 'met');

  const missingSubject = evaluateEpqAlternativeOffer(
    applicant({
      a_level_profile: {
        subjects: [
          { subject_id: 'chemistry', predicted_grade: 'A' },
          { subject_id: 'mathematics', predicted_grade: 'A' },
          { subject_id: 'physics', predicted_grade: 'B' }
        ]
      }
    }),
    subjectPolicy
  );
  assert.strictEqual(missingSubject.status, 'information_needed');
  assert.ok(missingSubject.reasons.includes('subject_grade_evidence_missing:biology'));

  const belowMinimum = evaluateEpqAlternativeOffer(
    applicant({
      a_level_profile: {
        subjects: [
          { subject_id: 'chemistry', predicted_grade: 'A' },
          { subject_id: 'biology', predicted_grade: 'B' },
          { subject_id: 'mathematics', predicted_grade: 'A' }
        ]
      }
    }),
    subjectPolicy
  );
  assert.strictEqual(belowMinimum.status, 'not_met');
  assert.ok(belowMinimum.failed_conditions.includes('subject_grade:biology'));
}

{
  const optionPolicy = {
    ...policy,
    required_subject_grade_options: [
      {
        option_id: 'biology_grade_a',
        required_subject_ids: ['biology'],
        grade_requirements: [
          {
            subject_id: 'biology',
            minimum_grade: 'A'
          }
        ],
        one_of_subject_groups: [
          {
            group_id: 'second_science_with_biology',
            minimum_required: 1,
            subject_ids: ['chemistry', 'mathematics', 'physics']
          }
        ]
      },
      {
        option_id: 'chemistry_grade_a',
        required_subject_ids: ['chemistry'],
        grade_requirements: [
          {
            subject_id: 'chemistry',
            minimum_grade: 'A'
          }
        ],
        one_of_subject_groups: [
          {
            group_id: 'second_science_with_chemistry',
            minimum_required: 1,
            subject_ids: ['biology', 'mathematics', 'physics']
          }
        ]
      }
    ]
  };

  assert.strictEqual(
    evaluateEpqAlternativeOffer(
      applicant({
        a_level_profile: {
          subjects: [
            { subject_id: 'biology', predicted_grade: 'A' },
            { subject_id: 'mathematics', predicted_grade: 'A' },
            { subject_id: 'physics', predicted_grade: 'B' }
          ]
        }
      }),
      optionPolicy
    ).status,
    'met'
  );

  const missingOptionEvidence = evaluateEpqAlternativeOffer(
    applicant({
      a_level_profile: {
        subjects: [
          { subject_id: 'biology', predicted_grade: 'A' },
          { subject_id: 'mathematics', predicted_grade: 'A' }
        ]
      }
    }),
    optionPolicy
  );
  assert.strictEqual(missingOptionEvidence.status, 'information_needed');
  assert.ok(missingOptionEvidence.reasons.includes('a_level_grade_evidence_missing'));

  const failedOption = evaluateEpqAlternativeOffer(
    applicant({
      a_level_profile: {
        subjects: [
          { subject_id: 'biology', predicted_grade: 'B' },
          { subject_id: 'mathematics', predicted_grade: 'A' },
          { subject_id: 'physics', predicted_grade: 'A' }
        ]
      }
    }),
    optionPolicy
  );
  assert.strictEqual(failedOption.status, 'not_met');
  assert.ok(failedOption.failed_conditions.includes('required_subject_grade_options'));
}

{
  const conditionalPolicy = {
    ...policy,
    conditions: {
      all_a_levels_same_sitting: true,
      a_level_resits_allowed: false,
      must_be_taken_alongside_a_levels: true,
      firm_choice_only: true
    }
  };

  const missingEvidence = evaluateEpqAlternativeOffer(
    applicant({
      a_level_profile: {
        completed_in_one_sitting: undefined,
        subjects: [
          { subject_id: 'chemistry', predicted_grade: 'A' },
          { subject_id: 'biology', predicted_grade: 'A' },
          { subject_id: 'mathematics', predicted_grade: 'B' }
        ]
      }
    }),
    conditionalPolicy
  );
  assert.strictEqual(missingEvidence.status, 'information_needed');
  assert.ok(missingEvidence.reasons.includes('same_sitting_evidence_missing'));
  assert.ok(missingEvidence.reasons.includes('a_level_resit_evidence_missing'));
  assert.ok(missingEvidence.reasons.includes('epq_alongside_a_levels_evidence_missing'));
  assert.deepStrictEqual(missingEvidence.future_conditions, ['firm_choice_required']);

  const failedConditions = evaluateEpqAlternativeOffer(
    applicant({
      a_level_profile: {
        completed_in_one_sitting: false,
        subjects: [
          { subject_id: 'chemistry', predicted_grade: 'A', sitting_status: 'resit' },
          { subject_id: 'biology', predicted_grade: 'A', sitting_status: 'first_sitting' },
          { subject_id: 'mathematics', predicted_grade: 'B', sitting_status: 'first_sitting' }
        ],
        epq: {
          status: 'achieved',
          grade: 'A',
          taken_alongside_a_levels: false
        }
      }
    }),
    conditionalPolicy
  );
  assert.strictEqual(failedConditions.status, 'not_met');
  assert.ok(failedConditions.failed_conditions.includes('all_a_levels_same_sitting'));
  assert.ok(failedConditions.failed_conditions.includes('a_level_resits_not_allowed'));
  assert.ok(failedConditions.failed_conditions.includes('epq_must_be_taken_alongside_a_levels'));

  const passedConditions = evaluateEpqAlternativeOffer(
    applicant({
      a_level_profile: {
        epq: {
          status: 'achieved',
          grade: 'A',
          taken_alongside_a_levels: true
        }
      }
    }),
    conditionalPolicy
  );
  assert.strictEqual(passedConditions.status, 'met');
  assert.deepStrictEqual(passedConditions.future_conditions, ['firm_choice_required']);
}

console.log('EPQ alternative offer evaluator: PASS');
