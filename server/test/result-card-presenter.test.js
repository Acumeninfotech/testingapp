#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

console.log('PASS: compact_status presenter mappings are generated from structured result data');
