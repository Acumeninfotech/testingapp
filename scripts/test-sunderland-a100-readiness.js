#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  presentResultCard,
  humanManualReviewReason,
  insufficientEvidenceReasonCodeFromWarnings
} = require('../assets/js/engine/result-card-presenter');

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

function hasNestedKey(value, targetKey) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) {
    return true;
  }
  return Object.values(value).some((entry) => hasNestedKey(entry, targetKey));
}

function hasPublicInternalLeak(value) {
  return /manual_review_required|prediction_confidence|compensatory_admissions_test_policy|compensable_deficiencies|maximum_compensable_deficiencies|ucat_remains_required|sjt_remains_required/.test(JSON.stringify(value));
}

const course = readJson('data/universities/sunderland-a100.json');
const research = readJson('data/research/sunderland-a100-research.json');
const config = readJson('data/interview-band-configs/sunderland-a100.json');
const card = readJson('data/examples/sunderland-a100-result-card.example.json');
const fixture = readJson('data/fixtures/interview-band-classification/sunderland-a100.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'sunderland-a100');
assert.strictEqual(course.profile_status, 'production_ready_eligibility_and_interview_guidance');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);

assert.strictEqual(course.course.ucas_code, 'A100');
assert.deepStrictEqual(course.course.fee_statuses, ['home']);
assert.strictEqual(course.course.is_graduate_entry, false);
assert.match(course.course.notes, /Graduates apply through the same A100 code/);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'holistic_review');
assert.strictEqual(course.stage_2_interview_selection.academic_scoring.applies, false);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.ucat.minimum_total_score, 1680);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.ucat.score_used_for_ranking, false);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.accepted_bands, [1, 2, 3]);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.excluded_bands, [4]);
assert.deepStrictEqual(
  config.guidance_pools.map((pool) => [pool.pool_id, pool.metric]),
  [['home_a100_eligibility_gate', 'eligibility_gate']]
);
assert.strictEqual(config.score_model.historical_guidance_only, true);
assert.strictEqual(config.score_model.fixed_current_cutoff, false);
assert.deepStrictEqual(
  config.score_model.historical_ucat_guidance.map((row) => row.adjusted_minimum_ucat_2700),
  [1690, 1670, 1650, 1680, 1670]
);
assert.ok(
  config.score_model.historical_ucat_guidance.every((row) => row.display_only === true),
  'Sunderland historical UCAT rows must be display-only.'
);

const graduatePolicy =
  course.stage_1_eligibility.post_16.graduate.compensatory_admissions_test_policy;
assert.strictEqual(graduatePolicy.enabled, true);
assert.strictEqual(graduatePolicy.standard_route_evaluated_first, true);
assert.strictEqual(graduatePolicy.ugat_remains_required, undefined);
assert.strictEqual(graduatePolicy.ucat_remains_required, true);
assert.strictEqual(graduatePolicy.sjt_remains_required, true);
assert.deepStrictEqual(
  graduatePolicy.compensable_deficiencies,
  ['a_level_requirements_not_met', 'gcse_science_alternative_not_met']
);
assert.strictEqual(graduatePolicy.maximum_compensable_deficiencies, 1);

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);
  const expected = scenario.expected;

  assert.strictEqual(
    result.eligibility.status,
    expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  assert.strictEqual(
    result.guidance_pool_id ?? null,
    expected.guidance_pool_id,
    `${scenario.scenario_id}: guidance pool`
  );
  assert.strictEqual(
    result.canonical_interview_band,
    expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  assert.strictEqual(
    result.manual_review_required === true,
    expected.manual_review_required,
    `${scenario.scenario_id}: manual review`
  );
  if (expected.failure) {
    assert.ok(
      result.eligibility.failures.includes(expected.failure),
      `${scenario.scenario_id}: expected failure ${expected.failure}; got ${result.eligibility.failures.join(',')}`
    );
  }
  if (expected.absent_failure) {
    assert.ok(
      !result.eligibility.failures.includes(expected.absent_failure),
      `${scenario.scenario_id}: unexpected failure ${expected.absent_failure}`
    );
  }
  if (expected.academic_pathway_id) {
    assert.strictEqual(
      result.eligibility.academic_pathway_id,
      expected.academic_pathway_id,
      `${scenario.scenario_id}: academic pathway`
    );
  }
  assert.strictEqual(hasNestedKey(result, 'offer_prediction'), false);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

function aLevelSubjects(grades) {
  return [
    {
      subject_id: 'biology',
      predicted_grade: grades[0],
      practical_endorsement: 'pass'
    },
    {
      subject_id: 'chemistry',
      predicted_grade: grades[1],
      practical_endorsement: 'pass'
    },
    {
      subject_id: 'mathematics',
      predicted_grade: grades[2],
      practical_endorsement: 'not_applicable'
    }
  ];
}

function applicantWith(grades, contextualProfile = {}, extra = {}) {
  return merge(
    merge(fixture.base_applicant, {
      a_level_profile: {
        subjects: aLevelSubjects(grades)
      }
    }),
    merge({ contextual_profile: contextualProfile }, extra)
  );
}

function applicantWithExactContextualProfile(grades, contextualProfile, extra = {}) {
  const applicant = merge(
    merge(fixture.base_applicant, {
      a_level_profile: {
        subjects: aLevelSubjects(grades)
      }
    }),
    extra
  );
  applicant.contextual_profile = clone(contextualProfile);
  return applicant;
}

function classifyApplicant(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function presentClassification(classification, applicant) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    manualReviewReason: humanManualReviewReason(classification.eligibility.manual_review_reasons),
    insufficientEvidenceReasonCode: insufficientEvidenceReasonCodeFromWarnings(classification.warnings, {
      eligibilityStatus: classification.eligibility.status,
      guidancePoolId: classification.guidance_pool_id ?? null
    }),
    transparencyContext: {
      course_identity: {
        profile_id: course.profile_id,
        university_name: 'University of Sunderland'
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids,
      readiness: course.engine_notes,
      eligibility: classification.eligibility,
      eligibility_checks: classification.eligibility.checks,
      eligibility_failures: classification.eligibility.failures,
      academic_pathway: classification.eligibility.academic_pathway || null,
      academic_pathway_id: classification.eligibility.academic_pathway_id || null,
      future_conditions: classification.eligibility.future_conditions || [],
      stage_1_eligibility: course.stage_1_eligibility,
      historical_admissions: course.historical_admissions,
      ranking: classification.ranking,
      band_metric: classification.band_metric,
      guidance_pool: classification.guidance_pool,
      guidance_pool_id: classification.guidance_pool_id ?? null,
      score_model: config.score_model,
      warnings: classification.warnings || []
    }
  });
}

function expectEligibility(name, applicant, expected) {
  const result = classifyApplicant(applicant);
  assert.strictEqual(result.eligibility.status, expected.status, `${name}: eligibility`);
  if (expected.band !== undefined) {
    assert.strictEqual(result.canonical_interview_band, expected.band, `${name}: band`);
  }
  if (expected.pathwayId !== undefined) {
    assert.strictEqual(result.eligibility.academic_pathway_id ?? null, expected.pathwayId, `${name}: pathway`);
  }
  if (expected.contextualPathway !== undefined) {
    assert.strictEqual(
      result.eligibility.contextual_eligibility?.matched_contextual_pathway ?? null,
      expected.contextualPathway,
      `${name}: contextual pathway`
    );
  }
  if (expected.failure) {
    assert.ok(result.eligibility.failures.includes(expected.failure), `${name}: expected ${expected.failure}`);
  }
  if (expected.manualReviewReason) {
    assert.ok(
      result.eligibility.manual_review_reasons.includes(expected.manualReviewReason),
      `${name}: expected manual review ${expected.manualReviewReason}`
    );
  }
  return result;
}

const noContextualCriteria = {
  home_area_region: {
    home_region: 'none',
    polar4_quintile: 'q5'
  },
  financial_support: {
    free_school_meals: 'no',
    ucat_bursary_recipient: 'no'
  },
  personal_circumstances: {
    refugee: 'no',
    uk_refugee_status_granted: 'no',
    military_family: 'no'
  }
};

const localNoWp = merge(noContextualCriteria, {
  home_area_region: {
    home_region: 'north_east_england_or_cumbria',
    polar4_quintile: 'q5'
  }
});

const realDefaultUnansweredStep6 = {
  home_area_region: {
    postcode: '',
    polar4_quintile: 'unknown',
    imd_quintile: 'unknown',
    tundra_quintile: 'unknown',
    simd_quintile: '',
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
    participation_status: 'no'
  },
  partner_schools: {
    status: 'no',
    relationships: []
  }
};

expectEligibility('standard AAA', fixture.base_applicant, {
  status: 'eligible',
  band: 'realistic',
  pathwayId: 'sunderland_standard_aaa',
  contextualPathway: null
});

const fsmAab = expectEligibility(
  'FSM-six-year AAB',
  applicantWith(['A', 'A', 'B'], {
    financial_support: {
      free_school_meals: 'yes'
    }
  }),
  {
    status: 'eligible',
    pathwayId: 'sunderland_contextual_aab',
    contextualPathway: 'sunderland_contextual_aab'
  }
);

expectEligibility(
  'UCAT-bursary AAB',
  applicantWith(['A', 'A', 'B'], {
    financial_support: {
      ucat_bursary_recipient: 'yes'
    }
  }),
  {
    status: 'eligible',
    pathwayId: 'sunderland_contextual_aab',
    contextualPathway: 'sunderland_contextual_aab'
  }
);

expectEligibility('no-criteria AAB rejection', applicantWith(['A', 'A', 'B'], noContextualCriteria), {
  status: 'not_eligible',
  pathwayId: 'sunderland_standard_aaa',
  failure: 'a_level_requirements_not_met'
});

const unresolvedAab = expectEligibility(
  'unresolved AAB',
  applicantWith(['A', 'A', 'B'], {
    financial_support: {
      free_school_meals: 'not_sure',
      ucat_bursary_recipient: 'no'
    },
    home_area_region: {
      home_region: 'none',
      polar4_quintile: 'q5'
    },
    personal_circumstances: {
      refugee: 'no',
      uk_refugee_status_granted: 'no',
      military_family: 'no'
    }
  }),
  {
    status: 'manual_review',
    manualReviewReason: 'sunderland_contextual_information_needed'
  }
);
assert.deepStrictEqual(
  unresolvedAab.missing_information.map((entry) => entry.criterion_id),
  ['free_school_meals']
);

const unresolvedDefaultAaa = expectEligibility(
  'standard AAA with real default unanswered Step 6',
  applicantWithExactContextualProfile(['A', 'A', 'A*'], realDefaultUnansweredStep6, {
    admissions_tests: {
      ucat: {
        total_score: 1950,
        subtests: {
          verbal_reasoning: 650,
          decision_making: 650,
          quantitative_reasoning: 650
        },
        sjt_band: 2
      }
    }
  }),
  {
    status: 'eligible',
    pathwayId: 'sunderland_standard_aaa',
    contextualPathway: null
  }
);
assert.strictEqual(unresolvedDefaultAaa.manual_review_required, undefined);
assert.deepStrictEqual(unresolvedDefaultAaa.eligibility.manual_review_reasons, []);
assert.ok(
  !unresolvedDefaultAaa.applicant_group_ids.includes('contextual'),
  'standard AAA with default Step 6 must not be classified as contextual'
);
assert.ok(
  !unresolvedDefaultAaa.applicant_group_ids.includes('widening_participation'),
  'standard AAA with default Step 6 must not be classified as widening participation'
);
assert.strictEqual(unresolvedDefaultAaa.eligibility.contextual_eligibility?.is_contextual, false);

expectEligibility(
  'AAB with real default unanswered Step 6',
  applicantWithExactContextualProfile(['A', 'A', 'B'], realDefaultUnansweredStep6),
  {
    status: 'not_eligible',
    failure: 'a_level_requirements_not_met'
  }
);

expectEligibility(
  'ABB with real default unanswered Step 6',
  applicantWithExactContextualProfile(['A', 'B', 'B'], realDefaultUnansweredStep6),
  {
    status: 'not_eligible',
    failure: 'a_level_requirements_not_met'
  }
);

expectEligibility('below ABB with real default unanswered Step 6', applicantWithExactContextualProfile(['B', 'B', 'B'], realDefaultUnansweredStep6), {
  status: 'not_eligible',
  failure: 'a_level_requirements_not_met'
});

for (const [name, contextualProfile, criterionId] of [
  ['ABB through POLAR4 Q1', { home_area_region: { home_region: 'north_east_england_or_cumbria', polar4_quintile: 'q1' } }, 'polar4_quintile_1_or_2'],
  ['ABB through POLAR4 Q2', { home_area_region: { home_region: 'north_east_england_or_cumbria', polar4_quintile: 'q2' } }, 'polar4_quintile_1_or_2'],
  ['ABB through refugee', { home_area_region: { home_region: 'north_east_england_or_cumbria', polar4_quintile: 'q5' }, personal_circumstances: { refugee: 'yes' } }, 'refugee_status'],
  ['ABB through FSM', { home_area_region: { home_region: 'north_east_england_or_cumbria', polar4_quintile: 'q5' }, financial_support: { free_school_meals: 'yes' } }, 'free_school_meals'],
  ['ABB through UCAT bursary', { home_area_region: { home_region: 'north_east_england_or_cumbria', polar4_quintile: 'q5' }, financial_support: { ucat_bursary_recipient: 'yes' } }, 'ucat_bursary'],
  ['ABB through UK Armed Forces family', { home_area_region: { home_region: 'north_east_england_or_cumbria', polar4_quintile: 'q5' }, personal_circumstances: { military_family: 'yes' } }, 'military_family']
]) {
  const result = expectEligibility(name, applicantWith(['A', 'B', 'B'], contextualProfile), {
    status: 'eligible',
    pathwayId: 'sunderland_local_contextual_abb',
    contextualPathway: 'sunderland_local_contextual_abb'
  });
  assert.ok(
    result.eligibility.contextual_eligibility.qualifying_criteria.some((entry) => entry.criterion_id === criterionId),
    `${name}: expected criterion ${criterionId}`
  );
  assert.deepStrictEqual(
    result.eligibility.future_conditions,
    ['sunderland_local_contextual_abb_firm_choice_required'],
    `${name}: ABB future condition`
  );
}

expectEligibility(
  'qualifying criterion without local region',
  applicantWith(['A', 'B', 'B'], {
    home_area_region: {
      home_region: 'none',
      polar4_quintile: 'q1'
    }
  }),
  {
    status: 'not_eligible',
    failure: 'a_level_requirements_not_met'
  }
);

expectEligibility(
  'unknown local region',
  applicantWith(['A', 'B', 'B'], {
    home_area_region: {
      home_region: 'unknown',
      polar4_quintile: 'q1'
    }
  }),
  {
    status: 'manual_review',
    manualReviewReason: 'sunderland_contextual_information_needed'
  }
);

expectEligibility('local region without WP criterion', applicantWith(['A', 'B', 'B'], localNoWp), {
  status: 'not_eligible',
  failure: 'a_level_requirements_not_met'
});

expectEligibility(
  'unresolved ABB criterion',
  applicantWith(['A', 'B', 'B'], {
    home_area_region: {
      home_region: 'north_east_england_or_cumbria',
      polar4_quintile: 'unknown'
    },
    financial_support: {
      free_school_meals: 'no',
      ucat_bursary_recipient: 'no'
    },
    personal_circumstances: {
      refugee: 'no',
      uk_refugee_status_granted: 'no',
      military_family: 'no'
    }
  }),
  {
    status: 'manual_review',
    manualReviewReason: 'sunderland_contextual_information_needed'
  }
);

expectEligibility(
  'legacy contextual flags alone do not activate route',
  applicantWith(['A', 'A', 'B'], noContextualCriteria, {
    applicant_identity: {
      contextual: true,
      widening_participation: true,
      contextual_status_confirmed: true,
      contextual_flags: {
        sunderland_contextual_confirmed: true
      }
    }
  }),
  {
    status: 'not_eligible',
    failure: 'a_level_requirements_not_met'
  }
);

expectEligibility(
  'shared FSM field confirms Sunderland FSM eligibility',
  applicantWith(['A', 'A', 'B'], {
    financial_support: {
      free_school_meals: 'yes',
      ucat_bursary_recipient: 'no'
    },
    home_area_region: {
      home_region: 'none',
      polar4_quintile: 'q5'
    }
  }),
  {
    status: 'eligible',
    pathwayId: 'sunderland_contextual_aab',
    contextualPathway: 'sunderland_contextual_aab'
  }
);

expectEligibility(
  'shared military family field confirms Sunderland Armed Forces eligibility',
  applicantWith(['A', 'B', 'B'], {
    home_area_region: {
      home_region: 'north_east_england_or_cumbria',
      polar4_quintile: 'q5'
    },
    personal_circumstances: {
      military_family: 'yes',
      refugee: 'no',
      uk_refugee_status_granted: 'no'
    },
    financial_support: {
      free_school_meals: 'no',
      ucat_bursary_recipient: 'no'
    }
  }),
  {
    status: 'eligible',
    pathwayId: 'sunderland_local_contextual_abb',
    contextualPathway: 'sunderland_local_contextual_abb'
  }
);

expectEligibility(
  'contextual below UCAT minimum remains rejected',
  applicantWith(['A', 'A', 'B'], {
    financial_support: {
      free_school_meals: 'yes'
    }
  }, {
    admissions_tests: {
      ucat: {
        total_score: 1670,
        subtests: {
          verbal_reasoning: 560,
          decision_making: 560,
          quantitative_reasoning: 550
        }
      }
    }
  }),
  {
    status: 'not_eligible',
    failure: 'minimum_ucat_total_not_met'
  }
);

expectEligibility(
  'contextual SJT Band 4 remains rejected',
  applicantWith(['A', 'A', 'B'], {
    financial_support: {
      ucat_bursary_recipient: 'yes'
    }
  }, {
    admissions_tests: {
      ucat: {
        sjt_band: 4
      }
    }
  }),
  {
    status: 'not_eligible',
    failure: 'sjt_band_excluded'
  }
);

const standardResult = classifyInterviewBand(course, config, fixture.base_applicant);
assert.strictEqual(standardResult.eligibility.status, 'eligible');
assert.strictEqual(standardResult.canonical_interview_band, 'realistic');
assert.strictEqual(standardResult.manual_review_required, undefined);
assert.strictEqual(standardResult.guidance_pool_id, 'home_a100_eligibility_gate');
assert.strictEqual(standardResult.eligibility.academic_pathway_id, 'sunderland_standard_aaa');

const publicCard = presentResultCard({
  eligibilityStatus: standardResult.eligibility.status,
  interviewBand: standardResult.canonical_interview_band,
  manualReviewRequired: standardResult.manual_review_required === true,
  manualReviewReason: humanManualReviewReason(standardResult.eligibility.manual_review_reasons),
  insufficientEvidenceReasonCode: insufficientEvidenceReasonCodeFromWarnings(standardResult.warnings, {
    eligibilityStatus: standardResult.eligibility.status,
    guidancePoolId: standardResult.guidance_pool_id ?? null
  }),
  transparencyContext: {
    course_identity: {
      profile_id: course.profile_id
    },
    applicant_context: fixture.base_applicant,
    applicant_group_ids: standardResult.applicant_group_ids,
    readiness: course.engine_notes,
    eligibility_checks: standardResult.eligibility.checks,
    eligibility_failures: standardResult.eligibility.failures,
    stage_1_eligibility: course.stage_1_eligibility,
    historical_admissions: course.historical_admissions,
    ranking: standardResult.ranking,
    band_metric: standardResult.band_metric,
    guidance_pool: standardResult.guidance_pool,
    guidance_pool_id: standardResult.guidance_pool_id ?? null,
    score_model: config.score_model,
    warnings: standardResult.warnings || []
  }
});

const publicText = JSON.stringify(publicCard);
assert.strictEqual(publicCard.contextual_status, null);
assert.strictEqual(publicCard.contextual_confirmation, null);
assert.strictEqual(publicCard.alternative_academic_offer, null);
assert.strictEqual(publicCard.primary_user_facing_recommendation, 'Possible choice for your application');
assert.strictEqual(publicCard.prediction.result_band, 'realistic');
assert.strictEqual(publicCard.prediction.available, true);
assert.match(publicCard.primary_explanation, /selection score may be competitive for this applicant group/i);
assert.match(publicText, /Interview Selection Tool/);
assert.match(publicText, /Interview Selection Tool shortlisting/i);
assert.doesNotMatch(publicText, /Interview Likely|Strong Choice|guaranteed interview|will receive an interview|offer chance|offer probability|IST score is/i);
assert.strictEqual(hasNestedKey(publicCard, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(publicCard, 'offer_probability'), false);
assert.strictEqual(hasPublicInternalLeak(publicCard), false);

const defaultStep6AaaApplicant = applicantWithExactContextualProfile(['A', 'A', 'A*'], realDefaultUnansweredStep6, {
  admissions_tests: {
    ucat: {
      total_score: 1950,
      subtests: {
        verbal_reasoning: 650,
        decision_making: 650,
        quantitative_reasoning: 650
      },
      sjt_band: 2
    }
  }
});
const defaultStep6AaaClassification = classifyApplicant(defaultStep6AaaApplicant);
const defaultStep6AaaCard = presentClassification(
  defaultStep6AaaClassification,
  defaultStep6AaaApplicant
);
const defaultStep6AaaText = JSON.stringify(defaultStep6AaaCard);
assert.strictEqual(defaultStep6AaaClassification.eligibility.status, 'eligible');
assert.strictEqual(defaultStep6AaaClassification.eligibility.academic_pathway_id, 'sunderland_standard_aaa');
assert.strictEqual(defaultStep6AaaCard.contextual_status, null);
assert.strictEqual(defaultStep6AaaCard.contextual_confirmation, null);
assert.strictEqual(defaultStep6AaaCard.alternative_academic_offer, null);
assert.strictEqual(defaultStep6AaaCard.information_needed_reason, null);
assert.doesNotMatch(defaultStep6AaaText, /contextual eligibility confirmed/i);
assert.doesNotMatch(defaultStep6AaaText, /contextual AAB/i);
assert.doesNotMatch(defaultStep6AaaText, /local contextual ABB/i);
assert.doesNotMatch(defaultStep6AaaText, /firm choice/i);
assert.doesNotMatch(defaultStep6AaaText, /insurance choice/i);

const aabApplicant = applicantWith(['A', 'A', 'B'], {
  financial_support: {
    free_school_meals: 'yes'
  }
});
const aabCard = presentClassification(classifyApplicant(aabApplicant), aabApplicant);
assert.strictEqual(aabCard.contextual_status, 'confirmed');
assert.strictEqual(aabCard.contextual_confirmation.collapsed_label, 'Contextual eligibility confirmed');
assert.strictEqual(aabCard.contextual_confirmation.contextual_offer_grade, 'AAB');
assert.deepStrictEqual(aabCard.alternative_academic_offer, {
  type: 'contextual',
  standard_offer: 'AAA',
  alternative_offer: 'AAB',
  alternative_offer_label: 'Contextual offer',
  explanation: 'Sunderland contextual eligibility is confirmed. The contextual offer is AAB; the standard offer is AAA.',
  applicable_offer: 'Contextual offer: AAB',
  pathway_id: 'sunderland_contextual_aab',
  conditions: []
});
assert.match(JSON.stringify(aabCard), /Contextual eligibility confirmed/i);
assert.match(JSON.stringify(aabCard), /Contextual offer: AAB/i);
assert.match(JSON.stringify(aabCard), /standard offer is AAA/i);

const abbApplicant = applicantWith(['A', 'B', 'B'], {
  home_area_region: {
    home_region: 'north_east_england_or_cumbria',
    polar4_quintile: 'q1'
  }
});
const abbCard = presentClassification(classifyApplicant(abbApplicant), abbApplicant);
assert.strictEqual(abbCard.contextual_status, 'confirmed');
assert.strictEqual(abbCard.contextual_confirmation.collapsed_label, 'Local contextual eligibility confirmed');
assert.strictEqual(abbCard.contextual_confirmation.contextual_offer_grade, 'ABB');
assert.deepStrictEqual(abbCard.alternative_academic_offer, {
  type: 'contextual',
  standard_offer: 'AAA',
  alternative_offer: 'ABB',
  alternative_offer_label: 'Local contextual offer',
  explanation: 'Sunderland local contextual eligibility is confirmed. The local contextual offer is ABB only if Sunderland is the firm UCAS choice; if Sunderland is the insurance choice, the offer is AAB.',
  applicable_offer: 'Local contextual offer: ABB',
  pathway_id: 'sunderland_local_contextual_abb',
  conditions: ['You must make Sunderland your firm UCAS choice to receive the ABB offer; if Sunderland is your insurance choice, the offer is AAB.']
});
assert.match(JSON.stringify(abbCard), /Local contextual eligibility confirmed/i);
assert.match(JSON.stringify(abbCard), /Local contextual offer: ABB/i);
assert.match(JSON.stringify(abbCard), /firm UCAS choice/i);
assert.match(JSON.stringify(abbCard), /insurance choice, the offer is AAB/i);
assert.deepStrictEqual(abbCard.future_conditions, ['sunderland_local_contextual_abb_firm_choice_required']);
assert.match(JSON.stringify(abbCard.future_condition_advisories), /insurance choice, the offer is AAB/i);

assert.strictEqual(card.prediction.result_band, 'realistic');
assert.strictEqual(card.prediction.available, true);
assert.strictEqual(card.display.primary_user_facing_recommendation, 'Possible choice for your application');
assert.match(JSON.stringify(card), /Interview Selection Tool/);
assert.match(
  JSON.stringify(card),
  /Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview/i
);
assert.doesNotMatch(JSON.stringify(card), /Interview Likely|Strong Choice|Guaranteed interview|You will receive an interview|Your IST score is|offer chance|offer probability/i);
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);
assert.strictEqual(card.readiness.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(card.engine_notes.offer_prediction_scope, 'out_of_scope');

assert.strictEqual(research.implementation_mapping.sunderland_specific_engine_branch, false);
assert.strictEqual(research.implementation_mapping.offer_prediction_implemented, false);
assert.strictEqual(research.implementation_mapping.ist_score_implemented, false);
assert.strictEqual(research.implementation_mapping.historical_ucat_used_as_current_cutoff, false);
assert.strictEqual(research.readiness.activation_ready, true);
assert.strictEqual(research.readiness.production_ready, true);
assert.strictEqual(course.engine_notes.activation_ready, true);
assert.strictEqual(course.engine_notes.production_ready, true);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Sunderland A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.selection_model, 'hybrid_eligibility_ucat_sjt_ist_shortlisting');
assert.strictEqual(indexEntry.has_graduate_entry, true);
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/sunderland-a100.json');
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.international_prediction, false);
assert.strictEqual(indexEntry.contextual_logic, true);

for (const field of [
  'eligibility',
  'interview_prediction',
  'historical_guidance',
  'international_prediction',
  'contextual_logic',
  'result_card',
  'regression',
  'research_completeness',
  'manual_review_required',
  'eligibility_ready',
  'interview_prediction_ready',
  'prediction_confidence',
  'result_card_ready',
  'offer_prediction_scope'
]) {
  assert.deepStrictEqual(research.readiness[field], course.engine_notes[field]);
  assert.deepStrictEqual(card.readiness[field], course.engine_notes[field]);
  assert.deepStrictEqual(indexEntry[field], course.engine_notes[field]);
}

console.log('Sunderland A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log('Home-only gate, contextual AAB, UCAT/SJT gates, IST limitation, graduate GAMSAT policy and no-offer safeguards: PASS');
