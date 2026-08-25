const BSMS_CONTEXTUAL_EVALUATOR_ID = 'bsms_contextual_medicine_a100';

const {
  feeStatusApplicantGroupIds
} = require('./applicant-group-normalisation');

const BSMS_ADJUSTED_OFFER_GROUP_ID = 'bsms_adjusted_offer_confirmed';
const BSMS_CARE_LEAVER_GROUP_ID = 'bsms_care_leaver_confirmed';

const REQUIRED_DISTINCT_SECTIONS = 3;

const UNRESOLVED_VALUES = new Set([
  '',
  null,
  undefined,
  'unknown',
  'not_sure',
  'prefer_not_to_say'
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function hasOwn(source, key) {
  return Boolean(
    source &&
    typeof source === 'object' &&
    Object.prototype.hasOwnProperty.call(source, key)
  );
}

function normalised(value, normaliseId) {
  return normaliseId ? normaliseId(value) : String(value ?? '').trim().toLowerCase();
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;

  return [
    'yes',
    'true',
    'confirmed',
    'eligible'
  ].includes(normalised(value, normaliseId));
}

function answerIsNo(value, normaliseId) {
  if (value === false) return true;

  return [
    'no',
    'false',
    'not_applicable',
    'not_eligible'
  ].includes(normalised(value, normaliseId));
}

function answerIsUnresolved(value, normaliseId) {
  if (UNRESOLVED_VALUES.has(value)) return true;

  return [
    'unknown',
    'not_sure',
    'prefer_not_to_say'
  ].includes(normalised(value, normaliseId));
}

function quintileIs(value, allowed, normaliseId) {
  const id = normalised(value, normaliseId);

  return allowed.some((quintile) => {
    return (
      Number(value) === quintile ||
      id === String(quintile) ||
      id === `q${quintile}` ||
      id === `quintile_${quintile}`
    );
  });
}

function check(
  criterionId,
  label,
  evidencePath,
  status,
  actual,
  details = {}
) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    status,
    actual,
    ...details
  };
}

function answerCheck({
  criterionId,
  label,
  evidencePath,
  actual,
  explicit,
  normaliseId
}) {
  if (answerIsYes(actual, normaliseId)) {
    return check(
      criterionId,
      label,
      evidencePath,
      'matched',
      actual
    );
  }

  if (answerIsNo(actual, normaliseId)) {
    return check(
      criterionId,
      label,
      evidencePath,
      'not_matched',
      actual
    );
  }

  if (explicit && answerIsUnresolved(actual, normaliseId)) {
    return check(
      criterionId,
      label,
      evidencePath,
      'information_needed',
      actual
    );
  }

  return check(
    criterionId,
    label,
    evidencePath,
    'not_matched',
    actual
  );
}

function sectionResult(sectionId, label, checks) {
  const matchedCriteria = checks.filter(
    (entry) => entry.status === 'matched'
  );

  const unresolvedCriteria = checks.filter(
    (entry) => entry.status === 'information_needed'
  );

  return {
    section_id: sectionId,
    label,
    status:
      matchedCriteria.length > 0
        ? 'matched'
        : unresolvedCriteria.length > 0
          ? 'information_needed'
          : 'not_matched',
    matched_criteria: matchedCriteria,
    unresolved_criteria: unresolvedCriteria,
    checks
  };
}

function evaluateGeographicalSection(evidence, normaliseId) {
  const postcode = asObject(evidence.postcode_measures);

  const checks = [
    check(
      'bsms_polar4_q1_q2',
      'POLAR4 quintile 1 or 2',
      'postcode_measures.polar4_quintile',
      quintileIs(postcode.polar4_quintile, [1, 2], normaliseId)
        ? 'matched'
        : hasOwn(postcode, 'polar4_quintile') &&
          answerIsUnresolved(postcode.polar4_quintile, normaliseId)
          ? 'information_needed'
          : 'not_matched',
      postcode.polar4_quintile
    ),

    check(
      'bsms_tundra_q1_q2',
      'TUNDRA quintile 1 or 2',
      'postcode_measures.tundra_quintile',
      quintileIs(postcode.tundra_quintile, [1, 2], normaliseId)
        ? 'matched'
        : hasOwn(postcode, 'tundra_quintile') &&
          answerIsUnresolved(postcode.tundra_quintile, normaliseId)
          ? 'information_needed'
          : 'not_matched',
      postcode.tundra_quintile
    ),

    check(
      'bsms_imd_lowest_20_percent',
      'IMD lowest 20%',
      'postcode_measures.imd_quintile',
      quintileIs(postcode.imd_quintile, [1], normaliseId)
        ? 'matched'
        : hasOwn(postcode, 'imd_quintile') &&
          answerIsUnresolved(postcode.imd_quintile, normaliseId)
          ? 'information_needed'
          : 'not_matched',
      postcode.imd_quintile,
      {
        threshold: 'imd_quintile_1'
      }
    )
  ];

  return sectionResult(
    'geographical',
    'Geographical',
    checks
  );
}

function evaluateEducationalSection(evidence, normaliseId) {
  const school = asObject(evidence.school_education);
  const personal = asObject(evidence.personal_circumstances);

  /*
   * BSMS 2027 educational section:
   *
   * - qualifying 11-16 school performance criterion
   * - parent/carer does not hold a UK university degree
   *
   * ApplySmart currently represents these using:
   *
   * school_education.below_average_gcse_school
   * personal_circumstances.first_in_family_at_university
   *
   * Do NOT add post-16 school performance or generic
   * low-progression fields to this BSMS section.
   */
  const checks = [
    answerCheck({
      criterionId: 'bsms_below_average_gcse_school',
      label: '11-16 school performance below the national average',
      evidencePath: 'school_education.below_average_gcse_school',
      actual: school.below_average_gcse_school,
      explicit: hasOwn(school, 'below_average_gcse_school'),
      normaliseId
    }),

    answerCheck({
      criterionId: 'bsms_first_generation_higher_education',
      label: 'First generation in immediate family to attend university',
      evidencePath: 'personal_circumstances.first_in_family_at_university',
      actual: personal.first_in_family_at_university,
      explicit: hasOwn(personal, 'first_in_family_at_university'),
      normaliseId
    })
  ];

  return sectionResult(
    'educational',
    'Educational',
    checks
  );
}

function evaluateHouseholdSection(evidence, normaliseId) {
  const financial = asObject(evidence.financial_support);

  const checks = [
    answerCheck({
      criterionId: 'bsms_means_tested_benefits',
      label: 'Means-tested benefits',
      evidencePath: 'financial_support.means_tested_benefits',
      actual: financial.means_tested_benefits,
      explicit: hasOwn(financial, 'means_tested_benefits'),
      normaliseId
    }),

    answerCheck({
      criterionId: 'bsms_free_school_meals',
      label: 'Free school meals',
      evidencePath: 'financial_support.free_school_meals',
      actual: financial.free_school_meals,
      explicit: hasOwn(financial, 'free_school_meals'),
      normaliseId
    }),

    answerCheck({
      criterionId: 'bsms_ucat_bursary',
      label: 'UCAT bursary',
      evidencePath: 'financial_support.ucat_bursary_recipient',
      actual: financial.ucat_bursary_recipient,
      explicit: hasOwn(financial, 'ucat_bursary_recipient'),
      normaliseId
    })
  ];

  return sectionResult(
    'household',
    'Household',
    checks
  );
}

function evaluateIndividualSection(evidence, normaliseId) {
  const financial = asObject(evidence.financial_support);
  const personal = asObject(evidence.personal_circumstances);

  const checks = [
    answerCheck({
      criterionId: 'bsms_ehcp',
      label: 'Education, Health and Care Plan',
      evidencePath: 'financial_support.ehcp',
      actual: financial.ehcp,
      explicit: hasOwn(financial, 'ehcp'),
      normaliseId
    }),

    answerCheck({
      criterionId: 'bsms_pip',
      label: 'Personal Independence Payment',
      evidencePath: 'financial_support.pip_recipient',
      actual: financial.pip_recipient,
      explicit: hasOwn(financial, 'pip_recipient'),
      normaliseId
    }),

    answerCheck({
      criterionId: 'bsms_young_carer',
      label: 'Young carer',
      evidencePath: 'personal_circumstances.young_or_adult_carer',
      actual: personal.young_or_adult_carer,
      explicit: hasOwn(personal, 'young_or_adult_carer'),
      normaliseId
    })
  ];

  return sectionResult(
    'individual',
    'Individual',
    checks
  );
}

function evaluateCareLeaverRoute(evidence, normaliseId) {
  const personal = asObject(evidence.personal_circumstances);
  const actual = personal.care_over_three_months;

  if (answerIsYes(actual, normaliseId)) {
    return {
      status: 'contextual',
      route_id: 'care_leaver',
      check: check(
        'bsms_care_over_three_months',
        'At least three months in local-authority care',
        'personal_circumstances.care_over_three_months',
        'matched',
        actual
      ),
      activated_applicant_group_ids: [
        'care_experienced',
        BSMS_CARE_LEAVER_GROUP_ID
      ]
    };
  }

  if (answerIsNo(actual, normaliseId)) {
    return {
      status: 'not_contextual',
      route_id: 'care_leaver',
      check: check(
        'bsms_care_over_three_months',
        'At least three months in local-authority care',
        'personal_circumstances.care_over_three_months',
        'not_matched',
        actual
      ),
      activated_applicant_group_ids: []
    };
  }

  if (
    hasOwn(personal, 'care_over_three_months') &&
    answerIsUnresolved(actual, normaliseId)
  ) {
    return {
      status: 'information_needed',
      route_id: 'care_leaver',
      check: check(
        'bsms_care_over_three_months',
        'At least three months in local-authority care',
        'personal_circumstances.care_over_three_months',
        'information_needed',
        actual
      ),
      activated_applicant_group_ids: []
    };
  }

  return {
    status: 'not_contextual',
    route_id: 'care_leaver',
    check: check(
      'bsms_care_over_three_months',
      'At least three months in local-authority care',
      'personal_circumstances.care_over_three_months',
      'not_matched',
      actual
    ),
    activated_applicant_group_ids: []
  };
}

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'bsms_contextual_criteria_not_met',
    is_contextual: false,
    ordinary_contextual: false,

    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,

    qualifying_criteria: [],
    missing_information: [],

    checks: {
      sections: [],
      care_leaver: []
    },

    contextual_evidence: {
      required_distinct_sections: REQUIRED_DISTINCT_SECTIONS,
      matched_section_count: 0,
      possible_section_count: 0,
      matched_sections: [],
      unresolved_sections: []
    },

    care_leaver_route: {
      status: 'not_contextual',
      route_id: 'care_leaver',
      activated_applicant_group_ids: []
    },

    activated_applicant_group_ids: []
  };
}

function evaluateBsmsContextualEligibility({
  applicant = {},
  evidence = {},
  helpers = {}
}) {
  const normaliseId =
    typeof helpers.normaliseId === 'function'
      ? helpers.normaliseId
      : (value) => String(value ?? '').trim().toLowerCase();
  const isHomeFeeApplicant =
    feeStatusApplicantGroupIds(
      normaliseId(applicant?.applicant_identity?.fee_status)
    ).includes('home_fee');

  const result = defaultResult();

  const sections = [
    evaluateGeographicalSection(evidence, normaliseId),
    evaluateEducationalSection(evidence, normaliseId),
    evaluateHouseholdSection(evidence, normaliseId),
    evaluateIndividualSection(evidence, normaliseId)
  ];

  const matchedSections = sections.filter(
    (section) => section.status === 'matched'
  );

  const unresolvedSections = sections.filter(
    (section) => section.status === 'information_needed'
  );

  const possibleSectionCount =
    matchedSections.length + unresolvedSections.length;

  const careLeaverRoute =
    evaluateCareLeaverRoute(evidence, normaliseId);

  result.checks.sections = sections;
  result.checks.care_leaver = [careLeaverRoute.check];

  result.care_leaver_route = careLeaverRoute;

  result.qualifying_criteria =
    sections.flatMap((section) => section.matched_criteria);

  result.contextual_evidence = {
    required_distinct_sections: REQUIRED_DISTINCT_SECTIONS,
    matched_section_count: matchedSections.length,
    possible_section_count: possibleSectionCount,
    matched_sections:
      matchedSections.map((section) => section.section_id),
    unresolved_sections:
      unresolvedSections.map((section) => section.section_id),
    section_rule:
      'Multiple qualifying indicators within one BSMS section count as one section.'
  };

  /*
   * Ordinary BSMS adjusted-offer route:
   * at least 3 DISTINCT matched sections.
   */
  if (
    isHomeFeeApplicant &&
    matchedSections.length >= REQUIRED_DISTINCT_SECTIONS
  ) {
    result.status = 'contextual';
    result.reason =
      'bsms_three_distinct_contextual_sections_met';

    result.is_contextual = true;
    result.ordinary_contextual = true;

    result.matched_contextual_pathway =
      'bsms_adjusted_offer';

    result.matched_contextual_pathway_label =
      'BSMS adjusted-offer route';

    result.activated_applicant_group_ids.push(
      BSMS_ADJUSTED_OFFER_GROUP_ID
    );
  } else if (
    isHomeFeeApplicant &&
    possibleSectionCount >= REQUIRED_DISTINCT_SECTIONS
  ) {
    /*
     * Unknown evidence matters only when it can still alter whether
     * the applicant reaches the three-section threshold.
     */
    result.status = 'information_needed';
    result.reason =
      'bsms_contextual_section_evidence_requires_confirmation';

    result.missing_information =
      unresolvedSections.flatMap(
        (section) => section.unresolved_criteria
      );
  }

  /*
   * Care-leaver route is independent of the ordinary
   * three-section adjusted-offer rule.
   */
  if (careLeaverRoute.status === 'contextual') {
    result.status = 'contextual';

    result.reason = result.ordinary_contextual
      ? 'bsms_care_leaver_and_adjusted_offer_routes_confirmed'
      : 'bsms_care_leaver_route_confirmed';

    result.is_contextual = true;

    result.matched_contextual_pathway =
      'bsms_care_leaver';

    result.matched_contextual_pathway_label =
      'BSMS care-leaver route';

    result.activated_applicant_group_ids.push(
      ...careLeaverRoute.activated_applicant_group_ids
    );
  } else if (
    careLeaverRoute.status === 'information_needed' &&
    result.status !== 'contextual'
  ) {
    result.status = 'information_needed';
    result.reason =
      'bsms_care_leaver_status_requires_confirmation';

    result.missing_information.push(
      careLeaverRoute.check
    );
  }

  result.activated_applicant_group_ids = [
    ...new Set(result.activated_applicant_group_ids)
  ];

  return result;
}

module.exports = {
  BSMS_CONTEXTUAL_EVALUATOR_ID,
  BSMS_ADJUSTED_OFFER_GROUP_ID,
  BSMS_CARE_LEAVER_GROUP_ID,
  evaluateBsmsContextualEligibility
};
