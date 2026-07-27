function normaliseId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function isRestOfUkFeeStatus(value) {
  const feeStatus = normaliseId(value);
  return feeStatus === 'rest_of_uk' || feeStatus === 'rest_of_uk_roi_fee_rate';
}

function feeStatusApplicantGroupIds(value) {
  const feeStatus = normaliseId(value);
  const groups = [];

  if (isRestOfUkFeeStatus(feeStatus)) {
    groups.push('home_fee', 'rest_of_uk');
    return groups;
  }

  if (
    feeStatus === 'home' ||
    feeStatus === 'home_fee' ||
    feeStatus === 'ruk' ||
    feeStatus.includes('home')
  ) {
    groups.push('home_fee');
  }

  if (
    feeStatus === 'international' ||
    feeStatus === 'international_fee' ||
    feeStatus === 'overseas' ||
    feeStatus.includes('international') ||
    feeStatus.includes('overseas')
  ) {
    groups.push('international_fee');
  }

  return groups;
}

module.exports = {
  feeStatusApplicantGroupIds,
  isRestOfUkFeeStatus,
  normaliseId
};
