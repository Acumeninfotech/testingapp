#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const standardise = require('./standardise-completed-profiles');

const rootDir = path.resolve(__dirname, '..');
const completedProfileIds = standardise.completedProfileIds;
const standardReadinessFields = [
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
  'offer_prediction_scope',
  'prediction_confidence',
  'result_card_ready'
];
const researchCoreFields = [
  'schema_version',
  'profile_id',
  'course_profile_id',
  'research_status',
  'file_purpose',
  'official_rules_source',
  'created_at',
  'last_updated',
  'research_scope',
  'evidence_classification_policy',
  'metadata',
  'readiness'
];
const resultCardCoreFields = [
  'schema_version',
  'template_version',
  'result_id',
  'generated_at',
  'result_mode',
  'course_identity',
  'applicant_context',
  'readiness',
  'eligibility',
  'prediction',
  'confidence',
  'evidence_confidence',
  'display',
  'decision_timeline',
  'decision_transparency',
  'engine_notes'
];
const interviewBandCoreFields = [
  'schema_version',
  'course_profile_id',
  'confidence',
  'evidence',
  'eligibility',
  'score_model',
  'guidance_pools'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function assertFields(value, fields, label) {
  for (const field of fields) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(value, field),
      `${label}.${field} must be present.`
    );
  }
}

function assertNoOfferPredictionOutput(value, label, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoOfferPredictionOutput(entry, label, [...pathParts, index])
    );
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const pathLabel = [...pathParts, key].join('.');
    if (key !== 'offer_prediction_scope') {
      assert.doesNotMatch(
        key,
        /offer_prediction|show_offer_prediction|final_offer_basis/i,
        `${label}.${pathLabel} must not expose offer prediction.`
      );
    }
    assertNoOfferPredictionOutput(entry, label, [...pathParts, key]);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertSanitiserPreservesScopeDisclosures() {
  const preservedStatements = [
    'This is not an offer prediction.',
    'Do not implement offer prediction.',
    'No offer prediction.',
    'Offer prediction remains out of scope.',
    'Final offers are based solely on MMI ranking, but offer prediction remains out of ApplySmart scope.',
    'Offer prediction, MMI prediction and waiting-list prediction are permanently out of ApplySmart scope.',
    'Do not predict offers, MMI score, waiting-list position or offer probability.',
    'This result is interview guidance only, not an offer prediction or an interview guarantee.'
  ];

  for (const statement of preservedStatements) {
    assert.strictEqual(
      standardise.sanitiseResultCardString(statement),
      statement,
      `standardiser must preserve complete scope disclosure: ${statement}`
    );
  }

  assert.notStrictEqual(
    standardise.sanitiseResultCardString('This is not an offer prediction.'),
    'This is not an',
    'standardiser must not create a broken "not an" fragment.'
  );
  assert.notStrictEqual(
    standardise.sanitiseResultCardString('Do not implement offer prediction.'),
    'Do not implement',
    'standardiser must not create a broken "Do not implement" fragment.'
  );
  assert.notStrictEqual(
    standardise.sanitiseResultCardString('No offer prediction.'),
    'No',
    'standardiser must not create a broken "No" fragment.'
  );
}

function assertStandardisationAuditIsSafe() {
  const audit = standardise.buildStandardisationAudit();
  const unsafe = audit.filter(standardise.isUnsafeAuditChange);
  assert.deepStrictEqual(
    unsafe,
    [],
    `standardisation audit must not contain unsafe/value-changing drift: ${unsafe
      .map((change) => `${change.file} [${change.classifications.join(',')}]`)
      .join('; ')}`
  );
}

function assertKnownScopeTextPreserved(profileId, currentValues, proposedValues) {
  const currentText = JSON.stringify(currentValues);
  const proposedText = JSON.stringify(proposedValues);
  const knownScopeStatements = [
    'Offer prediction remains out of scope.',
    'Offer selection information is stored for transparency only and does not enable offer prediction.',
    'Score guidance thresholds are guidance only and not offer prediction.',
    'Do not implement offer prediction.',
    'Do not implement offer prediction or the re-applicant 5%-below-waitlist rule as executable logic.',
    'No offer prediction.',
    'Do not predict offers, MMI score, waiting-list position or offer probability.',
    'Offer prediction, MMI prediction and waiting-list prediction are permanently out of ApplySmart scope.',
    'This is an ApplySmart estimate, not an official Plymouth cutoff.',
    'Interview thresholds may change each admissions cycle depending on applicant competition and interview capacity. Historical figures are guidance only, not a current cut-off, and do not guarantee an interview.'
  ];

  for (const statement of knownScopeStatements) {
    if (currentText.includes(statement)) {
      assert.ok(
        proposedText.includes(statement),
        `${profileId} standardisation must preserve scope/methodology statement: ${statement}`
      );
    }
  }
}

function plymouthProtectedSnapshot(production, research, card, config, indexEntry) {
  return {
    profile_status: production.profile_status,
    readiness: Object.fromEntries(
      [
        'eligibility_ready',
        'interview_prediction_ready',
        'result_card_ready',
        'activation_ready',
        'production_ready',
        'regression'
      ].map((field) => [field, indexEntry[field]])
    ),
    engine_readiness: Object.fromEntries(
      standardReadinessFields.map((field) => [field, production.engine_notes[field]])
    ),
    applicant_pools: production.applicant_pools,
    applies_to_group_ids: production.applies_to_group_ids,
    ucat_conversion_policy: production.historical_admissions.historical_ucat_conversion_policy,
    historical_cycles: production.historical_admissions.cycles.map((cycle) => ({
      entry_year: cycle.entry_year,
      application_pool: cycle.application_pool,
      official_historical_score: cycle.official_historical_score,
      original_score: cycle.original_score,
      converted_score: cycle.converted_score,
      converted_score_scale: cycle.converted_score_scale,
      conversion_method: cycle.conversion_method,
      display_only: cycle.display_only,
      converted_value_evidence_classification: cycle.converted_value_evidence_classification,
      usable_for_guidance_band_calibration: cycle.usable_for_guidance_band_calibration
    })),
    gamsat: production.historical_admissions.historical_gamsat_thresholds,
    normalised_calibration: production.historical_admissions.normalised_calibration,
    score_model: {
      conversion_policy: config.score_model.conversion_policy,
      calibration_policy: config.score_model.calibration_policy,
      historical_series: config.score_model.historical_series
    },
    guidance_pools: config.guidance_pools.map((pool) => ({
      pool_id: pool.pool_id,
      applicant_match: pool.applicant_match,
      band_rules: pool.band_rules
    })),
    research_readiness: research.readiness,
    card_readiness: card.readiness,
    card_disclosures: {
      historical_context: card.historical_context,
      prediction: card.prediction,
      display: card.display,
      decision_transparency: card.decision_transparency
    }
  };
}

function assertPlymouthProtectedStandardisation() {
  const production = readJson('data/universities/plymouth-a100.json');
  const research = readJson('data/research/plymouth-a100-research.json');
  const card = readJson('data/examples/plymouth-a100-result-card.example.json');
  const config = readJson('data/interview-band-configs/plymouth-a100.json');
  const index = readJson('data/index.json');
  const indexEntry = index.universities.find((entry) => entry.id === 'plymouth-a100');

  const productionById = new Map([['plymouth-a100', standardise.normaliseProduction(clone(production))]]);
  const proposedProduction = productionById.get('plymouth-a100');
  const proposedResearch = standardise.normaliseResearch(clone(research), proposedProduction);
  const proposedCard = standardise.normaliseResultCard(clone(card), proposedProduction);
  const proposedConfig = standardise.normaliseInterviewBandConfig(clone(config));
  const proposedIndexEntry = standardise
    .normaliseIndex(clone(index), productionById)
    .universities.find((entry) => entry.id === 'plymouth-a100');

  assert.deepStrictEqual(
    plymouthProtectedSnapshot(production, research, card, config, indexEntry),
    plymouthProtectedSnapshot(
      proposedProduction,
      proposedResearch,
      proposedCard,
      proposedConfig,
      proposedIndexEntry
    ),
    'Plymouth protected methodology, historical data, pools, disclosures and readiness must not change.'
  );

  const poolsById = Object.fromEntries(
    config.guidance_pools.map((pool) => [pool.pool_id, pool.band_rules])
  );
  assert.deepStrictEqual(poolsById.home_a100, [
    { band: 'interview_likely', operator: 'greater_than_or_equal', value: 2100 },
    { band: 'realistic', operator: 'between_inclusive', min: 1950, max: 2099 },
    { band: 'ambitious', operator: 'between_inclusive', min: 1800, max: 1949 },
    { band: 'high_risk', operator: 'less_than', value: 1800 }
  ]);
  assert.deepStrictEqual(poolsById.international_a100, poolsById.home_a100);
  assert.deepStrictEqual(poolsById.ukwpmed_widening_access_a100, [
    { band: 'interview_likely', operator: 'greater_than_or_equal', value: 1898 },
    { band: 'realistic', operator: 'between_inclusive', min: 1748, max: 1897 },
    { band: 'ambitious', operator: 'between_inclusive', min: 1598, max: 1747 },
    { band: 'high_risk', operator: 'less_than', value: 1598 }
  ]);
  assert.strictEqual(
    config.score_model.calibration_policy.method,
    'median_of_three_pool_specific_normalised_historical_thresholds'
  );
  assert.strictEqual(config.score_model.conversion_policy.formula, 'official_score_3600 * 3 / 4');
}

assertSanitiserPreservesScopeDisclosures();
assertStandardisationAuditIsSafe();
assertPlymouthProtectedStandardisation();

const index = readJson('data/index.json');

for (const profileId of completedProfileIds) {
  const production = readJson(`data/universities/${profileId}.json`);
  const research = readJson(`data/research/${profileId}-research.json`);
  const card = readJson(`data/examples/${profileId}-result-card.example.json`);
  const config = readJson(`data/interview-band-configs/${profileId}.json`);
  const indexEntry = index.universities.find((entry) => entry.id === profileId);

  assert.ok(indexEntry, `${profileId} must be present in data/index.json.`);
  assertFields(production.engine_notes, standardReadinessFields, `${profileId}.engine_notes`);
  assertFields(research, researchCoreFields, `${profileId}.research`);
  assertFields(research.readiness, standardReadinessFields, `${profileId}.research.readiness`);
  assertFields(card, resultCardCoreFields, `${profileId}.result_card`);
  assertFields(card.readiness, standardReadinessFields, `${profileId}.result_card.readiness`);
  assertFields(config, interviewBandCoreFields, `${profileId}.interview_band`);
  assertFields(indexEntry, standardReadinessFields, `${profileId}.index`);

  for (const field of standardReadinessFields) {
    const expected = production.engine_notes[field];
    assert.deepStrictEqual(
      research.readiness[field],
      expected,
      `${profileId} research readiness.${field} must match production.`
    );
    assert.deepStrictEqual(
      card.readiness[field],
      expected,
      `${profileId} result-card readiness.${field} must match production.`
    );
    assert.deepStrictEqual(
      indexEntry[field],
      expected,
      `${profileId} index readiness.${field} must match production.`
    );
  }

  assert.strictEqual(
    research.research_readiness_flags,
    undefined,
    `${profileId} must not use deprecated research_readiness_flags.`
  );
  assert.strictEqual(
    research.readiness.research_completeness_status,
    undefined,
    `${profileId} must not duplicate research_completeness.`
  );
  assert.strictEqual(config.course_profile_id, profileId);
  assert.ok(Array.isArray(config.guidance_pools));
  assert.strictEqual(config.offer_prediction, undefined);
  assert.strictEqual(production.engine_notes.offer_prediction_scope, 'out_of_scope');
  assert.strictEqual(research.readiness.offer_prediction_scope, 'out_of_scope');
  assert.strictEqual(card.readiness.offer_prediction_scope, 'out_of_scope');
  assert.strictEqual(indexEntry.offer_prediction_scope, 'out_of_scope');
  assert.strictEqual(production.engine_notes.offer_prediction_ready, undefined);
  assert.strictEqual(research.readiness.offer_prediction_ready, undefined);
  assert.strictEqual(card.readiness.offer_prediction_ready, undefined);
  assert.strictEqual(indexEntry.offer_prediction_ready, undefined);
  assertNoOfferPredictionOutput(card, `${profileId}.result_card`);

  if (
    [
      'anglia-ruskin-a100',
      'bristol-a100',
      'exeter-a100',
      'keele-a100',
      'leicester-a100',
      'newcastle-a100',
      'plymouth-a100',
      'queen-mary-a100'
    ].includes(profileId)
  ) {
    assertKnownScopeTextPreserved(
      profileId,
      { production, research, card },
      {
        production: standardise.normaliseProduction(clone(production)),
        research: standardise.normaliseResearch(clone(research), production),
        card: standardise.normaliseResultCard(clone(card), production)
      }
    );
  }
}

console.log('Completed profile standardisation validation: PASS');
console.log(`Profiles validated: ${completedProfileIds.length}`);
