const PRACTICAL_SCIENCE_SUBJECT_IDS = new Set([
  'biology',
  'human_biology',
  'chemistry',
  'physics'
]);

function normaliseId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalisePracticalEndorsement(value) {
  if (value === true) {
    return 'pass';
  }
  if (value === false) {
    return 'fail';
  }

  const status = String(value ?? '').trim().toLowerCase();
  if (['pass', 'passed'].includes(status)) {
    return 'pass';
  }
  if (['fail', 'failed'].includes(status)) {
    return 'fail';
  }
  return null;
}

function normaliseALevelPracticalEndorsements(aLevelProfile) {
  if (!aLevelProfile || typeof aLevelProfile !== 'object') {
    return aLevelProfile;
  }

  const sharedSciencePracticalEndorsement = normalisePracticalEndorsement(
    aLevelProfile.science_practical_endorsement
  );
  const legacyPracticalPasses = aLevelProfile.practical_passes || {};
  const normalisedLegacyPracticalPasses = Object.fromEntries(
    Object.entries(legacyPracticalPasses).map(([subjectId, value]) => [
      normaliseId(subjectId),
      value
    ])
  );
  const subjects = Array.isArray(aLevelProfile.subjects)
    ? aLevelProfile.subjects.map((subject) => {
        const subjectId = normaliseId(subject?.subject_id);
        const hasCanonicalValue = Object.prototype.hasOwnProperty.call(
          subject || {},
          'practical_endorsement'
        );
        const canonicalValue = hasCanonicalValue
          ? normalisePracticalEndorsement(subject.practical_endorsement)
          : null;
        const hasLegacyValue = Object.prototype.hasOwnProperty.call(
          normalisedLegacyPracticalPasses,
          subjectId
        );
        const sourceValue = canonicalValue !== null
          ? canonicalValue
          : (
              PRACTICAL_SCIENCE_SUBJECT_IDS.has(subjectId) &&
              sharedSciencePracticalEndorsement !== null
            )
            ? sharedSciencePracticalEndorsement
            : !hasCanonicalValue && hasLegacyValue
              ? normalisedLegacyPracticalPasses[subjectId]
              : null;

        return {
          ...subject,
          practical_endorsement: normalisePracticalEndorsement(sourceValue)
        };
      })
    : aLevelProfile.subjects;
  const {
    practical_passes: _legacyPracticalPasses,
    science_practical_endorsement: _sharedSciencePracticalEndorsement,
    ...profile
  } = aLevelProfile;

  return {
    ...profile,
    subjects
  };
}

function getPracticalEndorsementRequirement(course, config = null) {
  const aLevelProfile = course?.stage_1_eligibility?.post_16?.a_level || {};
  const configRule = config?.eligibility?.a_level?.science_practical_endorsement;
  const profileRecordsRequirement =
    aLevelProfile.science_practical_endorsement_required === true ||
    aLevelProfile.science_practical_required === true ||
    (
      typeof aLevelProfile.science_practical_endorsement === 'string' &&
      aLevelProfile.science_practical_endorsement.trim() !== ''
    ) ||
    (
      typeof aLevelProfile.practical_requirement === 'string' &&
      aLevelProfile.practical_requirement.trim() !== ''
    );
  const configRecordsRequirement = configRule?.required === true;

  if (!profileRecordsRequirement && !configRecordsRequirement) {
    return {
      required: false,
      source: null,
      subject_ids: []
    };
  }

  const configuredSubjectIds = (configRule?.subject_ids || []).map(normaliseId);
  return {
    required: true,
    source: configRecordsRequirement ? 'config' : 'course_profile',
    subject_ids: configuredSubjectIds.length
      ? configuredSubjectIds
      : [...PRACTICAL_SCIENCE_SUBJECT_IDS]
  };
}

function assessPracticalEndorsements(course, config, applicant) {
  const requirement = getPracticalEndorsementRequirement(course, config);
  if (!requirement.required) {
    return {
      ...requirement,
      passed: true,
      applicable_subject_ids: [],
      unconfirmed_subject_ids: [],
      unknown_subject_ids: [],
      failed_subject_ids: []
    };
  }

  const requiredSubjectIds = new Set(requirement.subject_ids);
  const applicableSubjects = (applicant?.a_level_profile?.subjects || [])
    .filter((subject) => requiredSubjectIds.has(normaliseId(subject?.subject_id)));
  const failedSubjectIds = applicableSubjects
    .filter((subject) => {
      return normalisePracticalEndorsement(subject.practical_endorsement) === 'fail';
    })
    .map((subject) => normaliseId(subject.subject_id));
  const unknownSubjectIds = applicableSubjects
    .filter((subject) => {
      return normalisePracticalEndorsement(subject.practical_endorsement) === null;
    })
    .map((subject) => normaliseId(subject.subject_id));
  const unconfirmedSubjectIds = [...unknownSubjectIds, ...failedSubjectIds];

  return {
    ...requirement,
    passed: unconfirmedSubjectIds.length === 0,
    applicable_subject_ids: applicableSubjects.map((subject) => {
      return normaliseId(subject.subject_id);
    }),
    unconfirmed_subject_ids: unconfirmedSubjectIds,
    unknown_subject_ids: unknownSubjectIds,
    failed_subject_ids: failedSubjectIds
  };
}

module.exports = {
  PRACTICAL_SCIENCE_SUBJECT_IDS,
  assessPracticalEndorsements,
  getPracticalEndorsementRequirement,
  normaliseALevelPracticalEndorsements,
  normalisePracticalEndorsement
};
