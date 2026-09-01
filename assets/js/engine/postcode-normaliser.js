const MAX_POSTCODE_LOOKUP_INPUT_LENGTH = 32;

function normalisePostcodeForLookup(value) {
  if (typeof value !== 'string') {
    return null;
  }

  if (value.length > MAX_POSTCODE_LOOKUP_INPUT_LENGTH) {
    return null;
  }

  const normalised = value.trim().toUpperCase().replace(/\s+/g, '');
  if (!normalised) {
    return null;
  }

  if (normalised.length > MAX_POSTCODE_LOOKUP_INPUT_LENGTH) {
    return null;
  }

  if (!/^[A-Z0-9]+$/.test(normalised)) {
    return null;
  }

  return normalised;
}

module.exports = {
  MAX_POSTCODE_LOOKUP_INPUT_LENGTH,
  normalisePostcodeForLookup
};
