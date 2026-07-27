#!/usr/bin/env node

const assert = require('assert');
const { presentResultCard } = require('../../assets/js/engine/result-card-presenter');

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

{
  const card = scoreCard({ score: 35, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'Historical selection score exceeded',
    type: 'selection_comparison',
    tone: 'positive'
  });
  assert.strictEqual(card.decision_transparency.selection_metric.applicant_value, 35);
  assert.strictEqual(card.decision_transparency.selection_metric.maximum_value, 36);
  assert.deepStrictEqual(card.decision_transparency.comparison_metrics, [
    {
      label: 'Historical selection score',
      value: '33.5',
      difference: '+1.5'
    }
  ]);
  assert.match(card.primary_explanation, /1\.5 points above/);
  assert.match(card.primary_explanation, /33\.5/);
}

{
  const card = scoreCard({ score: 33.5, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'Historical selection score met',
    type: 'selection_comparison',
    tone: 'positive'
  });
}

{
  const card = scoreCard({ score: 32, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'Below historical selection score',
    type: 'selection_comparison',
    tone: 'negative'
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
    label: 'ApplySmart strategic benchmark exceeded',
    type: 'selection_comparison',
    tone: 'positive'
  });
}

{
  const card = scoreOnlyCard({ score: 8.5, max: 10 });
  assertCompactStatus(card, {
    label: 'Selection score calculated',
    type: 'selection_metric',
    tone: 'neutral'
  });
  assert.deepStrictEqual(card.decision_transparency.comparison_metrics, []);
}

{
  const card = ucatHistoricalAdmissionsCard();
  assert.strictEqual(
    card.decision_transparency.comparison_metrics_title,
    'Historical Interview Data (2025)'
  );
  assert.deepStrictEqual(card.decision_transparency.comparison_metrics, [
    {
      label: 'Lowest interviewed UCAT (2025)',
      value: '1680',
      difference: '+720'
    },
    {
      label: 'Average interviewed UCAT (2025)',
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
    label: 'UCAT ranking assessed',
    type: 'selection_metric',
    tone: 'neutral'
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
  assert.match(card.primary_explanation, /Your UCAT is above the historical interview benchmark range/i);
  assert.match(historicalStage.summary, /UCAT: 2550 - above the historical interview benchmark range of 1855-1864\./i);
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
  assert.match(historicalStage.summary, /485 points above the historical interview benchmark of 1935/i);
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
  assert.match(historicalStage.summary, /320 points above the ApplySmart advisory Home competitive benchmark of 2100\/2700/i);
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
    label: 'Eligibility requirements met',
    type: 'eligibility',
    tone: 'positive'
  });
}

{
  const card = present({
    eligibilityStatus: 'not_eligible',
    interviewBand: 'not_eligible'
  });
  assertCompactStatus(card, {
    label: 'Entry requirements not met',
    type: 'eligibility',
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
    label: 'Information needed',
    type: 'information_needed',
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
    label: 'Prediction unavailable',
    type: 'prediction_unavailable',
    tone: 'neutral'
  });
}

console.log('PASS: compact_status presenter mappings are generated from structured result data');
