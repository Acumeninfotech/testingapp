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

function assertCompactStatus(card, expected) {
  assert.deepStrictEqual(card.decision_transparency?.compact_status, expected);
}

{
  const card = scoreCard({ score: 35, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'Historical interview guide exceeded',
    type: 'selection_comparison',
    tone: 'positive'
  });
  assert.strictEqual(card.decision_transparency.selection_metric.applicant_value, 35);
  assert.strictEqual(card.decision_transparency.selection_metric.maximum_value, 36);
  assert.match(card.primary_explanation, /1\.5 points above/);
  assert.match(card.primary_explanation, /33\.5/);
}

{
  const card = scoreCard({ score: 33.5, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'Historical interview guide met',
    type: 'selection_comparison',
    tone: 'positive'
  });
}

{
  const card = scoreCard({ score: 32, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'Below historical interview guide',
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
    label: 'ApplySmart advisory guide exceeded',
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
