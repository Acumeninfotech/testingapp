const ALLOWED_LABELS = new Set([
  'guidance-only: above the supplied historical range',
  'guidance-only: historically competitive range',
  'guidance-only: below the supplied historical guidance'
]);

function unavailable(status, message, extra = {}) {
  return {
    status,
    guidance_label: null,
    message,
    ...extra
  };
}

function validateConfig(config) {
  const positioning = config?.score_model?.historical_positioning;

  if (config?.course_profile_id !== 'nottingham-a100') {
    throw new TypeError('The Nottingham guidance classifier requires the nottingham-a100 config.');
  }
  if (
    config.score_model?.scale?.max !== 82 ||
    positioning?.source_type !== 'FOI' ||
    positioning?.guidance_only !== true ||
    positioning?.non_executable_admissions_logic !== true ||
    positioning?.fixed_cutoff !== false
  ) {
    throw new TypeError('The Nottingham guidance config is missing required FOI safeguards.');
  }
  if ((config.guidance_pools || []).some((pool) => pool.band_rules?.length > 0)) {
    throw new TypeError('Nottingham shared executable band rules must remain empty.');
  }

  return positioning;
}

function resolveGuidanceGroup(evaluation) {
  const groups = new Set(evaluation?.eligibility?.applicant_group_ids || []);

  if (groups.has('international_fee')) {
    return 'international';
  }
  if (
    groups.has('home_fee') &&
    evaluation?.contextual_policy?.status === 'verified_contextual_offer_stage_policy'
  ) {
    return 'contextual_or_widening_participation';
  }
  if (groups.has('home_fee')) {
    return 'home_standard';
  }

  return null;
}

function classifyNottinghamA100InterviewGuidance(config, evaluation) {
  const positioning = validateConfig(config);
  const score = evaluation?.official_score;

  if (score?.components?.sjt?.excludes_from_interview === true) {
    return unavailable(
      'excluded_before_guidance',
      'SJT Band 4 scores 0 points and excludes the applicant from interview consideration.',
      {
        exclusion_reason: 'sjt_band_4',
        historical_comparison_performed: false
      }
    );
  }

  if (score?.max === 50) {
    return unavailable(
      'not_applicable_no_gcse_scale',
      'Historical /82 guidance is not applied to applicants using Nottingham’s official no-GCSE /50 scale.',
      {
        exclusion_reason: 'official_no_gcse_50_point_scale',
        historical_comparison_performed: false
      }
    );
  }

  if (evaluation?.eligibility?.status !== 'eligible') {
    return unavailable(
      'not_available_until_eligibility_confirmed',
      'Historical score positioning is available only after published eligibility checks are satisfied.',
      { historical_comparison_performed: false }
    );
  }

  if (score?.max !== 82 || !Number.isFinite(score?.value)) {
    return unavailable(
      'insufficient_official_score',
      'A complete official Nottingham score on the /82 scale is required.',
      { historical_comparison_performed: false }
    );
  }

  const guidanceGroup = resolveGuidanceGroup(evaluation);
  const group = positioning.groups?.[guidanceGroup];
  if (!guidanceGroup || !group) {
    return unavailable(
      'no_verified_guidance_pool',
      'A matching verified applicant group is required for historical score positioning.',
      { historical_comparison_performed: false }
    );
  }

  const range = group.typical_range;
  const comparison = score.value > range.max
    ? 'above'
    : score.value >= range.min
      ? 'within'
      : 'below';
  const guidanceLabel = positioning.labels?.[comparison];

  if (!ALLOWED_LABELS.has(guidanceLabel)) {
    throw new TypeError('The Nottingham guidance label is not uncertainty-aware.');
  }

  return {
    status: 'guidance_only_historical_positioning',
    guidance_label: guidanceLabel,
    historical_comparison: comparison,
    historical_comparison_performed: true,
    applicant_score: {
      value: score.value,
      max: 82
    },
    guidance_group: guidanceGroup,
    historical_typical_range: {
      min: range.min,
      max: range.max,
      source_type: 'FOI',
      descriptive_summary_only: true
    },
    historical_cycles: group.historical_cycles,
    messages: [...(positioning.warnings || [])],
    safeguards: {
      guidance_only: true,
      fixed_cutoff: false,
      admissions_decision_effect: false,
      current_cycle_threshold_claimed: false,
      no_gcse_50_point_scale_excluded: true
    }
  };
}

module.exports = {
  classifyNottinghamA100InterviewGuidance,
  resolveGuidanceGroup
};
