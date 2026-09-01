const DUNDEE_CONTEXTUAL_EVALUATOR_ID = 'dundee_contextual_medicine_a100';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  return ['yes', 'true', 'confirmed', 'completed'].includes(normaliseId(value));
}

function answerIsUnresolved(value, normaliseId) {
  return ['not_sure', 'unsure', 'unknown', 'prefer_not_to_say'].includes(normaliseId(value));
}

function normaliseQuintile(value, normaliseId) {
  const normalised = normaliseId(value);
  if (!normalised) return null;
  const match = normalised.match(/(?:q|quintile|simd)?_?([1-5])$/);
  return match ? `q${match[1]}` : normalised;
}

function check(criterionId, label, evidencePath, status, actual = undefined) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    status,
    actual
  };
}

function isHomeScottishOrRukApplicant(identity, normaliseId) {
  const feeStatus = normaliseId(identity.fee_status);
  const domicile = normaliseId(identity.domicile);
  const homeFee =
    feeStatus === 'home' ||
    feeStatus === 'home_fee' ||
    feeStatus === 'ruk' ||
    feeStatus === 'rest_of_uk' ||
    feeStatus.includes('home');
  const ukDomicile = [
    'scotland',
    'scottish',
    'scotland_domiciled',
    'england',
    'wales',
    'northern_ireland',
    'rest_of_uk',
    'ruk'
  ].includes(domicile);
  return homeFee && ukDomicile;
}

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'dundee_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    contextual_category: 'non_contextual',
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      category_1: [],
      category_2: [],
      manual_review_criteria: []
    },
    activated_applicant_group_ids: []
  };
}

function contextualOutcome(result, category, matchedChecks, extra = {}) {
  const primary = matchedChecks[0] || null;
  return {
    ...result,
    status: 'contextual',
    reason: category === 'category_1'
      ? 'dundee_category_1_contextual_confirmed'
      : 'dundee_category_2_contextual_confirmed',
    is_contextual: true,
    matched_contextual_pathway: primary?.criterion_id || category,
    matched_contextual_pathway_label:
      'You meet Dundee’s contextual admissions criteria',
    contextual_category: category,
    contextual_category_source: 'applysmart_derived_from_published_dundee_evidence',
    qualifying_criteria: matchedChecks,
    activated_applicant_group_ids: [
      'contextual',
      'widening_participation',
      ...(extra.activated_applicant_group_ids || [])
    ],
    policy_decision: category === 'category_1'
      ? 'dundee_category_1_contextual_confirmed'
      : 'dundee_category_2_contextual_confirmed',
    category_review_note: extra.category_review_note || null
  };
}

function programmeLooksLikeDundeeContextual(programme, normaliseId) {
  const record = asObject(programme);
  const programmeId = normaliseId(record.programme_id);
  const recognisedProgrammeIds = new Set([
    'dundee_reach',
    'dundee_access',
    'glasgow_reach',
    'st_andrews_reach_scotland',
    'reach_programme_scotland',
    'aces_programme',
    'swap_programme',
    'scottish_wider_access_programme'
  ]);

  return recognisedProgrammeIds.has(programmeId);
}

function hasAmbiguousDundeeProgrammeEvidence(accessProgrammes, normaliseId) {
  const fallbackName = normaliseId(accessProgrammes.other_programme_name);
  const participationStatus = normaliseId(accessProgrammes.participation_status);
  const uncertainParticipation = ['yes', 'not_sure', 'unsure', 'unknown'].includes(participationStatus);
  const otherProgrammes = asArray(accessProgrammes.other_programmes);
  const selectedOtherProgramme = asArray(accessProgrammes.other_programmes).some((programme) => {
    const programmeId = normaliseId(asObject(programme).programme_id);
    return programmeId === 'other_access_wp_programme';
  });

  return selectedOtherProgramme ||
    Boolean(fallbackName) ||
    ['not_sure', 'unsure', 'unknown'].includes(participationStatus) ||
    (uncertainParticipation && otherProgrammes.length === 0) ||
    (
      uncertainParticipation &&
      otherProgrammes.some((programme) => {
        const record = asObject(programme);
        const programmeId = normaliseId(record.programme_id);
        return programmeId &&
          !programmeLooksLikeDundeeContextual(record, normaliseId);
      })
    );
}

function accessProgrammeCheck(accessProgrammes, normaliseId) {
  const programmes = asArray(accessProgrammes.other_programmes)
    .map(asObject)
    .filter((programme) => programmeLooksLikeDundeeContextual(programme, normaliseId));

  const programme = programmes[0] || null;
  if (!programme) {
    if (hasAmbiguousDundeeProgrammeEvidence(accessProgrammes, normaliseId)) {
      return check(
        'widening_access_programme',
        'Recognised widening access programme',
        'access_programmes',
        'information_needed',
        {
          participation_status: accessProgrammes.participation_status || null,
          other_programme_name: accessProgrammes.other_programme_name || null
        }
      );
    }
    return check(
      'widening_access_programme',
      'Recognised widening access programme',
      'access_programmes',
      'not_matched'
    );
  }

  const status = normaliseId(
    programme?.status ??
      programme?.programme_status ??
      accessProgrammes.participation_status
  );
  const confirmed = ['offered', 'participating', 'completed', 'yes', 'confirmed'].includes(status);
  return check(
    'widening_access_programme',
    'Recognised widening access programme',
    programme ? 'access_programmes.other_programmes' : 'access_programmes.other_programme_name',
    confirmed ? 'matched' : 'information_needed',
    {
      programme_id: programme?.programme_id || null,
      status: programme?.status || programme?.programme_status || accessProgrammes.participation_status || null
    }
  );
}

function rawHasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(asObject(object), key);
}

function evaluateDundeeContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultResult();
  const identity = asObject(applicant.applicant_identity);
  const rawContextual = asObject(applicant.contextual_profile);
  const rawFinancial = asObject(rawContextual.financial_support);
  const rawPersonal = asObject(rawContextual.personal_circumstances);
  const financial = asObject(evidence.financial_support);
  const personal = asObject(evidence.personal_circumstances);
  const postcode = asObject(evidence.postcode_measures);
  const accessProgrammes = asObject(evidence.access_programmes);

  const inScope = isHomeScottishOrRukApplicant(identity, normaliseId);
  result.checks.scope.push(check(
    'home_scottish_or_ruk_scope',
    'Home Scottish or Rest of UK applicant',
    'applicant_identity.fee_status/applicant_identity.domicile',
    inScope ? 'matched' : 'not_applicable',
    {
      fee_status: identity.fee_status,
      domicile: identity.domicile
    }
  ));
  if (!inScope) {
    return {
      ...result,
      reason: 'dundee_contextual_not_applicable',
      policy_decision: 'outside_home_scottish_ruk_contextual_scope'
    };
  }

  const simdQuintile = normaliseQuintile(postcode.simd_quintile, normaliseId);
  const category1Checks = [
    check(
      'simd_quintile_1',
      'SIMD Quintile 1',
      'home_area_region.simd_quintile',
      simdQuintile === 'q1' ? 'matched' : 'not_matched',
      postcode.simd_quintile
    ),
    check(
      'free_school_meals',
      'Free school meals',
      'financial_support.free_school_meals',
      answerIsYes(financial.free_school_meals, normaliseId) ? 'matched' : 'not_matched',
      financial.free_school_meals
    ),
    check(
      'carer',
      'Carer',
      'personal_circumstances.young_or_adult_carer',
      answerIsYes(
        personal.young_or_adult_carer ??
          personal.unpaid_carer ??
          personal.carer,
        normaliseId
      ) ? 'matched' : 'not_matched',
      personal.young_or_adult_carer ?? personal.unpaid_carer ?? personal.carer
    ),
    check(
      'care_experienced',
      'Care experienced',
      'personal_circumstances.care_experienced',
      answerIsYes(
        personal.care_experienced ??
          personal.care_over_three_months ??
          personal.care_leaver,
        normaliseId
      ) ? 'matched' : 'not_matched',
      personal.care_experienced ?? personal.care_over_three_months ?? personal.care_leaver
    ),
    check(
      'estranged',
      'Estranged',
      'personal_circumstances.estranged_from_family',
      answerIsYes(personal.estranged_from_family ?? personal.estranged, normaliseId)
        ? 'matched'
        : 'not_matched',
      personal.estranged_from_family ?? personal.estranged
    ),
    check(
      'refugee_or_asylum_seeker',
      'Refugee or asylum seeker',
      'personal_circumstances.refugee',
      answerIsYes(
        personal.refugee ??
          personal.uk_refugee_status_granted ??
          personal.seeking_asylum ??
          personal.asylum_seeker,
        normaliseId
      ) ? 'matched' : 'not_matched',
      personal.refugee ??
        personal.uk_refugee_status_granted ??
        personal.seeking_asylum ??
        personal.asylum_seeker
    )
  ];
  result.checks.category_1.push(...category1Checks);
  const matchedCategory1 = category1Checks.filter((entry) => entry.status === 'matched');
  if (matchedCategory1.length > 0) {
    return contextualOutcome(result, 'category_1', matchedCategory1, {
      activated_applicant_group_ids: matchedCategory1.some((entry) => {
        return entry.criterion_id === 'care_experienced';
      }) ? ['care_experienced'] : []
    });
  }

  const accessCheck = accessProgrammeCheck(accessProgrammes, normaliseId);
  const category2Checks = [
    check(
      'simd40',
      'SIMD40 / SIMD Quintile 2',
      'home_area_region.simd_quintile',
      simdQuintile === 'q2' ? 'matched' : 'not_matched',
      postcode.simd_quintile
    ),
    check(
      'declared_disability',
      'Declared disability',
      'personal_circumstances.disability',
      answerIsYes(personal.disability, normaliseId) ? 'matched' : 'not_matched',
      personal.disability
    ),
    accessCheck
  ];
  result.checks.category_2.push(...category2Checks);
  const matchedCategory2 = category2Checks.filter((entry) => entry.status === 'matched');
  if (matchedCategory2.length > 0) {
    return contextualOutcome(result, 'category_2', matchedCategory2, {
      category_review_note: matchedCategory2.length > 1
        ? 'Dundee may review multiple Category 2 factors internally; ApplySmart keeps this as Category 2 unless Category 1 evidence is directly confirmed.'
        : null
    });
  }

  const unresolvedChecks = [];
  const unresolvedFinancialFields = [
    ['free_school_meals', 'Free school meals', 'financial_support.free_school_meals']
  ];
  for (const [key, label, path] of unresolvedFinancialFields) {
    if (rawHasOwn(rawFinancial, key) && answerIsUnresolved(financial[key], normaliseId)) {
      unresolvedChecks.push(check(key, label, path, 'information_needed', financial[key]));
    }
  }

  const unresolvedPersonalFields = [
    ['young_or_adult_carer', 'Carer', 'personal_circumstances.young_or_adult_carer'],
    ['care_experienced', 'Care experienced', 'personal_circumstances.care_experienced'],
    ['care_over_three_months', 'Care experienced', 'personal_circumstances.care_over_three_months'],
    ['estranged_from_family', 'Estranged', 'personal_circumstances.estranged_from_family'],
    ['refugee', 'Refugee', 'personal_circumstances.refugee'],
    ['uk_refugee_status_granted', 'Refugee', 'personal_circumstances.uk_refugee_status_granted'],
    ['seeking_asylum', 'Asylum seeker', 'personal_circumstances.seeking_asylum'],
    ['disability', 'Declared disability', 'personal_circumstances.disability']
  ];
  for (const [key, label, path] of unresolvedPersonalFields) {
    if (rawHasOwn(rawPersonal, key) && answerIsUnresolved(personal[key], normaliseId)) {
      unresolvedChecks.push(check(key, label, path, 'information_needed', personal[key]));
    }
  }
  if (accessCheck.status === 'information_needed') {
    unresolvedChecks.push(accessCheck);
  }
  result.checks.manual_review_criteria.push(...unresolvedChecks);

  if (unresolvedChecks.length > 0) {
    return {
      ...result,
      status: 'information_needed',
      reason: 'dundee_contextual_information_needed',
      manual_review_reason: 'dundee_contextual_information_needed',
      contextual_category: 'information_needed',
      missing_information: unresolvedChecks.map((entry) => ({
        criterion_id: entry.criterion_id,
        label: entry.label,
        evidence_path: entry.evidence_path,
        reason: 'dundee_contextual_information_needed'
      })),
      policy_decision: 'manual_review_required_for_unresolved_contextual_evidence'
    };
  }

  return result;
}

module.exports = {
  DUNDEE_CONTEXTUAL_EVALUATOR_ID,
  evaluateDundeeContextualEligibility
};
