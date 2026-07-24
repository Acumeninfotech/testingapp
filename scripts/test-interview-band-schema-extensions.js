#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const schema = readJson('data/schemas/interview-band-classification.schema.json');
const bristol = readJson('data/interview-band-configs/bristol-a100.json');
const angliaRuskin = readJson('data/interview-band-configs/anglia-ruskin-a100.json');
const manchester = readJson('data/interview-band-configs/manchester-a100.json');
const keele = readJson('data/interview-band-configs/keele-a100.json');
const southampton = readJson('data/interview-band-configs/southampton-a100.json');

const eligibilityProperties = schema.properties.eligibility.properties;
const ibMinimumSchema = eligibilityProperties
  .international_baccalaureate
  .properties
  .routes
  .items
  .$ref;
const ibRouteSchema = schema.$defs[ibMinimumSchema.replace('#/$defs/', '')];
assert.deepStrictEqual(ibRouteSchema.properties.minimum_hl_points, {
  type: 'integer',
  minimum: 0,
  maximum: 21
});

assert.deepStrictEqual(
  eligibilityProperties.international_qualification.properties.unverified_outcome.enum,
  ['not_eligible', 'manual_review']
);
assert.strictEqual(eligibilityProperties.graduate.properties.gcse_required.type, 'boolean');
assert.strictEqual(eligibilityProperties.graduate.properties.waive_a_level_requirements.type, 'boolean');
assert.deepStrictEqual(
  schema.$defs.comparison_guidance.properties.comparison_type.enum,
  ['current_guidance', 'historical_threshold', 'historical_range']
);

const overrideSchema = schema.$defs.guaranteed_interview_override;
assert.strictEqual(overrideSchema.properties.apply_ucat_guidance_band.const, false);
assert.strictEqual(overrideSchema.properties.interview_outcome.const, 'guaranteed_interview');
assert.strictEqual(overrideSchema.properties.outcome.const, 'guaranteed_interview');
assert.ok(
  JSON.stringify(overrideSchema).includes('applicant_evidence_path'),
  'override schema must explicitly mention applicant_evidence_path'
);
assert.ok(
  JSON.stringify(overrideSchema).includes('required_evidence'),
  'override schema must explicitly mention required_evidence'
);

function validateApprovedExtensions(config) {
  const failures = [];
  const eligibility = config.eligibility || {};
  const allowedHistoricalEvidence = schema.properties.guidance_pools.items.properties
    .historical_cutoff.properties.evidence_classification.enum;

  for (const pool of config.guidance_pools || []) {
    if (
      pool.historical_cutoff &&
      !allowedHistoricalEvidence.includes(pool.historical_cutoff.evidence_classification)
    ) {
      failures.push('invalid_evidence_classification');
    }
  }

  for (const route of eligibility.international_baccalaureate?.routes || []) {
    if (Object.prototype.hasOwnProperty.call(route, 'minimum_hl_points')) {
      if (!Number.isInteger(route.minimum_hl_points)) {
        failures.push('minimum_hl_points_must_be_integer');
      }
      if (route.minimum_hl_points < 0 || route.minimum_hl_points > 21) {
        failures.push('minimum_hl_points_out_of_range');
      }
    }
  }

  const unverifiedOutcome = eligibility.international_qualification?.unverified_outcome;
  if (
    unverifiedOutcome !== undefined &&
    !['not_eligible', 'manual_review'].includes(unverifiedOutcome)
  ) {
    failures.push('invalid_unverified_outcome');
  }

  const graduateGcseRequired = eligibility.graduate?.gcse_required;
  if (
    graduateGcseRequired !== undefined &&
    typeof graduateGcseRequired !== 'boolean'
  ) {
    failures.push('graduate_gcse_required_must_be_boolean');
  }
  const graduateWaiveALevel = eligibility.graduate?.waive_a_level_requirements;
  if (
    graduateWaiveALevel !== undefined &&
    typeof graduateWaiveALevel !== 'boolean'
  ) {
    failures.push('graduate_waive_a_level_requirements_must_be_boolean');
  }

  const override = eligibility.map_override;
  if (override) {
    if (override.apply_ucat_guidance_band !== false) {
      failures.push('guaranteed_override_must_bypass_ucat_guidance');
    }
    if (
      override.outcome !== 'guaranteed_interview' &&
      override.interview_outcome !== 'guaranteed_interview'
    ) {
      failures.push('guaranteed_override_missing_outcome');
    }
    const forbiddenOrdinaryBandFields = [
      'threshold',
      'value',
      'band',
      'interview_band',
      'canonical_interview_band',
      'band_rules',
      'historical_cutoff'
    ];
    for (const field of forbiddenOrdinaryBandFields) {
      if (Object.prototype.hasOwnProperty.call(override, field)) {
        failures.push(`guaranteed_override_forbidden_${field}`);
      }
    }

    const hasDirectEvidence =
      typeof override.applicant_evidence_path === 'string' &&
      override.applicant_evidence_path.length > 0 &&
      override.required_evidence &&
      typeof override.required_evidence === 'object' &&
      Object.keys(override.required_evidence).length > 0;
    const conditionEvidence = Array.isArray(override.any_conditions) &&
      override.any_conditions.length > 0 &&
      override.any_conditions.every((condition) => {
        return typeof condition.applicant_evidence_path === 'string' &&
          condition.applicant_evidence_path.length > 0 &&
          condition.required_evidence &&
          typeof condition.required_evidence === 'object' &&
          Object.keys(condition.required_evidence).length > 0;
      });
    if (!hasDirectEvidence && !conditionEvidence) {
      failures.push('guaranteed_override_missing_evidence_requirements');
    }
  }

  return failures;
}

function assertValid(name, config) {
  assert.deepStrictEqual(validateApprovedExtensions(config), [], name);
}

function assertInvalid(name, mutate, expectedFailure) {
  const config = clone(bristol);
  mutate(config);
  assert.ok(
    validateApprovedExtensions(config).includes(expectedFailure),
    `${name} must fail with ${expectedFailure}`
  );
}

assertValid('Bristol approved schema extensions', bristol);
assertValid('ARU approved guaranteed-interview override', angliaRuskin);
assertValid('Manchester approved guaranteed-interview override', manchester);
assertValid('Keele approved guaranteed-interview override', keele);
assertValid('Southampton graduate GCSE and current-guidance extensions', southampton);

assertInvalid(
  'negative minimum_hl_points',
  (config) => {
    config.eligibility.international_baccalaureate.routes[0].minimum_hl_points = -1;
  },
  'minimum_hl_points_out_of_range'
);
assertInvalid(
  'minimum_hl_points above 21',
  (config) => {
    config.eligibility.international_baccalaureate.routes[0].minimum_hl_points = 22;
  },
  'minimum_hl_points_out_of_range'
);
assertInvalid(
  'non-integer minimum_hl_points',
  (config) => {
    config.eligibility.international_baccalaureate.routes[0].minimum_hl_points = 16.5;
  },
  'minimum_hl_points_must_be_integer'
);
assertInvalid(
  'invalid unverified_outcome',
  (config) => {
    config.eligibility.international_qualification.unverified_outcome = 'maybe';
  },
  'invalid_unverified_outcome'
);
assertInvalid(
  'guaranteed override without evidence path',
  (config) => {
    delete config.eligibility.map_override.applicant_evidence_path;
  },
  'guaranteed_override_missing_evidence_requirements'
);
assertInvalid(
  'guaranteed override without required evidence',
  (config) => {
    delete config.eligibility.map_override.required_evidence;
  },
  'guaranteed_override_missing_evidence_requirements'
);
assertInvalid(
  'guaranteed override with UCAT guidance enabled',
  (config) => {
    config.eligibility.map_override.apply_ucat_guidance_band = true;
  },
  'guaranteed_override_must_bypass_ucat_guidance'
);
assertInvalid(
  'guaranteed override with threshold zero',
  (config) => {
    config.eligibility.map_override.value = 0;
  },
  'guaranteed_override_forbidden_value'
);
assertInvalid(
  'guaranteed override with ordinary interview band',
  (config) => {
    config.eligibility.map_override.interview_band = 'interview_likely';
  },
  'guaranteed_override_forbidden_interview_band'
);
assertInvalid(
  'invalid evidence classification',
  (config) => {
    config.guidance_pools[0].historical_cutoff.evidence_classification = 'unverified_cutoff';
  },
  'invalid_evidence_classification'
);
assertInvalid(
  'non-boolean graduate gcse_required',
  (config) => {
    config.eligibility.graduate = {
      gcse_required: 'true',
      waive_a_level_requirements: true
    };
  },
  'graduate_gcse_required_must_be_boolean'
);
assertInvalid(
  'non-boolean graduate waive_a_level_requirements',
  (config) => {
    config.eligibility.graduate = {
      gcse_required: true,
      waive_a_level_requirements: 'yes'
    };
  },
  'graduate_waive_a_level_requirements_must_be_boolean'
);

console.log('Interview-band schema extension safeguards: PASS');
console.log('Negative malformed configuration cases checked: 12');
