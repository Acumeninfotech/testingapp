#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  predict
} = require('../server/src/predict');
const {
  buildDecisionTimeline,
  buildDecisionTransparency,
  buildEvidenceConfidence
} = require('../assets/js/engine/result-card-presenter');

const rootDir = path.resolve(__dirname, '..');
const profileId = 'brighton-and-sussex-a100';

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

function expectedDecisionTransparency(card) {
  const expected = buildDecisionTransparency(card);
  if (
    !Object.hasOwn(card.decision_transparency || {}, 'insufficient_evidence_reason') &&
    expected.insufficient_evidence_reason === null
  ) {
    delete expected.insufficient_evidence_reason;
  }
  return expected;
}

const course = readJson(`data/universities/${profileId}.json`);
const research = readJson(`data/research/${profileId}-research.json`);
const config = readJson(`data/interview-band-configs/${profileId}.json`);
const fixture = readJson(`data/fixtures/interview-band-classification/${profileId}.json`);
const card = readJson(`data/examples/${profileId}-result-card.example.json`);
const index = readJson('data/index.json');
const indexEntry = index.universities.find((entry) => entry.id === profileId);

assert.ok(indexEntry, 'BSMS A100 must be present in data/index.json.');
assert.strictEqual(course.profile_id, profileId);
assert.strictEqual(research.course_profile_id, profileId);
assert.strictEqual(config.course_profile_id, profileId);
assert.strictEqual(fixture.course_profile_id, profileId);
assert.strictEqual(card.course_identity.profile_id, profileId);
assert.strictEqual(course.profile_status, 'activated_for_scoped_eligibility_and_interview_guidance');
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.selection_model, 'ucat_ranking');
assert.strictEqual(indexEntry.interview_band_config_file, `interview-band-configs/${profileId}.json`);
assert.strictEqual(indexEntry.result_card_example_file, `examples/${profileId}-result-card.example.json`);

assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');
assert.match(
  course.stage_1_eligibility.overall_policy.description,
  /threshold-only/i
);
assert.strictEqual(course.stage_1_eligibility.admissions_tests.sjt.used_as_gate, true);
assert.deepStrictEqual(course.stage_1_eligibility.admissions_tests.sjt.excluded_bands, [4]);
assert.strictEqual(config.eligibility.sjt.missing_outcome, 'manual_review');
assert.strictEqual(config.eligibility.ucat.missing_outcome, 'manual_review');
assert.strictEqual(config.score_model.metric, 'ucat_total');
assert.strictEqual(config.score_model.scale.max, 2700);
assert.strictEqual(config.score_model.historical_guidance_only, false);
assert.deepStrictEqual(
  config.score_model.official_thresholds,
  { home_standard: 1990, overseas: 1980, home_adjusted_offer: null }
);

assert.deepStrictEqual(config.eligibility.result_card_map, fixture.approved_band_to_result_card_map);
assert.strictEqual(config.eligibility.prediction_confidence, 'moderate');
assert.strictEqual(config.eligibility.evidence_confidence, 'high');
assert.strictEqual(research.metadata.prediction_confidence, 'moderate');
assert.strictEqual(research.metadata.evidence_confidence, 'high');
assert.strictEqual(research.metadata.offer_prediction_ready, false);
assert.strictEqual(card.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(hasNestedKey(course, 'offer_prediction_ready'), false);
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

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
  assert.deepStrictEqual(research.readiness[field], course.engine_notes[field], `research readiness ${field}`);
  assert.deepStrictEqual(card.readiness[field], course.engine_notes[field], `card readiness ${field}`);
  assert.deepStrictEqual(indexEntry[field], course.engine_notes[field], `index readiness ${field}`);
}

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);
  const expected = scenario.expected;

  assert.strictEqual(
    result.eligibility.status,
    expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );

  if (Object.hasOwn(expected, 'guidance_pool_id')) {
    assert.strictEqual(
      result.guidance_pool_id ?? null,
      expected.guidance_pool_id,
      `${scenario.scenario_id}: guidance pool`
    );
  }

  if (expected.source_band_id) {
    assert.strictEqual(
      result.source_interview_band_id,
      expected.source_band_id,
      `${scenario.scenario_id}: BSMS source band`
    );
  }

  if (expected.result_card_id) {
    assert.strictEqual(
      result.result_card_id,
      expected.result_card_id,
      `${scenario.scenario_id}: result-card mapping`
    );
  }

  if (expected.interview_outcome) {
    assert.strictEqual(
      result.interview_outcome,
      expected.interview_outcome,
      `${scenario.scenario_id}: interview route`
    );
  }

  if (expected.failure) {
    assert.ok(
      result.eligibility.failures.includes(expected.failure),
      `${scenario.scenario_id}: expected failure ${expected.failure}`
    );
  }

  if (expected.manual_review_required) {
    assert.strictEqual(result.manual_review_required, true, `${scenario.scenario_id}: manual review flag`);
    assert.ok(
      result.eligibility.manual_review_reasons.includes(expected.manual_review_reason),
      `${scenario.scenario_id}: manual review reason`
    );
  }

  if (expected.warning) {
    assert.ok(result.warnings.includes(expected.warning), `${scenario.scenario_id}: future-cycle warning`);
    assert.strictEqual(result.confidence, 'medium', `${scenario.scenario_id}: prediction confidence capped at medium/moderate`);
  }

  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

function classify(overrides) {
  return classifyInterviewBand(course, config, merge(fixture.base_applicant, overrides));
}

function classifyApplicant(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function assertHardFailure(label, overrides, failure) {
  const result = classify(overrides);
  assert.strictEqual(result.eligibility.status, 'not_eligible', `${label}: eligibility`);
  assert.strictEqual(result.canonical_interview_band, 'not_eligible', `${label}: canonical band`);
  assert.ok(result.eligibility.failures.includes(failure), `${label}: expected failure ${failure}`);
  assert.strictEqual(result.source_interview_band_id ?? null, null, `${label}: no runtime source band on hard failure`);
  assert.strictEqual(result.result_card_id ?? null, null, `${label}: no runtime result-card ID on hard failure`);
  return result;
}

assert.strictEqual(
  classify({ admissions_tests: { ucat: { total_score: 1990, sjt_band: 1 } } }).source_interview_band_id,
  'HS_E_BOUNDARY_PASS',
  'Home 1990 SJT Band 1 must pass the exact-boundary rule.'
);
assert.strictEqual(
  classify({ admissions_tests: { ucat: { total_score: 1990, sjt_band: 2 } } }).source_interview_band_id,
  'HS_E_BOUNDARY_FAIL',
  'Home 1990 SJT Band 2 must fail the exact-boundary rule.'
);
assert.strictEqual(
  classify({ admissions_tests: { ucat: { total_score: 1990, sjt_band: 3 } } }).source_interview_band_id,
  'HS_E_BOUNDARY_FAIL',
  'Home 1990 SJT Band 3 must fail the exact-boundary rule.'
);
assert.strictEqual(
  classify({
    applicant_identity: {
      applicant_type: 'international_standard_school_leaver',
      fee_status: 'International',
      domicile: 'International',
      english_language_exempt: true
    },
    admissions_tests: { ucat: { total_score: 1980, sjt_band: 1 } }
  }).source_interview_band_id,
  'OS_E_BOUNDARY_FAIL',
  'Overseas exactly 1980 must be below threshold, not manual review.'
);

function expectedHomeBand(score, sjtBand) {
  if (score >= 2100) return 'HS_A_SECURE';
  if (score >= 2050) return 'HS_B_STRONG';
  if (score >= 2010) return 'HS_C_COMFORTABLE';
  if (score >= 1991) return 'HS_D_MARGINAL';
  if (score === 1990) return sjtBand === 1 ? 'HS_E_BOUNDARY_PASS' : 'HS_E_BOUNDARY_FAIL';
  return 'HS_F_BELOW';
}

function expectedOverseasBand(score) {
  if (score >= 2090) return 'OS_A_SECURE';
  if (score >= 2040) return 'OS_B_STRONG';
  if (score >= 2000) return 'OS_C_COMFORTABLE';
  if (score >= 1981) return 'OS_D_MARGINAL';
  if (score === 1980) return 'OS_E_BOUNDARY_FAIL';
  return 'OS_F_BELOW';
}

for (let score = 0; score <= 2700; score += 1) {
  for (const sjtBand of [1, 2, 3]) {
    assert.strictEqual(
      classify({ admissions_tests: { ucat: { total_score: score, sjt_band: sjtBand } } }).source_interview_band_id,
      expectedHomeBand(score, sjtBand),
      `Home coverage score ${score} SJT ${sjtBand}`
    );
    assert.strictEqual(
      classify({
        applicant_identity: {
          applicant_type: 'international_standard_school_leaver',
          fee_status: 'International',
          domicile: 'International',
          english_language_exempt: true
        },
        admissions_tests: { ucat: { total_score: score, sjt_band: sjtBand } }
      }).source_interview_band_id,
      expectedOverseasBand(score),
      `Overseas coverage score ${score} SJT ${sjtBand}`
    );
  }
}

const adjustedNoUcat = fixture.scenarios.find((scenario) => scenario.scenario_id === 'adjusted_offer_no_ucat');
const adjustedResult = classify(adjustedNoUcat.overrides);
assert.strictEqual(adjustedResult.eligibility.status, 'manual_review');
assert.ok(
  adjustedResult.eligibility.manual_review_reasons.includes(
    'required_admissions_test_missing:ucat'
  ),
  'Adjusted-offer applicants must still provide UCAT for 2027 contextual ranking.'
);

const adjustedEvidenceOnly = classify({
  contextual_profile: {
    home_area_region: {
      polar4_quintile: 'q1'
    },
    school_education: {
      below_average_gcse_school: 'yes'
    },
    financial_support: {
      free_school_meals: 'yes'
    },
    personal_circumstances: {
      care_over_three_months: 'no'
    }
  },
  admissions_tests: {
    ucat: {
      total_score: null,
      sjt_band: 2
    }
  }
});
assert.ok(
  adjustedEvidenceOnly.applicant_group_ids.includes('bsms_adjusted_offer_confirmed'),
  'Confirmed BSMS adjusted-offer evidence must derive the canonical adjusted-offer group.'
);
assert.strictEqual(adjustedEvidenceOnly.eligibility.status, 'manual_review');
assert.ok(
  adjustedEvidenceOnly.eligibility.manual_review_reasons.includes(
    'required_admissions_test_missing:ucat'
  ),
  'Confirmed adjusted-offer applicants without UCAT must require review rather than receive a guaranteed-interview route.'
);

const manualResultCardCase2Applicant = merge(fixture.base_applicant, {
  profile_id: 'bsms_manual_result_card_case_2',
  applicant_identity: {
    applicant_type: 'standard_entry',
    fee_status: 'home_fee',
    domicile: 'England',
    current_uk_residence: 'yes',
    age_at_course_start_band: 'age_18',
    contextual: true,
    widening_participation: true,
    contextual_flags: {},
    graduate: false,
    resit: {
      has_resits: false
    }
  },
  application_year: 2027,
  a_level_profile: {
    subjects: [
      {
        subject_id: 'chemistry',
        predicted_grade: 'A'
      },
      {
        subject_id: 'biology',
        predicted_grade: 'A'
      },
      {
        subject_id: 'psychology',
        predicted_grade: 'B'
      }
    ]
  },
  gcse_profile: {
    subjects: {
      english_language: '5',
      mathematics: '5'
    },
    total_gcse_count: 2
  },
  admissions_tests: {
    ucat: {
      total_score: 1950,
      score_scale: 2700,
      subtests: {
        verbal_reasoning: 650,
        decision_making: 650,
        quantitative_reasoning: 650
      },
      sjt_band: 2,
      test_year: 2026
    }
  },
  contextual_profile: {
    home_area_region: {
      postcode: 'BN1 9PX',
      polar4_quintile: 'q2',
      imd_quintile: 'q3',
      tundra_quintile: 'q5',
      postcode_lookup: {
        status: 'matched',
        normalised_postcode: 'BN19PX',
        values: {
          polar4: {
            value: 2,
            source: 'postcode_lookup'
          },
          imd: {
            value: 3,
            source: 'postcode_lookup',
            dataset_year: 2019
          },
          tundra: {
            value: 5,
            source: 'postcode_lookup'
          }
        }
      }
    },
    school_education: {
      below_average_gcse_school: 'yes'
    },
    financial_support: {
      free_school_meals: 'yes'
    },
    personal_circumstances: {
      first_in_family_at_university: 'yes',
      care_over_three_months: 'no'
    }
  }
});
const manualResultCardCase2Classification = classifyApplicant(manualResultCardCase2Applicant);
assert.strictEqual(manualResultCardCase2Classification.eligibility.status, 'eligible');
assert.strictEqual(
  manualResultCardCase2Classification.eligibility.contextual_eligibility.status,
  'contextual',
  'Manual Result Card Case 2 must activate BSMS contextual eligibility before A-level routing.'
);
assert.strictEqual(
  manualResultCardCase2Classification.eligibility.contextual_eligibility.contextual_evidence.matched_section_count,
  3,
  'Manual Result Card Case 2 must preserve three distinct matched BSMS sections.'
);
assert.ok(
  manualResultCardCase2Classification.applicant_group_ids.includes('bsms_adjusted_offer_confirmed'),
  'Manual Result Card Case 2 must derive the adjusted-offer group from Step 6 evidence.'
);
assert.strictEqual(
  manualResultCardCase2Classification.eligibility.academic_pathway_id,
  'bsms_a_level_contextual_aab',
  'Manual Result Card Case 2 must use the AAB contextual A-level requirement.'
);
assert.strictEqual(manualResultCardCase2Classification.guidance_pool_id, 'home_adjusted_offer');
assert.strictEqual(manualResultCardCase2Classification.source_interview_band_id, 'HA_CONTEXTUAL_RANKED');
assert.strictEqual(manualResultCardCase2Classification.canonical_interview_band, 'eligible_to_apply');

const [manualResultCardCase2Prediction] = predict({
  universityIds: [profileId],
  studentProfile: manualResultCardCase2Applicant
});
assert.strictEqual(manualResultCardCase2Prediction.result_card.contextual_status, 'confirmed');
assert.strictEqual(
  manualResultCardCase2Prediction.result_card.prediction.guidance_pool_id,
  'home_adjusted_offer'
);
assert.strictEqual(manualResultCardCase2Prediction.result_card.prediction.ranking_metric, 'ucat_total');
assert.strictEqual(
  manualResultCardCase2Prediction.result_card.decision_transparency.ucat_comparison.comparison_type,
  'no_published_contextual_cutoff'
);
assert.strictEqual(manualResultCardCase2Prediction.result_card.primary_user_facing_recommendation, 'Entry requirements met');
assert.strictEqual(
  manualResultCardCase2Prediction.result_card.decision_transparency.compact_status.label,
  'Contextual eligibility confirmed.'
);
assert.strictEqual(
  manualResultCardCase2Prediction.result_card.decision_transparency.selection_metric.value_label,
  'Contextual requirements met'
);
assert.ok(
  manualResultCardCase2Prediction.result_card.factor_usage.some((factor) =>
    factor.factor_id === 'ucat' &&
    factor.label === 'UCAT - Contextual applicant' &&
    /BSMS contextual applicant pool/.test(factor.detail) &&
    /not compared with the standard Home applicant UCAT threshold/.test(factor.detail)
  ),
  'Manual Result Card Case 2 must explain the contextual UCAT pool in the UCAT row.'
);
const manualResultCardCase2Text = JSON.stringify(manualResultCardCase2Prediction.result_card);
assert.match(
  manualResultCardCase2Text,
  /Contextual applicants are considered separately from standard Home applicants/
);
assert.match(
  manualResultCardCase2Text,
  /previous admissions cycle.*adjusted offer.*SJT Band 1, 2 or 3.*regardless of their total UCAT score/is
);
assert.match(
  manualResultCardCase2Text,
  /For 2027 entry, BSMS has not yet published an equivalent interview threshold/
);
assert.doesNotMatch(
  manualResultCardCase2Text,
  /published Home threshold of 1990|Guaranteed Interview|Interview guaranteed under the published criteria/
);

const [standardHomePrediction] = predict({
  universityIds: [profileId],
  studentProfile: fixture.base_applicant
});
const standardHomeText = JSON.stringify(standardHomePrediction.result_card);
assert.match(
  standardHomeText,
  /published Home threshold of 1990/,
  'Standard Home result-card wording must continue to use the published Home threshold.'
);
assert.doesNotMatch(
  standardHomeText,
  /Previous BSMS interview outcome|BSMS contextual applicant pool|standard Home applicant UCAT threshold/,
  'Standard Home result card must not receive contextual historical or pool wording.'
);

const overseasAdjustedEvidence = classify({
  applicant_identity: {
    applicant_type: 'international_standard_school_leaver',
    fee_status: 'International',
    domicile: 'International',
    english_language_exempt: true
  },
  contextual_profile: {
    home_area_region: {
      polar4_quintile: 'q1'
    },
    school_education: {
      below_average_gcse_school: 'yes'
    },
    financial_support: {
      free_school_meals: 'yes'
    },
    personal_circumstances: {
      care_over_three_months: 'no'
    }
  }
});
assert.ok(
  !overseasAdjustedEvidence.applicant_group_ids.includes('bsms_adjusted_offer_confirmed'),
  'Overseas applicants must not derive the Home adjusted-offer group.'
);
const [internationalPrediction] = predict({
  universityIds: [profileId],
  studentProfile: merge(fixture.base_applicant, {
    applicant_identity: {
      applicant_type: 'international_standard_school_leaver',
      fee_status: 'International',
      domicile: 'International',
      english_language_exempt: true
    },
    admissions_tests: {
      ucat: {
        total_score: 2100,
        sjt_band: 2
      }
    }
  })
});
assert.doesNotMatch(
  JSON.stringify(internationalPrediction.result_card),
  /Previous BSMS interview outcome|BSMS contextual applicant pool|standard Home applicant UCAT threshold/,
  'International result card must not receive contextual Home wording.'
);

const careResult = classify(fixture.scenarios.find((scenario) => scenario.scenario_id === 'care_leaver_no_ucat').overrides);
assert.strictEqual(careResult.result_card_id, 'CARE_LEAVER_INTERVIEW_ROUTE');
assert.strictEqual(careResult.source_interview_band_id, 'CARE_LEAVER');
assert.strictEqual(careResult.interview_outcome, 'care_leaver_interview_route');
assert.notStrictEqual(careResult.result_card_id, 'ADJUSTED_OFFER_INTERVIEW_ROUTE');
const [carePrediction] = predict({
  universityIds: [profileId],
  studentProfile: merge(fixture.base_applicant, {
    contextual_profile: {
      personal_circumstances: {
        care_over_three_months: 'yes'
      }
    },
    admissions_tests: {
      ucat: {
        total_score: 1950,
        subtests: {
          verbal_reasoning: 650,
          decision_making: 650,
          quantitative_reasoning: 650
        },
        sjt_band: 1
      }
    }
  })
});
assert.strictEqual(
  carePrediction.result_card.interview_outcome,
  'care_leaver_interview_route',
  'Care-leaver result-card routing must remain unchanged.'
);
assert.doesNotMatch(
  JSON.stringify(carePrediction.result_card),
  /Previous BSMS interview outcome|BSMS contextual applicant pool|standard Home applicant UCAT threshold/,
  'Care-leaver result card must not receive adjusted-offer contextual UCAT wording.'
);

const careEvidenceOnly = classify({
  contextual_profile: {
    personal_circumstances: {
      care_over_three_months: 'yes'
    }
  },
  admissions_tests: {
    ucat: {
      total_score: null,
      sjt_band: 1
    }
  }
});
assert.ok(
  careEvidenceOnly.applicant_group_ids.includes('bsms_care_leaver_confirmed'),
  'Confirmed BSMS care-leaver evidence must derive the BSMS-specific care-leaver route group.'
);
assert.strictEqual(careEvidenceOnly.source_interview_band_id, 'CARE_LEAVER');
assert.strictEqual(careEvidenceOnly.result_card_id, 'CARE_LEAVER_INTERVIEW_ROUTE');

const bothCareAndAdjusted = classify({
  contextual_profile: {
    home_area_region: {
      polar4_quintile: 'q1'
    },
    school_education: {
      below_average_gcse_school: 'yes'
    },
    financial_support: {
      free_school_meals: 'yes'
    },
    personal_circumstances: {
      care_over_three_months: 'yes'
    }
  },
  admissions_tests: {
    ucat: {
      total_score: null,
      sjt_band: 1
    }
  }
});
assert.strictEqual(
  bothCareAndAdjusted.result_card_id,
  'CARE_LEAVER_INTERVIEW_ROUTE',
  'Care-leaver route must take priority over adjusted-offer route after academic and SJT gates.'
);

assertHardFailure('HS_SJT_FAIL', {
  admissions_tests: {
    ucat: {
      total_score: 2700,
      sjt_band: 4
    }
  }
}, 'sjt_band_excluded');

assertHardFailure('OS_SJT_FAIL', {
  applicant_identity: {
    applicant_type: 'international_standard_school_leaver',
    fee_status: 'International',
    domicile: 'International',
    english_language_exempt: true
  },
  admissions_tests: {
    ucat: {
      total_score: 2700,
      sjt_band: 4
    }
  }
}, 'sjt_band_excluded');

assertHardFailure('HA_SJT_FAIL', {
  contextual_profile: {
    home_area_region: {
      polar4_quintile: 'q1'
    },
    school_education: {
      below_average_gcse_school: 'yes'
    },
    financial_support: {
      free_school_meals: 'yes'
    },
    personal_circumstances: {
      care_over_three_months: 'no'
    }
  },
  admissions_tests: {
    ucat: {
      total_score: 2700,
      sjt_band: 4
    }
  }
}, 'sjt_band_excluded');

assertHardFailure('HA_ACADEMIC_FAIL', {
  contextual_profile: {
    home_area_region: {
      polar4_quintile: 'q1'
    },
    school_education: {
      below_average_gcse_school: 'yes'
    },
    financial_support: {
      free_school_meals: 'yes'
    },
    personal_circumstances: {
      care_over_three_months: 'no'
    }
  },
  gcse_profile: {
    subjects: {
      english_language: '4',
      mathematics: '5'
    },
    total_gcse_count: 2
  },
  admissions_tests: {
    ucat: {
      total_score: 2200,
      sjt_band: 1
    }
  }
}, 'gcse_requirement_not_met:english_language');

assertHardFailure('care-leaver academic failure', {
  contextual_profile: {
    personal_circumstances: {
      care_over_three_months: 'yes'
    }
  },
  gcse_profile: {
    subjects: {
      english_language: '4',
      mathematics: '5'
    },
    total_gcse_count: 2
  },
  admissions_tests: {
    ucat: {
      total_score: 2200,
      sjt_band: 1
    }
  }
}, 'gcse_requirement_not_met:english_language');

assertHardFailure('care-leaver SJT Band 4', {
  contextual_profile: {
    personal_circumstances: {
      care_over_three_months: 'yes'
    }
  },
  admissions_tests: {
    ucat: {
      total_score: 2700,
      sjt_band: 4
    }
  }
}, 'sjt_band_excluded');

const missingALevelApplicant = clone(fixture.base_applicant);
missingALevelApplicant.a_level_profile = null;
const missingALevelResult = classifyApplicant(missingALevelApplicant);
assert.strictEqual(missingALevelResult.eligibility.status, 'manual_review');
assert.ok(
  missingALevelResult.eligibility.manual_review_reasons.includes('missing_academic_evidence_requires_manual_review'),
  'Missing A-level evidence must route to manual review.'
);

const missingGcseEnglishApplicant = clone(fixture.base_applicant);
delete missingGcseEnglishApplicant.gcse_profile.subjects.english_language;
missingGcseEnglishApplicant.gcse_profile.total_gcse_count = 1;
const missingGcseEnglishResult = classifyApplicant(missingGcseEnglishApplicant);
assert.strictEqual(missingGcseEnglishResult.eligibility.status, 'manual_review');
assert.ok(
  missingGcseEnglishResult.eligibility.manual_review_reasons.includes('missing_academic_evidence_requires_manual_review'),
  'Missing GCSE English evidence must route to manual review.'
);

assert.deepStrictEqual(card.evidence_confidence, buildEvidenceConfidence(card));
assert.deepStrictEqual(card.decision_timeline, buildDecisionTimeline(card));
assert.deepStrictEqual(card.decision_transparency, expectedDecisionTransparency(card));
assert.match(
  JSON.stringify(card.decision_transparency),
  /academic.*threshold|UCAT threshold/s
);
assert.match(
  JSON.stringify(research.public_transparency),
  /official BSMS thresholds|ApplySmart.*derived|known evidence gaps/is
);

console.log('BSMS A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log('Boundary, adjusted-offer, care-leaver, manual-review and result-card mappings: PASS');
