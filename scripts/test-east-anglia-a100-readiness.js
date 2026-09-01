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
const {
  evaluateContextualEligibility
} = require('../assets/js/engine/eligibility-evaluator');
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

function hasNestedKey(value, targetKey) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) {
    return true;
  }
  return Object.values(value).some((entry) => hasNestedKey(entry, targetKey));
}

function includesFailure(result, expected) {
  const failures = [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
  return failures.some((failure) => failure === expected);
}

function makeResultCard(course, config, applicant, classification) {
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
        profile_id: course.profile_id
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: course.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      stage_1_eligibility: course.stage_1_eligibility || null,
      historical_admissions: course.historical_admissions || null,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      score_model: config.score_model,
      guidance_pool_id: classification.guidance_pool_id || null,
      selection_route_id: classification.selection_route_id || null,
      interview_outcome: classification.interview_outcome || null,
      guaranteed_interview_explanation: classification.guaranteed_interview_explanation || null,
      guaranteed_interview_notice: classification.guaranteed_interview_notice || null,
      guaranteed_interview_pool_label: classification.guaranteed_interview_pool_label || null,
      guaranteed_interview_badge_label: classification.guaranteed_interview_badge_label || null,
      warnings: classification.warnings || []
    }
  });
}

const course = readJson('data/universities/east-anglia-a100.json');
const research = readJson('data/research/east-anglia-a100-research.json');
const config = readJson('data/interview-band-configs/east-anglia-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/east-anglia-a100.json');
const card = readJson('data/examples/east-anglia-a100-result-card.example.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'east-anglia-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');
assert.strictEqual(course.stage_2_interview_selection.ranking_factors[0].weight_percent, 100);
assert.deepStrictEqual(course.stage_2_interview_selection.modifiers, [
  'home_international_separate_ranking'
]);
assert.strictEqual(course.contextual_admissions.available, false);

const gcse = course.stage_1_eligibility.gcse;
assert.strictEqual(gcse.minimum_count, 6);
assert.strictEqual(gcse.minimum_count_at_or_above_grade.count, 6);
assert.strictEqual(gcse.minimum_count_at_or_above_grade.minimum_grade, '7/A');
assert.strictEqual(gcse.scored_after_eligibility, false);
assert.strictEqual(
  gcse.grade_requirements.find((rule) => rule.subject_id === 'english_language').minimum_grade,
  '5/B'
);
assert.strictEqual(
  gcse.grade_requirements.find((rule) => rule.subject_id === 'mathematics').minimum_grade,
  '7/A'
);
assert.ok(
  gcse.science_requirement.accepted_options.some((option) => option.option_id === 'combined_science_double_award')
);

const aLevel = course.stage_1_eligibility.post_16.a_level;
assert.deepStrictEqual(aLevel.standard_offer.grade_profile, ['A', 'A', 'A']);
assert.strictEqual(aLevel.contextual_offer, null);
assert.strictEqual(aLevel.science_practical_endorsement_required, true);
assert.strictEqual(aLevel.predicted_grades_scored, false);
assert.strictEqual(aLevel.achieved_grades_scored, false);
assert.deepStrictEqual(aLevel.excluded_subject_names, [
  'General Studies',
  'Critical Thinking'
]);

const admissionsTests = course.stage_1_eligibility.admissions_tests;
assert.strictEqual(admissionsTests.ucat.required, true);
assert.strictEqual(admissionsTests.ucat.minimum_total_score, null);
assert.strictEqual(admissionsTests.sjt.used_as_gate, false);
assert.deepStrictEqual(admissionsTests.sjt.accepted_bands, [1, 2, 3, 4]);
assert.deepStrictEqual(admissionsTests.sjt.excluded_bands, []);
assert.strictEqual(admissionsTests.sjt.scoring.used_in_score, false);

assert.strictEqual(config.score_model.metric, 'ucat_total');
assert.strictEqual(config.score_model.scale.max, 2700);
assert.strictEqual(config.score_model.fixed_current_cutoff, false);
assert.strictEqual(config.score_model.legacy_3600_conversion_used, true);
assert.strictEqual(config.score_model.anomaly_exclusion_policy.source_values_preserved_in_research, true);
assert.deepStrictEqual(config.score_model.anomaly_exclusion_policy.excluded_cycles, [2020, 2025]);
assert.strictEqual(
  config.score_model.calibration_policy.method,
  'median_of_non_anomalous_home_interview_average_scores_normalised_to_2700'
);
assert.strictEqual(
  config.score_model.calibration_policy.pool_references.home_a100.median_reference_2700,
  2076.75
);
assert.deepStrictEqual(
  config.score_model.calibration_policy.pool_references.home_a100.runtime_boundaries,
  {
    likely: 2227,
    realisticMin: 2077,
    realisticMax: 2226,
    ambitiousMin: 1927,
    ambitiousMax: 2076,
    highRiskBelow: 1927
  }
);
assert.deepStrictEqual(
  config.guidance_pools.map((pool) => pool.pool_id),
  [
    'international_a100',
    'home_a100'
  ]
);
assert.deepStrictEqual(
  config.guidance_pools.find((pool) => pool.pool_id === 'international_a100').band_rules,
  []
);
assert.ok(
  !JSON.stringify(config.guidance_pools).match(/\b(?:1390|2739|2758|2710|2730)\b/),
  'Anomalous 2020 and unverified 2025 UCAT values must not appear in executable guidance pools.'
);

const historical2020 = course.historical_admissions.cycles.find((row) => row.entry_year === 2020);
const historical2025 = course.historical_admissions.cycles.find((row) => row.entry_year === 2025);
assert.strictEqual(historical2020.official_source_anomaly, true);
assert.strictEqual(historical2020.usable_for_guidance_band_calibration, false);
assert.strictEqual(historical2020.highest_interviewed_ucat, 1390);
assert.strictEqual(historical2025.official_source_anomaly, true);
assert.strictEqual(historical2025.usable_for_guidance_band_calibration, false);
assert.strictEqual(historical2025.average_interviewed_ucat, 2739);
assert.strictEqual(historical2025.average_offer_ucat, 2758);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'UEA A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.has_contextual_admissions, false);
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/east-anglia-a100.json');
assert.strictEqual(course.engine_notes.production_ready, true);
assert.strictEqual(research.readiness.production_ready_candidate, true);
assert.strictEqual(research.readiness.international_prediction, false);
assert.strictEqual(card.prediction.result_band, 'realistic');
assert.strictEqual(card.evidence_confidence.level, 'Medium');
assert.strictEqual(hasNestedKey(course, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(config, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

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
  if (expected.failure) {
    assert.ok(includesFailure(result, expected.failure), `${scenario.scenario_id}: failure ${expected.failure}`);
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

function applicantForBoundary(boundary) {
  const international = boundary.pool === 'international';
  const ucatTotal = boundary.ucat_total;
  const first = Math.floor(ucatTotal / 3);
  const second = Math.floor((ucatTotal - first) / 2);
  const third = ucatTotal - first - second;
  return merge(fixture.base_applicant, {
    applicant_identity: {
      applicant_type: international
        ? 'international_standard_school_leaver'
        : 'standard_school_leaver',
      fee_status: international ? 'International' : 'Home',
      domicile: international ? 'International' : 'England',
      english_language_exempt: international
    },
    admissions_tests: {
      ucat: {
        total_score: ucatTotal,
        subtests: {
          verbal_reasoning: first,
          decision_making: second,
          quantitative_reasoning: third
        }
      }
    }
  });
}

for (const boundary of fixture.historical_guidance_boundaries) {
  const result = classifyInterviewBand(
    course,
    config,
    applicantForBoundary(boundary)
  );
  assert.strictEqual(
    result.canonical_interview_band,
    boundary.expected_band,
    `${boundary.pool} UCAT ${boundary.ucat_total}`
  );
}

const baseResult = classifyInterviewBand(course, config, fixture.base_applicant);
const resultCard = makeResultCard(course, config, fixture.base_applicant, baseResult);
assert.strictEqual(baseResult.interview_outcome ?? null, null);
assert.strictEqual(resultCard.prediction.ranking_metric, 'ucat_total');
assert.strictEqual(resultCard.decision_transparency.score_breakdown, null);
assert.match(
  JSON.stringify(resultCard.decision_transparency),
  /UCAT.*ranking|ranking.*UCAT/i,
  'Result card must explain UCAT ranking rather than academic scoring.'
);
assert.doesNotMatch(
  JSON.stringify(resultCard),
  /offer probability|MMI performance|waiting-list prediction/i
);

const strongStructuredContextualApplicant = merge(fixture.base_applicant, {
  contextual_profile: {
    home_area_region: {
      postcode: 'NR1 1AA',
      polar4_quintile: 'q1',
      imd_quintile: 'q1',
      tundra_quintile: 'q1',
      home_region: 'east_of_england',
      school_area: 'none',
      regional_flags: {
        east_of_england: 'yes'
      },
      postcode_lookup: {
        status: 'matched',
        values: {
          polar4: { value: 1, source: 'ons_postcode_lookup' },
          imd: { value: 1, source: 'ons_postcode_lookup', dataset_year: 2019 },
          tundra: { value: 1, source: 'ons_postcode_lookup' }
        }
      }
    },
    financial_support: {
      free_school_meals: 'yes',
      ucat_bursary_recipient: 'yes',
      other_financial_support: 'yes'
    },
    school_education: {
      first_in_family_at_university: 'yes',
      school_performance_indicator: 'yes'
    },
    personal_circumstances: {
      care_experienced: 'yes',
      refugee: 'yes',
      estranged: 'yes',
      young_carer: 'yes',
      disability: 'yes'
    },
    access_programmes: {
      participation_status: 'yes',
      ukwpmed: {
        status: 'yes',
        programme_id: 'keele_steps2medicine',
        programme_status: 'completed'
      },
      other_programmes: [
        {
          programme_id: 'generic_widening_participation_programme',
          status: 'completed'
        }
      ]
    },
    partner_schools: {
      status: 'yes',
      relationships: [
        {
          university_id: 'east-anglia-a100',
          school_name: 'Example Partner School',
          status: 'yes'
        }
      ]
    }
  }
});

const strongStructuredContextualResult = classifyInterviewBand(
  course,
  config,
  strongStructuredContextualApplicant
);
assert.strictEqual(
  strongStructuredContextualResult.eligibility.status,
  baseResult.eligibility.status,
  'Structured contextual evidence must not alter UEA A100 eligibility status.'
);
assert.deepStrictEqual(
  strongStructuredContextualResult.eligibility.checks,
  baseResult.eligibility.checks,
  'Structured contextual evidence must not change UEA A100 academic or UCAT eligibility checks.'
);
assert.strictEqual(
  strongStructuredContextualResult.guidance_pool_id,
  baseResult.guidance_pool_id,
  'Structured contextual evidence must not change UEA A100 UCAT screening pool.'
);
assert.strictEqual(
  strongStructuredContextualResult.canonical_interview_band,
  baseResult.canonical_interview_band,
  'Structured contextual evidence must not change UEA A100 interview band classification.'
);
assert.strictEqual(
  strongStructuredContextualResult.interview_outcome ?? null,
  null,
  'Structured contextual evidence must not create a guaranteed interview route for UEA A100.'
);

const ueaContextualPolicy = evaluateContextualEligibility(course, strongStructuredContextualApplicant);
assert.strictEqual(ueaContextualPolicy.evaluator_id, 'uea_a100_contextual_screening_excluded');
assert.strictEqual(ueaContextualPolicy.status, 'not_contextual');
assert.strictEqual(ueaContextualPolicy.is_contextual, false);
assert.strictEqual(ueaContextualPolicy.applicable_to_screening, false);
assert.deepStrictEqual(ueaContextualPolicy.activated_applicant_group_ids, []);

const strongStructuredContextualCard = makeResultCard(
  course,
  config,
  strongStructuredContextualApplicant,
  strongStructuredContextualResult
);
assert.strictEqual(strongStructuredContextualCard.contextual_status, null);
assert.strictEqual(strongStructuredContextualCard.interview_outcome, null);
assert.strictEqual(
  strongStructuredContextualCard.prediction.result_band,
  resultCard.prediction.result_band,
  'Structured contextual evidence must not change the public UEA A100 result card band.'
);

const preparingForMedicineWithoutEngagementApplicant = merge(fixture.base_applicant, {
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: [
        {
          programme_id: 'uea_outreach_pathways',
          status: 'participating'
        }
      ]
    }
  }
});
const preparingForMedicineWithoutEngagementPolicy = evaluateContextualEligibility(
  course,
  preparingForMedicineWithoutEngagementApplicant
);
assert.strictEqual(preparingForMedicineWithoutEngagementPolicy.status, 'information_needed');
assert.strictEqual(preparingForMedicineWithoutEngagementPolicy.is_contextual, false);
assert.strictEqual(preparingForMedicineWithoutEngagementPolicy.applicable_to_screening, false);
assert.strictEqual(
  preparingForMedicineWithoutEngagementPolicy.manual_review_reason,
  'uea_preparing_for_medicine_engagement_confirmation_required'
);
const preparingForMedicineWithoutEngagementResult = classifyInterviewBand(
  course,
  config,
  preparingForMedicineWithoutEngagementApplicant
);
assert.strictEqual(preparingForMedicineWithoutEngagementResult.eligibility.status, 'manual_review');
assert.strictEqual(preparingForMedicineWithoutEngagementResult.manual_review_required, true);
assert.strictEqual(preparingForMedicineWithoutEngagementResult.interview_outcome ?? null, null);

const preparingForMedicineGuaranteedApplicant = merge(fixture.base_applicant, {
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: [
        {
          programme_id: 'uea_outreach_pathways',
          status: 'completed'
        }
      ]
    }
  }
});
const preparingForMedicineGuaranteedPolicy = evaluateContextualEligibility(
  course,
  preparingForMedicineGuaranteedApplicant
);
assert.strictEqual(preparingForMedicineGuaranteedPolicy.status, 'contextual');
assert.strictEqual(preparingForMedicineGuaranteedPolicy.is_contextual, true);
assert.strictEqual(preparingForMedicineGuaranteedPolicy.applicable_to_screening, false);
assert.deepStrictEqual(
  preparingForMedicineGuaranteedPolicy.activated_applicant_group_ids,
  ['uea_preparing_for_medicine_programme']
);
const preparingForMedicineGuaranteedResult = classifyInterviewBand(
  course,
  config,
  preparingForMedicineGuaranteedApplicant
);
assert.strictEqual(preparingForMedicineGuaranteedResult.eligibility.status, 'eligible');
assert.strictEqual(preparingForMedicineGuaranteedResult.interview_outcome, 'guaranteed_interview');
assert.strictEqual(preparingForMedicineGuaranteedResult.guidance_pool_id, null);
assert.strictEqual(preparingForMedicineGuaranteedResult.canonical_interview_band, null);
const preparingForMedicineGuaranteedCard = makeResultCard(
  course,
  config,
  preparingForMedicineGuaranteedApplicant,
  preparingForMedicineGuaranteedResult
);
assert.strictEqual(preparingForMedicineGuaranteedCard.interview_outcome, 'guaranteed_interview');
assert.strictEqual(preparingForMedicineGuaranteedCard.contextual_status, null);
assert.strictEqual(
  preparingForMedicineGuaranteedCard.guaranteed_interview_notice,
  'Guaranteed interview — UEA Preparing for Medicine Programme'
);

const preparingForMedicineAcademicFailApplicant = merge(preparingForMedicineGuaranteedApplicant, {
  a_level_profile: {
    subjects: [
      {
        subject_id: 'biology',
        predicted_grade: 'A',
        sitting_status: 'first_sitting',
        practical_endorsement: 'pass'
      },
      {
        subject_id: 'chemistry',
        predicted_grade: 'A',
        sitting_status: 'first_sitting',
        practical_endorsement: 'pass'
      },
      {
        subject_id: 'mathematics',
        predicted_grade: 'B',
        sitting_status: 'first_sitting'
      }
    ],
    sitting_status: 'first_sitting'
  }
});
const preparingForMedicineAcademicFailResult = classifyInterviewBand(
  course,
  config,
  preparingForMedicineAcademicFailApplicant
);
assert.strictEqual(preparingForMedicineAcademicFailResult.eligibility.status, 'not_eligible');
assert.strictEqual(preparingForMedicineAcademicFailResult.interview_outcome ?? null, null);

const predicted = predict({
  universityIds: ['east-anglia-a100'],
  studentProfile: fixture.base_applicant
});
assert.strictEqual(predicted.length, 1);
assert.strictEqual(predicted[0].universityId, 'east-anglia-a100');
assert.strictEqual(predicted[0].result_card.prediction.result_band, 'realistic');
assert.strictEqual(predicted[0].result_card.decision_transparency.score_breakdown, null);

console.log('UEA A100 readiness checks passed.');
