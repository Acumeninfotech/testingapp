#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const { predict } = require('../server/src/predict');

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

const course = readJson('data/universities/manchester-a100.json');
const config = readJson('data/interview-band-configs/manchester-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/manchester-a100.json');
const index = readJson('data/index.json');

const baseApplicant = fixture.base_applicant;

function fullUcat() {
  return {
    verbal_reasoning: 700,
    decision_making: 700,
    quantitative_reasoning: 700
  };
}

function standardSubjects() {
  return [
    { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
    { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
    { subject_id: 'history', predicted_grade: 'A' }
  ];
}

function contextualAabSubjects() {
  return [
    { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
    { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
    { subject_id: 'history', predicted_grade: 'B' }
  ];
}

function refugeeCareAbbSubjects() {
  return [
    { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
    { subject_id: 'biology', predicted_grade: 'B', practical_endorsement: 'pass' },
    { subject_id: 'history', predicted_grade: 'B' }
  ];
}

function verifiedManchesterAssessment(criteria = {}) {
  return [{
    provider_university_id: 'manchester',
    assessment_id: 'contextual_eligibility_tool',
    verification_status: 'verified',
    criteria
  }];
}

function structuredMapCompletionEvidence(overrides = {}) {
  return merge({
    contextual_profile: {
      access_programmes: {
        ukwpmed: {
          status: 'yes',
          programme_id: 'manchester_access_programme',
          programme_status: 'completed',
          provider_university_id: 'manchester-a100'
        }
      }
    }
  }, overrides);
}

function contextualSharedFacts(overrides = {}) {
  return merge({
    applicant_identity: {
      age_at_course_start_band: 'age_19',
      current_uk_residence: 'yes'
    },
    contextual_profile: {
      home_area_region: {
        polar4_quintile: 'q2',
        imd_quintile: 'q3',
        tundra_quintile: 'q4'
      },
      school_education: {
        attended_uk_school_or_college_for_gcse_or_equivalent: 'yes',
        below_average_gcse_school: 'yes'
      }
    }
  }, overrides);
}

function makeApplicant(overrides = {}) {
  const applicant = merge(baseApplicant, overrides);
  applicant.admissions_tests = applicant.admissions_tests || {};
  applicant.admissions_tests.ucat = applicant.admissions_tests.ucat || {};
  applicant.admissions_tests.ucat.subtests = fullUcat();
  return applicant;
}

function classify(overrides = {}) {
  return classifyInterviewBand(course, config, makeApplicant(overrides));
}

function predictManchester(overrides = {}) {
  return predict({
    universityIds: ['manchester-a100'],
    studentProfile: makeApplicant(overrides)
  })[0];
}

function assertNoManchesterContextualActivation(result, message) {
  assert.ok(!result.applicant_group_ids.includes('contextual'), message);
  assert.ok(!result.applicant_group_ids.includes('widening_participation'), message);
  assert.ok(!result.applicant_group_ids.includes('manchester_contextual_aab'), message);
  assert.ok(!result.applicant_group_ids.includes('manchester_refugee_care_abb'), message);
  assert.ok(!result.applicant_group_ids.includes('manchester_wp_verified'), message);
}

assert.strictEqual(course.profile_id, 'manchester-a100');
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.contextual_admissions.evaluator_id, 'manchester_contextual_medicine_a100');
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.accepted_bands, [1, 2]);
assert.deepStrictEqual(
  course.contextual_admissions.adjustments.find((entry) => entry.adjustment_id === 'verified_wp_gcse_count').applies_to_group_ids,
  ['manchester_wp_verified']
);
assert.deepStrictEqual(config.eligibility.derived_applicant_groups, []);

const indexCourse = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexCourse, 'Manchester A100 must be present in data/index.json.');
assert.strictEqual(indexCourse.json_file, 'universities/manchester-a100.json');
assert.strictEqual(
  indexCourse.interview_band_config_file,
  'interview-band-configs/manchester-a100.json'
);

const standardResult = classify();
assert.strictEqual(standardResult.eligibility.status, 'eligible');
assert.strictEqual(standardResult.eligibility.academic_pathway_id, 'manchester_standard_offer');
assert.strictEqual(standardResult.guidance_pool_id, 'a106_home_standard_school_leaver');
assert.strictEqual(standardResult.canonical_interview_band, 'interview_likely');
const standardPrediction = predictManchester();
assert.strictEqual(standardPrediction.result_card.recommendation_display_state, 'standard');
assert.strictEqual(standardPrediction.result_card.contextual_status, null);

const contextualAabResult = classify(merge(
  contextualSharedFacts(),
  {
    a_level_profile: {
      subjects: contextualAabSubjects()
    }
  }
));
assert.strictEqual(contextualAabResult.eligibility.status, 'eligible');
assert.strictEqual(contextualAabResult.eligibility.academic_pathway_id, 'manchester_contextual_aab_offer');
assert.strictEqual(contextualAabResult.guidance_pool_id, 'a106_home_contextual_wp_school_leaver');
assert.ok(contextualAabResult.applicant_group_ids.includes('manchester_contextual_aab'));
assert.ok(contextualAabResult.applicant_group_ids.includes('contextual'));
assert.ok(contextualAabResult.applicant_group_ids.includes('widening_participation'));

const contextualPrediction = predictManchester(merge(
  contextualSharedFacts(),
  {
    a_level_profile: {
      subjects: contextualAabSubjects()
    }
  }
));
assert.strictEqual(contextualPrediction.result_card.recommendation_display_state, 'standard');
assert.strictEqual(contextualPrediction.result_card.academic_pathway_id, 'manchester_contextual_aab_offer');
assert.strictEqual(contextualPrediction.result_card.contextual_status, 'confirmed');
assert.deepStrictEqual(contextualPrediction.result_card.alternative_academic_offer, {
  type: 'contextual',
  standard_offer: 'AAA',
  alternative_offer: 'AAB',
  pathway_id: 'manchester_contextual_aab_offer',
  conditions: []
});

const missingAreaResult = classify(merge(
  contextualSharedFacts({
    contextual_profile: {
      home_area_region: {
        polar4_quintile: 'unknown',
        imd_quintile: 'unknown',
        tundra_quintile: 'unknown'
      }
    }
  }),
  {
    a_level_profile: {
      subjects: contextualAabSubjects()
    }
  }
));
assert.strictEqual(missingAreaResult.eligibility.status, 'manual_review');
assert.strictEqual(missingAreaResult.canonical_interview_band, 'insufficient_evidence');
assert.deepStrictEqual(missingAreaResult.eligibility.manual_review_reasons, [
  'manchester_contextual_information_needed'
]);

const missingAreaPrediction = predictManchester(merge(
  contextualSharedFacts({
    contextual_profile: {
      home_area_region: {
        polar4_quintile: 'unknown',
        imd_quintile: 'unknown',
        tundra_quintile: 'unknown'
      }
    }
  }),
  {
    a_level_profile: {
      subjects: contextualAabSubjects()
    }
  }
));
assert.strictEqual(missingAreaPrediction.result_card.recommendation_display_state, 'manual_review');
assert.strictEqual(missingAreaPrediction.result_card.contextual_status, null);
assert.match(
  missingAreaPrediction.result_card.information_needed_reason || '',
  /postcode|school-context evidence/i
);

const missingSchoolResult = classify({
  applicant_identity: {
    age_at_course_start_band: 'age_19',
    current_uk_residence: 'yes'
  },
  contextual_profile: {
    home_area_region: {
      polar4_quintile: 'q2',
      imd_quintile: 'q3',
      tundra_quintile: 'q4'
    }
  },
  a_level_profile: {
    subjects: contextualAabSubjects()
  }
});
assert.strictEqual(missingSchoolResult.eligibility.status, 'manual_review');
assert.deepStrictEqual(missingSchoolResult.eligibility.manual_review_reasons, [
  'manchester_contextual_information_needed'
]);
assert.ok(
  missingSchoolResult.eligibility.contextual_eligibility.missing_information.some((entry) => {
    return entry.reason === 'school_stage_evidence_missing';
  })
);

for (const [label, applicantIdentity] of Object.entries({
  age_21_or_over: {
    age_at_course_start_band: 'age_21_or_over',
    current_uk_residence: 'yes'
  },
  non_uk_resident: {
    age_at_course_start_band: 'age_19',
    current_uk_residence: 'no'
  }
})) {
  const result = classify(merge(
    contextualSharedFacts({
      applicant_identity: applicantIdentity
    }),
    {
      a_level_profile: {
        subjects: contextualAabSubjects()
      }
    }
  ));
  assert.strictEqual(result.eligibility.status, 'not_eligible', `${label}: eligibility`);
  assert.strictEqual(result.eligibility.academic_pathway_id, 'manchester_standard_offer', `${label}: pathway`);
}

const careAbbResult = classify({
  contextual_profile: {
    personal_circumstances: {
      care_over_three_months: 'yes'
    }
  },
  a_level_profile: {
    subjects: refugeeCareAbbSubjects()
  }
});
assert.strictEqual(careAbbResult.eligibility.status, 'eligible');
assert.strictEqual(careAbbResult.eligibility.academic_pathway_id, 'manchester_refugee_care_abb_offer');
assert.ok(careAbbResult.applicant_group_ids.includes('manchester_refugee_care_abb'));

const refugeeAbbResult = classify({
  contextual_profile: {
    personal_circumstances: {
      uk_refugee_status_granted: 'yes'
    }
  },
  a_level_profile: {
    subjects: refugeeCareAbbSubjects()
  }
});
assert.strictEqual(refugeeAbbResult.eligibility.status, 'eligible');
assert.strictEqual(refugeeAbbResult.eligibility.academic_pathway_id, 'manchester_refugee_care_abb_offer');

for (const scheme of [
  'homes_for_ukraine',
  'ukraine_family_scheme',
  'ukraine_extension_scheme'
]) {
  const result = classify({
    contextual_profile: {
      personal_circumstances: {
        ukrainian_visa_scheme: scheme
      }
    },
    a_level_profile: {
      subjects: refugeeCareAbbSubjects()
    }
  });
  assert.strictEqual(result.eligibility.status, 'eligible', `${scheme}: eligibility`);
  assert.strictEqual(
    result.eligibility.academic_pathway_id,
    'manchester_refugee_care_abb_offer',
    `${scheme}: pathway`
  );
}

const careDurationMissingResult = classify({
  contextual_profile: {
    personal_circumstances: {
      care_experienced: 'yes'
    }
  },
  a_level_profile: {
    subjects: refugeeCareAbbSubjects()
  }
});
assert.strictEqual(careDurationMissingResult.eligibility.status, 'manual_review');
assert.deepStrictEqual(careDurationMissingResult.eligibility.manual_review_reasons, [
  'manchester_refugee_or_care_information_needed'
]);
assert.ok(
  careDurationMissingResult.eligibility.contextual_eligibility.missing_information.some((entry) => {
    return entry.reason === 'care_duration_confirmation_required';
  })
);

const topLevelContextualOnly = classify({
  applicant_identity: {
    contextual: true,
    widening_participation: true,
    age_at_course_start_band: 'age_19',
    current_uk_residence: 'yes'
  },
  a_level_profile: {
    subjects: contextualAabSubjects()
  }
});
assert.strictEqual(topLevelContextualOnly.eligibility.status, 'not_eligible');
assertNoManchesterContextualActivation(
  topLevelContextualOnly,
  'Generic contextual declarations must not activate Manchester contextual routes.'
);

const genericFlagsOnly = classify({
  applicant_identity: {
    age_at_course_start_band: 'age_19',
    current_uk_residence: 'yes',
    contextual_flags: {
      free_school_meals: true,
      first_generation_higher_education: true
    }
  },
  a_level_profile: {
    subjects: contextualAabSubjects()
  }
});
assert.strictEqual(genericFlagsOnly.eligibility.status, 'not_eligible');
assertNoManchesterContextualActivation(
  genericFlagsOnly,
  'Generic contextual flags must not activate Manchester contextual routes.'
);

const legacyAgeResult = classify(merge(
  contextualSharedFacts({
    applicant_identity: {
      age_at_course_start_band: 'age_18_or_over_legacy',
      current_uk_residence: 'yes'
    }
  }),
  {
    a_level_profile: {
      subjects: contextualAabSubjects()
    }
  }
));
assert.strictEqual(legacyAgeResult.eligibility.status, 'manual_review');
assert.deepStrictEqual(legacyAgeResult.eligibility.manual_review_reasons, [
  'manchester_contextual_information_needed'
]);
assert.ok(
  legacyAgeResult.eligibility.contextual_eligibility.missing_information.some((entry) => {
    return entry.reason === 'precise_age_confirmation_required';
  })
);

const mapGuaranteedInterview = classify({
  contextual_evidence: {
    manchester_access_programme: {
      completed: true,
      verified: true
    }
  }
});
assert.strictEqual(mapGuaranteedInterview.eligibility.status, 'eligible');
assert.strictEqual(mapGuaranteedInterview.interview_outcome, 'guaranteed_interview');
assert.strictEqual(mapGuaranteedInterview.eligibility.academic_pathway_id, 'manchester_standard_offer');
assertNoManchesterContextualActivation(
  mapGuaranteedInterview,
  'MAP must remain separate from Manchester contextual route activation.'
);

const structuredMapGuaranteedInterview = classify(
  structuredMapCompletionEvidence()
);
assert.strictEqual(structuredMapGuaranteedInterview.eligibility.status, 'eligible');
assert.strictEqual(structuredMapGuaranteedInterview.interview_outcome, 'guaranteed_interview');
assert.strictEqual(structuredMapGuaranteedInterview.eligibility.academic_pathway_id, 'manchester_standard_offer');
assertNoManchesterContextualActivation(
  structuredMapGuaranteedInterview,
  'Structured UKWPMED MAP completion must trigger only the MAP guaranteed-interview override.'
);
assert.strictEqual(
  structuredMapGuaranteedInterview.guaranteed_interview_explanation,
  'Based on the information provided, you meet the published criteria for a guaranteed interview through the Manchester Access Programme (MAP).'
);

const structuredMapPrediction = predictManchester(
  structuredMapCompletionEvidence()
);
assert.strictEqual(structuredMapPrediction.result_card.interview_outcome, 'guaranteed_interview');
assert.strictEqual(
  structuredMapPrediction.result_card.primary_explanation,
  'Based on the information provided, you meet the published criteria for a guaranteed interview through the Manchester Access Programme (MAP).'
);
assert.strictEqual(
  structuredMapPrediction.result_card.guaranteed_interview_notice,
  'You meet the published requirements for the MAP guaranteed-interview route.'
);
assert.strictEqual(
  structuredMapPrediction.result_card.guaranteed_interview_badge_label,
  'Guaranteed Interview'
);
const mapSelectionStage = structuredMapPrediction.result_card.decision_transparency?.decision_path?.find((stage) => {
  return stage.stage === 'Selection model';
});
const mapApplicantPoolCheck = (mapSelectionStage?.checks || []).find((entry) => {
  return entry.label === 'Applicant pool';
});
assert.strictEqual(
  mapApplicantPoolCheck?.summary,
  'Manchester Access Programme (MAP)'
);

const mapDoesNotRescueAab = classify({
  contextual_evidence: {
    manchester_access_programme: {
      completed: true,
      verified: true
    }
  },
  a_level_profile: {
    subjects: contextualAabSubjects()
  }
});
assert.strictEqual(mapDoesNotRescueAab.eligibility.status, 'not_eligible');
assert.strictEqual(mapDoesNotRescueAab.eligibility.academic_pathway_id, 'manchester_standard_offer');

const structuredMapDoesNotRescueAab = classify(merge(
  structuredMapCompletionEvidence(),
  {
    a_level_profile: {
      subjects: contextualAabSubjects()
    }
  }
));
assert.strictEqual(structuredMapDoesNotRescueAab.eligibility.status, 'not_eligible');
assert.strictEqual(structuredMapDoesNotRescueAab.eligibility.academic_pathway_id, 'manchester_standard_offer');

for (const band of [3, 4]) {
  const result = classify({
    admissions_tests: {
      ucat: {
        sjt_band: band
      }
    }
  });
  assert.strictEqual(result.eligibility.status, 'not_eligible', `SJT ${band}: eligibility`);
  assert.ok(result.eligibility.failures.includes('disqualifying_sjt_rule'), `SJT ${band}: failure`);
}

const standardPrecedenceResult = classify(merge(
  contextualSharedFacts(),
  {
    a_level_profile: {
      subjects: standardSubjects()
    }
  }
));
assert.strictEqual(standardPrecedenceResult.eligibility.status, 'eligible');
assert.strictEqual(standardPrecedenceResult.eligibility.academic_pathway_id, 'manchester_standard_offer');
assert.strictEqual(standardPrecedenceResult.guidance_pool_id, 'a106_home_contextual_wp_school_leaver');

const contextualRescueWithoutFacts = classify({
  a_level_profile: {
    subjects: contextualAabSubjects()
  }
});
assert.strictEqual(contextualRescueWithoutFacts.eligibility.status, 'not_eligible');
assert.strictEqual(contextualRescueWithoutFacts.eligibility.academic_pathway_id, 'manchester_standard_offer');

const contextualRescueWithFacts = classify(merge(
  contextualSharedFacts(),
  {
    a_level_profile: {
      subjects: contextualAabSubjects()
    }
  }
));
assert.strictEqual(contextualRescueWithFacts.eligibility.status, 'eligible');
assert.strictEqual(contextualRescueWithFacts.eligibility.academic_pathway_id, 'manchester_contextual_aab_offer');

const wpNotVerifiedResult = classify(merge(
  contextualSharedFacts(),
  {
    gcse_profile: {
      subjects: {
        religious_studies: '6'
      }
    },
    a_level_profile: {
      subjects: contextualAabSubjects()
    }
  }
));
assert.strictEqual(wpNotVerifiedResult.eligibility.status, 'not_eligible');
assert.ok(
  wpNotVerifiedResult.eligibility.failures.includes(
    'minimum_gcse_count_at_grade_not_met:gcse_standard_seven_at_7_or_a'
  )
);

const wpVerifiedResult = classify(merge(
  contextualSharedFacts({
    contextual_evidence: {
      external_assessments: verifiedManchesterAssessment({
        wp_band: 'wp_plus'
      })
    }
  }),
  {
    gcse_profile: {
      subjects: {
        religious_studies: '6'
      }
    },
    a_level_profile: {
      subjects: contextualAabSubjects()
    }
  }
));
assert.strictEqual(wpVerifiedResult.eligibility.status, 'eligible');
assert.ok(wpVerifiedResult.applicant_group_ids.includes('manchester_wp_verified'));

const refugeePrediction = predictManchester({
  contextual_profile: {
    personal_circumstances: {
      uk_refugee_status_granted: 'yes'
    }
  },
  a_level_profile: {
    subjects: refugeeCareAbbSubjects()
  }
});
assert.strictEqual(refugeePrediction.result_card.recommendation_display_state, 'standard');
assert.deepStrictEqual(refugeePrediction.result_card.alternative_academic_offer, {
  type: 'contextual',
  standard_offer: 'AAA',
  alternative_offer: 'ABB',
  pathway_id: 'manchester_refugee_care_abb_offer',
  conditions: []
});
assert.match(
  refugeePrediction.result_card.primary_explanation,
  /Contextual eligibility confirmed: Care Experienced Route \(ABB\)/i
);
const refugeeSelectionStage = refugeePrediction.result_card.decision_transparency?.decision_path?.find((stage) => {
  return stage.stage === 'Selection model';
});
const contextualEligibilityCheck = (refugeeSelectionStage?.checks || []).find((entry) => {
  return entry.label === 'Contextual eligibility';
});
assert.ok(contextualEligibilityCheck, 'Manchester result card must show a contextual eligibility check.');
assert.match(contextualEligibilityCheck.summary || '', /Care Experienced Route \(ABB\)/i);
assert.match(contextualEligibilityCheck.summary || '', /Matched evidence/i);

console.log('Manchester A100 contextual routing and result-card regression');
console.log('PASS standard AAA, contextual AAB, refugee/care ABB and MAP separation');
console.log('PASS missing area/school evidence, legacy age ambiguity and generic-flag isolation');
console.log('PASS SJT rejection, standard-route precedence, contextual rescue and WP verification gating');
