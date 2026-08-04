const fs = require('fs');
const path = require('path');
const {
  normalisePostcodeForLookup
} = require('../../assets/js/engine/postcode-normaliser');

const DEFAULT_LOOKUP_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'data',
  'contextual',
  'postcode-contextual-lookup.json'
);

let cachedLookup = null;
let cachedLookupPath = null;

class ContextualPostcodeLookupError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'ContextualPostcodeLookupError';
    this.statusCode = statusCode;
  }
}

function lookupPath() {
  return process.env.CONTEXTUAL_POSTCODE_LOOKUP_PATH || DEFAULT_LOOKUP_PATH;
}

function loadLookupDataset(filePath = lookupPath()) {
  if (cachedLookup && cachedLookupPath === filePath) {
    return cachedLookup;
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw new ContextualPostcodeLookupError('Postcode lookup dataset is unavailable');
  }

  if (
    !parsed ||
    parsed.schema_version !== 1 ||
    !parsed.postcodes ||
    typeof parsed.postcodes !== 'object'
  ) {
    throw new ContextualPostcodeLookupError('Postcode lookup dataset is invalid');
  }

  cachedLookup = parsed;
  cachedLookupPath = filePath;
  return cachedLookup;
}

function warningFor(label) {
  return `${label} data is unavailable for this postcode.`;
}

function resultFromRow(inputPostcode, normalisedPostcode, row) {
  const polar4 = row?.[1] ?? null;
  const tundra = row?.[2] ?? null;
  const imd = row?.[3] ?? null;
  const availability = {
    polar4: polar4 !== null,
    tundra: tundra !== null,
    imd: imd !== null
  };
  const warnings = [];
  if (row) {
    if (!availability.polar4) warnings.push(warningFor('POLAR4'));
    if (!availability.tundra) warnings.push(warningFor('TUNDRA'));
    if (!availability.imd) warnings.push(warningFor('IMD 2019'));
  }

  return {
    matched: Boolean(row),
    postcode: row?.[0] || inputPostcode.trim(),
    normalised_postcode: normalisedPostcode,
    polar4_quintile: polar4,
    tundra_quintile: tundra,
    imd_quintile: imd,
    availability,
    ...(warnings.length > 0 ? { warnings } : {})
  };
}

function lookupContextualPostcode(postcode) {
  const normalisedPostcode = normalisePostcodeForLookup(postcode);
  if (!normalisedPostcode) {
    throw new ContextualPostcodeLookupError('Enter a valid postcode to check.', 400);
  }

  const dataset = loadLookupDataset();
  const row = dataset.postcodes[normalisedPostcode];
  return resultFromRow(postcode, normalisedPostcode, row);
}

function resetContextualPostcodeLookupCache() {
  cachedLookup = null;
  cachedLookupPath = null;
}

module.exports = {
  ContextualPostcodeLookupError,
  loadLookupDataset,
  lookupContextualPostcode,
  normalisePostcodeForLookup,
  resetContextualPostcodeLookupCache
};
