#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { presentResultCard } = require('../../assets/js/engine/result-card-presenter');
const { classifyInterviewBand } = require('../../assets/js/engine/interview-band-classifier');
const cambridgeCourse = require('../../data/universities/cambridge-a100.json');
const cambridgeConfig = require('../../data/interview-band-configs/cambridge-a100.json');
const cambridgeFixture = require('../../data/fixtures/interview-band-classification/cambridge-a100.json');

function present(overrides = {}) {
  return presentResultCard({
    eligibilityStatus: 'eligible',
    interviewBand: 'interview_likely',
    transparencyContext: {
      course_identity: { profile_id: 'presenter-test-a100' },
      prediction: {},
      ...overrides.transparencyContext
    },
    ...overrides
  });
}

function scoreCard({ score, threshold, max = 36, comparisonGuidance = undefined }) {
  return present({
    transparencyContext: {
      ranking: { value: score },
      score_model: { type: 'component_sum' },
      guidance_pool: {
        metric: 'selection_score',
        historical_cutoff: { value: threshold },
        comparison_guidance: comparisonGuidance
      },
      estimated_selection_score: {
        value: score,
        max,
        name: 'Selection score'
      }
    }
  });
}

function scoreOnlyCard({ score, max }) {
  return present({
    transparencyContext: {
      ranking: { value: score },
      score_model: { type: 'component_sum' },
      guidance_pool: { metric: 'selection_score' },
      estimated_selection_score: {
        value: score,
        max,
        name: 'Selection score'
      }
    }
  });
}

function ucatHistoricalAdmissionsCard() {
  return present({
    transparencyContext: {
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: 2400, score_scale: 2700 }
        }
      },
      applicant_group_ids: ['home_fee'],
      score_model: {
        type: 'ranking_metric',
        metric: 'ucat_total',
        scale: { min: 0, max: 2700 }
      },
      guidance_pool: {
        metric: 'ucat_total',
        comparison_guidance: {
          comparison_type: 'historical_range',
          label: 'Structured historical UCAT guide'
        },
        band_rules: [
          { band: 'realistic', operator: 'between_inclusive', min: 1680, max: 1995 }
        ]
      },
      historical_admissions: {
        cycles: [
          {
            entry_year: 2025,
            fee_status: 'Home',
            metric: 'lowest_interviewed',
            converted_score_2700: 1680,
            score_scale: 2700
          },
          {
            entry_year: 2025,
            fee_status: 'Home',
            metric: 'average_interviewed',
            converted_score_2700: 1995,
            score_scale: 2700
          }
        ]
      }
    }
  });
}

function ucatComparisonCard({ ucat, guidancePool, scoreModel = undefined }) {
  return present({
    transparencyContext: {
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: ucat, score_scale: 2700 }
        }
      },
      score_model: scoreModel || {
        type: 'ranking_metric',
        metric: 'ucat_total',
        scale: { min: 0, max: 2700 }
      },
      guidance_pool: guidancePool
    }
  });
}

function assertCompactStatus(card, expected) {
  assert.deepStrictEqual(card.decision_transparency?.compact_status, expected);
}

function publicAcademicChecks(card) {
  return card.academic_requirement_checks.map((check) => ({
    qualification_type: check.qualification_type,
    requirement_type: check.requirement_type,
    label: check.label,
    status: check.status
  }));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeCambridgeCard(ucatTotal) {
  const applicant = clone(cambridgeFixture.base_applicant);
  applicant.admissions_tests.ucat = {
    ...applicant.admissions_tests.ucat,
    total_score: ucatTotal,
    score_scale: 2700,
    sjt_band: 2
  };
  const classification = classifyInterviewBand(cambridgeCourse, cambridgeConfig, applicant);
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    insufficientEvidenceReasonCode: classification.insufficient_evidence_reason_code || null,
    missingInformation: classification.missing_information || null,
    transparencyContext: {
      course_identity: { profile_id: cambridgeCourse.profile_id },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: cambridgeCourse.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      stage_1_eligibility: cambridgeCourse.stage_1_eligibility || null,
      stage_2_interview_selection: cambridgeCourse.stage_2_interview_selection || null,
      contextual_admissions: cambridgeCourse.contextual_admissions || null,
      historical_admissions: cambridgeCourse.historical_admissions || null,
      selection_approach_display: cambridgeCourse.selection_approach_display || null,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      score_model: cambridgeConfig.score_model,
      guidance_pool_id: classification.guidance_pool_id || null,
      missing_information: classification.missing_information || null,
      warnings: classification.warnings || []
    }
  });
}

function makeCambridgeSixGcseCard() {
  const applicant = clone(cambridgeFixture.base_applicant);
  applicant.gcse_profile = {
    subjects: {
      english_language: '9',
      mathematics: '9',
      biology: '9',
      chemistry: '9',
      physics: '9',
      history: '9'
    },
    additional_subjects: [],
    total_gcse_count: 6,
    top_9_gcse_grades: ['9', '9', '9', '9', '9', '9']
  };
  const classification = classifyInterviewBand(cambridgeCourse, cambridgeConfig, applicant);
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    insufficientEvidenceReasonCode: classification.insufficient_evidence_reason_code || null,
    missingInformation: classification.missing_information || null,
    transparencyContext: {
      course_identity: { profile_id: cambridgeCourse.profile_id },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: cambridgeCourse.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      stage_1_eligibility: cambridgeCourse.stage_1_eligibility || null,
      stage_2_interview_selection: cambridgeCourse.stage_2_interview_selection || null,
      contextual_admissions: cambridgeCourse.contextual_admissions || null,
      historical_admissions: cambridgeCourse.historical_admissions || null,
      selection_approach_display: cambridgeCourse.selection_approach_display || null,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      score_model: cambridgeConfig.score_model,
      guidance_pool_id: classification.guidance_pool_id || null,
      missing_information: classification.missing_information || null,
      warnings: classification.warnings || []
    }
  });
}

{
  const card = present({
    eligibilityStatus: 'eligible',
    interviewBand: 'interview_likely',
    transparencyContext: {
      course_identity: { profile_id: 'cambridge-a100' },
      selection_approach_display: cambridgeCourse.selection_approach_display?.default,
      stage_1_eligibility: cambridgeCourse.stage_1_eligibility,
      stage_2_interview_selection: cambridgeCourse.stage_2_interview_selection,
      contextual_admissions: cambridgeCourse.contextual_admissions,
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: 2400, score_scale: 2700, sjt_band: 3 }
        }
      }
    }
  });
  assert.deepStrictEqual(card.factor_usage.map(({ factor_id, label, role, evidence_status }) => ({ factor_id, label, role, evidence_status })), [
    {
      factor_id: 'ucat',
      label: 'UCAT',
      role: 'considered',
      evidence_status: 'available'
    },
    {
      factor_id: 'gcse',
      label: 'GCSEs',
      role: 'considered',
      evidence_status: 'available'
    },
    {
      factor_id: 'a_level',
      label: 'A-levels',
      role: 'considered',
      evidence_status: 'available'
    },
    {
      factor_id: 'sjt',
      label: 'SJT',
      role: 'not_used',
      evidence_status: 'not_applicable'
    },
    {
      factor_id: 'contextual',
      label: 'Contextual',
      role: 'contextual',
      evidence_status: 'available'
    }
  ]);
}

{
  const rankingCard = present({
    transparencyContext: {
      stage_1_eligibility: {
        admissions_tests: {
          ucat: {
            required: false,
            used_as_gate: false
          }
        }
      },
      stage_2_interview_selection: {
        primary_model: 'ucat_ranking',
        ranking_factors: [
          {
            factor_id: 'ucat_cognitive_total',
            role: 'ranking_factor',
            notes: 'UCAT total is used for ranking.'
          }
        ]
      }
    }
  });
  assert.strictEqual(
    rankingCard.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'ranking'
  );

  const consideredCard = present({
    transparencyContext: {
      stage_1_eligibility: {
        admissions_tests: {
          ucat: {
            required: false,
            used_as_gate: false
          }
        }
      },
      stage_2_interview_selection: {
        primary_model: 'holistic_review',
        ranking_factors: [
          {
            factor_id: 'ucat_cognitive_total',
            role: 'review_factor',
            notes: 'UCAT total is considered alongside academic evidence.'
          }
        ]
      }
    }
  });
  assert.strictEqual(
    consideredCard.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'considered'
  );

  const notUsedCard = present({
    transparencyContext: {
      stage_1_eligibility: {
        admissions_tests: {
          ucat: {
            required: false,
            used: false,
            notes: 'UCAT is not used for interview selection.'
          }
        }
      }
    }
  });
  assert.strictEqual(
    notUsedCard.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'not_used'
  );

  const eligibilityCard = present({
    transparencyContext: {
      stage_1_eligibility: {
        admissions_tests: {
          ucat: {
            required: true,
            used_as_gate: true,
            notes: 'UCAT is an eligibility gate only.'
          }
        }
      }
    }
  });
  assert.strictEqual(
    eligibilityCard.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'eligibility'
  );
}

{
  const card = present({
    eligibilityStatus: 'not_eligible',
    interviewBand: 'not_eligible',
    transparencyContext: {
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: 2400, score_scale: 2700 }
        }
      },
      score_model: {
        type: 'ranking_metric',
        metric: 'ucat_total',
        scale: { min: 0, max: 2700 }
      },
      guidance_pool: {
        metric: 'ucat_total',
        comparison_guidance: {
          comparison_type: 'historical_range',
          label: 'Structured historical UCAT guide'
        },
        band_rules: [
          { band: 'realistic', operator: 'between_inclusive', min: 1680, max: 1995 }
        ]
      }
    }
  });

  const historicalStage = card.decision_transparency.decision_path.find((stage) => stage.stage === 'Historical guidance');
  assert.strictEqual(historicalStage.status, 'Context only');
  assert.match(historicalStage.summary, /contextual only/i);
  assert.strictEqual(
    historicalStage.checks.find((check) => check.label === 'UCAT comparison')?.status,
    'Context only'
  );
}

{
  const card = present({
    eligibilityStatus: 'not_eligible',
    interviewBand: 'not_eligible'
  });

  const historicalStage = card.decision_transparency.decision_path.find((stage) => stage.stage === 'Historical guidance');
  assert.strictEqual(historicalStage.status, 'Not applied');
  assert.match(historicalStage.summary, /not applied because the entry requirements are not met/i);
}

{
  const card = present({
    eligibilityStatus: 'manual_review',
    manualReviewRequired: true,
    manualReviewReason: 'Please confirm the practical endorsement outcome for your required A-level science subject.',
    interviewBand: 'insufficient_evidence'
  });
  assert.strictEqual(
    card.primary_explanation,
    'Please confirm the practical endorsement outcome for your required A-level science subject.'
  );
}

{
  const card = present({
    eligibilityStatus: 'eligible',
    interviewBand: 'insufficient_evidence',
    insufficientEvidenceReasonCode: 'prediction_calibration_unavailable',
    transparencyContext: {
      score_model: {
        presentation: {
          insufficient_evidence_explanation:
            'This applicant pool has historical observations, but public prediction calibration is not approved yet.'
        }
      }
    }
  });
  assert.strictEqual(
    card.primary_explanation,
    'This applicant pool has historical observations, but public prediction calibration is not approved yet.'
  );
  assert.strictEqual(
    card.decision_transparency.insufficient_evidence_reason,
    card.primary_explanation
  );
}

{
  const card = present({
    eligibilityStatus: 'eligible',
    interviewBand: 'insufficient_evidence'
  });
  assert.strictEqual(
    card.primary_explanation,
    'ApplySmart needs additional applicant information before it can provide a complete recommendation for this applicant group.'
  );
}

{
  const reason =
    'This university ranks applicants using the best eight GCSEs. Only six GCSEs are available, so the published scoring model cannot be calculated. This is not a rejection.';
  const card = present({
    eligibilityStatus: 'eligible',
    interviewBand: 'insufficient_evidence',
    insufficientEvidenceReasonCode: 'insufficient_gcse_results',
    missingInformation: {
      qualification_type: 'gcse',
      provided_count: 6,
      required_count: 8
    },
    transparencyContext: {
      score_model: {
        type: 'component_sum',
        gcse_profile_completeness: {
          minimum_results_for_competitiveness_assessment: 8
        }
      },
      missing_information: {
        qualification_type: 'gcse',
        provided_count: 6,
        required_count: 8
      }
    }
  });
  const historicalStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Historical guidance'
  );
  assert.strictEqual(card.primary_explanation, reason);
  assert.strictEqual(card.information_needed_reason, reason);
  assert.strictEqual(card.decision_transparency.information_needed_reason, reason);
  assert.strictEqual(card.decision_transparency.insufficient_evidence_reason, reason);
  assert.match(historicalStage.summary, /Historical admissions data was not compared/i);
  assert.match(historicalStage.summary, /Only six GCSEs are available/i);
  assert.doesNotMatch(
    `${card.primary_explanation} ${historicalStage.summary}`,
    /ApplySmart needs additional applicant information before it can provide a complete recommendation/i
  );
}

{
  const reason =
    'ApplySmart needs a more complete GCSE profile before it can assess your Cambridge interview potential. This is not a rejection.';
  const card = makeCambridgeSixGcseCard();
  const historicalStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Historical guidance'
  );
  assert.strictEqual(card.recommendation_display_state, 'insufficient_evidence');
  assert.strictEqual(card.primary_explanation, reason);
  assert.strictEqual(card.information_needed_reason, reason);
  assert.strictEqual(card.decision_transparency.information_needed_reason, reason);
  assert.strictEqual(card.decision_transparency.insufficient_evidence_reason, reason);
  assert.match(historicalStage.summary, /Historical admissions data was not compared/i);
  assert.match(historicalStage.summary, /more complete GCSE profile/i);
  assert.doesNotMatch(historicalStage.summary, /best eight GCSEs/i);
}

{
  const card = present({
    transparencyContext: {
      eligibility_checks: [
        { check: 'gcse_minimum_count', passed: true },
        { check: 'gcse_science_alternative', passed: true },
        { check: 'a_level_route', passed: true },
        { check: 'a_level_subject_combination', passed: true },
        { check: 'ucat_required', passed: true }
      ]
    }
  });
  assert.deepStrictEqual(publicAcademicChecks(card), [
    { qualification_type: 'gcse', requirement_type: 'gcse_minimum_count', label: 'GCSEs', status: 'met' },
    { qualification_type: 'a_level', requirement_type: 'a_level_route', label: 'A-level grades', status: 'met' },
    { qualification_type: 'a_level', requirement_type: 'a_level_subject_combination', label: 'Required A-level subjects', status: 'met' }
  ]);
}

{
  const card = present({
    transparencyContext: {
      eligibility_checks: [
        { check_id: 'gcse_english_language_minimum', status: 'pass' },
        { check_id: 'gcse_mathematics_minimum', status: 'pass' },
        { check_id: 'home_standard_a_level', status: 'fail' },
        { check_id: 'a_level_science_practical_endorsement', status: 'pass' }
      ]
    }
  });
  assert.deepStrictEqual(publicAcademicChecks(card), [
    { qualification_type: 'gcse', requirement_type: 'gcse_english_language_minimum', label: 'GCSE English Language', status: 'met' },
    { qualification_type: 'gcse', requirement_type: 'gcse_mathematics_minimum', label: 'GCSE Mathematics', status: 'met' },
    { qualification_type: 'a_level', requirement_type: 'home_standard_a_level', label: 'A-level grades', status: 'not_met' },
    { qualification_type: 'a_level', requirement_type: 'a_level_science_practical_endorsement', label: 'Science practical endorsement', status: 'met' }
  ]);
}

{
  const card = present({
    eligibilityStatus: 'manual_review',
    manualReviewRequired: true,
    transparencyContext: {
      eligibility_checks: [
        { check: 'international_baccalaureate_route', passed: false, unknown_subject_ids: ['chemistry'] },
        { check: 'sjt_policy', passed: true }
      ]
    }
  });
  assert.deepStrictEqual(publicAcademicChecks(card), [
    { qualification_type: 'ib', requirement_type: 'international_baccalaureate_route', label: 'IB', status: 'information_needed' }
  ]);
}

{
  const card = present({
    transparencyContext: {
      eligibility_checks: [
        { check: 'national_5_route', passed: true },
        { check: 'scottish_post_16_route', passed: true },
        { check: 'graduate_degree_route', passed: true },
        { check: 'resit_pathway', passed: true }
      ]
    }
  });
  assert.deepStrictEqual(publicAcademicChecks(card), [
    { qualification_type: 'scottish', requirement_type: 'national_5_route', label: 'Scottish Highers', status: 'met' },
    { qualification_type: 'scottish', requirement_type: 'scottish_post_16_route', label: 'Scottish Highers', status: 'met' },
    { qualification_type: 'graduate', requirement_type: 'graduate_degree_route', label: 'Graduate Entry', status: 'met' }
  ]);
}

{
  const card = scoreCard({ score: 35, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
  assert.strictEqual(card.decision_transparency.selection_metric.applicant_value, 35);
  assert.strictEqual(card.decision_transparency.selection_metric.maximum_value, 36);
  assert.deepStrictEqual(card.decision_transparency.comparison_metrics, [
    {
      label: 'historical score guide',
      value: '33.5',
      difference: '+1.5'
    }
  ]);
  assert.strictEqual(
    card.primary_explanation,
    "Based on ApplySmart's assessment, your selection score appears competitive for this applicant group."
  );
  const historicalStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Historical guidance'
  );
  assert.match(historicalStage.summary, /1\.5 points above/);
  assert.match(historicalStage.summary, /33\.5/);
}

{
  const metadataSelectionApproach =
    'Applicants are assessed using the university metadata sentence.';
  const legacySelectionSummary = 'Legacy generated selection summary should not render.';
  const card = present({
    transparencyContext: {
      selection_approach_display: metadataSelectionApproach,
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: legacySelectionSummary
        }
      },
      guidance_pool: { metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  const selectionCheck = selectionStage.checks.find((check) => check.label === 'Selection approach');
  assert.strictEqual(card.selection_approach_display, metadataSelectionApproach);
  assert.strictEqual(card.decision_transparency.selection_approach_display, metadataSelectionApproach);
  assert.strictEqual(selectionStage.summary, metadataSelectionApproach);
  assert.strictEqual(selectionCheck.summary, metadataSelectionApproach);
  assert.notStrictEqual(selectionStage.summary, legacySelectionSummary);
}

{
  const fallbackSelectionSummary = 'Fallback presentation selection summary.';
  const card = present({
    transparencyContext: {
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: fallbackSelectionSummary
        }
      },
      guidance_pool: { metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.strictEqual(card.selection_approach_display, null);
  assert.strictEqual(card.decision_transparency.selection_approach_display, null);
  assert.strictEqual(selectionStage.summary, fallbackSelectionSummary);
}

{
  const defaultSelectionApproach = 'Applicants are assessed using the default metadata sentence.';
  const fallbackSelectionSummary = 'Fallback presentation selection summary.';
  const card = present({
    transparencyContext: {
      guidance_pool_id: 'unlisted_pool',
      selection_approach_display: {
        default: defaultSelectionApproach,
        by_applicant_pool: {
          international: 'International applicants who meet the academic requirements are ranked using their UCAT score.'
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: fallbackSelectionSummary
        }
      },
      guidance_pool: { pool_id: 'unlisted_pool', metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.strictEqual(card.selection_approach_display, defaultSelectionApproach);
  assert.strictEqual(selectionStage.summary, defaultSelectionApproach);
}

{
  const homeSelectionApproach =
    'Home applicants are assessed using a selection score combining GCSE performance and UCAT.';
  const internationalSelectionApproach =
    'International applicants who meet the academic requirements are ranked using their UCAT score.';
  const fallbackSelectionSummary = 'Fallback presentation selection summary.';
  const card = present({
    transparencyContext: {
      guidance_pool_id: 'international',
      selection_approach_display: {
        by_applicant_pool: {
          home_non_wp: homeSelectionApproach,
          international: internationalSelectionApproach
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: fallbackSelectionSummary
        }
      },
      guidance_pool: { pool_id: 'international', metric: 'ucat_total' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.strictEqual(card.selection_approach_display, internationalSelectionApproach);
  assert.strictEqual(selectionStage.summary, internationalSelectionApproach);
  assert.notStrictEqual(selectionStage.summary, fallbackSelectionSummary);
}

{
  const fallbackSelectionSummary = 'Fallback presentation selection summary.';
  const card = present({
    transparencyContext: {
      guidance_pool_id: 'unknown_pool',
      selection_approach_display: {
        by_applicant_pool: {
          international: 'International applicants who meet the academic requirements are ranked using their UCAT score.'
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: fallbackSelectionSummary
        }
      },
      guidance_pool: { pool_id: 'unknown_pool', metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.strictEqual(card.selection_approach_display, null);
  assert.strictEqual(selectionStage.summary, fallbackSelectionSummary);
}

{
  const routeSelectionApproach = 'Applicants are assessed using the resolved route sentence.';
  const poolSelectionApproach = 'Applicants are assessed using the matched pool sentence.';
  const card = present({
    transparencyContext: {
      selection_route_id: 'route_a',
      guidance_pool_id: 'pool_a',
      selection_approach_display: {
        by_selection_route: {
          route_a: routeSelectionApproach
        },
        by_applicant_pool: {
          pool_a: poolSelectionApproach
        }
      },
      score_model: { type: 'component_sum' },
      guidance_pool: { pool_id: 'pool_a', metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.ok(!Object.prototype.hasOwnProperty.call(card, 'selection_route_id'));
  assert.ok(!Object.prototype.hasOwnProperty.call(card.decision_transparency, 'selection_route_id'));
  assert.strictEqual(card.selection_approach_display, routeSelectionApproach);
  assert.strictEqual(selectionStage.summary, routeSelectionApproach);
}

{
  const poolSelectionApproach = 'Applicants are assessed using the matched pool sentence.';
  const fallbackSelectionSummary = 'Fallback presentation selection summary.';
  const card = present({
    transparencyContext: {
      selection_route_id: 'unmatched_route',
      guidance_pool_id: 'pool_a',
      selection_approach_display: {
        by_selection_route: {
          route_b: 'Applicants are assessed using another route sentence.'
        },
        by_applicant_pool: {
          pool_a: poolSelectionApproach
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: fallbackSelectionSummary
        }
      },
      guidance_pool: { pool_id: 'pool_a', metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.strictEqual(card.selection_approach_display, poolSelectionApproach);
  assert.strictEqual(selectionStage.summary, poolSelectionApproach);
  assert.notStrictEqual(selectionStage.summary, fallbackSelectionSummary);
}

{
  const card = scoreCard({ score: 33.5, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
}

{
  const schemaPath = path.join(__dirname, '../../data/schemas/course.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const structuredMetadataSchema = schema.properties.selection_approach_display.anyOf
    .find((candidate) => candidate.type === 'object');
  const bySelectionRoute =
    structuredMetadataSchema.properties.by_selection_route;
  assert.strictEqual(structuredMetadataSchema.additionalProperties, false);
  assert.deepStrictEqual(bySelectionRoute.additionalProperties, {
    type: 'string',
    minLength: 1
  });
  assert.ok(
    structuredMetadataSchema.anyOf.some((candidate) =>
      candidate.required?.includes('by_selection_route')
    ),
    'course schema must accept structured metadata with by_selection_route and no default'
  );
}

{
  const card = scoreCard({ score: 32, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
}

{
  const card = scoreCard({
    score: 35,
    threshold: 33.5,
    comparisonGuidance: {
      comparison_type: 'current_guidance',
      label: 'ApplySmart strategic benchmark'
    }
  });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
}

{
  const card = scoreOnlyCard({ score: 8.5, max: 10 });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
  assert.deepStrictEqual(card.decision_transparency.comparison_metrics, []);
}

{
  const card = ucatHistoricalAdmissionsCard();
  assert.strictEqual(
    card.decision_transparency.comparison_metrics_title,
    'Historical Interview Data'
  );
  assert.deepStrictEqual(card.decision_transparency.comparison_metrics, [
    {
      label: 'Lowest interviewed UCAT',
      value: '1680',
      difference: '+720'
    },
    {
      label: 'Average interviewed UCAT',
      value: '1995',
      difference: '+405'
    }
  ]);
  const historicalChecks = card.decision_transparency.decision_path
    .find((stage) => stage.stage === 'Historical guidance')
    .checks;
  assert(
    historicalChecks.some((check) => /Lowest interviewed UCAT 1680/.test(check.summary))
  );
  assert(
    historicalChecks.every((check) => !/UCAT interview threshold/.test(check.summary))
  );
}

{
  const card = present({
    transparencyContext: {
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: 2500, score_scale: 2700 }
        }
      },
      score_model: { type: 'ranking_metric', metric: 'ucat_total' },
      guidance_pool: { metric: 'ucat_total' }
    }
  });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
}

{
  const card = ucatComparisonCard({
    ucat: 2550,
    guidancePool: {
      metric: 'ucat_total',
      band_rules: [
        { band: 'realistic', operator: 'between_inclusive', min: 1855, max: 1864 }
      ]
    }
  });
  const historicalStage = card.decision_transparency.decision_path
    .find((stage) => stage.stage === 'Historical guidance');
  assert.match(card.primary_explanation, /UCAT score appears competitive for this applicant group/i);
  assert.match(historicalStage.summary, /UCAT: 2550 - above the historical interview range of 1855-1864\./i);
  assert.doesNotMatch(historicalStage.summary, /historical reference range|encouraging historical guidance/i);
}

{
  const card = ucatComparisonCard({
    ucat: 2420,
    guidancePool: {
      metric: 'ucat_total',
      band_rules: [
        { band: 'interview_likely', operator: 'greater_than_or_equal', value: 1935 }
      ]
    }
  });
  const historicalStage = card.decision_transparency.decision_path
    .find((stage) => stage.stage === 'Historical guidance');
  assert.match(historicalStage.summary, /485 points above the historical interview range of 1935/i);
  assert.doesNotMatch(historicalStage.summary, /previous interview threshold|Historical figures are guidance only/i);
}

{
  const card = ucatComparisonCard({
    ucat: 2420,
    scoreModel: {
      type: 'ranking_metric',
      metric: 'ucat_total',
      scale: { min: 0, max: 2700 },
      current_scale_guidance: {
        home: { value: 2100 }
      }
    },
    guidancePool: {
      metric: 'ucat_total',
      pool_id: 'home_standard',
      comparison_guidance: {
        comparison_type: 'current_guidance',
        label: 'ApplySmart advisory Home competitive benchmark'
      },
      band_rules: [
        { band: 'interview_likely', operator: 'greater_than_or_equal', value: 2100 }
      ]
    }
  });
  const historicalStage = card.decision_transparency.decision_path
    .find((stage) => stage.stage === 'Historical guidance');
  assert.match(historicalStage.summary, /320 points above the historical interview range of 2100\/2700/i);
  assert.doesNotMatch(historicalStage.summary, /historical interview benchmark|historical reference range/i);
}

{
  const card = present({
    interviewBand: 'eligible_to_apply',
    transparencyContext: {
      readiness: { assessment_mode: 'eligibility_only' },
      score_model: { assessment_mode: 'eligibility_only' },
      prediction: { result_band: 'eligible_to_apply', prediction_type: 'eligibility_only' }
    }
  });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
}

{
  const card = present({
    eligibilityStatus: 'not_eligible',
    interviewBand: 'not_eligible'
  });
  assertCompactStatus(card, {
    label: 'You do not currently meet the academic requirements.',
    type: 'academic_status',
    tone: 'negative'
  });
}

{
  const card = present({
    eligibilityStatus: 'insufficient_evidence',
    interviewBand: 'insufficient_evidence',
    insufficientEvidenceReasonCode: 'applicant_evidence_gap'
  });
  assertCompactStatus(card, {
    label: 'ApplySmart needs more information to assess the academic requirements.',
    type: 'academic_status',
    tone: 'warning'
  });
}

{
  const card = present({
    eligibilityStatus: 'insufficient_evidence',
    interviewBand: 'insufficient_evidence',
    insufficientEvidenceReasonCode: 'university_methodology_gap'
  });
  assertCompactStatus(card, {
    label: 'ApplySmart needs more information to assess the academic requirements.',
    type: 'academic_status',
    tone: 'warning'
  });
}

{
  const card = present({
    eligibilityStatus: 'insufficient_evidence',
    interviewBand: 'insufficient_evidence',
    insufficientEvidenceReasonCode: 'applicant_evidence_gap'
  });
  assert.strictEqual(card.recommendation_display_state, 'insufficient_evidence');
  assert.strictEqual(card.primary_user_facing_recommendation, 'More information is required');
}

{
  const card = makeCambridgeCard(2000);
  assert.strictEqual(card.recommendation_display_state, 'standard');
  assert.strictEqual(card.prediction.result_band, 'high_risk');
  assert.strictEqual(card.risk_explanation.primary_factor, 'ucat');
  assert.strictEqual(card.risk_explanation.reason_code, 'ucat_historical_guidance_range');
  assert.match(card.primary_explanation, /UCAT score falls within ApplySmart's more cautious historical guidance range/i);
  assert.doesNotMatch(card.primary_explanation, /academic profile/i);
  assert.strictEqual(card.decision_transparency.risk_explanation.primary_factor, 'ucat');
  assert.strictEqual(card.decision_transparency.score_breakdown, null);
  assert.strictEqual(card.decision_transparency.selection_metric, null);
  assert.strictEqual(card.decision_transparency.ucat_comparison, null);
  const publicText = JSON.stringify(card);
  assert.doesNotMatch(publicText, /\b0\/5\b/);
  assert.doesNotMatch(publicText, /selection score is 0/i);
}

{
  const card = present({
    interviewBand: 'high_risk',
    transparencyContext: {
      ranking: {
        status: 'calculated',
        value: 0,
        max: 10,
        components: {
          academic_profile_score: {
            band: 'high_risk',
            profile_class: 'weak',
            applied_adjustment: -2
          },
          ucat_score: {
            band: 'realistic'
          }
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          hide_score_breakdown: true,
          hide_selection_score_details: true
        }
      },
      guidance_pool: { metric: 'selection_score' }
    }
  });
  assert.strictEqual(card.risk_explanation.primary_factor, 'academic');
  assert.strictEqual(card.risk_explanation.reason_code, 'academic_historical_guidance_range');
  assert.match(card.primary_explanation, /academic profile falls within ApplySmart's more cautious historical guidance range/i);
  assert.doesNotMatch(card.primary_explanation, /UCAT score/i);
}

{
  const card = present({
    interviewBand: 'high_risk',
    transparencyContext: {
      ranking: {
        status: 'calculated',
        value: 0,
        max: 10,
        components: {
          academic_profile_score: {
            band: 'high_risk',
            profile_class: 'weak',
            applied_adjustment: -2
          },
          ucat_score: {
            band: 'high_risk'
          }
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          hide_score_breakdown: true,
          hide_selection_score_details: true
        }
      },
      guidance_pool: { metric: 'selection_score' }
    }
  });
  assert.strictEqual(card.risk_explanation.primary_factor, 'combined_academic_ucat');
  assert.strictEqual(card.risk_explanation.reason_code, 'combined_academic_ucat_historical_guidance_range');
  assert.match(card.primary_explanation, /academic profile and UCAT score fall within ApplySmart's more cautious historical guidance range/i);
}

{
  const card = present({
    eligibilityStatus: 'manual_review',
    manualReviewRequired: true,
    manualReviewReason: 'Please confirm the practical endorsement outcome for your required A-level science subject.',
    interviewBand: 'insufficient_evidence',
    transparencyContext: {
      ranking: {
        status: 'calculated',
        value: 0,
        max: 10,
        components: {
          ucat_score: {
            band: 'high_risk'
          }
        }
      }
    }
  });
  assert.strictEqual(card.recommendation_display_state, 'manual_review');
  assert.strictEqual(card.primary_explanation, 'Please confirm the practical endorsement outcome for your required A-level science subject.');
  assert.strictEqual(card.risk_explanation, null);
  assert.strictEqual(card.decision_transparency.risk_explanation, null);
}

console.log('PASS: compact_status presenter mappings are generated from structured result data');
