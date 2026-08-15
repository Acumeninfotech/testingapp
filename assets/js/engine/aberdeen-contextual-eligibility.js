const ABERDEEN_CONTEXTUAL_EVALUATOR_ID = 'aberdeen_contextual_medicine_a100';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  return normaliseId(value) === 'yes';
}

function hasSubstantiveAccessValue(value, normaliseId) {
  const normalised = normaliseId(value);
  return Boolean(normalised) &&
    ![
      'no',
      'none',
      'not_sure',
      'unsure',
      'unknown',
      'false',
      'not_applicable',
      'na',
      'n_a'
    ].includes(normalised);
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

function isHomeFeeStatus(feeStatus, normaliseId) {
  const value = normaliseId(feeStatus);
  return (
    value === 'home' ||
    value === 'home_fee' ||
    value === 'ruk' ||
    value === 'rest_of_uk' ||
    value === 'rest_of_uk_roi_fee_rate' ||
    value.includes('home')
  );
}

function isRestOfUkApplicant(identity, normaliseId) {
  const feeStatus = normaliseId(identity.fee_status);
  const domicile = normaliseId(identity.domicile);
  return (
    ['ruk', 'rest_of_uk', 'rest_of_uk_roi_fee_rate'].includes(feeStatus) ||
    ['england', 'wales', 'northern_ireland', 'rest_of_uk'].includes(domicile)
  );
}

function isScotlandDomiciledApplicant(identity, normaliseId) {
  const feeStatus = normaliseId(identity.fee_status);
  const domicile = normaliseId(identity.domicile);
  return (
    ['scotland', 'scottish', 'scotland_domiciled'].includes(domicile) ||
    ['scotland', 'scottish', 'scotland_domiciled'].includes(feeStatus)
  );
}

function normaliseQuintile(value, normaliseId) {
  const normalised = normaliseId(value);
  if (!normalised) return null;
  const match = normalised.match(/(?:q|quintile|simd)?_?([1-5])$/);
  return match ? `q${match[1]}` : normalised;
}

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'aberdeen_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      qualifying_criteria: [],
      manual_review_criteria: []
    },
    contextual_criteria: [],
    ucat_uplift_percent: null,
    ucat_uplift_reason: null,
    adjusted_selection_ucat: null,
    activated_applicant_group_ids: []
  };
}

function contextualOutcome(result, matchedChecks, extra = {}) {
  const checks = asArray(matchedChecks);
  const primaryCheck = checks[0] || null;
  const contextualCriteria = [
    ...checks.map((entry) => entry.criterion_id),
    ...(extra.contextual_criteria || [])
  ].filter(Boolean);
  return {
    ...result,
    status: 'contextual',
    reason: 'aberdeen_contextual_criterion_met',
    is_contextual: true,
    matched_contextual_pathway: primaryCheck?.criterion_id || null,
    matched_contextual_pathway_label: primaryCheck?.label || null,
    qualifying_criteria: [
      ...result.qualifying_criteria,
      ...checks
    ],
    contextual_criteria: [...new Set(contextualCriteria)],
    ucat_uplift_percent: extra.ucat_uplift_percent ?? null,
    ucat_uplift_reason: extra.ucat_uplift_reason ?? null,
    adjusted_selection_ucat: extra.adjusted_selection_ucat ?? null,
    activated_applicant_group_ids: [
      'contextual',
      'widening_participation',
      ...(extra.activated_applicant_group_ids || [])
    ]
  };
}

function unresolvedAccessProgrammeSignal(accessProgrammes, normaliseId) {
  const otherProgrammes = asArray(accessProgrammes.other_programmes);
  const reachSignals = [
    accessProgrammes.reach_program_scotland,
    accessProgrammes.reach_participation,
    accessProgrammes.other_programme_name,
    ...otherProgrammes.flatMap((programme) => {
      const record = asObject(programme);
      return [
        record.programme_id,
        record.programme_name,
        record.name,
        record.label
      ];
    })
  ];
  return reachSignals.some((value) => {
    const normalised = normaliseId(value);
    return hasSubstantiveAccessValue(value, normaliseId) &&
      (
        normalised === 'reach' ||
        normalised === 'reach_program_scotland' ||
        normalised === 'scotland_reach_program' ||
        normalised === 'reach_scotland' ||
        normalised.includes('reach_program') ||
        normalised.includes('reach_scotland')
      );
  });
}

function structuredReachProgramScotlandCheck(accessProgrammes, normaliseId) {
  const otherProgrammes = asArray(accessProgrammes.other_programmes);
  const reachRecord = otherProgrammes
    .map(asObject)
    .find((programme) =>
      normaliseId(programme.programme_id) === 'st_andrews_reach_scotland'
    );

  if (!reachRecord) {
    return check(
      'reach_program_scotland',
      'Reach Program Scotland',
      'access_programmes.other_programmes',
      'not_matched'
    );
  }

  const status = normaliseId(reachRecord.status);
  const confirmed = ['participating', 'completed'].includes(status);
  return check(
    'reach_program_scotland',
    'Reach Program Scotland',
    'access_programmes.other_programmes',
    confirmed ? 'matched' : 'information_needed',
    {
      programme_id: reachRecord.programme_id,
      status: reachRecord.status || null
    }
  );
}

function evaluateAberdeenContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const identity = asObject(applicant.applicant_identity);
  const personal = asObject(evidence.personal_circumstances);
  const accessProgrammes = asObject(evidence.access_programmes);
  const postcode = asObject(evidence.postcode_measures);
  const result = defaultResult();

  const homeFee = isHomeFeeStatus(identity.fee_status, normaliseId);
  const restOfUk = isRestOfUkApplicant(identity, normaliseId);
  const scotlandDomiciled = isScotlandDomiciledApplicant(identity, normaliseId);
  const scopePassed = homeFee && (restOfUk || scotlandDomiciled);
  result.checks.scope.push(check(
    'home_ruk_or_scotland_scope',
    'Home fee status and UK domicile route',
    'applicant_identity.fee_status/applicant_identity.domicile',
    scopePassed ? 'matched' : 'not_applicable',
    {
      fee_status: identity.fee_status,
      domicile: identity.domicile,
      scotland_domiciled: scotlandDomiciled,
      rest_of_uk: restOfUk
    }
  ));

  if (!scopePassed) {
    return {
      ...result,
      reason: 'aberdeen_contextual_not_applicable',
      policy_decision: 'outside_home_ruk_contextual_scope'
    };
  }

  const matchedChecks = [];
  const upliftCandidates = [];
  const rawUcat = applicant.admissions_tests?.ucat?.total_score;
  const addUpliftCandidate = (checkEntry, percent) => {
    upliftCandidates.push({
      criterion_id: checkEntry.criterion_id,
      label: checkEntry.label,
      percent
    });
  };

  if (scotlandDomiciled) {
    const simdQuintile = normaliseQuintile(postcode.simd_quintile, normaliseId);
    const simd20Check = check(
      'simd20',
      'SIMD20 / SIMD Quintile 1',
      'home_area_region.simd_quintile',
      simdQuintile === 'q1' ? 'matched' : 'not_matched',
      postcode.simd_quintile
    );
    result.checks.qualifying_criteria.push(simd20Check);
    if (simd20Check.status === 'matched') {
      matchedChecks.push(simd20Check);
      addUpliftCandidate(simd20Check, 10);
    }

    const simd40Check = check(
      'simd40',
      'SIMD40 / SIMD Quintile 2',
      'home_area_region.simd_quintile',
      simdQuintile === 'q2' ? 'matched' : 'not_matched',
      postcode.simd_quintile
    );
    result.checks.qualifying_criteria.push(simd40Check);
    if (simd40Check.status === 'matched') {
      matchedChecks.push(simd40Check);
      addUpliftCandidate(simd40Check, 5);
    }
  }

  const polar4Check = check(
    'polar4_quintile_1',
    'POLAR4 Quintile 1',
    'home_area_region.polar4_quintile',
    normaliseQuintile(postcode.polar4_quintile, normaliseId) === 'q1' ? 'matched' : 'not_matched',
    postcode.polar4_quintile
  );
  result.checks.qualifying_criteria.push(polar4Check);
  if (polar4Check.status === 'matched') {
    matchedChecks.push(polar4Check);
  }

  const careCheck = check(
    'care_experienced',
    'Care experienced',
    'personal_circumstances.care_experienced',
    answerIsYes(personal.care_experienced, normaliseId) ? 'matched' : 'not_matched',
    personal.care_experienced
  );
  result.checks.qualifying_criteria.push(careCheck);
  if (careCheck.status === 'matched') {
    matchedChecks.push(careCheck);
    addUpliftCandidate(careCheck, 10);
  }

  const structuredReachCheck = structuredReachProgramScotlandCheck(
    accessProgrammes,
    normaliseId
  );
  result.checks.qualifying_criteria.push(structuredReachCheck);
  if (structuredReachCheck.status === 'matched') {
    matchedChecks.push(structuredReachCheck);
  }

  if (matchedChecks.length > 0) {
    const selectedUplift = upliftCandidates
      .sort((a, b) => b.percent - a.percent)[0] || null;
    const adjustedSelectionUcat =
      selectedUplift && Number.isFinite(rawUcat)
        ? {
          raw_ucat: rawUcat,
          adjusted_ucat: Math.round(rawUcat * (1 + selectedUplift.percent / 100)),
          uplift_percent: selectedUplift.percent,
          reason: selectedUplift.criterion_id,
          reason_label: selectedUplift.label,
          stacking_policy: 'highest_applicable_uplift_only'
        }
        : null;
    return contextualOutcome(result, matchedChecks, {
      activated_applicant_group_ids: careCheck.status === 'matched' ? ['care_experienced'] : [],
      contextual_criteria: selectedUplift ? [selectedUplift.criterion_id] : [],
      ucat_uplift_percent: selectedUplift?.percent ?? null,
      ucat_uplift_reason: selectedUplift?.criterion_id ?? null,
      adjusted_selection_ucat: adjustedSelectionUcat
    });
  }

  const youngCarerCheck = check(
    'young_or_adult_carer',
    'Young or adult carer',
    'personal_circumstances.young_or_adult_carer',
    answerIsYes(personal.young_or_adult_carer, normaliseId)
      ? 'information_needed'
      : 'not_matched',
    personal.young_or_adult_carer
  );
  result.checks.manual_review_criteria.push(youngCarerCheck);

  const reachCheck = check(
    'reach_program_scotland',
    'Reach Program Scotland',
    'access_programmes',
    structuredReachCheck.status === 'information_needed' ||
      unresolvedAccessProgrammeSignal(accessProgrammes, normaliseId)
      ? 'information_needed'
      : 'not_matched'
  );
  result.checks.manual_review_criteria.push(reachCheck);

  const missingInformation = [youngCarerCheck, reachCheck]
    .filter((entry) => entry.status === 'information_needed')
    .map((entry) => ({
      criterion_id: entry.criterion_id,
      label: entry.label,
      evidence_path: entry.evidence_path,
      reason: entry.criterion_id === 'reach_program_scotland'
        ? 'aberdeen_reach_program_scotland_information_needed'
        : 'aberdeen_contextual_evidence_needs_review'
    }));

  if (missingInformation.length > 0) {
    const manualReviewReason =
      missingInformation.length === 1 &&
        missingInformation[0]?.criterion_id === 'reach_program_scotland'
        ? 'aberdeen_reach_program_scotland_information_needed'
        : 'aberdeen_contextual_information_needed';
    return {
      ...result,
      status: 'information_needed',
      reason: manualReviewReason,
      manual_review_reason: manualReviewReason,
      missing_information: missingInformation,
      policy_decision: 'manual_review_required_for_unresolved_contextual_evidence'
    };
  }

  return result;
}

module.exports = {
  ABERDEEN_CONTEXTUAL_EVALUATOR_ID,
  evaluateAberdeenContextualEligibility
};
