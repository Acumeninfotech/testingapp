const {
  normaliseContextualProfile
} = require('./applicant-profile-normaliser');
const {
  normaliseId
} = require('./applicant-group-normalisation');

const DEFAULT_UNSUPPORTED_REASON = 'unsupported_contextual_policy';
const ABERDEEN_CONTEXTUAL_EVALUATOR_ID = 'aberdeen_contextual_medicine_a100';
const ASTON_READY_EVALUATOR_ID = 'aston_ready_medicine_a100';
const BIRMINGHAM_CONTEXTUAL_EVALUATOR_ID = 'birmingham_contextual_medicine_a100';
const DUNDEE_CONTEXTUAL_EVALUATOR_ID = 'dundee_contextual_medicine_a100';
const EDINBURGH_CONTEXTUAL_EVALUATOR_ID = 'edinburgh_contextual_medicine_a100';
const GLASGOW_CONTEXTUAL_EVALUATOR_ID = 'glasgow_contextual_medicine_a100';
const ST_ANDREWS_CONTEXTUAL_EVALUATOR_ID = 'st_andrews_contextual_medicine_a100';
const PLYMOUTH_CONTEXTUAL_EVALUATOR_ID = 'plymouth_contextual_medicine_a100';
const SOUTHAMPTON_CONTEXTUAL_EVALUATOR_ID = 'southampton_contextual_medicine_a100';
const UCL_CONTEXTUAL_EVALUATOR_ID = 'ucl_contextual_medicine_a100';
const HYMS_CONTEXTUAL_EVALUATOR_ID = 'hyms_contextual_medicine_a100';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function valueAtPath(source, path) {
  if (!path) return undefined;
  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      return current[key];
    }, source);
}

function booleanFromTriState(value) {
  if (value === true || value === false) return value;
  const normalised = normaliseId(value);
  if (['yes', 'true', 'confirmed', 'completed'].includes(normalised)) {
    return true;
  }
  if (['no', 'false'].includes(normalised)) {
    return false;
  }
  return null;
}

function collectLegacyDeclarations(applicant = {}) {
  const identity = asObject(applicant.applicant_identity);
  const contextualFlags = asObject(identity.contextual_flags);
  const confirmedFlags = Object.entries(contextualFlags)
    .filter(([, value]) => value === true)
    .map(([flagId]) => normaliseId(flagId))
    .filter(Boolean);

  return {
    contextual: identity.contextual === true,
    widening_participation: identity.widening_participation === true,
    contextual_status_confirmed: identity.contextual_status_confirmed === true,
    contextual_flags: contextualFlags,
    confirmed_flag_ids: confirmedFlags
  };
}

function collectContextualEvidence(applicant = {}, options = {}) {
  const contextualProfile = normaliseContextualProfile(applicant, options);
  const home = contextualProfile.home_area_region;
  const access = contextualProfile.access_programmes;
  const partnerSchools = contextualProfile.partner_schools;

  return {
    profile: contextualProfile,
    postcode_measures: {
      polar4_quintile: home.polar4_quintile,
      imd_quintile: home.imd_quintile,
      tundra_quintile: home.tundra_quintile,
      simd_quintile: home.simd_quintile,
      acorn_quintile: home.acorn_quintile ?? null,
      mem_quintile: home.mem_quintile ?? null,
      lookup: home.postcode_lookup
    },
    home_area_region: {
      home_region: home.home_region,
      specific_home_area: home.specific_home_area,
      school_area: home.school_area,
      regional_flags: home.regional_flags
    },
    financial_support: contextualProfile.financial_support,
    school_education: contextualProfile.school_education,
    personal_circumstances: contextualProfile.personal_circumstances,
    access_programmes: {
      participation_status: access.participation_status,
      ukwpmed: access.ukwpmed,
      other_programmes: access.other_programmes,
      other_programme_name: access.other_programme_name
    },
    partner_schools: {
      status: partnerSchools.status,
      relationships: partnerSchools.relationships
    },
    legacy_declarations: collectLegacyDeclarations(applicant)
  };
}

function defaultContextualEligibilityResult(course, applicant, reason = DEFAULT_UNSUPPORTED_REASON) {
  return {
    status: 'not_evaluated',
    reason,
    is_contextual: false,
    evaluator_id: null,
    course_profile_id: course?.profile_id || null,
    applicant_profile_id: applicant?.profile_id || null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    unsupported_policy: reason === DEFAULT_UNSUPPORTED_REASON,
    evidence: collectContextualEvidence(applicant),
    activated_applicant_group_ids: []
  };
}

function criterionEvidencePath(criterion = {}) {
  return criterion.evidence_path || criterion.path || criterion.field || null;
}

function criterionId(criterion = {}, fallback = 'criterion') {
  return criterion.criterion_id || criterion.id || criterionEvidencePath(criterion) || fallback;
}

function compareCriterionValue(actual, criterion = {}) {
  if (criterion.exists === true) {
    return actual !== undefined && actual !== null && actual !== '';
  }
  if (Object.prototype.hasOwnProperty.call(criterion, 'equals')) {
    return actual === criterion.equals;
  }
  if (Object.prototype.hasOwnProperty.call(criterion, 'not_equals')) {
    return actual !== criterion.not_equals;
  }
  if (Array.isArray(criterion.in)) {
    return criterion.in.includes(actual);
  }
  if (Array.isArray(criterion.one_of)) {
    return criterion.one_of.includes(actual);
  }
  if (Array.isArray(criterion.includes)) {
    return Array.isArray(actual) &&
      criterion.includes.every((entry) => actual.includes(entry));
  }
  if (Object.prototype.hasOwnProperty.call(criterion, 'truthy')) {
    return Boolean(actual) === Boolean(criterion.truthy);
  }
  if (Object.prototype.hasOwnProperty.call(criterion, 'tri_state_yes')) {
    return booleanFromTriState(actual) === Boolean(criterion.tri_state_yes);
  }
  if (Number.isFinite(criterion.minimum)) {
    return Number(actual) >= criterion.minimum;
  }
  if (Number.isFinite(criterion.maximum)) {
    return Number(actual) <= criterion.maximum;
  }
  return booleanFromTriState(actual) === true || actual === true;
}

function evaluateCriterion(criterion = {}, evidence = {}) {
  const path = criterionEvidencePath(criterion);
  const actual = path ? valueAtPath(evidence, path) : undefined;
  const passed = compareCriterionValue(actual, criterion);
  const required = criterion.required === true;
  const unknownValues = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);
  const missing = required && unknownValues.has(actual);

  return {
    criterion_id: criterionId(criterion),
    evidence_path: path,
    passed,
    missing,
    actual,
    expected: {
      equals: criterion.equals,
      not_equals: criterion.not_equals,
      in: criterion.in || criterion.one_of,
      includes: criterion.includes,
      truthy: criterion.truthy,
      tri_state_yes: criterion.tri_state_yes,
      minimum: criterion.minimum,
      maximum: criterion.maximum,
      exists: criterion.exists
    }
  };
}

function evaluateCriteria(criteria = {}, evidence = {}) {
  const allOf = asArray(criteria.all_of).map((criterion) => {
    return evaluateCriterion(criterion, evidence);
  });
  const anyOf = asArray(criteria.any_of).map((criterion) => {
    return evaluateCriterion(criterion, evidence);
  });
  const exclusions = asArray(criteria.exclusions || criteria.excluded_if).map((criterion) => {
    return evaluateCriterion(criterion, evidence);
  });

  const allPassed = allOf.every((result) => result.passed);
  const anyPassed = anyOf.length === 0 || anyOf.some((result) => result.passed);
  const exclusionMatched = exclusions.some((result) => result.passed);
  const missingInformation = [...allOf, ...anyOf]
    .filter((result) => result.missing)
    .map((result) => result.criterion_id);
  const qualifyingCriteria = [...allOf, ...anyOf]
    .filter((result) => result.passed)
    .map((result) => result.criterion_id);

  return {
    passed: allPassed && anyPassed && !exclusionMatched && missingInformation.length === 0,
    excluded: exclusionMatched,
    qualifying_criteria: qualifyingCriteria,
    missing_information: missingInformation,
    checks: {
      all_of: allOf,
      any_of: anyOf,
      exclusions
    }
  };
}

function evaluatorIdForCourse(course = {}) {
  return (
    course.contextual_eligibility?.evaluator_id ||
    course.contextual_admissions?.contextual_eligibility?.evaluator_id ||
    course.contextual_admissions?.evaluator_id ||
    null
  );
}

function criteriaForCourse(course = {}) {
  return (
    course.contextual_eligibility?.criteria ||
    course.contextual_admissions?.contextual_eligibility?.criteria ||
    {}
  );
}

function contextualEvidenceOptionsForCourse(course = {}, evaluatorId = null, options = {}) {
  const evidenceOptions = {
    ...asObject(options.evidenceOptions)
  };

  if (
    course.profile_id === 'aberdeen-a100' ||
    evaluatorId === ABERDEEN_CONTEXTUAL_EVALUATOR_ID ||
    course.profile_id === 'aston-a100' ||
    evaluatorId === ASTON_READY_EVALUATOR_ID ||
    course.profile_id === 'birmingham-a100' ||
    evaluatorId === BIRMINGHAM_CONTEXTUAL_EVALUATOR_ID ||
    course.profile_id === 'dundee-a100' ||
    evaluatorId === DUNDEE_CONTEXTUAL_EVALUATOR_ID ||
    course.profile_id === 'edinburgh-a100' ||
    evaluatorId === EDINBURGH_CONTEXTUAL_EVALUATOR_ID ||
    course.profile_id === 'glasgow-a100' ||
    evaluatorId === GLASGOW_CONTEXTUAL_EVALUATOR_ID ||
    course.profile_id === 'plymouth-a100' ||
    evaluatorId === PLYMOUTH_CONTEXTUAL_EVALUATOR_ID ||
    course.profile_id === 'southampton-a100' ||
    evaluatorId === SOUTHAMPTON_CONTEXTUAL_EVALUATOR_ID ||
    course.profile_id === 'ucl-a100' ||
    evaluatorId === UCL_CONTEXTUAL_EVALUATOR_ID ||
    course.profile_id === 'hull-york-a100' ||
    evaluatorId === HYMS_CONTEXTUAL_EVALUATOR_ID ||
    course.profile_id === 'st-andrews-a100' ||
    evaluatorId === ST_ANDREWS_CONTEXTUAL_EVALUATOR_ID
  ) {
    evidenceOptions.projectLegacyContextualCriteriaFlags = false;
    evidenceOptions.projectLegacyAccessProgrammes = false;
  }

  return evidenceOptions;
}

function evaluateContextualEligibility(course, applicant, options = {}) {
  if (!course || !applicant) {
    throw new TypeError('course and applicant are required.');
  }

  const evaluatorId = evaluatorIdForCourse(course);
  if (!evaluatorId) {
    return defaultContextualEligibilityResult(course, applicant);
  }

  const evaluators = asObject(options.evaluators);
  const evaluator = evaluators[evaluatorId];
  if (typeof evaluator !== 'function') {
    return {
      ...defaultContextualEligibilityResult(course, applicant, 'contextual_evaluator_not_registered'),
      evaluator_id: evaluatorId
    };
  }

  const evidenceOptions = contextualEvidenceOptionsForCourse(course, evaluatorId, options);
  const evidence = collectContextualEvidence(applicant, evidenceOptions);
  const helpers = {
    collectContextualEvidence: (candidate = applicant, helperOptions = {}) =>
      collectContextualEvidence(candidate, {
        ...evidenceOptions,
        ...helperOptions
      }),
    evaluateCriteria,
    evaluateCriterion,
    normaliseId,
    valueAtPath
  };
  const result = evaluator({
    course,
    applicant,
    evidence,
    criteria: criteriaForCourse(course),
    helpers
  }) || {};

  const isContextual = result.is_contextual === true || result.status === 'contextual';

  return {
    ...defaultContextualEligibilityResult(course, applicant, 'evaluated'),
    ...result,
    status: result.status || (isContextual ? 'contextual' : 'not_contextual'),
    is_contextual: isContextual,
    evaluator_id: evaluatorId,
    evidence,
    unsupported_policy: false,
    activated_applicant_group_ids: Array.isArray(result.activated_applicant_group_ids)
      ? result.activated_applicant_group_ids
      : isContextual
        ? ['contextual']
        : []
  };
}

module.exports = {
  collectContextualEvidence,
  defaultContextualEligibilityResult,
  evaluateContextualEligibility,
  evaluateCriteria,
  evaluateCriterion,
  valueAtPath
};
