#!/usr/bin/env node

const assert = require('assert');

const {
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const aberdeenCourse = require('../data/universities/aberdeen-a100.json');

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

function baseCourse(overrides = {}) {
  const course = {
    profile_id: 'evaluator-route-schema-test',
    stage_1_eligibility: {
      gcse: {
        minimum_count: null,
        mandatory_subject_ids: [],
        grade_requirements: []
      },
      national_5: {
        minimum_count: 0,
        confirmed_mandatory_subject_ids: []
      },
      post_16: {
        accepted_qualifications: [
          'a_level',
          'international_baccalaureate',
          'scottish'
        ],
        a_level: {},
        ib: {},
        scottish: {
          route_implemented: false,
          grade_requirements: []
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

  return merge(course, overrides);
}

function baseALevelApplicant(overrides = {}) {
  const applicant = {
    profile_id: 'route-schema-a-level',
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      english_language_exempt: true
    },
    qualification_route: 'a_level',
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A*' },
        { subject_id: 'biology', predicted_grade: 'A*' },
        { subject_id: 'mathematics', predicted_grade: 'A' }
      ]
    },
    gcse_profile: {
      subjects: {
        english_language: '8',
        mathematics: '8'
      }
    }
  };

  return merge(applicant, overrides);
}

{
  const course = baseCourse({
    stage_1_eligibility: {
      post_16: {
        a_level: {
          grade_requirements: [
            {
              requirement_id: 'legacy_grade_requirements',
              applies_to_group_ids: ['home_fee'],
              grade_profile: ['A*', 'A*', 'A'],
              required_subject_ids: ['chemistry'],
              one_of_subject_groups: [
                {
                  group_id: 'second_science_or_maths',
                  minimum_required: 1,
                  subject_ids: ['biology', 'physics', 'mathematics']
                }
              ]
            }
          ]
        }
      }
    }
  });
  const result = evaluateCourseEligibility(course, baseALevelApplicant());
  assert.strictEqual(result.status, 'eligible', 'legacy grade_requirements A-level schema should pass.');
}

{
  const course = baseCourse({
    stage_1_eligibility: {
      post_16: {
        a_level: {
          routes: [
            {
              route_id: 'route_based_schema',
              applies_to_group_ids: ['home_fee'],
              grade_profile: ['A*', 'A*', 'A'],
              required_subject_ids: ['chemistry'],
              one_of_subject_groups: [
                {
                  group_id: 'second_science_or_maths',
                  minimum_required: 1,
                  subject_ids: ['biology', 'physics', 'mathematics']
                }
              ]
            }
          ]
        }
      }
    }
  });
  const result = evaluateCourseEligibility(course, baseALevelApplicant());
  assert.strictEqual(result.status, 'eligible', 'route-based A-level schema should pass.');
}

{
  const course = baseCourse({
    stage_1_eligibility: {
      post_16: {
        a_level: {
          standard_offer: {
            grade_profile: ['A*', 'A*', 'A']
          },
          required_subject_ids: ['chemistry'],
          one_of_subject_groups: [
            {
              group_id: 'second_science_or_maths',
              minimum_required: 1,
              subject_ids: ['biology', 'physics', 'mathematics']
            }
          ]
        }
      }
    }
  });
  const result = evaluateCourseEligibility(course, baseALevelApplicant());
  assert.strictEqual(result.status, 'eligible', 'standard-offer A-level schema should pass.');
}

{
  const course = baseCourse({
    stage_1_eligibility: {
      post_16: {
        a_level: {
          grade_requirements: [
            {
              requirement_id: 'home_only',
              applies_to_group_ids: ['home_fee'],
              grade_profile: ['A*', 'A*', 'A'],
              required_subject_ids: ['chemistry']
            }
          ]
        }
      }
    }
  });
  const result = evaluateCourseEligibility(
    course,
    baseALevelApplicant({
      applicant_identity: {
        applicant_type: 'international_standard_school_leaver',
        fee_status: 'International',
        domicile: 'International',
        english_language_exempt: true
      }
    })
  );
  assert.strictEqual(result.status, 'not_eligible', 'unsupported applicant group should not borrow another group route.');
  assert.ok(
    result.failures.includes('a_level_route_not_supported_for_applicant_groups'),
    'unsupported applicant group must fail route support.'
  );
}

{
  const course = baseCourse();
  const result = evaluateCourseEligibility(
    course,
    {
      profile_id: 'international-unknown-route',
      applicant_identity: {
        applicant_type: 'international_standard_school_leaver',
        fee_status: 'International',
        domicile: 'International',
        english_language_exempt: true
      }
    }
  );
  assert.strictEqual(result.status, 'manual_review', 'international applicant with unresolved route should be manual review.');
  assert.ok(
    result.manual_review_reasons.includes('qualification_route_not_resolved'),
    'unresolved route should be explicit manual-review reason.'
  );
}

{
  const course = baseCourse({
    stage_1_eligibility: {
      post_16: {
        ib: {
          total_points: 41,
          hl_grade_profile: ['7', '7', '6'],
          required_hl_subjects: [
            {
              subject_id: 'chemistry',
              minimum_grade: '6'
            }
          ],
          required_hl_subject_grade_options: [
            {
              option_id: 'biology_or_maths',
              grade_requirements: [
                {
                  subject_id: 'biology',
                  minimum_grade: '6'
                }
              ]
            },
            {
              option_id: 'mathematics_or_biology',
              grade_requirements: [
                {
                  subject_id: 'mathematics',
                  minimum_grade: '6'
                }
              ]
            }
          ]
        }
      }
    }
  });
  const result = evaluateCourseEligibility(
    course,
    baseALevelApplicant({
      qualification_route: 'international_baccalaureate',
      a_level_profile: null,
      ib_profile: {
        total_points: 41,
        higher_level_subjects: [
          { subject_id: 'chemistry', higher_level_grade: '7' },
          { subject_id: 'biology', higher_level_grade: '7' },
          { subject_id: 'mathematics', higher_level_grade: '6' }
        ]
      }
    })
  );
  assert.strictEqual(result.status, 'eligible', 'valid IB route should pass.');
}

{
  const course = baseCourse({
    stage_1_eligibility: {
      post_16: {
        ib: {
          grade_requirements: [
            {
              requirement_id: 'ib_international_only',
              applies_to_group_ids: ['international_fee'],
              total_points: 40,
              hl_grade_profile: ['7', '6', '6'],
              required_hl_subject_ids: ['chemistry']
            }
          ]
        }
      }
    }
  });
  const result = evaluateCourseEligibility(
    course,
    baseALevelApplicant({
      qualification_route: 'international_baccalaureate',
      a_level_profile: null,
      ib_profile: {
        total_points: 41,
        higher_level_subjects: [
          { subject_id: 'chemistry', higher_level_grade: '7' },
          { subject_id: 'biology', higher_level_grade: '7' },
          { subject_id: 'mathematics', higher_level_grade: '6' }
        ]
      }
    })
  );
  assert.strictEqual(result.status, 'not_eligible', 'unsupported IB route should not silently pass.');
  assert.ok(
    result.failures.includes('ib_route_not_supported_for_applicant_groups'),
    'unsupported IB route should fail with route-support reason.'
  );
}

{
  const course = baseCourse({
    stage_1_eligibility: {
      national_5: {
        minimum_count: 2,
        grade_requirements: [
          {
            requirement_id: 'national_5_english_minimum',
            subject_id: 'english_language',
            alternative_subject_ids: ['english'],
            minimum_grade: 'B'
          },
          {
            requirement_id: 'national_5_biology_or_higher_minimum',
            subject_id: 'biology',
            minimum_grade: 'B',
            post16_satisfaction: {
              allowed: true,
              qualification_levels: ['higher', 'advanced_higher'],
              minimum_grade: 'B'
            }
          }
        ]
      },
      post_16: {
        scottish: {
          route_implemented: true,
          grade_requirements: [
            {
              qualification_level: 'higher',
              grade_profile: ['A', 'A'],
              required_subject_ids: ['chemistry', 'biology']
            }
          ]
        }
      }
    }
  });
  const result = evaluateCourseEligibility(
    course,
    {
      profile_id: 'scottish-valid-route',
      applicant_identity: {
        applicant_type: 'standard_school_leaver',
        fee_status: 'Home',
        domicile: 'Scotland',
        english_language_exempt: true
      },
      scottish_profile: {
        national_5_subjects: [
          { subject_id: 'english', grade: 'A' },
          { subject_id: 'mathematics', grade: 'A' }
        ],
        higher_subjects: [
          { subject_id: 'chemistry', grade: 'A' },
          { subject_id: 'biology', grade: 'A' }
        ]
      }
    }
  );
  assert.strictEqual(result.status, 'eligible', 'valid Scottish route should pass.');
  const national5Check = result.checks.find((check) => check.check_id === 'national_5_requirements');
  assert.strictEqual(national5Check.status, 'pass', 'National 5 alternatives and Higher satisfaction should pass.');
  assert.deepStrictEqual(
    national5Check.evaluated_requirement_ids,
    ['national_5_english_minimum', 'national_5_biology_or_higher_minimum'],
    'National 5 check should report evaluated shared requirement IDs.'
  );
}

{
  const course = baseCourse({
    stage_1_eligibility: {
      gcse: {
        minimum_count: null,
        mandatory_subject_ids: [],
        grade_requirements: [
          {
            requirement_id: 'embedded_national_5_english_minimum',
            qualification_level: 'national_5',
            subject_id: 'english_language',
            minimum_grade: 'B'
          },
          {
            requirement_id: 'embedded_national_5_mathematics_minimum',
            qualification_level: 'national_5',
            subject_id: 'mathematics',
            minimum_grade: 'B'
          }
        ]
      },
      national_5: {
        minimum_count: 0,
        confirmed_mandatory_subject_ids: []
      },
      post_16: {
        scottish: {
          route_implemented: true,
          grade_requirements: [
            {
              requirement_id: 'embedded_national_5_scottish_higher_route',
              qualification_level: 'higher',
              grade_profile: ['A', 'A', 'A', 'A', 'B'],
              required_subject_ids: ['biology'],
              one_of_subject_groups: [
                {
                  minimum_required: 1,
                  subject_ids: ['chemistry', 'physics']
                }
              ]
            }
          ]
        }
      }
    }
  });
  const applicant = {
    profile_id: 'embedded-national-5-rules-valid',
    qualification_route: 'scottish',
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      english_language_exempt: true
    },
    scottish_profile: {
      national_5_subjects: [
        { subject_id: 'english_language', grade: 'B' },
        { subject_id: 'mathematics', grade: 'B' }
      ],
      higher_subjects: [
        { subject_id: 'biology', grade: 'A' },
        { subject_id: 'chemistry', grade: 'A' },
        { subject_id: 'mathematics', grade: 'A' },
        { subject_id: 'english', grade: 'A' },
        { subject_id: 'history', grade: 'B' }
      ],
      advanced_higher_subjects: []
    }
  };
  const result = evaluateCourseEligibility(course, applicant);
  assert.strictEqual(result.status, 'eligible', 'Embedded GCSE National 5 rules should pass.');
  const national5Check = result.checks.find((check) => check.check_id === 'national_5_requirements');
  assert.deepStrictEqual(
    national5Check.evaluated_requirement_ids,
    ['embedded_national_5_english_minimum', 'embedded_national_5_mathematics_minimum'],
    'Embedded GCSE National 5 requirements should be evaluated by the Scottish route.'
  );

  const failedResult = evaluateCourseEligibility(
    course,
    merge(applicant, {
      profile_id: 'embedded-national-5-rules-invalid',
      scottish_profile: {
        national_5_subjects: [
          { subject_id: 'english_language', grade: 'B' },
          { subject_id: 'mathematics', grade: 'C' }
        ]
      }
    })
  );
  assert.strictEqual(
    failedResult.status,
    'not_eligible',
    'Embedded GCSE National 5 rules should fail below the configured minimum.'
  );
  assert.ok(failedResult.failures.includes('national_5_requirements_not_met'));
}

{
  const applicant = {
    profile_id: 'aberdeen-scottish-national-5-valid',
    qualification_route: 'scottish',
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'Scotland',
      english_language_exempt: true
    },
    scottish_profile: {
      national_5_subjects: [
        { subject_id: 'english', grade: 'B' },
        { subject_id: 'mathematics', grade: 'B' }
      ],
      higher_subjects: [
        { subject_id: 'chemistry', grade: 'A' },
        { subject_id: 'biology', grade: 'A' },
        { subject_id: 'mathematics', grade: 'A' },
        { subject_id: 'physics', grade: 'A' },
        { subject_id: 'english', grade: 'B' }
      ],
      advanced_higher_subjects: []
    },
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 700,
          decision_making: 750,
          quantitative_reasoning: 750
        },
        sjt_band: 2
      }
    }
  };

  const result = evaluateCourseEligibility(aberdeenCourse, applicant);
  assert.strictEqual(result.status, 'eligible', 'Aberdeen Scottish applicant with required National 5s should pass.');

  const failedNational5Applicant = merge(applicant, {
    profile_id: 'aberdeen-scottish-national-5-invalid',
    scottish_profile: {
      national_5_subjects: [
        { subject_id: 'english', grade: 'B' },
        { subject_id: 'mathematics', grade: 'C' }
      ]
    }
  });
  const failedResult = evaluateCourseEligibility(aberdeenCourse, failedNational5Applicant);
  assert.strictEqual(
    failedResult.status,
    'not_eligible',
    'Aberdeen Scottish applicant below the configured National 5 Mathematics minimum should fail.'
  );
  assert.ok(
    failedResult.failures.includes('national_5_requirements_not_met'),
    'Aberdeen National 5 failure should come from the shared National 5 evaluator.'
  );
}

{
  const course = baseCourse({
    stage_1_eligibility: {
      post_16: {
        a_level: {}
      }
    }
  });
  const result = evaluateCourseEligibility(course, baseALevelApplicant());
  assert.strictEqual(result.status, 'not_eligible', 'missing requirement definitions must not silently pass.');
  assert.ok(
    result.failures.includes('a_level_route_not_supported_for_applicant_groups'),
    'missing requirement definition should produce explicit route-support failure.'
  );
}

console.log('Eligibility evaluator route-resolution safeguards passed.');
