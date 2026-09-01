const GLASGOW_CONTEXTUAL_EVALUATOR_ID = 'glasgow_contextual_medicine_a100';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  return ['yes', 'true', 'confirmed'].includes(normaliseId(value));
}

function normaliseQuintile(value, normaliseId) {
  const normalised = normaliseId(value);
  if (!normalised) return null;
  const match = normalised.match(/(?:q|quintile|simd)?_?([1-5])$/);
  return match ? `q${match[1]}` : normalised;
}

function isScotlandDomiciledApplicant(identity, normaliseId) {
  return ['scotland', 'scottish', 'scotland_domiciled'].includes(
    normaliseId(identity.domicile)
  );
}

function deriveQualificationRoute(applicant, normaliseId) {
  const explicitRoute = normaliseId(
    applicant.qualification_route ||
      applicant.entry_route ||
      applicant.course_target?.qualification_route
  );
  if (explicitRoute) {
    return explicitRoute;
  }
  const scottishProfile = asObject(applicant.scottish_profile);
  if (scottishProfile.higher_subjects || scottishProfile.advanced_higher_subjects) {
    return 'scottish';
  }
  if (asObject(applicant.a_level_profile).subjects) {
    return 'a_level';
  }
  return null;
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

function defaultResult() {
  return {
    status: 'not_contextual',
    reason: 'glasgow_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      scope: [],
      qualifying_criteria: [],
      reach: []
    },
    activated_applicant_group_ids: []
  };
}

function programmeLooksLikeGlasgowReach(programme, normaliseId) {
  const record = asObject(programme);
  const values = [
    record.programme_id,
    record.programme_name,
    record.name,
    record.label,
    record.provider_university_id,
    record.provider_university_name
  ].map(normaliseId);

  return values.some((value) => {
    return value === 'glasgow_reach' ||
      value === 'university_of_glasgow_reach' ||
      value === 'reach_programme' ||
      value === 'reach_program' ||
      value === 'reach' ||
      value.includes('glasgow_reach') ||
      (value.includes('reach') && value.includes('glasgow'));
  });
}

function reachCompletionCheck(accessProgrammes, normaliseId) {
  const ukwpmed = asObject(accessProgrammes.ukwpmed);
  const programmeRecords = [
    ...asArray(accessProgrammes.other_programmes),
    ...(normaliseId(ukwpmed.programme_id).includes('reach') ? [ukwpmed] : [])
  ];
  const reachRecord = programmeRecords
    .map(asObject)
    .find((programme) => programmeLooksLikeGlasgowReach(programme, normaliseId));

  const fallbackName = normaliseId(accessProgrammes.other_programme_name);
  const fallbackStatus = normaliseId(accessProgrammes.participation_status);
  const hasFallbackReach =
    fallbackName === 'reach' ||
    fallbackName === 'glasgow_reach' ||
    fallbackName.includes('glasgow_reach') ||
    (fallbackName.includes('reach') && fallbackName.includes('glasgow'));

  if (!reachRecord && !hasFallbackReach) {
    return check(
      'glasgow_reach_completed',
      'Glasgow Reach completed',
      'access_programmes',
      'not_matched'
    );
  }

  const status = normaliseId(
    reachRecord?.status ??
      reachRecord?.programme_status ??
      (hasFallbackReach ? fallbackStatus : '')
  );
  const completed = status === 'completed';
  return check(
    'glasgow_reach_completed',
    'Glasgow Reach completed',
    reachRecord ? 'access_programmes.other_programmes' : 'access_programmes.other_programme_name',
    completed ? 'matched' : 'information_needed',
    {
      programme_id: reachRecord?.programme_id || null,
      status: reachRecord?.status || reachRecord?.programme_status || accessProgrammes.participation_status || null
    }
  );
}

function matchedWpChecks(evidence, normaliseId) {
  const personal = asObject(evidence.personal_circumstances);
  const postcode = asObject(evidence.postcode_measures);
  const simdQuintile = normaliseQuintile(postcode.simd_quintile, normaliseId);
  const checks = [
    check(
      'simd_decile_1_to_4',
      'SIMD decile 1-4',
      'home_area_region.simd_quintile',
      ['q1', 'q2'].includes(simdQuintile) ? 'matched' : 'not_matched',
      postcode.simd_quintile
    ),
    check(
      'care_experienced',
      'Care experienced',
      'personal_circumstances.care_experienced',
      answerIsYes(personal.care_experienced, normaliseId) ? 'matched' : 'not_matched',
      personal.care_experienced
    ),
    check(
      'estranged_from_family',
      'Estranged from family / living without family support',
      'personal_circumstances.estranged_from_family',
      answerIsYes(
        personal.estranged_from_family ??
          personal.estranged ??
          personal.living_without_family_support,
        normaliseId
      ) ? 'matched' : 'not_matched',
      personal.estranged_from_family ?? personal.estranged ?? personal.living_without_family_support
    ),
    check(
      'unpaid_carer',
      'Unpaid carer',
      'personal_circumstances.unpaid_carer',
      answerIsYes(
        personal.unpaid_carer ??
          personal.carer ??
          personal.young_or_adult_carer ??
          personal.care_over_three_months,
        normaliseId
      ) ? 'matched' : 'not_matched',
      personal.unpaid_carer ?? personal.carer ?? personal.young_or_adult_carer ?? personal.care_over_three_months
    ),
    check(
      'asylum_seeker',
      'Asylum seeker',
      'personal_circumstances.seeking_asylum',
      answerIsYes(personal.seeking_asylum ?? personal.asylum_seeker, normaliseId)
        ? 'matched'
        : 'not_matched',
      personal.seeking_asylum ?? personal.asylum_seeker
    ),
    check(
      'refugee',
      'Refugee',
      'personal_circumstances.refugee',
      answerIsYes(
        personal.refugee ??
          personal.uk_refugee_status_granted,
        normaliseId
      ) ? 'matched' : 'not_matched',
      personal.refugee ?? personal.uk_refugee_status_granted
    )
  ];

  return {
    checks,
    matched: checks.filter((entry) => entry.status === 'matched')
  };
}

function evaluateGlasgowContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const identity = asObject(applicant.applicant_identity);
  const accessProgrammes = asObject(evidence.access_programmes);
  const result = defaultResult();
  const scotlandDomiciled = isScotlandDomiciledApplicant(identity, normaliseId);
  const qualificationRoute = deriveQualificationRoute(applicant, normaliseId);
  const scottishRoute = ['scottish', 'scottish_highers', 'scottish_advanced_highers', 'sqa']
    .includes(qualificationRoute);

  result.checks.scope.push(check(
    'scotland_domicile_required',
    'Scotland domicile',
    'applicant_identity.domicile',
    scotlandDomiciled ? 'matched' : 'not_applicable',
    identity.domicile
  ));

  if (!scotlandDomiciled) {
    return {
      ...result,
      reason: 'glasgow_contextual_not_applicable',
      policy_decision: 'outside_scotland_contextual_scope'
    };
  }

  result.checks.scope.push(check(
    'scottish_qualification_route_required',
    'Scottish qualification route',
    'qualification_route',
    scottishRoute ? 'matched' : 'not_applicable',
    qualificationRoute
  ));

  if (!scottishRoute) {
    return {
      ...result,
      reason: 'glasgow_contextual_not_applicable_to_qualification_route',
      policy_decision: 'outside_scottish_qualification_route_scope'
    };
  }

  const wp = matchedWpChecks(evidence, normaliseId);
  result.checks.qualifying_criteria.push(...wp.checks);
  const reachCheck = reachCompletionCheck(accessProgrammes, normaliseId);
  result.checks.reach.push(reachCheck);

  if (wp.matched.length === 0) {
    return result;
  }

  if (reachCheck.status !== 'matched') {
    return {
      ...result,
      status: 'information_needed',
      reason: 'glasgow_reach_completion_required',
      manual_review_reason: 'glasgow_reach_completion_required',
      qualifying_criteria: wp.matched,
      missing_information: [{
        criterion_id: 'glasgow_reach_completed',
        label: 'Glasgow Reach completed',
        evidence_path: reachCheck.evidence_path,
        reason: 'glasgow_reach_completion_required'
      }],
      policy_decision: 'manual_review_required_for_reach_completion'
    };
  }

  const primary = wp.matched[0] || null;
  return {
    ...result,
    status: 'contextual',
    reason: 'glasgow_contextual_criteria_and_reach_met',
    is_contextual: true,
    matched_contextual_pathway: primary?.criterion_id || null,
    matched_contextual_pathway_label: primary?.label || 'Glasgow contextual adjusted route',
    qualifying_criteria: wp.matched,
    activated_applicant_group_ids: [
      'contextual',
      'widening_participation',
      ...(wp.matched.some((entry) => entry.criterion_id === 'care_experienced')
        ? ['care_experienced']
        : [])
    ],
    policy_decision: 'adjusted_scottish_academic_route_confirmed'
  };
}

module.exports = {
  GLASGOW_CONTEXTUAL_EVALUATOR_ID,
  evaluateGlasgowContextualEligibility
};
