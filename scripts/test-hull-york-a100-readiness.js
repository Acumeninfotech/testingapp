#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildHullYorkA100ResultCard,
  evaluateHullYorkA100
} = require('../assets/js/engine/hull-york-a100-consumer');

const rootDir = path.resolve(__dirname, '..');
const course = readJson(
  path.join(rootDir, 'data', 'universities', 'hull-york-a100.json')
);
const config = readJson(
  path.join(rootDir, 'data', 'interview-band-configs', 'hull-york-a100.json')
);
const fixture = readJson(
  path.join(rootDir, 'data', 'fixtures', 'hull-york-a100-readiness.json')
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, override) {
  if (Array.isArray(override)) {
    return clone(override);
  }
  if (override && typeof override === 'object') {
    const result = {
      ...(base && typeof base === 'object' ? base : {})
    };
    for (const [key, value] of Object.entries(override)) {
      result[key] = merge(result[key], value);
    }
    return result;
  }
  return override;
}

const genericClassifierSource = fs.readFileSync(
  path.join(rootDir, 'assets', 'js', 'engine', 'interview-band-classifier.js'),
  'utf8'
);
assert.doesNotMatch(
  genericClassifierSource,
  /hull[-_ ]york|hyms/i,
  'The generic classifier must remain free of HYMS-specific logic.'
);

assert.strictEqual(
  config.score_model.estimate_mode.official,
  false,
  'HYMS estimate mode must be explicitly unofficial.'
);
assert.strictEqual(
  config.score_model.estimate_mode.contextual.cap,
  15,
  'The contextual estimate must be capped at 15.'
);
assert.match(
  config.score_model.estimate_mode.mandatory_disclosure,
  /published HYMS admissions information/i
);

for (const scenario of fixture.scenarios) {
  const applicant = merge(clone(fixture.base_applicant), scenario.overrides);
  const result = evaluateHullYorkA100(course, config, applicant);
  const expected = scenario.expected;
  const contextual = result.estimated_selection_score.contextual;

  assert.strictEqual(
    result.eligibility.status,
    expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  assert.strictEqual(
    contextual.applicable,
    expected.contextual_applicable,
    `${scenario.scenario_id}: contextual applicability`
  );
  assert.strictEqual(
    contextual.points,
    expected.contextual_points,
    `${scenario.scenario_id}: contextual estimate points`
  );
  if (Object.hasOwn(expected, 'contextual_raw_points')) {
    assert.strictEqual(
      contextual.raw_points_before_cap,
      expected.contextual_raw_points,
      `${scenario.scenario_id}: raw contextual estimate`
    );
  }
  if (Object.hasOwn(expected, 'contextual_cap_applied')) {
    assert.strictEqual(
      contextual.cap_applied,
      expected.contextual_cap_applied,
      `${scenario.scenario_id}: contextual cap`
    );
  }
  if (Object.hasOwn(expected, 'excluded_reason')) {
    assert.strictEqual(
      contextual.excluded_reason,
      expected.excluded_reason,
      `${scenario.scenario_id}: contextual exclusion reason`
    );
  }
  assert.strictEqual(
    result.estimated_selection_score.value,
    expected.score,
    `${scenario.scenario_id}: estimated selection score`
  );
  assert.strictEqual(
    result.estimated_selection_score.max,
    expected.score_max,
    `${scenario.scenario_id}: estimated score maximum`
  );
  assert.strictEqual(
    result.canonical_interview_band,
    expected.band,
    `${scenario.scenario_id}: recommendation band`
  );
  assert.strictEqual(
    result.estimated_selection_score.label,
    'Estimated HYMS selection score'
  );
  assert.strictEqual(result.estimated_selection_score.official, false);
}

const exampleApplicant = clone(fixture.base_applicant);
const generatedCard = buildHullYorkA100ResultCard(
  course,
  config,
  exampleApplicant
);
const generatedText = JSON.stringify(generatedCard);

assert.match(generatedText, /Estimated HYMS selection score/);
assert.doesNotMatch(generatedText, /Confirmed HYMS selection score/i);
assert.match(generatedText, /published HYMS admissions information/i);
assert.match(generatedText, /not a guarantee of interview/i);
assert.strictEqual(
  generatedCard.estimated_selection_score.contextual.points,
  15
);
assert.strictEqual(
  generatedCard.engine_notes.dedicated_adapter,
  'hull_york_a100_consumer'
);
assert.strictEqual(generatedCard.engine_notes.generic_classifier_used, false);
assert.strictEqual(
  generatedCard.readiness.offer_prediction_scope,
  'out_of_scope'
);

const storedCard = readJson(
  path.join(
    rootDir,
    'data',
    'examples',
    'hull-york-a100-result-card.example.json'
  )
);
const storedText = JSON.stringify(storedCard);
assert.match(storedText, /Estimated HYMS selection score/);
assert.doesNotMatch(storedText, /Confirmed HYMS selection score/i);
assert.match(storedText, /published HYMS admissions information/i);
assert.strictEqual(storedCard.prediction.result_band, 'interview_likely');
assert.strictEqual(storedCard.prediction.score, 85.48);
assert.strictEqual(storedCard.prediction.score_scale.max, 100);
assert.strictEqual(storedCard.decision_transparency.selection_metric.applicant_value, 85.48);
assert.strictEqual(storedCard.decision_transparency.selection_metric.maximum_value, 100);
assert.strictEqual(storedCard.decision_transparency.score_breakdown.value, 85.48);
assert.strictEqual(storedCard.decision_transparency.score_breakdown.max, 100);

console.log('HYMS A100 dedicated consumer and estimate-mode regression: PASS');
console.log(`Scenarios checked: ${fixture.scenarios.length}`);
console.log('Home contextual, international, graduate, prior-university, cap and disclosure safeguards: PASS');
