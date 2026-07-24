const fs = require('fs');
const path = require('path');

const DEFAULT_CONVERSION_PATH = path.resolve(__dirname, '../../../data/ucat-conversions.json');
const APPLYSMART_STANDARD_UCAT_CONVERSION_ID =
  'applysmart-standard-ucat-historical-conversion';
const HISTORICAL_UCAT_SCALE_ID = 'historical_3600';
const CURRENT_UCAT_SCALE_ID = 'current_2700';
const APPLYSMART_DERIVED_STATUS = 'applysmart_derived';
const OFFICIAL_HISTORICAL_STATUS = 'official_historical_evidence';

function loadUcatConversionReference(filePath = DEFAULT_CONVERSION_PATH) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normaliseScaleId(value) {
  if (value === 3600 || value === '3600' || value === '/3600') {
    return HISTORICAL_UCAT_SCALE_ID;
  }
  if (value === 2700 || value === '2700' || value === '/2700') {
    return CURRENT_UCAT_SCALE_ID;
  }
  return String(value ?? '').trim();
}

function parseFiniteScore(value, fieldName = 'historical_score') {
  if (value === undefined) {
    throw new TypeError(`${fieldName} is required.`);
  }
  if (value === null) {
    throw new TypeError(`${fieldName} must not be null.`);
  }
  if (typeof value === 'string' && value.trim() === '') {
    throw new TypeError(`${fieldName} must not be empty.`);
  }
  if (typeof value === 'boolean') {
    throw new TypeError(`${fieldName} must be numeric.`);
  }

  const score = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(score)) {
    throw new TypeError(`${fieldName} must be a finite numeric score.`);
  }

  return score;
}

function assertActiveReference(reference, expectedReferenceId) {
  if (!expectedReferenceId) {
    throw new Error('conversion_reference is required for historical UCAT conversion.');
  }
  if (!reference || typeof reference !== 'object') {
    throw new Error('UCAT conversion reference is unavailable.');
  }
  if (reference.id !== expectedReferenceId) {
    throw new Error(`Unknown UCAT conversion reference "${expectedReferenceId}".`);
  }
  if (reference.status !== 'active') {
    throw new Error(`UCAT conversion reference "${reference.id}" is not active.`);
  }
}

function assertSupportedDirection(reference, sourceScale, targetScale) {
  const sourceScaleId = normaliseScaleId(sourceScale);
  const targetScaleId = normaliseScaleId(targetScale);

  if (sourceScaleId !== reference.source_scale?.id) {
    throw new Error(`Unsupported UCAT conversion source scale "${sourceScale}".`);
  }
  if (targetScaleId !== reference.target_scale?.id) {
    throw new Error(`Unsupported UCAT conversion target scale "${targetScale}".`);
  }
}

function roundConvertedScore(value, roundingRule) {
  if (roundingRule !== 'nearest_integer') {
    throw new Error(`Unsupported UCAT conversion rounding rule "${roundingRule}".`);
  }
  return Math.round(value);
}

function convertHistoricalUcatScore(rawScore, options = {}) {
  const reference =
    options.reference ||
    loadUcatConversionReference(options.referencePath || DEFAULT_CONVERSION_PATH);
  const referenceId = options.conversionReference || options.conversion_reference;
  const sourceScale = options.sourceScale || options.source_scale || HISTORICAL_UCAT_SCALE_ID;
  const targetScale = options.targetScale || options.target_scale || CURRENT_UCAT_SCALE_ID;

  assertActiveReference(reference, referenceId);
  assertSupportedDirection(reference, sourceScale, targetScale);

  const score = parseFiniteScore(rawScore);
  const minimumScore =
    reference.valid_historical_input_range?.minimum_score ??
    reference.source_scale?.minimum_score;
  const maximumScore =
    reference.valid_historical_input_range?.maximum_score ??
    reference.source_scale?.maximum_score;

  if (score < 0) {
    throw new RangeError('historical_score must not be negative.');
  }
  if (Number.isFinite(minimumScore) && score < minimumScore) {
    throw new RangeError(`historical_score must be at least ${minimumScore}.`);
  }
  if (Number.isFinite(maximumScore) && score > maximumScore) {
    throw new RangeError(`historical_score must be no greater than ${maximumScore}.`);
  }

  const converted = roundConvertedScore(
    score * reference.conversion.factor,
    reference.conversion.rounding
  );

  return {
    original_score: score,
    original_scale: reference.source_scale.maximum_score,
    original_scale_id: reference.source_scale.id,
    converted_score: converted,
    converted_scale: reference.target_scale.maximum_score,
    converted_scale_id: reference.target_scale.id,
    conversion_reference: reference.id,
    conversion_method: reference.conversion.method_id,
    conversion_status: APPLYSMART_DERIVED_STATUS,
    score_origin: OFFICIAL_HISTORICAL_STATUS,
    formula: reference.conversion.formula,
    factor: reference.conversion.factor,
    rounding: reference.conversion.rounding,
    disclaimer: reference.disclaimer
  };
}

function hasOwn(object, field) {
  return Object.prototype.hasOwnProperty.call(object || {}, field);
}

function historicalBoundaryFieldsForRule(rule) {
  if (rule.operator === 'between_inclusive') {
    return {
      historicalFields: ['minimum_historical_score', 'maximum_historical_score'],
      nativeFields: ['min', 'max'],
      derivedFields: ['minimum_derived_score_2700', 'maximum_derived_score_2700']
    };
  }

  return {
    historicalFields: ['historical_score'],
    nativeFields: ['value'],
    derivedFields: ['derived_score_2700']
  };
}

function buildBoundaryTransparency(rule, conversions, reference) {
  const isRange = rule.operator === 'between_inclusive';

  if (isRange) {
    return {
      historical_boundary: {
        minimum_score: conversions.minimum.original_score,
        maximum_score: conversions.maximum.original_score,
        scale: conversions.minimum.original_scale,
        scale_id: conversions.minimum.original_scale_id,
        status: OFFICIAL_HISTORICAL_STATUS
      },
      converted_boundary: {
        minimum_score: conversions.minimum.converted_score,
        maximum_score: conversions.maximum.converted_score,
        scale: conversions.minimum.converted_scale,
        scale_id: conversions.minimum.converted_scale_id,
        status: APPLYSMART_DERIVED_STATUS,
        conversion_reference: conversions.minimum.conversion_reference,
        conversion_method: conversions.minimum.conversion_method
      },
      conversion_disclaimer: reference.disclaimer
    };
  }

  return {
    historical_boundary: {
      value: conversions.value.original_score,
      scale: conversions.value.original_scale,
      scale_id: conversions.value.original_scale_id,
      status: OFFICIAL_HISTORICAL_STATUS
    },
    converted_boundary: {
      value: conversions.value.converted_score,
      scale: conversions.value.converted_scale,
      scale_id: conversions.value.converted_scale_id,
      status: APPLYSMART_DERIVED_STATUS,
      conversion_reference: conversions.value.conversion_reference,
      conversion_method: conversions.value.conversion_method
    },
    conversion_disclaimer: reference.disclaimer
  };
}

function resolveBandRuleForComparison(rule, options = {}) {
  const scoreScale = rule?.score_scale;

  if (scoreScale === undefined || normaliseScaleId(scoreScale) === CURRENT_UCAT_SCALE_ID) {
    if (rule?.conversion_reference) {
      throw new Error('conversion_reference requires score_scale "historical_3600".');
    }
    return {
      rule,
      comparison_rule: rule,
      conversion: null
    };
  }

  if (normaliseScaleId(scoreScale) !== HISTORICAL_UCAT_SCALE_ID) {
    throw new Error(`Unsupported band-rule score_scale "${scoreScale}".`);
  }

  const reference =
    options.reference ||
    loadUcatConversionReference(options.referencePath || DEFAULT_CONVERSION_PATH);
  const fields = historicalBoundaryFieldsForRule(rule);
  const hasNativeField = fields.nativeFields.some((field) => hasOwn(rule, field));
  if (hasNativeField) {
    throw new Error('Historical UCAT band rules must not mix native current-scale fields.');
  }

  const convertOptions = {
    reference,
    conversionReference: rule.conversion_reference,
    sourceScale: HISTORICAL_UCAT_SCALE_ID,
    targetScale: CURRENT_UCAT_SCALE_ID
  };
  const comparisonRule = { ...rule };
  let conversions;

  if (rule.operator === 'between_inclusive') {
    conversions = {
      minimum: convertHistoricalUcatScore(rule.minimum_historical_score, convertOptions),
      maximum: convertHistoricalUcatScore(rule.maximum_historical_score, convertOptions)
    };
    if (conversions.minimum.original_score > conversions.maximum.original_score) {
      throw new RangeError('minimum_historical_score must not exceed maximum_historical_score.');
    }
    comparisonRule.min = conversions.minimum.converted_score;
    comparisonRule.max = conversions.maximum.converted_score;
    if (hasOwn(rule, 'minimum_derived_score_2700') &&
      rule.minimum_derived_score_2700 !== conversions.minimum.converted_score) {
      throw new Error('minimum_derived_score_2700 does not match the shared UCAT conversion.');
    }
    if (hasOwn(rule, 'maximum_derived_score_2700') &&
      rule.maximum_derived_score_2700 !== conversions.maximum.converted_score) {
      throw new Error('maximum_derived_score_2700 does not match the shared UCAT conversion.');
    }
  } else {
    conversions = {
      value: convertHistoricalUcatScore(rule.historical_score, convertOptions)
    };
    comparisonRule.value = conversions.value.converted_score;
    if (hasOwn(rule, 'derived_score_2700') &&
      rule.derived_score_2700 !== conversions.value.converted_score) {
      throw new Error('derived_score_2700 does not match the shared UCAT conversion.');
    }
  }

  if (fields.derivedFields.some((field) => hasOwn(rule, field)) &&
    rule.derived_score_status !== APPLYSMART_DERIVED_STATUS) {
    throw new Error('Stored derived UCAT values must use derived_score_status "applysmart_derived".');
  }

  return {
    rule,
    comparison_rule: comparisonRule,
    conversion: buildBoundaryTransparency(rule, conversions, reference)
  };
}

function validateHistoricalUcatBandRules(config, options = {}) {
  const reference =
    options.reference ||
    loadUcatConversionReference(options.referencePath || DEFAULT_CONVERSION_PATH);
  const failures = [];

  for (const [poolIndex, pool] of (config.guidance_pools || []).entries()) {
    const convertedRanges = [];

    for (const [ruleIndex, rule] of (pool.band_rules || []).entries()) {
      const pathLabel = `guidance_pools[${poolIndex}].band_rules[${ruleIndex}]`;
      const scale = normaliseScaleId(rule.score_scale);
      const hasHistoricalFields = [
        'historical_score',
        'minimum_historical_score',
        'maximum_historical_score'
      ].some((field) => hasOwn(rule, field));
      const hasConversionField = hasOwn(rule, 'conversion_reference');
      const hasDerivedField = [
        'derived_score_2700',
        'minimum_derived_score_2700',
        'maximum_derived_score_2700'
      ].some((field) => hasOwn(rule, field));

      if (scale !== HISTORICAL_UCAT_SCALE_ID) {
        if (hasHistoricalFields || hasConversionField || hasDerivedField) {
          failures.push(`${pathLabel}:conversion_fields_require_historical_3600_scale`);
        }
        continue;
      }

      try {
        if (!hasConversionField) {
          failures.push(`${pathLabel}:missing_conversion_reference`);
        }

        const resolved = resolveBandRuleForComparison(rule, { reference });
        const comparisonRule = resolved.comparison_rule;

        if (rule.operator === 'between_inclusive') {
          if (comparisonRule.min > comparisonRule.max) {
            failures.push(`${pathLabel}:minimum_score_greater_than_maximum_score`);
          }
          convertedRanges.push({
            pathLabel,
            historicalMin: rule.minimum_historical_score,
            historicalMax: rule.maximum_historical_score,
            convertedMin: comparisonRule.min,
            convertedMax: comparisonRule.max
          });
        }
      } catch (error) {
        const message = String(error.message || error);
        if (message.includes('conversion_reference is required')) {
          failures.push(`${pathLabel}:missing_conversion_reference`);
        } else if (message.includes('must not be null')) {
          failures.push(`${pathLabel}:null_historical_score`);
        } else if (message.includes('is required')) {
          failures.push(`${pathLabel}:missing_historical_score`);
        } else if (message.includes('must not be empty')) {
          failures.push(`${pathLabel}:empty_historical_score`);
        } else if (message.includes('finite numeric')) {
          failures.push(`${pathLabel}:non_numeric_historical_score`);
        } else if (message.includes('must not be negative')) {
          failures.push(`${pathLabel}:negative_historical_score`);
        } else if (message.includes('at least')) {
          failures.push(`${pathLabel}:historical_score_below_supported_minimum`);
        } else if (message.includes('no greater than')) {
          failures.push(`${pathLabel}:historical_score_above_supported_maximum`);
        } else if (message.includes('Unknown UCAT conversion reference')) {
          failures.push(`${pathLabel}:unknown_conversion_reference`);
        } else if (message.includes('not active')) {
          failures.push(`${pathLabel}:inactive_conversion_reference`);
        } else if (message.includes('source scale')) {
          failures.push(`${pathLabel}:invalid_source_scale`);
        } else if (message.includes('target scale')) {
          failures.push(`${pathLabel}:invalid_target_scale`);
        } else if (message.includes('must not mix')) {
          failures.push(`${pathLabel}:mixed_historical_and_native_score_fields`);
        } else if (message.includes('does not match')) {
          failures.push(`${pathLabel}:stored_derived_score_mismatch`);
        } else if (message.includes('derived_score_status')) {
          failures.push(`${pathLabel}:stored_derived_score_status_invalid`);
        } else if (message.includes('minimum_historical_score')) {
          failures.push(`${pathLabel}:minimum_score_greater_than_maximum_score`);
        } else {
          failures.push(`${pathLabel}:invalid_historical_ucat_conversion_rule`);
        }
      }
    }

    convertedRanges
      .sort((a, b) => a.convertedMin - b.convertedMin)
      .forEach((range, index, ranges) => {
        if (index === 0) {
          return;
        }
        const previous = ranges[index - 1];
        if (previous.convertedMax >= range.convertedMin) {
          failures.push(`${range.pathLabel}:converted_range_overlap`);
          failures.push(`${range.pathLabel}:historical_conversion_rounding_ambiguity`);
        }
        if (
          Number(previous.historicalMax) + 1 >= Number(range.historicalMin) &&
          previous.convertedMax + 1 < range.convertedMin
        ) {
          failures.push(`${range.pathLabel}:converted_range_gap`);
        }
      });
  }

  return failures;
}

module.exports = {
  APPLYSMART_DERIVED_STATUS,
  APPLYSMART_STANDARD_UCAT_CONVERSION_ID,
  CURRENT_UCAT_SCALE_ID,
  HISTORICAL_UCAT_SCALE_ID,
  OFFICIAL_HISTORICAL_STATUS,
  convertHistoricalUcatScore,
  loadUcatConversionReference,
  normaliseScaleId,
  resolveBandRuleForComparison,
  validateHistoricalUcatBandRules
};
