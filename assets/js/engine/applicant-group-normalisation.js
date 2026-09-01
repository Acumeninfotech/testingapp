function normaliseId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function isRestOfUkFeeStatus(value) {
  const feeStatus = normaliseId(value);
  return feeStatus === 'ruk' ||
    feeStatus === 'rest_of_uk' ||
    feeStatus === 'rest_of_uk_roi_fee_rate';
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

const CONTEXTUAL_FLAG_GROUP_ALIASES = {
  asylum_seeker: ['refugee_or_asylum_seeker'],
  refugee: ['refugee_or_asylum_seeker'],
  refugee_or_asylum_seeker: ['refugee', 'asylum_seeker']
};

function contextualFlagApplicantGroupIds(flags = {}) {
  const groups = new Set();

  for (const [flagId, value] of Object.entries(flags || {})) {
    if (value !== true) {
      continue;
    }

    const groupId = normaliseId(flagId);
    if (!groupId) {
      continue;
    }
    groups.add(groupId);

    for (const alias of CONTEXTUAL_FLAG_GROUP_ALIASES[groupId] || []) {
      groups.add(alias);
    }
  }

  return [...groups];
}

module.exports = {
  contextualFlagApplicantGroupIds,
  feeStatusApplicantGroupIds,
  isRestOfUkFeeStatus,
  normaliseId
};
