#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  APPLYSMART_STANDARD_UCAT_CONVERSION_ID,
  convertHistoricalUcatScore,
  resolveBandRuleForComparison,
  validateHistoricalUcatBandRules
} = require('../assets/js/engine/ucat-conversion-service');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');

const rootDir = path.resolve(__dirname, '..');
const conversionReference = readJson('data/ucat-conversions.json');
const schema = readJson('data/schemas/interview-band-classification.schema.json');
const classifierSource = fs.readFileSync(
  path.join(rootDir, 'assets', 'js', 'engine', 'interview-band-classifier.js'),
  'utf8'
);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertThrowsMessage(name, fn, text) {
  assert.throws(
    fn,
    (error) => String(error.message).includes(text),
    name
  );
}

function validationCodes(failures) {
  return failures.map((failure) => failure.split(':').pop());
}

function assertValidationFailure(name, config, expectedCode) {
  const codes = validationCodes(validateHistoricalUcatBandRules(config, {
    reference: conversionReference
  }));
  assert.ok(codes.includes(expectedCode), `${name} must include ${expectedCode}`);
}

function historicalRangeRule(minimum, maximum, band = 'realistic', extra = {}) {
  return {
    band,
    operator: 'between_inclusive',
    score_scale: 'historical_3600',
    conversion_reference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID,
    evidence_status: 'official_historical_evidence',
    minimum_historical_score: minimum,
    maximum_historical_score: maximum,
    ...extra
  };
}

function historicalSingleRule(score, operator = 'greater_than_or_equal', extra = {}) {
  return {
    band: 'interview_likely',
    operator,
    score_scale: 'historical_3600',
    conversion_reference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID,
    evidence_status: 'official_historical_evidence',
    historical_score: score,
    ...extra
  };
}

function baseConfig(rules) {
  return {
    schema_version: '1.0.0',
    course_profile_id: 'test-a100',
    confidence: 'low',
    evidence: {
      classification: 'test',
      summary: 'Test config',
      source_ids: []
    },
    eligibility: {
      qualification_routes: {
        supported: [
          'unknown'
        ]
      }
    },
    score_model: {
      type: 'ranking_metric',
      basis: 'UCAT total',
      metric: 'ucat_total',
      scale: {
        min: 0,
        max: 2700
      }
    },
    guidance_pools: [
      {
        pool_id: 'all',
        priority: 1,
        applicant_match: {},
        metric: 'ucat_total',
        band_rules: rules
      }
    ]
  };
}

const course = {
  profile_id: 'test-a100',
  course: {
    ucas_code: 'A100',
    discipline: 'medicine'
  }
};

const applicant = {
  profile_id: 'test-applicant',
  course_target: {
    discipline: 'medicine'
  },
  applicant_identity: {
    domicile: 'England',
    fee_status: 'Home',
    contextual_flags: {}
  },
  admissions_tests: {
    ucat: {
      total_score: 2250,
      score_scale: 2700,
      sjt_band: 2
    }
  }
};

assert.strictEqual(conversionReference.id, APPLYSMART_STANDARD_UCAT_CONVERSION_ID);
assert.strictEqual(conversionReference.conversion.rounding, 'nearest_integer');
assert.strictEqual(conversionReference.conversion.factor, 0.75);

for (const [historicalScore, expectedConvertedScore] of [
  [3600, 2700],
  [3500, 2625],
  [3400, 2550],
  [3300, 2475],
  [3200, 2400],
  [3100, 2325],
  [3000, 2250],
  [2900, 2175],
  [2840, 2130],
  [2800, 2100],
  [2700, 2025],
  [2600, 1950],
  [2500, 1875]
]) {
  assert.strictEqual(
    convertHistoricalUcatScore(historicalScore, {
      reference: conversionReference,
      conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
    }).converted_score,
    expectedConvertedScore,
    `${historicalScore} must convert to ${expectedConvertedScore}`
  );
}

assert.strictEqual(
  convertHistoricalUcatScore(2501, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  }).converted_score,
  1876,
  'Decimal conversion result must round to nearest integer.'
);
assert.strictEqual(
  convertHistoricalUcatScore(2500.66, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  }).converted_score,
  1875,
  'Value immediately below .5 rounding boundary must round down.'
);
assert.strictEqual(
  convertHistoricalUcatScore(2500.67, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  }).converted_score,
  1876,
  'Value immediately above .5 rounding boundary must round up.'
);
assert.strictEqual(
  convertHistoricalUcatScore(1200, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  }).converted_score,
  900
);
assert.strictEqual(
  convertHistoricalUcatScore(3600, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  }).converted_score,
  2700
);
assert.strictEqual(
  convertHistoricalUcatScore('2840', {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  }).converted_score,
  2130,
  'Numeric strings should follow the existing Number-based UCAT input policy.'
);

assertThrowsMessage('missing value', () => {
  convertHistoricalUcatScore(undefined, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  });
}, 'is required');
assertThrowsMessage('null value', () => {
  convertHistoricalUcatScore(null, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  });
}, 'must not be null');
assertThrowsMessage('empty string', () => {
  convertHistoricalUcatScore('', {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  });
}, 'must not be empty');
assertThrowsMessage('non-numeric string', () => {
  convertHistoricalUcatScore('not-a-score', {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  });
}, 'finite numeric');
assertThrowsMessage('negative score', () => {
  convertHistoricalUcatScore(-1, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  });
}, 'must not be negative');
assertThrowsMessage('below supported minimum score', () => {
  convertHistoricalUcatScore(1199, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  });
}, 'at least 1200');
assertThrowsMessage('above maximum score', () => {
  convertHistoricalUcatScore(3601, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  });
}, 'no greater than 3600');
assertThrowsMessage('invalid source scale', () => {
  convertHistoricalUcatScore(3000, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID,
    sourceScale: 'current_2700'
  });
}, 'Unsupported UCAT conversion source scale');
assertThrowsMessage('invalid target scale', () => {
  convertHistoricalUcatScore(3000, {
    reference: conversionReference,
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID,
    targetScale: 'historical_3600'
  });
}, 'Unsupported UCAT conversion target scale');
assertThrowsMessage('missing conversion reference', () => {
  convertHistoricalUcatScore(3000, {
    reference: conversionReference
  });
}, 'conversion_reference is required');
assertThrowsMessage('unknown conversion reference', () => {
  convertHistoricalUcatScore(3000, {
    reference: conversionReference,
    conversionReference: 'unknown-reference'
  });
}, 'Unknown UCAT conversion reference');
assertThrowsMessage('inactive conversion reference', () => {
  convertHistoricalUcatScore(3000, {
    reference: {
      ...conversionReference,
      status: 'retired'
    },
    conversionReference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  });
}, 'not active');

const historicalRule = historicalRangeRule(3000, 3199, 'interview_likely', {
  minimum_derived_score_2700: 2250,
  maximum_derived_score_2700: 2399,
  derived_score_status: 'applysmart_derived'
});
const resolvedHistoricalRule = resolveBandRuleForComparison(historicalRule, {
  reference: conversionReference
});
assert.strictEqual(resolvedHistoricalRule.comparison_rule.min, 2250);
assert.strictEqual(resolvedHistoricalRule.comparison_rule.max, 2399);
assert.strictEqual(
  resolvedHistoricalRule.conversion.historical_boundary.minimum_score,
  3000
);
assert.strictEqual(
  resolvedHistoricalRule.conversion.converted_boundary.minimum_score,
  2250
);

const nativeRule = {
  band: 'interview_likely',
  operator: 'greater_than_or_equal',
  score_scale: 'current_2700',
  value: 2200
};
const resolvedNativeRule = resolveBandRuleForComparison(nativeRule, {
  reference: conversionReference
});
assert.strictEqual(resolvedNativeRule.comparison_rule, nativeRule);
assert.strictEqual(resolvedNativeRule.conversion, null);

const historicalConfig = baseConfig([
  historicalRangeRule(3000, 3199, 'interview_likely'),
  historicalRangeRule(1200, 2999, 'realistic')
]);
assert.deepStrictEqual(validateHistoricalUcatBandRules(historicalConfig, {
  reference: conversionReference
}), []);

const historicalApplicant = clone(applicant);
historicalApplicant.admissions_tests.ucat.total_score = 2250;
const historicalResult = classifyInterviewBand(course, historicalConfig, historicalApplicant);
assert.strictEqual(historicalResult.canonical_interview_band, 'interview_likely');
assert.strictEqual(
  historicalResult.band_metric.historical_conversion.historical_boundary.minimum_score,
  3000
);
assert.strictEqual(
  historicalResult.band_metric.historical_conversion.converted_boundary.minimum_score,
  2250
);
assert.strictEqual(
  historicalResult.band_metric.historical_conversion.applicant_score.scale,
  2700
);

const nativeConfig = baseConfig([
  {
    band: 'interview_likely',
    operator: 'greater_than_or_equal',
    score_scale: 'current_2700',
    value: 2200
  }
]);
const nativeResult = classifyInterviewBand(course, nativeConfig, historicalApplicant);
assert.strictEqual(nativeResult.canonical_interview_band, 'interview_likely');
assert.strictEqual(nativeResult.band_metric.historical_conversion, undefined);

assertValidationFailure(
  'missing historical score',
  baseConfig([historicalSingleRule(undefined)]),
  'missing_historical_score'
);
assertValidationFailure(
  'null historical score',
  baseConfig([historicalSingleRule(null)]),
  'null_historical_score'
);
assertValidationFailure(
  'non-numeric historical score',
  baseConfig([historicalSingleRule('two thousand')]),
  'non_numeric_historical_score'
);
assertValidationFailure(
  'negative historical score',
  baseConfig([historicalSingleRule(-10)]),
  'negative_historical_score'
);
assertValidationFailure(
  'historical score below supported minimum',
  baseConfig([historicalSingleRule(1199)]),
  'historical_score_below_supported_minimum'
);
assertValidationFailure(
  'historical score above max',
  baseConfig([historicalSingleRule(3601)]),
  'historical_score_above_supported_maximum'
);
assertValidationFailure(
  'missing conversion reference',
  baseConfig([historicalSingleRule(3000, 'greater_than_or_equal', {
    conversion_reference: undefined
  })]),
  'missing_conversion_reference'
);
assertValidationFailure(
  'unknown conversion reference',
  baseConfig([historicalSingleRule(3000, 'greater_than_or_equal', {
    conversion_reference: 'unknown-reference'
  })]),
  'unknown_conversion_reference'
);
assertValidationFailure(
  'mixed historical and native fields',
  baseConfig([historicalRangeRule(3000, 3200, 'realistic', {
    min: 2250
  })]),
  'mixed_historical_and_native_score_fields'
);
assertValidationFailure(
  'stored derived score mismatch',
  baseConfig([historicalSingleRule(3000, 'greater_than_or_equal', {
    derived_score_2700: 2249,
    derived_score_status: 'applysmart_derived'
  })]),
  'stored_derived_score_mismatch'
);
assertValidationFailure(
  'minimum score greater than maximum score',
  baseConfig([historicalRangeRule(3200, 3000)]),
  'minimum_score_greater_than_maximum_score'
);
assertValidationFailure(
  'converted overlap',
  baseConfig([
    historicalRangeRule(3002, 3002),
    historicalRangeRule(3003, 3003)
  ]),
  'converted_range_overlap'
);
assertValidationFailure(
  'rounding ambiguity',
  baseConfig([
    historicalRangeRule(3002, 3002),
    historicalRangeRule(3003, 3003)
  ]),
  'historical_conversion_rounding_ambiguity'
);
assertValidationFailure(
  'conversion fields without historical scale',
  baseConfig([{
    band: 'interview_likely',
    operator: 'greater_than_or_equal',
    value: 2250,
    conversion_reference: APPLYSMART_STANDARD_UCAT_CONVERSION_ID
  }]),
  'conversion_fields_require_historical_3600_scale'
);

const bandRuleSchema = schema.$defs.band_rule;
assert.ok(JSON.stringify(bandRuleSchema).includes('historical_3600'));
assert.ok(JSON.stringify(bandRuleSchema).includes('conversion_reference'));
assert.ok(JSON.stringify(bandRuleSchema).includes('minimum_historical_score'));
assert.ok(JSON.stringify(bandRuleSchema).includes('applysmart_derived'));

assert.ok(
  !classifierSource.includes('aberdeen') &&
  !classifierSource.includes('dundee') &&
  !classifierSource.includes('lancaster') &&
  !classifierSource.includes('sheffield'),
  'Historical conversion runtime must not introduce university-specific branches.'
);

console.log('UCAT historical conversion infrastructure: PASS');
