// The single authoritative canonical band -> public label mapping. Every
// other map in this file (headlines, official-prediction-unavailable
// wording, decision-timeline status text) derives its short label from
// this so the same band always shows the same public wording everywhere.
// Internal canonical band IDs (the object keys) must never be renamed or
// shown to users - only the values here are public-facing.
const CANONICAL_BAND_LABELS = {
  very_strong_interview_potential: 'Very Strong Choice',
  interview_likely: 'Strong Choice',
  realistic: 'Realistic Choice',
  ambitious: 'Ambitious Choice',
  high_risk: 'High Risk'
};

const {
  isRestOfUkFeeStatus
} = require('./applicant-group-normalisation');

const STANDARD_RECOMMENDATIONS = {
  very_strong_interview_potential: {
    headline: 'Very strong choice based on your selection score',
    recommendation: CANONICAL_BAND_LABELS.very_strong_interview_potential,
    explanation: "ApplySmart's evidence-based analysis places this selection score well above the historical interview benchmark available for this applicant group."
  },
  interview_likely: {
    headline: 'Strong choice based on your selection score',
    recommendation: CANONICAL_BAND_LABELS.interview_likely,
    explanation: "ApplySmart's evidence-based analysis places this selection score above the historical interview benchmark available for this applicant group."
  },
  realistic: {
    headline: 'Realistic choice based on your selection score',
    recommendation: CANONICAL_BAND_LABELS.realistic,
    explanation: "ApplySmart's evidence-based analysis places this selection score in line with the historical interview benchmark available for this applicant group."
  },
  ambitious: {
    headline: 'Ambitious choice based on your selection score',
    recommendation: CANONICAL_BAND_LABELS.ambitious,
    explanation: "ApplySmart's evidence-based analysis places this selection score slightly below the historical interview benchmark available for this applicant group."
  },
  high_risk: {
    headline: 'High risk based on your selection score',
    recommendation: CANONICAL_BAND_LABELS.high_risk,
    explanation: "ApplySmart's evidence-based analysis places this selection score below the historical interview benchmark available for this applicant group."
  }
};

const UCAT_RANKING_RECOMMENDATIONS = {
  very_strong_interview_potential: {
    headline: 'Very strong choice based on your UCAT',
    recommendation: CANONICAL_BAND_LABELS.very_strong_interview_potential,
    position: 'above'
  },
  interview_likely: {
    headline: 'Strong choice based on your UCAT',
    recommendation: CANONICAL_BAND_LABELS.interview_likely,
    position: 'above'
  },
  realistic: {
    headline: 'Realistic choice based on your UCAT',
    recommendation: CANONICAL_BAND_LABELS.realistic,
    position: 'within'
  },
  ambitious: {
    headline: 'Ambitious choice based on your UCAT',
    recommendation: CANONICAL_BAND_LABELS.ambitious,
    position: 'slightly below'
  },
  high_risk: {
    headline: 'High risk based on your UCAT',
    recommendation: CANONICAL_BAND_LABELS.high_risk,
    position: 'below'
  }
};

const HISTORICAL_GUIDANCE_CAVEAT =
  'Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview.';

const OFFICIAL_UNAVAILABLE_TRUST_STATEMENT =
  'ApplySmart does not alter university requirements or present unofficial information as an official rule. Predictions are generated only after applying the published university criteria and analysing the available admissions evidence.';

const EVIDENCE = {
  standard: [
    'Official admissions policy',
    'University selection methodology',
    'UCAT policy',
    'Historical interview data'
  ],
  contextual: [
    'Official admissions policy',
    'University selection methodology',
    'UCAT policy',
    'Historical interview data',
    'Contextual admissions policy'
  ],
  international: [
    'Official admissions policy',
    'University selection methodology',
    'UCAT policy',
    'Historical interview data',
    'International admissions policy'
  ],
  foiInternational: [
    'Official admissions policy',
    'University selection methodology',
    'UCAT policy',
    'Historical interview data',
    'FOI evidence',
    'International admissions policy'
  ],
  eligibilityOnly: [
    'Official admissions policy',
    'University selection process',
    'Fee information',
    'Documented prediction limitation'
  ]
};

// Per-university static facts only (applicant pool label + a plain-language
// description of the selection approach + evidence-source labels). None of
// this varies per applicant. Per-applicant numbers (actual score, actual
// UCAT total, etc.) are never hand-authored here - they come from
// buildScoreBreakdown/buildRankingEvidence, which read the real engine
// output for the specific applicant being scored.
const UNIVERSITY_EXPLANATIONS = {
  'aberdeen-a100': {
    pool: 'International applicants',
    selectionSummary:
      'Academic attainment and UCAT are combined for the implemented pre-interview score.',
    evidence: EVIDENCE.foiInternational
  },
  'anglia-ruskin-a100': {
    pool: 'Home A100 applicants',
    selectionSummary:
      'Anglia Ruskin checks academic thresholds and the SJT filter before ranking eligible applicants by UCAT cognitive score after any documented percentage uplifts.',
    evidence: EVIDENCE.contextual
  },
  'aston-a100': {
    pool: 'Home non-widening-participation school-leavers',
    selectionSummary:
      'Aston combines points from six selected GCSEs and the UCAT cognitive total.',
    evidence: [...EVIDENCE.standard, 'FOI evidence']
  },
  'birmingham-a100': {
    pool: 'Home standard school-leavers',
    selectionSummary:
      'Birmingham combines scored GCSEs, UCAT and verified contextual information for interview guidance.',
    evidence: EVIDENCE.contextual
  },
  'cardiff-a100': {
    pool: 'International applicants',
    selectionSummary:
      'Cardiff uses a 28-point score and then the raw UCAT cognitive total to separate tied scores where needed.',
    evidence: EVIDENCE.foiInternational
  },
  'brunel-university-of-london-a100': {
    pool: 'Home A100 applicants',
    selectionSummary:
      'Brunel checks academic eligibility and the SJT Band 4 gate first, then ranks eligible Home applicants by total UCAT score. No academic score is created.',
    evidence: [...EVIDENCE.standard, 'FOI evidence']
  },
  'cambridge-a100': {
    pool: 'Cambridge A100 applicants',
    selectionSummary:
      'Cambridge reviews applicants holistically by college. ApplySmart checks the published academic and UCAT requirements, then uses historical admissions data, GCSE profile context and recognised contextual information to support interview benchmark analysis.',
    evidence: EVIDENCE.contextual
  },
  'dundee-a100': {
    pool: 'International standard-entry applicants',
    selectionSummary:
      'The implemented Dundee approach combines academic attainment and UCAT national-decile performance.',
    evidence: EVIDENCE.foiInternational
  },
  'edinburgh-a100': {
    pool: 'International applicants ranked separately',
    selectionSummary:
      'Edinburgh ranks applicants by a pre-interview total out of 40, combining academic, UCAT cognitive and SJT scores.',
    evidence: EVIDENCE.international
  },
  'exeter-a100': {
    pool: 'Home and International applicants ranked separately',
    selectionSummary:
      'Exeter ranks direct school-leaver applicants using the official Exeter Score, combining grade-profile points, UCAT national-decile points and verified achieved-grade or contextual/WP uplifts.',
    evidence: EVIDENCE.contextual
  },
  'glasgow-a100': {
    pool: 'International fee-status applicants ranked separately',
    selectionSummary:
      'Glasgow ranks eligible applicants by UCAT cognitive total only within the applicable fee-status group.',
    evidence: EVIDENCE.international
  },
  'keele-a100': {
    pool: 'International applicants ranked separately',
    selectionSummary:
      "Keele checks GCSE, academic, UCAT and SJT gates before using UCAT total for International interview guidance; Home applicants need Keele's own /25 shortlisting score.",
    evidence: EVIDENCE.international
  },
  'leicester-a100': {
    pool: 'Predicted and achieved A-level/IB applicants',
    selectionSummary:
      'Leicester combines a 48-point GCSE score with a 48-point UCAT score for a 96-point pre-interview total for predicted and achieved A-level/IB applicants; Graduate and Access to Medicine applicants use separate routes not covered by this score.',
    evidence: EVIDENCE.standard
  },
  'leeds-a100': {
    pool: 'Home A100 applicants',
    selectionSummary:
      'Leeds considers academic performance and UCAT together. ApplySmart uses Leeds-specific historical admissions data to support interview benchmark analysis.',
    evidence: EVIDENCE.contextual
  },
  'queen-mary-a100': {
    pool: 'Home and Overseas applicants ranked separately',
    selectionSummary:
      "Queen Mary's exact UCAT/Tariff weighting and current-cycle thresholds are unpublished; ApplySmart uses historical admissions data to support UCAT interview benchmark analysis.",
    evidence: [...EVIDENCE.standard, 'FOI evidence']
  },
  'liverpool-a100': {
    pool: 'Home standard non-contextual school-leavers',
    selectionSummary:
      'Liverpool applies academic and Home SJT checks, then ranks this applicant pool by UCAT cognitive total.',
    evidence: [...EVIDENCE.contextual, 'FOI evidence']
  },
  'lancaster-a100': {
    pool: 'Home standard school-leavers',
    selectionSummary:
      'Lancaster checks academic requirements and the SJT filter before ranking eligible applicants by UCAT cognitive total within the relevant applicant pool.',
    evidence: EVIDENCE.contextual
  },
  'manchester-a100': {
    pool: 'International applicants ranked separately',
    selectionSummary:
      'Manchester first applies the academic and SJT gates, then ranks eligible applicants by UCAT cognitive total.',
    evidence: EVIDENCE.foiInternational
  },
  'nottingham-a100': {
    pool: 'Home standard school-leavers',
    selectionSummary:
      'Nottingham combines points from eight GCSEs, the three UCAT cognitive sections and SJT.',
    evidence: EVIDENCE.standard
  },
  'sheffield-a100': {
    pool: 'Home A100 applicants',
    selectionSummary:
      'Sheffield checks academic eligibility and the UCAT minimum before ranking most eligible applicants by UCAT cognitive total within separate Home and International pools.',
    evidence: EVIDENCE.contextual
  },
  'st-andrews-a100': {
    pool: 'International applicants with historical admissions data',
    selectionSummary:
      'St Andrews checks academic, reference and relevant-experience hurdles first, then ranks eligible applicants by UCAT Global Score.',
    evidence: [...EVIDENCE.contextual, 'International admissions policy']
  }
};

const TIMELINE_SELECTION_SUMMARIES = {
  'aberdeen-a100':
    'Academic attainment and UCAT were combined in the implemented pre-interview score.',
  'anglia-ruskin-a100':
    'Academic thresholds and the SJT filter were checked before adjusted-UCAT interview guidance was applied.',
  'aston-a100':
    'Points from six selected GCSEs and the UCAT cognitive total were combined.',
  'birmingham-a100':
    'The score-based interview guidance combined scored GCSEs, UCAT and verified contextual information.',
  'cardiff-a100':
    'The 28-point score was applied, with the raw UCAT cognitive total available to separate tied scores.',
  'brunel-university-of-london-a100':
    'Academic eligibility and the SJT Band 4 gate were checked before Brunel Home-pool UCAT ranking guidance was applied. No academic score was created.',
  'cambridge-a100':
    'Published academic and UCAT requirements were checked before Cambridge-specific holistic interview guidance was applied with internal thresholds hidden.',
  'dundee-a100':
    'Academic attainment and UCAT national-decile performance were combined.',
  'edinburgh-a100':
    'Academic, UCAT cognitive and SJT components were considered in the pre-interview total.',
  'exeter-a100':
    'The official Exeter Score was applied, combining grade-profile points, UCAT national-decile points and verified achieved-grade or contextual/WP uplifts.',
  'glasgow-a100':
    'UCAT-based ranking was applied within the relevant fee-status applicant group.',
  'keele-a100':
    "Academic, UCAT and SJT gates were checked before UCAT-ranked International guidance was applied; Home /25 guidance is withheld without Keele's personal-statement score.",
  'leicester-a100':
    'A 48-point GCSE score and a 48-point UCAT score were combined into a 96-point pre-interview total for predicted and achieved A-level/IB applicants.',
  'leeds-a100':
    'Published entry requirements were checked before academics and UCAT were considered together using Leeds-specific historical admissions data.',
  'queen-mary-a100':
    "Historical admissions data was used to support Queen Mary's UCAT interview benchmark analysis, since exact UCAT/Tariff weighting is unpublished.",
  'liverpool-a100':
    'Academic and SJT checks were applied before the applicant pool and historical admissions data were considered.',
  'lancaster-a100':
    'Academic requirements and the SJT filter were checked before UCAT ranking within the relevant Lancaster applicant pool.',
  'manchester-a100':
    'The SJT Band 1–2 gate was checked before UCAT ranking within the relevant applicant group.',
  'nottingham-a100':
    'Points from eight GCSEs, the UCAT cognitive sections and SJT were combined.',
  'sheffield-a100':
    'Academic eligibility and the UCAT minimum were checked before UCAT ranking within the relevant Sheffield applicant pool.',
  'st-andrews-a100':
    'Academic, reference and experience hurdles were checked before UCAT ranking.'
};

function mergePresentations(...presentations) {
  return presentations.reduce((merged, presentation) => {
    if (!presentation || typeof presentation !== 'object') {
      return merged;
    }
    return { ...merged, ...presentation };
  }, {});
}

function configuredPresentation(card = {}, options = {}) {
  return mergePresentations(
    card.stage_2_selection?.presentation,
    options.scoreModel?.presentation,
    options.guidancePool?.presentation
  );
}

function hideSelectionScoreDetails(presentation = {}) {
  return presentation.hide_selection_score_details === true ||
    presentation.hide_score_breakdown === true;
}

function reasonScopedPresentationValue(presentation = {}, field, reasonCode) {
  const values = presentation[field];
  if (!reasonCode || !values || typeof values !== 'object') {
    return null;
  }
  return values[reasonCode] || null;
}

function isApplicantInformationReasonCode(reasonCode) {
  return Boolean(reasonCode) &&
    reasonCode !== 'university_methodology_gap' &&
    !/historical_evidence_gap/.test(String(reasonCode));
}

function check(label, status, summary) {
  return { label, status, summary };
}

// Generic reason-code -> human label for the machine-readable failure/check
// codes produced by eligibility-evaluator.js's addFailure/addCheck and
// interview-band-classifier.js's evaluateHardFilters (same {checks, failures}
// shape across the generic path and the Nottingham/Hull York consumers).
// Codes may carry a ":subject_id"/":extra" suffix, handled separately below.
// This lets every university show real, specific reasons without
// hand-authoring prose per university.
const FAILURE_REASON_LABELS = {
  minimum_gcse_count_not_met: 'You need more GCSEs at the required grade than are currently on file.',
  gcse_minimum_count_at_grade_not_met: 'You need more GCSEs at the required minimum grade than are currently on file.',
  gcse_requirement_not_met: 'One of your GCSE subject grades does not meet the published minimum.',
  gcse_science_alternative_not_met: 'Your GCSE science subjects do not match any of the accepted science combinations.',
  minimum_gcse_points_not_met: 'Your GCSE points score does not meet the published minimum.',
  a_level_requirements_not_met: 'Your A-level grades (predicted or achieved) do not meet the published minimum.',
  a_level_practical_requirement_not_met: 'A required A-level science practical endorsement is missing or not a pass.',
  science_practical_endorsement_evidence_missing: 'Please confirm the practical endorsement outcome for your required A-level science subject.',
  same_sitting_evidence_missing: 'Please confirm whether your required A-level qualifications were or will be completed in the same examination sitting.',
  same_sitting_evidence_not_supported_for_route: 'This qualification route needs adviser review because same-sitting evidence cannot yet be checked automatically.',
  same_sitting_requirement_not_met: 'Your required qualifications were not completed in the same examination sitting.',
  a_level_route_not_supported_for_applicant_groups: 'ApplySmart does not yet have published A-level requirement data for your applicant group at this university.',
  ib_requirements_not_met: 'Your IB points or subject grades do not meet the published minimum.',
  ib_route_not_supported_for_applicant_groups: 'ApplySmart does not yet have published IB requirement data for your applicant group at this university.',
  btec_route_not_accepted: 'This university does not publish an accepted BTEC route matching your qualification.',
  access_to_he_not_accepted: 'This university does not accept the Access to HE route as entered.',
  international_qualification_requires_manual_review: 'Your international qualification equivalence needs adviser review before eligibility can be confirmed.',
  international_qualification_equivalence_requires_verification: 'Your international qualification equivalence needs adviser review before eligibility can be confirmed.',
  graduate_route_requirements_not_met: 'Your graduate-entry qualifications do not meet the published minimum.',
  ielts_academic_requirements_not_met: 'Your English language test scores do not meet the published minimum.',
  international_english_language_requirement_not_met: 'Your English language test scores do not meet the published minimum.',
  minimum_ucat_total_not_met: 'Your UCAT total score does not meet the published minimum.',
  required_admissions_test_missing: 'A required admissions test score is missing.',
  minimum_gamsat_component_not_met: 'Your GAMSAT scores do not meet the published minimum.',
  graduate_standard_route_not_met: 'The standard graduate academic route is not fully met.',
  graduate_compensatory_test_required: 'A compensatory admissions test is required for this graduate route because one compensable academic requirement is not met.',
  graduate_compensatory_test_threshold_not_met: 'Your compensatory admissions test scores do not meet the published minimum.',
  graduate_compensatory_test_multiple_deficiencies: 'The compensatory admissions test can only cover one specified academic shortfall for this route.',
  graduate_degree_requirements_not_met: 'The graduate degree requirement is not met.',
  qualification_route_requires_manual_review: 'This applicant route needs manual review because ApplySmart cannot automatically evaluate this university’s published process for it yet.',
  applicant_group_requires_manual_review: 'This applicant group needs manual review because ApplySmart cannot automatically evaluate this university’s published process for it yet.',
  sjt_band_excluded: 'Your SJT band is excluded by this university’s published policy.',
  disqualifying_sjt_rule: 'Your SJT band is excluded by this university’s published policy.',
  required_admissions_test_component_missing: 'A required admissions test component is missing.',
  resits_not_accepted: 'This university does not accept resits for your route.',
  resit_policy_not_met: 'Your resit evidence does not meet the published resit policy.',
  ucat_not_taken_in_application_year: 'Your UCAT was not taken in the year required for this application cycle.',
  ucat_test_year_not_valid: 'Your UCAT was not taken in the year required for this application cycle.',
  course_target_mismatch: 'The course you selected does not match this university’s course.',
  applicant_group_explicitly_blocked: 'This university does not accept applications from your applicant group.',
  qualification_route_explicitly_blocked: 'This university does not accept your qualification route.',
  unsupported_qualification_route: 'ApplySmart does not yet support checking this qualification route for this university.',
  initial_deferred_entry_not_accepted: 'This university does not accept deferred entry.',
  t_level_not_accepted: 'This university does not accept T-levels for this route.',
  age_on_1_october_requires_confirmation: 'Your age on 1 October of the entry year needs to be confirmed against this university’s published age requirement.'
};

function humanFailureLabel(code) {
  const [base] = String(code || '').split(':');
  return FAILURE_REASON_LABELS[base] || null;
}

// Distinguishes, for an insufficient_evidence result, whether the gap is on
// the university's side (its own published methodology has a component
// ApplySmart cannot execute for this applicant's route - e.g. Leicester's
// Graduate /48 route, or Keele's Home /25 score requiring a
// personal-statement score ApplySmart doesn't collect) versus a generic
// evidence gap. classifyInterviewBand already signals this: when an eligible
// applicant matches no guidance_pool at all (guidance_pool_id stays null),
// or when the Birmingham-style classifier emits a warning naming an
// unpublished/non-executable boundary, that is the university's methodology
// - not the applicant's data - falling short. Never invents a reason the
// engine didn't already surface.
const UNIVERSITY_METHODOLOGY_GAP_WARNING_PATTERNS = [
  /_not_published/,
  /_not_executable/,
  /_not_verified/,
  /_boundary_not_published/
];

function insufficientEvidenceReasonCodeFromWarnings(warnings, options = {}) {
  const hasMethodologyGapWarning = (warnings || []).some((code) =>
    UNIVERSITY_METHODOLOGY_GAP_WARNING_PATTERNS.some((pattern) => pattern.test(String(code || '')))
  );
  const noMatchingGuidancePool =
    options.eligibilityStatus === 'eligible' && options.guidancePoolId === null;
  return hasMethodologyGapWarning || noMatchingGuidancePool ? 'university_methodology_gap' : null;
}

function selectedFeeStatusKey(groupIds = []) {
  const groups = new Set(groupIds || []);
  if (groups.has('international_fee')) {
    return 'international';
  }
  if (groups.has('home_fee')) {
    return 'home';
  }
  return null;
}

function publicFeeInformation(feeInformation, groupIds = []) {
  if (!feeInformation || typeof feeInformation !== 'object') {
    return null;
  }

  const feeStatus = selectedFeeStatusKey(groupIds);
  const selected = feeStatus ? feeInformation[feeStatus] : null;
  if (!selected || typeof selected !== 'object') {
    return null;
  }
  const firstYear = selected.first_year ?? null;
  const courseTotal = selected.course_total ?? null;
  const deposit = selected.deposit ?? feeInformation.deposit ?? null;
  const hasPublishedAmount =
    Number.isFinite(firstYear) ||
    Number.isFinite(courseTotal) ||
    Number.isFinite(deposit);

  if (!hasPublishedAmount) {
    return null;
  }

  return {
    fee_status: feeStatus,
    currency: feeInformation.currency || null,
    entry_cycle: feeInformation.entry_cycle || null,
    first_year: firstYear,
    course_total: courseTotal,
    deposit,
    deposit_refundable_if_conditions_not_met:
      selected.deposit_refundable_if_conditions_not_met ??
      feeInformation.deposit_refundable_if_conditions_not_met ??
      null,
    fees_subject_to_change: feeInformation.fees_subject_to_change === true,
    fee_increase_wording: feeInformation.fee_increase_wording || null,
    additional_costs: feeInformation.additional_costs || null,
    eligibility_effect: feeInformation.eligibility_effect || 'informational_only',
    published_rates: Object.fromEntries(
      ['home', 'international']
        .filter((status) => feeInformation[status] && typeof feeInformation[status] === 'object')
        .map((status) => [
          status,
          {
            first_year: feeInformation[status].first_year ?? null,
            course_total: feeInformation[status].course_total ?? null,
            deposit: feeInformation[status].deposit ?? feeInformation.deposit ?? null
          }
        ])
    )
  };
}

// First manual_review_reasons code (same lookup as failure codes) rendered
// as a human label, for use as the specific manual-review reason shown to
// the applicant instead of the generic "some information is missing" text.
function humanManualReviewReason(manualReviewReasons) {
  const [firstReason] = manualReviewReasons || [];
  return humanFailureLabel(firstReason) || null;
}

function titleCaseGroupLabel(groupId) {
  return String(groupId || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Builds the applicant-pool label actually evaluated for this applicant,
// from the engine's own deriveApplicantGroupIds() output
// (classification.applicant_group_ids / eligibility.applicant_group_ids -
// identical vocabulary across the generic, Nottingham and Hull York
// dispatch paths). This replaces the old static per-university pool string,
// which never varied per applicant and could show a Home applicant as
// International (or vice versa). Fee status (home/international) is always
// the headline distinction; domicile, contextual/WP and graduate status are
// appended when present, since they are also real evaluated applicant-group
// facts, not invented text.
function humanApplicantPoolLabel(groupIds, applicantContext = {}) {
  const groups = new Set(groupIds || []);
  if (groups.size === 0) {
    return null;
  }
  const explicitRestOfUkFeeStatus = isRestOfUkFeeStatus(
    applicantContext?.applicant_identity?.fee_status ||
    applicantContext?.fee_status
  );

  const feeLabel = groups.has('international_fee')
    ? 'International'
    : explicitRestOfUkFeeStatus && groups.has('rest_of_uk')
      ? 'Rest of UK / ROI'
      : groups.has('home_fee')
        ? 'Home'
      : null;

  const domicileLabel = explicitRestOfUkFeeStatus && groups.has('rest_of_uk')
    ? null
    : groups.has('scotland_domiciled')
    ? 'Scotland-domiciled'
    : groups.has('rest_of_uk')
      ? 'Rest of UK'
      : null;

  const modifiers = [];
  if (groups.has('graduate_applicant')) modifiers.push('graduate');
  if (groups.has('contextual') || groups.has('widening_participation')) modifiers.push('contextual/widening participation');
  if (groups.has('care_experienced')) modifiers.push('care-experienced');
  if (groups.has('mature_applicant')) modifiers.push('mature');

  const parts = [feeLabel, domicileLabel].filter(Boolean);
  if (parts.length === 0 && modifiers.length === 0) {
    return null;
  }

  const base = parts.length > 0 ? parts.join(', ') : 'Applicant';
  return modifiers.length > 0 ? `${base} applicants (${modifiers.join(', ')})` : `${base} applicants`;
}

// Historical cycle year fields are not standardised across university JSON:
// most use a numeric entry_year, but several use a string cycle/entry_cycle
// field ("2025 entry", "2023_entry", "2023/24", "2025 entry for 2026
// places"). Extracts the first 4-digit year from whichever field is present
// so those universities' historical data is matched at all, instead of
// silently sorting to 0 and being dropped.
function extractCycleYear(entry) {
  const raw = entry.entry_year ?? entry.cycle ?? entry.entry_cycle;
  if (Number.isFinite(raw)) {
    return raw;
  }
  const match = String(raw ?? '').match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

// A cycle entry's UCAT figures are only safe to show on the applicant's
// current 2700 scale if the entry itself says so - many universities retain
// pre-2025 3600-scale rows (four-cognitive-subtest UCAT) alongside current
// 2700-scale rows (three-cognitive-subtest UCAT) in the same cycles array,
// and rendering the former unconverted next to a 2700-scale applicant score
// would misrepresent a historical figure as a current one. Resolves to
// true/false/null (unknown - treated as unsafe) from whichever scale field
// the entry uses (score_scale/ucat_scale/ucat_score_scale, numeric or a
// descriptive string).
function cycleScaleIs2700(figures) {
  const scaleValue = figures.score_scale ?? figures.ucat_scale ?? figures.ucat_score_scale;
  if (scaleValue === 2700) return true;
  if (scaleValue === 3600) return false;
  const text = String(scaleValue ?? '').toLowerCase();
  if (!text) return null;
  if (text.includes('3600') || text.includes('legacy')) return false;
  if (text.includes('2700')) return true;
  return null;
}

// Some universities already publish an explicit, audited conversion of a
// legacy 3600-scale figure to the current 2700 scale (e.g. Manchester's
// documented conversion_policy formula, or Glasgow/Aston's precomputed
// *_converted_2700 fields) - those are safe to show as-is. Absent one, a
// UCAT figure is only shown when the entry's own scale unambiguously
// resolves to 2700; otherwise it is omitted rather than guessed at or
// converted with an unaudited formula.
function safeUcatCutoff(figures) {
  const alreadyConverted =
    figures.converted_historical_interview_threshold_2700 ??
    figures.converted_score_2700 ??
    figures.lowest_ucat_converted_2700 ??
    figures.average_ucat_converted_2700;
  if (Number.isFinite(alreadyConverted)) {
    return alreadyConverted;
  }

  if (cycleScaleIs2700(figures) !== true) {
    return null;
  }

  return figures.interview_ucat_cutoff ?? figures.ucat_cutoff ?? figures.lowest_interviewed_ucat ?? figures.minimum_combined_score ?? null;
}

// Renders a single historical-admissions cycle entry (applications/interviews/
// offers/places/UCAT cutoff figures) as a human-readable check, with no
// interpretation — this is already-structured official/FOI evidence. UCAT
// figures are scale-gated by safeUcatCutoff so a legacy 3600-scale value is
// never shown unconverted beside the applicant's current 2700-scale score;
// non-scale figures (applications/interviews/offers/places) are unaffected
// and still render even when the UCAT figure must be omitted.
function formatAdmissionsNumber(value) {
  return Number(value).toLocaleString('en-GB');
}

function formatMetricDisplayValue(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(3)).toString();
}

function formatMetricDifference(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const formatted = formatMetricDisplayValue(value);
  return value > 0 ? `+${formatted}` : formatted;
}

function humaniseMetricKey(value) {
  const normalised = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalised ? normalised.charAt(0).toUpperCase() + normalised.slice(1) : '';
}

function historicalMetricSubject(figures = {}) {
  const text = [
    figures.metric,
    figures.metric_type,
    ...Object.keys(figures || {})
  ].join(' ').toLowerCase();

  if (text.includes('gamsat')) return 'GAMSAT';
  if (text.includes('ucat') || text.includes('score')) return 'UCAT';
  return null;
}

function historicalMetricLabel(figures = {}, entryYear = null) {
  const metric = figures.metric || figures.metric_type || null;
  if (!metric) {
    return null;
  }

  const subject = historicalMetricSubject(figures);
  const year = Number.isFinite(entryYear) ? ` (${entryYear})` : '';
  return [humaniseMetricKey(metric), subject].filter(Boolean).join(' ') + year;
}

function historicalMetricValue(figures = {}) {
  const explicitDisplay =
    figures.display_score_2700 ??
    figures.display_value ??
    figures.display_score ??
    null;
  if (Number.isFinite(explicitDisplay)) {
    return explicitDisplay;
  }

  const convertedOrSafe = safeUcatCutoff(figures);
  if (Number.isFinite(convertedOrSafe)) {
    return convertedOrSafe;
  }

  const metric = String(figures.metric || figures.metric_type || '').toLowerCase();
  const metricCandidates = Object.entries(figures || [])
    .filter(([key, value]) => (
      Number.isFinite(value) &&
      key !== 'entry_year' &&
      key !== 'original_score' &&
      key !== 'original_scale' &&
      key !== 'score_scale' &&
      key !== 'ucat_scale' &&
      key !== 'ucat_score_scale' &&
      key.toLowerCase().includes(metric)
    ));

  return metricCandidates[0]?.[1] ?? null;
}

function joinAdmissionsParts(parts, summaryStyle = null) {
  if (summaryStyle !== 'recent_admissions_sentence' || parts.length < 2) {
    return parts.join(', ');
  }
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function historicalCycleCheck(entryYear, groupLabel, figures, options = {}) {
  const parts = [];
  const applications = figures.applications ?? figures.applicants_approx;
  const interviews = figures.interviews ?? figures.invited_approx;
  const offers = figures.offers;
  const places = figures.places;
  const ucatCutoff = safeUcatCutoff(figures);
  const rawUcatCutoff =
    figures.interview_ucat_cutoff ??
    figures.ucat_cutoff ??
    figures.lowest_interviewed_ucat ??
    null;
  const rawUcatScale = figures.score_scale ?? figures.ucat_scale ?? figures.ucat_score_scale;
  const combinedScore = figures.minimum_combined_score ?? figures.combined_cutoff ?? null;
  const combinedScale = figures.combined_score_scale ?? figures.score_out_of ?? null;
  const metricLabel = historicalMetricLabel(figures);
  const metricValue = historicalMetricValue(figures);

  if (options.summaryStyle === 'recent_admissions_sentence') {
    if (Number.isFinite(applications)) parts.push(`approximately ${formatAdmissionsNumber(applications)} applicants`);
    if (Number.isFinite(interviews)) parts.push(`${formatAdmissionsNumber(interviews)} interviewed`);
    if (Number.isFinite(offers)) parts.push(`${formatAdmissionsNumber(offers)} offers`);
  } else {
    if (Number.isFinite(applications)) parts.push(`~${applications} applicants`);
    if (Number.isFinite(interviews)) parts.push(`~${interviews} interviewed`);
    if (Number.isFinite(offers)) parts.push(`~${offers} offers`);
  }
  if (Number.isFinite(places)) parts.push(`~${places} places`);
  if (metricLabel && Number.isFinite(metricValue)) {
    parts.push(`${metricLabel} ${formatMetricDisplayValue(metricValue)} (2700 scale)`);
  } else if (Number.isFinite(ucatCutoff)) {
    parts.push(`UCAT interview threshold ~${ucatCutoff} (2700 scale)`);
  }
  const originalScaleDisplayAllowed =
    figures.display_original_scale === true ||
    String(figures.use || '').includes('display_only_original_scale') ||
    String(figures.display_policy || '').includes('display_only_original_scale');
  if (
    originalScaleDisplayAllowed &&
    !metricLabel &&
    !Number.isFinite(ucatCutoff) &&
    Number.isFinite(rawUcatCutoff)
  ) {
    const scaleText = rawUcatScale ? ` (${rawUcatScale} scale, display only)` : ' (display only)';
    parts.push(`UCAT interview threshold ${rawUcatCutoff}${scaleText}`);
  }
  if (Number.isFinite(combinedScore)) {
    const scaleText = Number.isFinite(combinedScale) ? `/${combinedScale}` : '';
    parts.push(`combined-score threshold ${combinedScore}${scaleText} (display only)`);
  }

  if (parts.length === 0) {
    return null;
  }

  return check(
    options.label || `${groupLabel} (${entryYear})`,
    'Historical',
    joinAdmissionsParts(parts, options.summaryStyle) + '.'
  );
}

// Renders the university's own historical_admissions JSON directly, with no
// interpretation — this is already-structured official/FOI evidence, not
// derived or invented. Most universities store a top-level `cycles` array
// (applications/interviews/offers/places per applicant group per entry
// year); a smaller number instead nest observed_cycles.groups under
// pre_interview_thresholds — both are supported.
function filterHistoricalEntriesForApplicant(entries, groupIds = []) {
  const groups = new Set(groupIds || []);
  const isInternational = groups.has('international_fee');
  const isHome = groups.has('home_fee') && !isInternational;

  if (!isInternational && !isHome) {
    return entries;
  }

  const matching = entries.filter((entry) => {
    const feeStatus = String(entry.fee_status || entry.applicant_group_id || '').toLowerCase();
    const anyGroupIds = entry.any_group_ids || [];
    if (isInternational) {
      return feeStatus.includes('international') || anyGroupIds.includes('international_fee');
    }
    return !feeStatus.includes('international') && !anyGroupIds.includes('international_fee');
  });

  return matching.length > 0 ? matching : entries;
}

function historicalAdmissionsChecks(historicalAdmissions, groupIds = []) {
  if (!historicalAdmissions) {
    return [];
  }

  const cycles = historicalAdmissions.cycles;
  if (Array.isArray(cycles) && cycles.length > 0) {
    const years = cycles.map(extractCycleYear).filter(Number.isFinite);
    const mostRecentYear = years.length > 0 ? Math.max(...years) : null;
    if (mostRecentYear === null) {
      return [];
    }
    const mostRecentEntries = filterHistoricalEntriesForApplicant(
      cycles.filter((c) => extractCycleYear(c) === mostRecentYear),
      groupIds
    );

    return mostRecentEntries
      .map((entry) => {
        const feeLabel = titleCaseGroupLabel(
          entry.fee_status || entry.applicant_group_id || (entry.any_group_ids || [])[0] || 'All applicants'
        );
        // A fee status (e.g. "Home") can have multiple distinct rows in the
        // same year - different applicant pools (graduate / predicted
        // A-level / achieved A-level) with very different figures. Fold the
        // pool into the label so those rows aren't shown as identical
        // duplicates of each other.
        const groupLabel = entry.pool ? `${feeLabel} – ${titleCaseGroupLabel(entry.pool)}` : feeLabel;
        return historicalCycleCheck(mostRecentYear, groupLabel, entry, {
          label: historicalAdmissions.public_recent_label || null,
          summaryStyle: historicalAdmissions.public_summary_style || null
        });
      })
      .filter(Boolean)
      .slice(0, 6);
  }

  const observedCycles = historicalAdmissions.pre_interview_thresholds?.observed_cycles;
  if (Array.isArray(observedCycles) && observedCycles.length > 0) {
    const mostRecent = [...observedCycles].sort((a, b) => (b.entry_year || 0) - (a.entry_year || 0))[0];
    const groups = mostRecent?.groups || {};

    return Object.entries(groups)
      .map(([groupId, figures]) => historicalCycleCheck(mostRecent.entry_year, titleCaseGroupLabel(groupId), figures))
      .filter(Boolean)
      .slice(0, 4);
  }

  return [];
}

function applicantUcatForComparison(options = {}, ucatComparison = null) {
  const applicantUcat =
    ucatComparison?.applicant_ucat ??
    options.applicantContext?.admissions_tests?.ucat?.total_score;
  return Number.isFinite(applicantUcat) ? applicantUcat : null;
}

function historicalAdmissionComparisonMetrics(historicalAdmissions, groupIds = [], options = {}, ucatComparison = null) {
  if (!historicalAdmissions) {
    return [];
  }

  const cycles = historicalAdmissions.cycles;
  if (!Array.isArray(cycles) || cycles.length === 0) {
    return [];
  }

  const years = cycles.map(extractCycleYear).filter(Number.isFinite);
  const mostRecentYear = years.length > 0 ? Math.max(...years) : null;
  if (mostRecentYear === null) {
    return [];
  }

  const applicantUcat = applicantUcatForComparison(options, ucatComparison);
  return filterHistoricalEntriesForApplicant(
    cycles.filter((c) => extractCycleYear(c) === mostRecentYear),
    groupIds
  )
    .map((entry) => {
      const label = historicalMetricLabel(entry, mostRecentYear);
      const value = historicalMetricValue(entry);
      if (!label || !Number.isFinite(value)) {
        return null;
      }
      return {
        label,
        value: formatMetricDisplayValue(value),
        difference: Number.isFinite(applicantUcat) ? formatMetricDifference(applicantUcat - value) : null
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

// Human labels for the score_model component_id values used across
// data/interview-band-configs/*.json (see interview-band-classifier.js's
// calculateScore/calculateComponent). Matched by substring against the
// component_id so new universities using the same naming convention
// (gcse_*, ucat_*, sjt_*, contextual_*, academic_*) get a readable label
// without a per-university entry.
const SCORE_COMPONENT_LABEL_PATTERNS = [
  [/achieved/i, 'Achieved-grade uplift'],
  [/wp|widening/i, 'Contextual uplift'],
  [/contextual/i, 'Contextual uplift'],
  [/gcse/i, 'GCSE score'],
  [/academic/i, 'Academic score'],
  [/grade/i, 'Grade profile score'],
  [/ucat/i, 'UCAT score'],
  [/sjt/i, 'SJT score']
];

function humanScoreComponentLabel(componentId) {
  const match = SCORE_COMPONENT_LABEL_PATTERNS.find(([pattern]) => pattern.test(componentId || ''));
  return match ? match[1] : titleCaseGroupLabel(componentId);
}

// Renders one calculated score component ({value, max, ...}) as a check.
// Values/maxima are read directly off the engine's own output - nothing is
// invented or recalculated here.
function scoreComponentCheck(label, component) {
  if (!component) {
    return null;
  }
  if (component.applicable === false) {
    return null;
  }
  if (component.max === 0 && component.value === 0) {
    return null;
  }
  if (!Number.isFinite(component.value)) {
    return check(label, 'Not available', component.reason
      ? studentFacingText(String(component.reason).replace(/_/g, ' '))
      : 'This component could not be calculated from the information supplied.');
  }
  const maxText = Number.isFinite(component.max) ? ` out of ${formatScorePoints(component.max)}` : '';
  return check(label, 'Counted', `${formatScorePoints(component.value)}${maxText}.`);
}

// Hull York contextual points are shown as applied/not applied in the public
// score breakdown so the card stays applicant-facing instead of explaining
// the internal scoring scale.
function contextualScoreComponentCheck(component) {
  if (!component || !component.applicable) {
    return null;
  }
  if (component.value === 0) {
    return check(
      'Contextual points',
      'Not applied',
      'Not applied based on the information provided.'
    );
  }
  return check(
    'Contextual points',
    'Applied',
    'Applied based on the information provided.'
  );
}

// Builds a generic score breakdown from whichever already-computed engine
// score shape is present for this university - the generic component_sum
// ranking (interview-band-classifier.js calculateScore), the Nottingham
// consumer's official_score, or the Hull York consumer's unofficial
// estimated_selection_score. Returns null when the university has no
// combined score model (ranking/cut-off-only universities), so the caller
// can fall back to ranking-only evidence instead.
function buildScoreBreakdown(options = {}) {
  if (options.officialScore) {
    const score = options.officialScore;
    const components = score.components || {};
    const checks = [
      scoreComponentCheck('GCSE score', components.gcse),
      scoreComponentCheck('UCAT cognitive score', components.ucat_cognitive),
      scoreComponentCheck('SJT score', components.sjt)
    ].filter(Boolean);
    return {
      name: 'Official Nottingham pre-interview score',
      value: Number.isFinite(score.value) ? score.value : null,
      max: Number.isFinite(score.max) ? score.max : null,
      status: score.status,
      explanation: score.explanation || null,
      checks
    };
  }

  if (options.estimatedSelectionScore) {
    const score = options.estimatedSelectionScore;
    const components = score.components || {};
    const checks = [
      scoreComponentCheck('GCSE score', components.gcse),
      scoreComponentCheck('UCAT score', components.ucat),
      scoreComponentCheck('SJT score', components.sjt),
      contextualScoreComponentCheck(components.contextual)
    ].filter(Boolean);
    return {
      name: score.label || 'Estimated selection score',
      value: Number.isFinite(score.value) ? score.value : null,
      max: Number.isFinite(score.max) ? score.max : null,
      status: score.status,
      explanation: score.disclosure || null,
      unofficial: score.official === false,
      checks
    };
  }

  const ranking = options.ranking;
  const scoreModel = options.scoreModel;
  // calculatePoolRanking() returns a raw UCAT/GAMSAT ranking (empty
  // `components: {}`) instead of the university's component_sum score
  // whenever the matched guidance pool ranks by admissions-test total rather
  // than the whole-university formula (score_model.pool_specific_output is
  // true for that pool's metric). scoreModel.type is a static, university-
  // level field and stays 'component_sum' even then, so it cannot be used
  // alone to decide whether to render a combined score - checking for real
  // components is what distinguishes an actual calculated score from a pool
  // that was deliberately routed away from the whole-university formula.
  const rankingIsComponentSum = Object.keys(ranking?.components || {}).length > 0;
  if (ranking && scoreModel?.type === 'component_sum' && rankingIsComponentSum && ranking.status === 'calculated') {
    const checks = Object.entries(ranking.components || {})
      .map(([componentId, component]) => scoreComponentCheck(humanScoreComponentLabel(componentId), component))
      .filter(Boolean);
    const capExplanation =
      ranking.cap_applied === true &&
      Number.isFinite(ranking.uncapped_value) &&
      Number.isFinite(ranking.selection_score_cap)
        ? ` Raw component total was ${ranking.uncapped_value}; final selection score is capped at ${ranking.selection_score_cap}.`
        : '';
    const breakdown = {
      name: scoreModel.label || 'Selection score',
      value: Number.isFinite(ranking.value) ? ranking.value : null,
      max: Number.isFinite(ranking.max) ? ranking.max : null,
      status: ranking.status,
      explanation: ranking.basis || capExplanation ? `${ranking.basis || ''}${capExplanation}` : null,
      checks
    };
    if (Number.isFinite(ranking.uncapped_value)) {
      breakdown.uncapped_value = ranking.uncapped_value;
      breakdown.selection_score_cap = Number.isFinite(ranking.selection_score_cap)
        ? ranking.selection_score_cap
        : null;
      breakdown.cap_applied = ranking.cap_applied === true;
    }
    if (Number.isFinite(ranking.applicable_max_score)) {
      breakdown.applicable_max_score = ranking.applicable_max_score;
      breakdown.selection_score_max = ranking.selection_score_max ?? ranking.applicable_max_score;
      breakdown.global_max = ranking.global_max ?? scoreModel.scale?.max ?? null;
    }
    return breakdown;
  }

  // The engine can return status: 'unavailable' for a component_sum university
  // when required scoring inputs are missing (e.g. incomplete GCSE grades) -
  // this is distinct from a ranking-only university with no combined score at
  // all, so it must not fall through to buildRankingEvidence's "this
  // university does not publish a combined points score" message, which
  // would be actively wrong for a university that does publish one.
  if (ranking && scoreModel?.type === 'component_sum' && rankingIsComponentSum && ranking.status === 'unavailable') {
    const checks = Object.entries(ranking.components || {})
      .map(([componentId, component]) => scoreComponentCheck(humanScoreComponentLabel(componentId), component))
      .filter(Boolean);
    const breakdown = {
      name: scoreModel.label || 'Selection score',
      value: null,
      max: Number.isFinite(ranking.max) ? ranking.max : null,
      status: ranking.status,
      explanation: ranking.basis || null,
      reason: ranking.reason || null,
      checks
    };
    if (Number.isFinite(ranking.applicable_max_score)) {
      breakdown.applicable_max_score = ranking.applicable_max_score;
      breakdown.selection_score_max = ranking.selection_score_max ?? ranking.applicable_max_score;
      breakdown.global_max = ranking.global_max ?? scoreModel.scale?.max ?? null;
    }
    return breakdown;
  }

  return null;
}

// For universities with no combined score model (ranking_metric-only, or a
// component_sum whose pool bypasses it via raw UCAT/GAMSAT ranking), render
// what selection is actually based on: the UCAT/GAMSAT figure used for
// ranking, and the SJT band, both already on the applicant/engine output.
// No thresholds or unofficial data are invented here.
function buildRankingEvidence(options = {}) {
  const bandMetric = options.bandMetric;
  const applicant = options.applicantContext;
  const ucat = applicant?.admissions_tests?.ucat;
  const gamsat = applicant?.admissions_tests?.gamsat;
  const ucatComparison = options.ucatComparison;

  const checks = [];
  if (ucatComparison?.official_ucat_minimum) {
    checks.push(check(
      'UCAT minimum',
      ucatComparison.official_ucat_minimum.met ? 'Met' : 'Not met',
      ucatComparison.official_ucat_minimum.summary
    ));
  }
  if (ucatComparison) {
    checks.push(check(
      'UCAT',
      ucatComparison.position ? titleCaseGroupLabel(ucatComparison.position) : 'Ranking only',
      ucatComparisonAssessmentText(ucatComparison)
    ));
    checks.push(check(
      'SJT requirement',
      titleCaseGroupLabel(ucatComparison.sjt_outcome),
      ucatComparison.sjt_summary
    ));
  } else
  if (bandMetric?.metric === 'gamsat_total' && Number.isFinite(bandMetric.value)) {
    checks.push(check('GAMSAT total entered', 'Used for ranking', `${bandMetric.value}${Number.isFinite(bandMetric.scale?.max) ? ` out of ${bandMetric.scale.max}` : ''}.`));
  } else if (Number.isFinite(bandMetric?.value) || Number.isFinite(ucat?.total_score)) {
    const value = Number.isFinite(bandMetric?.value) ? bandMetric.value : ucat.total_score;
    const max = Number.isFinite(bandMetric?.scale?.max) ? bandMetric.scale.max : (ucat?.score_scale ?? 2700);
    checks.push(check('UCAT total entered', 'Used for ranking', `${value} out of ${max}.`));
  } else if (Number.isFinite(gamsat?.overall_score)) {
    checks.push(check('GAMSAT total entered', 'On file', `${gamsat.overall_score}${Number.isFinite(gamsat.score_scale) ? ` out of ${gamsat.score_scale}` : ''}.`));
  }

  if (!ucatComparison && ucat?.sjt_band !== undefined && ucat?.sjt_band !== null) {
    checks.push(check('SJT band', 'On file', `Band ${ucat.sjt_band}.`));
  }

  checks.push(check(
    'Selection approach',
    'Ranking/cut-off based',
    options.selectionSummary ||
      'This university does not publish a combined points score; eligible applicants are ranked against the admissions-test total (or a published cut-off), not a calculated score.'
  ));

  return checks;
}

function eligibilityChecksFromFailureCodes(checks, failures) {
  const failureChecks = (failures || [])
    .map((code) => {
      const label = humanFailureLabel(code);
      return label ? check('Entry requirement', 'Not met', label) : null;
    })
    .filter(Boolean);

  if (failureChecks.length > 0) {
    return failureChecks;
  }

  return (checks || [])
    .filter((entry) => entry && entry.status === 'pass')
    .slice(0, 4)
    .map((entry) => check('Entry requirement', 'Met', 'This requirement was assessed and met.'));
}

function studentFacingText(value) {
  return String(value || '')
    .replace(/\boffer outcome\b/gi, 'post-interview decision')
    .replace(/\boffer[- ]?(prediction|probability|likelihood|chance)\b/gi, 'post-interview assessment');
}

function studentFacingEligibilityChecks(card, options = {}) {
  const checks = card.eligibility?.stage_1_checks || [];

  if (checks.length === 0) {
    const genericChecks = eligibilityChecksFromFailureCodes(
      options.eligibilityChecks,
      options.eligibilityFailures
    );
    if (genericChecks.length > 0) {
      return genericChecks;
    }

    return [
      check(
        'Entry requirements',
        isNotEligible(card) ? 'Not met' : 'Met',
        studentFacingText(card.eligibility?.summary) ||
          'The supported entry requirements have been assessed.'
      )
    ];
  }

  return checks.slice(0, 4).map((entry) => {
    const rawStatus = String(entry.status || entry.decision_outcome || '').toLowerCase();
    const status = rawStatus.includes('manual')
      ? 'Confirmed'
      : rawStatus.includes('not_applicable')
        ? 'Not applicable'
        : rawStatus.includes('not_used') || rawStatus.includes('not_considered')
          ? 'Not used'
          : rawStatus.includes('fail') || rawStatus.includes('not_eligible')
            ? 'Not met'
            : 'Met';
    const details = [entry.requirement, entry.applicant_value]
      .filter(Boolean)
      .map(studentFacingText)
      .join(' Applicant information: ');

    return check(entry.label || 'Entry requirement', status, details || 'This requirement was assessed.');
  });
}

function getProfileId(card) {
  return card.course_identity?.profile_id || card.engine_notes?.generated_from_profile_id || null;
}

function isNotEligible(card) {
  return (
    card.eligibility?.status === 'not_eligible' ||
    card.prediction?.result_band === 'not_eligible' ||
    card.display?.recommendation_display_state === 'not_eligible'
  );
}

function officialPredictionUnavailable(card = {}, options = {}) {
  const officialPrediction =
    options.officialPrediction ||
    card.prediction?.official_prediction ||
    card.official_prediction ||
    null;
  return Boolean(
    officialPrediction?.available === false ||
      card.prediction?.prediction_status === 'prediction_unavailable'
  );
}

function isManualReview(card, options) {
  return Boolean(
    options.manualReviewRequired ||
      card.eligibility?.status === 'manual_review' ||
      card.display?.recommendation_display_state === 'manual_review'
  );
}

function isInsufficientEvidence(card) {
  return (
    card.eligibility?.status === 'insufficient_evidence' ||
    card.prediction?.result_band === 'insufficient_evidence' ||
    card.display?.recommendation_display_state === 'insufficient_evidence' ||
    (!card.prediction?.available && !isNotEligible(card) && !officialPredictionUnavailable(card))
  );
}

function isEligibilityOnlyContext(card = {}, options = {}) {
  const readiness = options.readiness || card.readiness || card.engine_notes || {};
  return (
    card.prediction?.prediction_type === 'eligibility_only' ||
    card.prediction?.result_band === 'eligible_to_apply' ||
    card.display?.recommendation_display_state === 'eligibility_only' ||
    readiness.assessment_mode === 'eligibility_only' ||
    readiness.eligibility_only_ready === true ||
    options.scoreModel?.assessment_mode === 'eligibility_only'
  );
}

function applicantRouteFlags(card, options) {
  const applicant = options.applicantContext || card.applicant_context || {};
  const groupIds = applicant.applies_to_group_ids || [];
  const feeCohort = String(applicant.fee_cohort || '').toLowerCase();
  const entryRoute = String(
    applicant.entry_route || applicant.qualification_route || ''
  ).toLowerCase();

  return {
    contextual: Boolean(
      applicant.contextual ||
      applicant.widening_participation ||
      groupIds.some((groupId) => /contextual|widening/.test(String(groupId)))
    ),
    graduate: Boolean(
      applicant.graduate ||
      applicant.graduate_applicant ||
      /graduate/.test(entryRoute) ||
      groupIds.some((groupId) => /graduate/.test(String(groupId)))
    ),
    international: Boolean(
      applicant.international ||
      /international|overseas/.test(feeCohort) ||
      groupIds.some((groupId) => /international|overseas/.test(String(groupId)))
    )
  };
}

function buildEvidenceConfidence(card, options = {}) {
  const manualReview = isManualReview(card, options);
  const insufficientEvidence =
    !manualReview && isInsufficientEvidence(card);
  const insufficientEvidenceReasonCode =
    options.insufficientEvidenceReasonCode ||
    card.decision_transparency?.insufficient_evidence_reason_code ||
    null;
  const applicantInformationGap = isApplicantInformationReasonCode(insufficientEvidenceReasonCode);
  const readiness = options.readiness || card.readiness || card.engine_notes || {};
  const route = applicantRouteFlags(card, options);
  const routeEvidenceGap =
    (route.contextual && readiness.contextual_logic === false) ||
    (route.international && readiness.international_prediction === false) ||
    (route.graduate && readiness.manual_review_required === true);
  const coreEvidenceUnavailable =
    readiness.eligibility === false ||
    readiness.interview_prediction === false ||
    readiness.historical_guidance === false;

  if (!manualReview && officialPredictionUnavailable(card, options)) {
    const officialPrediction =
      options.officialPrediction ||
      card.prediction?.official_prediction ||
      card.official_prediction ||
      null;
    return {
      level: 'Medium',
      summary: 'Official eligibility evidence is available, but the official interview prediction is unavailable from public current-cycle data.',
      reasons: [
        'Official eligibility rules are available.',
        officialPrediction?.explanation ||
          'The university has not published enough current-cycle information for ApplySmart to reproduce the official interview prediction.'
      ]
    };
  }

  if (manualReview) {
    return {
      level: 'Limited',
      summary: 'The evidence is limited until the required adviser review is complete.',
      reasons: [
        'Some applicant information is missing or needs confirmation.',
        'Interview guidance is withheld until that review is complete.'
      ]
    };
  }

  if (isEligibilityOnlyContext(card, options)) {
    return {
      level: 'Medium',
      summary: 'The academic eligibility assessment is supported by official admissions evidence; interview likelihood is not predicted.',
      reasons: [
        'Official eligibility rules are available.',
        'The public result is limited to eligibility because the university does not publish an executable interview-prediction threshold.'
      ]
    };
  }

  if (insufficientEvidence || routeEvidenceGap || coreEvidenceUnavailable) {
    return {
      level: 'Limited',
      summary: 'The available evidence is not sufficient for confident guidance on this applicant route.',
      reasons: [
	        'Official eligibility information is used where it is available.',
	        applicantInformationGap
          ? 'A required applicant scoring input is missing, so ApplySmart cannot calculate the selection score for this route.'
          : routeEvidenceGap
	          ? 'This applicant route has an evidence gap that needs individual review.'
	          : 'Verified historical interview information is incomplete for this applicant route.'
	      ]
    };
  }

  const coreEvidenceReady =
    readiness.eligibility !== false &&
    readiness.interview_prediction !== false &&
    readiness.historical_guidance !== false &&
    readiness.regression !== false;
  const supportedScopeComplete =
    readiness.research_completeness === 'complete_for_supported_scope';
  const profileRecordsHighConfidence =
    String(readiness.prediction_confidence || '').toLowerCase() === 'high';

  if (
    coreEvidenceReady &&
    (supportedScopeComplete || profileRecordsHighConfidence)
  ) {
    return {
      level: 'High',
      summary: 'The recommendation is supported by strong admissions evidence for this applicant route.',
      reasons: [
        'Official eligibility rules are available.',
        'The university selection approach is implemented.',
        'Historical interview data is available for this applicant pool.',
        'The implemented checks have been tested across supported applicant profiles.'
      ]
    };
  }

  return {
    level: 'Medium',
    summary: 'The recommendation is supported by core admissions evidence, with some historical or route-specific limits.',
    reasons: [
      'Official eligibility rules are available.',
      'The university selection approach is implemented.',
      'Historical interview guidance is available, but some evidence is historical, FOI-derived or has documented gaps.'
    ]
  };
}

function selectionScoreThresholdComparison(options = {}) {
  const pool = options.guidancePool || {};
  const ranking = options.ranking || {};
  const scoreModel = options.scoreModel || {};
  const score = Number.isFinite(ranking.value) ? ranking.value : null;

  if (
    pool.metric !== 'selection_score' ||
    scoreModel.type !== 'component_sum' ||
    !Number.isFinite(score)
  ) {
    return null;
  }

  const threshold =
    Number.isFinite(pool.historical_cutoff?.value)
      ? pool.historical_cutoff.value
      : (pool.band_rules || [])
        .find((rule) =>
          ['interview_likely', 'realistic'].includes(rule.band) &&
          ['greater_than', 'greater_than_or_equal'].includes(rule.operator) &&
          Number.isFinite(rule.value)
        )?.value;

  if (!Number.isFinite(threshold)) {
    return null;
  }

  const guidanceText = [
    pool.comparison_guidance?.label,
    pool.comparison_guidance?.caveat,
    pool.comparison_guidance?.comparison_type
  ].filter(Boolean).join(' ');
  const suppliedLabel = typeof pool.comparison_guidance?.label === 'string'
    ? pool.comparison_guidance.label.trim()
    : '';
  const suppliedCategory = comparisonCategoryFromLabel(suppliedLabel);
  const provisional = suppliedCategory === 'advisory' ||
    /provisional|strategic benchmark|modelled|advisory|applysmart-derived/i.test(guidanceText);

  return {
    score,
    threshold,
    difference: score - threshold,
    provisional,
    comparison_label: suppliedLabel || null,
    comparison_category: suppliedCategory,
    comparison_caveat: pool.comparison_guidance?.caveat || null
  };
}

function formatScorePoints(value) {
  return Number(value.toFixed(2)).toString();
}

function comparisonCategoryFromLabel(label = '') {
  const text = String(label || '').toLowerCase();
  if (/advisory|modelled|modeled|applysmart|guidance zone|historical-equivalent/.test(text)) {
    return 'advisory';
  }
  if (/\b(published|official)\b/.test(text) && !/\bunpublished\b/.test(text) && /threshold|minimum/.test(text)) {
    return 'published_threshold';
  }
  if (/observed|interviewed-score|lowest interviewed|average interviewed|interview scores/.test(text)) {
    return 'observed_data';
  }
  return null;
}

function publicComparisonLabel(label = '') {
  const trimmed = String(label || '').trim();
  const text = trimmed.toLowerCase();
  if (/applysmart/.test(text) && /advisory/.test(text) && /historical-equivalent/.test(text) && /ucat/.test(text)) {
    return 'ApplySmart advisory UCAT range based on historical admissions evidence';
  }
  return trimmed;
}

function ucatComparisonLabel(comparison = {}) {
  if (comparison.comparison_type === 'official_minimum') {
    return {
      comparison_label: 'Published UCAT minimum',
      comparison_label_type: 'published_ucat_minimum',
      difference_word: 'minimum'
    };
  }

  const suppliedLabel = typeof comparison.benchmark_label === 'string'
    ? comparison.benchmark_label.trim()
    : '';
  const displayLabel = publicComparisonLabel(suppliedLabel);
  const suppliedCategory = ucatComparisonCategory(comparison);

  if (suppliedCategory === 'published_threshold' && comparison.comparison_type === 'historical_range') {
    return {
      comparison_label: `ApplySmart band range above ${displayLabel}`,
      comparison_label_type: 'applysmart_advisory_guide',
      difference_word: 'benchmark'
    };
  }

  if (suppliedCategory === 'published_threshold') {
    return {
      comparison_label: displayLabel,
      comparison_label_type: 'published_interview_threshold',
      difference_word: 'threshold'
    };
  }

  if (suppliedCategory === 'advisory' || comparison.comparison_type === 'current_guidance') {
    return {
      comparison_label: displayLabel || 'ApplySmart advisory benchmark',
      comparison_label_type: 'applysmart_advisory_guide',
      difference_word: 'benchmark'
    };
  }

  if (suppliedCategory === 'observed_data') {
    return {
      comparison_label: displayLabel || 'Historical interview data',
      comparison_label_type: 'recent_interview_benchmark',
      difference_word: 'data'
    };
  }

  if (comparison.comparison_type === 'historical_average') {
    return {
      comparison_label: displayLabel || 'Recent interview benchmark',
      comparison_label_type: 'recent_interview_benchmark',
      difference_word: 'benchmark'
    };
  }

  return {
    comparison_label: displayLabel || 'Historical interview benchmark',
    comparison_label_type: 'historical_interview_guide',
    difference_word: 'benchmark'
  };
}

function comparisonLabelForUcat(comparison = {}) {
  return ucatComparisonLabel(comparison);
}

function ucatComparisonCategory(comparison = {}) {
  return comparisonCategoryFromLabel([
    comparison.benchmark_label,
    comparison.caveat,
    comparison.comparison_type
  ].filter(Boolean).join(' '));
}

function ucatComparisonDisplayName(comparison = {}) {
  const label = ucatComparisonLabel(comparison).comparison_label;
  const category = ucatComparisonCategory(comparison);
  if (category === 'published_threshold' || category === 'advisory') {
    return label;
  }
  if (category === 'observed_data') {
    return Number.isFinite(comparison.benchmark_max)
      ? 'historical interviewed-score range'
      : 'historical interview data';
  }
  if (comparison.comparison_type === 'historical_average') {
    return 'recent interviewed-score benchmark';
  }
  if (comparison.comparison_type === 'historical_range') {
    return 'historical interview benchmark range';
  }
  return 'historical interview benchmark';
}

function differenceDirection(difference) {
  if (!Number.isFinite(difference)) {
    return null;
  }
  if (difference > 0) return 'above';
  if (difference < 0) return 'below';
  return 'at';
}

function buildUcatSelectionMetric(ucatComparison, options = {}) {
  if (!ucatComparison || typeof ucatComparison !== 'object') {
    return null;
  }

  if (!Number.isFinite(ucatComparison.applicant_ucat)) {
    return null;
  }

  const maximum = Number.isFinite(options.bandMetric?.scale?.max)
    ? options.bandMetric.scale.max
    : options.applicantContext?.admissions_tests?.ucat?.score_scale ?? 2700;

  if (!Number.isFinite(ucatComparison.benchmark_min)) {
    return {
      type: 'ucat',
      label: 'UCAT ranking',
      applicant_value: ucatComparison.applicant_ucat,
      comparison_value: null,
      comparison_max_value: null,
      comparison_label: null,
      comparison_label_type: null,
      comparison_context: null,
      difference: null,
      difference_direction: null,
      difference_word: null,
      maximum_value: Number.isFinite(maximum) ? maximum : null,
      display_mode: 'score',
      display_eligibility: true,
      entry_year: null,
      caveat: null
    };
  }

  const label = comparisonLabelForUcat(ucatComparison);
  const difference = ucatComparison.applicant_ucat - ucatComparison.benchmark_min;

  return {
    type: 'ucat',
    label: 'UCAT comparison',
    applicant_value: ucatComparison.applicant_ucat,
    comparison_value: ucatComparison.benchmark_min,
    comparison_max_value: Number.isFinite(ucatComparison.benchmark_max)
      ? ucatComparison.benchmark_max
      : null,
    comparison_label: label.comparison_label,
    comparison_label_type: label.comparison_label_type,
    comparison_context: ucatComparison.benchmark_label || null,
    difference,
    difference_direction: differenceDirection(difference),
    difference_word: label.difference_word,
    maximum_value: Number.isFinite(maximum) ? maximum : null,
    display_mode: 'comparison',
    display_eligibility: true,
    entry_year: null,
    caveat: ucatComparison.caveat || HISTORICAL_GUIDANCE_CAVEAT
  };
}

function buildScoreSelectionMetric(scoreBreakdown, selectionScoreComparison) {
  if (!scoreBreakdown || !Number.isFinite(scoreBreakdown.value)) {
    return null;
  }

  const scoreName = String(scoreBreakdown.name || '').toLowerCase();
  const type = /\bpoints?\b/.test(scoreName) && !/selection score/.test(scoreName)
    ? 'points'
    : 'selection_score';
  const label = type === 'points' ? 'Points score' : 'Selection score';
  const hasComparison = Number.isFinite(selectionScoreComparison?.threshold);
  const suppliedComparisonLabel = selectionScoreComparison?.comparison_label;
  const comparisonLabel = suppliedComparisonLabel ||
    (selectionScoreComparison?.provisional
      ? 'ApplySmart advisory benchmark'
      : type === 'points'
        ? 'Historical points guide'
        : 'Historical selection score');
  const comparisonLabelType =
    selectionScoreComparison?.comparison_category === 'published_threshold'
      ? 'published_interview_threshold'
      : selectionScoreComparison?.provisional
        ? 'applysmart_advisory_guide'
        : 'historical_interview_guide';
  const comparisonWord =
    comparisonLabelType === 'published_interview_threshold'
      ? 'threshold'
      : comparisonLabelType === 'applysmart_advisory_guide'
        ? 'benchmark'
        : type === 'points'
          ? 'guide'
          : 'benchmark';

  return {
    type,
    label,
    applicant_value: scoreBreakdown.value,
    comparison_value: hasComparison ? selectionScoreComparison.threshold : null,
    comparison_max_value: null,
    comparison_label: hasComparison ? comparisonLabel : null,
    comparison_label_type: hasComparison ? comparisonLabelType : null,
    comparison_context: scoreBreakdown.name || null,
    difference: hasComparison ? selectionScoreComparison.difference : null,
    difference_direction: hasComparison ? differenceDirection(selectionScoreComparison.difference) : null,
    difference_word: hasComparison ? comparisonWord : null,
    maximum_value: Number.isFinite(scoreBreakdown.max) ? scoreBreakdown.max : null,
    display_mode: 'score',
    display_eligibility: true,
    entry_year: null,
    caveat: hasComparison ? selectionScoreComparison.comparison_caveat || HISTORICAL_GUIDANCE_CAVEAT : null
  };
}

function buildEligibilitySelectionMetric(state) {
  if (state !== 'eligibility_only') {
    return null;
  }
  return {
    type: 'eligibility',
    label: 'Eligibility',
    applicant_value: null,
    comparison_value: null,
    comparison_max_value: null,
    comparison_label: null,
    comparison_label_type: null,
    comparison_context: null,
    difference: null,
    difference_direction: null,
    difference_word: null,
    maximum_value: null,
    display_mode: 'eligibility',
    display_eligibility: true,
    entry_year: null,
    value_label: 'Eligibility requirements met',
    caveat: null
  };
}

function buildSelectionMetric({ state, scoreBreakdown, selectionScoreComparison, ucatComparison, options }) {
  if (state === 'manual_review' || state === 'insufficient_evidence' || state === 'not_eligible') {
    return null;
  }
  if (state === 'eligibility_only') {
    return buildEligibilitySelectionMetric(state);
  }

  return buildScoreSelectionMetric(scoreBreakdown, selectionScoreComparison) ||
    buildUcatSelectionMetric(ucatComparison, options) ||
    buildEligibilitySelectionMetric(state);
}

function lowerInitial(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function buildCompactStatus({ state, selectionMetric, insufficientEvidenceReasonCode, predictionAvailable = true }) {
  if (state === 'not_eligible') {
    return {
      label: 'Entry requirements not met',
      type: 'eligibility',
      tone: 'negative'
    };
  }

  if (state === 'manual_review') {
    return {
      label: 'Needs adviser review',
      type: 'manual_review',
      tone: 'warning'
    };
  }

  if (state === 'insufficient_evidence') {
    const applicantInformationGap =
      isApplicantInformationReasonCode(insufficientEvidenceReasonCode) ||
      !insufficientEvidenceReasonCode;
    return {
      label: applicantInformationGap ? 'Information needed' : 'Prediction unavailable',
      type: applicantInformationGap ? 'information_needed' : 'prediction_unavailable',
      tone: applicantInformationGap ? 'warning' : 'neutral'
    };
  }

  if (
    selectionMetric &&
    Number.isFinite(selectionMetric.comparison_value) &&
    ['above', 'below', 'at'].includes(selectionMetric.difference_direction) &&
    typeof selectionMetric.comparison_label === 'string' &&
    selectionMetric.comparison_label.trim()
  ) {
    const comparisonLabel = selectionMetric.comparison_label.trim();
    if (selectionMetric.difference_direction === 'below') {
      return {
        label: `Below ${lowerInitial(comparisonLabel)}`,
        type: 'selection_comparison',
        tone: 'negative'
      };
    }
    return {
      label: `${comparisonLabel} ${selectionMetric.difference_direction === 'at' ? 'met' : 'exceeded'}`,
      type: 'selection_comparison',
      tone: 'positive'
    };
  }

  if (selectionMetric?.type === 'eligibility' || state === 'eligibility_only') {
    return {
      label: 'Eligibility requirements met',
      type: 'eligibility',
      tone: 'positive'
    };
  }

  if (selectionMetric?.type === 'ucat') {
    return {
      label: 'UCAT ranking assessed',
      type: 'selection_metric',
      tone: 'neutral'
    };
  }

  if (selectionMetric?.type === 'selection_score' || selectionMetric?.type === 'points') {
    const label = typeof selectionMetric.label === 'string' && selectionMetric.label.trim()
      ? selectionMetric.label.trim()
      : 'Selection score';
    return {
      label: `${label} calculated`,
      type: 'selection_metric',
      tone: 'neutral'
    };
  }

  if (predictionAvailable) {
    return {
      label: 'Selection approach assessed',
      type: 'selection_metric',
      tone: 'neutral'
    };
  }

  return {
    label: 'Prediction unavailable',
    type: 'prediction_unavailable',
    tone: 'neutral'
  };
}

function comparisonMetricLabelFromSelectionMetric(metric) {
  if (!metric || typeof metric.comparison_label !== 'string' || !metric.comparison_label.trim()) {
    return null;
  }

  if (metric.comparison_label_type === 'historical_interview_guide') {
    const context = `${metric.comparison_context || ''} ${metric.label || ''}`.toLowerCase();
    if (context.includes('selection score')) {
      return 'Historical selection score';
    }
    if (context.includes('point') || metric.type === 'points') {
      return 'Historical points guide';
    }
  }

  return metric.comparison_label.trim();
}

function comparisonMetricValueFromSelectionMetric(metric) {
  if (!metric || !Number.isFinite(metric.comparison_value)) {
    return null;
  }

  const value = formatMetricDisplayValue(metric.comparison_value);
  if (!Number.isFinite(metric.comparison_max_value)) {
    return value;
  }

  return `${value}-${formatMetricDisplayValue(metric.comparison_max_value)}`;
}

function selectionComparisonMetrics(selectionMetric) {
  if (!selectionMetric || !Number.isFinite(selectionMetric.comparison_value)) {
    return [];
  }

  const label = comparisonMetricLabelFromSelectionMetric(selectionMetric);
  const value = comparisonMetricValueFromSelectionMetric(selectionMetric);
  if (!label || !value) {
    return [];
  }

  return [
    {
      label,
      value,
      difference: formatMetricDifference(selectionMetric.difference)
    }
  ];
}

function buildComparisonMetrics({ state, selectionMetric, ucatComparison, options = {} }) {
  if (state !== 'standard') {
    return [];
  }

  const historicalAdmissionsMetrics = historicalAdmissionComparisonMetrics(
    options.historicalAdmissions,
    options.applicantGroupIds,
    options,
    ucatComparison
  );
  if (historicalAdmissionsMetrics.length > 0) {
    return historicalAdmissionsMetrics;
  }

  return selectionComparisonMetrics(selectionMetric);
}

function buildComparisonMetricsTitle({ state, comparisonMetrics, options = {} }) {
  if (state !== 'standard' || !Array.isArray(comparisonMetrics) || comparisonMetrics.length === 0) {
    return null;
  }

  const cycles = options.historicalAdmissions?.cycles;
  if (!Array.isArray(cycles) || cycles.length === 0) {
    return null;
  }

  const years = cycles.map(extractCycleYear).filter(Number.isFinite);
  const mostRecentYear = years.length > 0 ? Math.max(...years) : null;
  if (mostRecentYear === null) {
    return null;
  }

  const mostRecentEntries = filterHistoricalEntriesForApplicant(
    cycles.filter((c) => extractCycleYear(c) === mostRecentYear),
    options.applicantGroupIds
  );
  const hasInterviewMetric = mostRecentEntries.some((entry) =>
    String(entry.metric || entry.metric_type || '').toLowerCase().includes('interview')
  );

  return hasInterviewMetric ? `Historical Interview Data (${mostRecentYear})` : null;
}

function selectionScoreThresholdText(comparison) {
  if (!comparison) {
    return null;
  }

  const difference = comparison.difference;
  const formattedThreshold = formatScorePoints(comparison.threshold);
  const benchmarkName = comparison.comparison_label ||
    (comparison.provisional
      ? 'ApplySmart advisory benchmark'
      : 'historical selection score');
  if (difference < 0) {
    const suffix = comparison.provisional
      ? 'This result uses ApplySmart advisory modelling, not an official cut-off.'
      : 'This result does not mean the comparison point was met.';
    return `Your selection score is ${formatScorePoints(Math.abs(difference))} points below the ${benchmarkName} of ${formattedThreshold} for this applicant pool. ${suffix}`;
  }
  if (difference > 0) {
    return `Your selection score is ${formatScorePoints(difference)} points above the ${benchmarkName} of ${formattedThreshold} for this applicant pool.`;
  }
  return `Your selection score meets the ${benchmarkName} of ${formattedThreshold} for this applicant pool.`;
}

function existingSelectionScoreThresholdText(card) {
  const selectionStage = card.decision_transparency?.decision_path?.find((stage) =>
    stage.stage === 'Selection model'
  );
  const thresholdCheck = selectionStage?.checks?.find((entry) =>
    entry.label === 'Selection score threshold' ||
    entry.label === 'Selection score benchmark' ||
    entry.label === 'Selection score guide'
  );
  return thresholdCheck?.summary || null;
}

function selectionScoreThresholdSummary(options = {}) {
  return options.selectionScoreText || selectionScoreThresholdText(options.selectionScoreComparison);
}

function calculatedScoreExplanation(context = {}) {
  if (context.estimated_selection_score) {
    return null;
  }
  const score = context.official_score || null;
  if (score && Number.isFinite(score.value)) {
    const label = score.label || score.name || 'selection score';
    return `ApplySmart has calculated this ${lowerInitial(label)} using the available admissions evidence for this applicant group.`;
  }
  if (
    context.score_model?.type === 'component_sum' &&
    Number.isFinite(context.ranking?.value)
  ) {
    return 'ApplySmart has calculated this selection score using the available admissions evidence for this applicant group.';
  }
  if (!score || !Number.isFinite(score.value)) {
    return null;
  }
  return null;
}

function selectionScoreThresholdComparisonCheck(comparison) {
  if (!comparison) {
    return null;
  }

  const status = comparison.difference < 0
    ? 'Below guide'
    : comparison.difference > 0
      ? 'Above guide'
      : 'At guide';
  return check(
    comparison.provisional ? 'Selection score benchmark' : 'Selection score guide',
    status,
    selectionScoreThresholdText(comparison)
  );
}

function historicalSummary(card, state, options = {}) {
  const presentation = configuredPresentation(card, options);
  if (state === 'eligibility_only') {
    return 'Historical admissions data is not used for this eligibility-only result because ApplySmart is not predicting interview likelihood.';
  }
  if (state === 'not_eligible') {
    return `Historical admissions data is not applied because the entry requirements are not met. ${HISTORICAL_GUIDANCE_CAVEAT}`;
  }
  if (state === 'manual_review') {
    return `Historical admissions data is held back until the review is complete. ${HISTORICAL_GUIDANCE_CAVEAT}`;
  }
  if (state === 'insufficient_evidence') {
    const reasonCode = options.insufficientEvidenceReasonCode ||
      card.decision_transparency?.insufficient_evidence_reason_code;
    const reasonSummary = reasonScopedPresentationValue(
      presentation,
      'insufficient_evidence_historical_summaries',
      reasonCode
    );
    if (reasonSummary) {
      return reasonSummary;
    }
    if (isApplicantInformationReasonCode(reasonCode)) {
      return `Historical admissions data was not compared because a required applicant scoring input is missing. ${HISTORICAL_GUIDANCE_CAVEAT}`;
    }
    return `There is not enough verified historical admissions data for this applicant route. ${HISTORICAL_GUIDANCE_CAVEAT}`;
  }
  if (presentation.historical_summary) {
    return presentation.historical_summary;
  }
  if (getProfileId(card) === 'king-s-college-london-a100') {
    const existingHistoricalSummary = card.decision_transparency?.decision_path?.find((stage) =>
      stage.stage === 'Historical guidance'
    )?.summary;
    if (existingHistoricalSummary) {
      return existingHistoricalSummary;
    }
  }

  const selectionScoreText = selectionScoreThresholdSummary(options);
  if (selectionScoreText) {
    return `${selectionScoreText} ${HISTORICAL_GUIDANCE_CAVEAT}`;
  }
  if (['current_guidance', 'historical_range', 'historical_threshold', 'historical_average'].includes(options.ucatComparison?.comparison_type)) {
    return `${ucatComparisonAssessmentText(options.ucatComparison)} ${options.ucatComparison.caveat || HISTORICAL_GUIDANCE_CAVEAT}`;
  }

  return `The result was assessed using the available admissions evidence for this applicant group. ${HISTORICAL_GUIDANCE_CAVEAT}`;
}

function recommendationSummary(card, state, options = {}) {
  if (state === 'eligibility_only') {
    const presentation = configuredPresentation(card, options);
    return presentation.recommendation_summary ||
      'You meet the supported academic requirements. ApplySmart does not predict Buckingham MMA or MMI progression.';
  }
  if (state === 'not_eligible') {
    return 'The interview recommendation is not applied because the supported entry requirements are not met.';
  }
  if (state === 'manual_review') {
    return 'An adviser must review the missing or unconfirmed information before interview guidance can be shown.';
  }
  if (state === 'insufficient_evidence') {
    const reasonCode = options.insufficientEvidenceReasonCode ||
      card.decision_transparency?.insufficient_evidence_reason_code;
    const reasonSummary = reasonScopedPresentationValue(
      configuredPresentation(card, options),
      'insufficient_evidence_recommendation_summaries',
      reasonCode
    );
    if (reasonSummary) {
      return reasonSummary;
    }
    if (isApplicantInformationReasonCode(reasonCode)) {
      return 'No interview recommendation is shown because a required applicant scoring input is missing.';
    }
    return 'No confident recommendation is shown because the available evidence is insufficient.';
  }

  const selectionScoreText = selectionScoreThresholdSummary(options);
  if (selectionScoreText) {
    return `${selectionScoreText} Treat this as guidance for university choice, not a promised interview.`;
  }

  return `${card.display?.primary_user_facing_recommendation || 'Interview guidance available'}. Treat this as guidance for university choice, not a promised interview.`;
}

function hasBuilderOptions(options = {}) {
  return Object.keys(options || {}).length > 0;
}

function finiteNumber(...values) {
  return values.find((value) => Number.isFinite(value)) ?? null;
}

function completedCardScoreValue(card) {
  const predictionScore = card.prediction?.score;
  if (Number.isFinite(predictionScore)) {
    return predictionScore;
  }
  if (predictionScore && typeof predictionScore === 'object') {
    return finiteNumber(
      predictionScore.value,
      predictionScore.pre_interview_score?.value,
      predictionScore.application_score?.value,
      predictionScore.total_score?.value
    );
  }
  return finiteNumber(
    card.estimated_selection_score?.value,
    card.official_score?.value,
    card.stage_2?.score?.value,
    card.stage_2_selection?.represented_ranking_input?.score
  );
}

function completedCardScoreMax(card) {
  const predictionScore = card.prediction?.score;
  if (predictionScore && typeof predictionScore === 'object') {
    return finiteNumber(
      predictionScore.max,
      predictionScore.maximum,
      predictionScore.pre_interview_score?.max,
      predictionScore.application_score?.max,
      predictionScore.total_score?.max
    );
  }
  return finiteNumber(
    card.estimated_selection_score?.max,
    card.official_score?.max,
    card.stage_2?.score?.max,
    card.stage_2_selection?.represented_ranking_input?.max,
    card.prediction?.score_scale?.max
  );
}

function scoreBreakdownChecksFromCompletedCard(card, transparency) {
  const estimatedComponents = card.estimated_selection_score?.components;
  if (estimatedComponents) {
    return [
      scoreComponentCheck('GCSE score', estimatedComponents.gcse),
      scoreComponentCheck('UCAT score', estimatedComponents.ucat),
      scoreComponentCheck('SJT score', estimatedComponents.sjt),
      contextualScoreComponentCheck(estimatedComponents.contextual)
    ].filter(Boolean);
  }

  const officialComponents = card.official_score?.components;
  if (officialComponents) {
    return [
      scoreComponentCheck('GCSE score', officialComponents.gcse),
      scoreComponentCheck('UCAT cognitive score', officialComponents.ucat_cognitive),
      scoreComponentCheck('SJT score', officialComponents.sjt)
    ].filter(Boolean);
  }

  const stage2Components = card.stage_2?.score?.components;
  if (Array.isArray(stage2Components) && stage2Components.length > 0) {
    return stage2Components
      .map((component) => scoreComponentCheck(
        humanScoreComponentLabel(component.component_id || component.label),
        component
      ))
      .filter(Boolean);
  }

  const rankingFactors = card.stage_2_selection?.ranking_factors;
  if (
    card.stage_2_selection?.represented_ranking_input?.metric === 'selection_score' &&
    Array.isArray(rankingFactors)
  ) {
    return rankingFactors
      .filter((factor) => factor.calculation_status === 'calculated')
      .map((factor) => check(
        factor.label || humanScoreComponentLabel(factor.factor_id),
        'Counted',
        studentFacingText(factor.notes || 'This component was counted in the selection score.')
      ));
  }

  const selectionChecks =
    transparency?.decision_path?.find((stage) => stage.stage === 'Selection model')?.checks || [];
  return selectionChecks.filter((entry) => {
    if (
      entry.label === 'Applicant pool' ||
      entry.label === 'Selection approach' ||
      /tie-break|evidence limit/i.test(entry.label)
    ) {
      return false;
    }
    if (/cannot be completed|not fully calculated|awaiting/i.test(`${entry.status} ${entry.summary}`)) {
      return false;
    }
    return /(contribution|score|point|total|sjt)/i.test(`${entry.label} ${entry.summary}`);
  });
}

function completedCardHasScoringSurface(card, transparency) {
  if (
    card.estimated_selection_score ||
    card.official_score ||
    card.stage_2?.score ||
    card.stage_2_selection?.represented_ranking_input?.metric === 'selection_score'
  ) {
    return true;
  }

  const selectionChecks =
    transparency?.decision_path?.find((stage) => stage.stage === 'Selection model')?.checks || [];
  return selectionChecks.some((entry) =>
    /calculated/i.test(entry.status) &&
    !/cannot be completed|not fully calculated|awaiting/i.test(entry.summary) &&
    /(combined score|application score|total score|pre-interview total)/i.test(entry.label)
  );
}

function groupRuleApplies(rule = {}, groupIds = []) {
  const groups = new Set(groupIds || []);
  const all = rule.all_group_ids || rule.applies_to_group_ids || [];
  const any = rule.any_group_ids || [];
  const excluded = rule.excluded_group_ids || [];

  return (
    all.every((groupId) => groups.has(groupId)) &&
    (any.length === 0 || any.some((groupId) => groups.has(groupId))) &&
    !excluded.some((groupId) => groups.has(groupId))
  );
}

function resolveApplicantUcatMinimum(stage1Eligibility, groupIds = []) {
  const ucat = stage1Eligibility?.admissions_tests?.ucat || {};
  const groupRule = (ucat.group_minimum_total_scores || [])
    .find((rule) => groupRuleApplies(rule, groupIds));
  const minimum = groupRule?.minimum_total_score ?? ucat.minimum_total_score;

  return Number.isFinite(minimum) ? minimum : null;
}

function selectApplicableSjtPolicy(stage1Eligibility, groupIds = []) {
  const sjt = stage1Eligibility?.admissions_tests?.sjt || {};
  const groupPolicy = (sjt.group_policies || [])
    .find((policy) => groupRuleApplies(policy, groupIds));
  return { ...sjt, ...(groupPolicy || {}) };
}

function formatBandList(bands = []) {
  const sorted = [...bands].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return `Band ${sorted[0]}`;
  if (sorted.every((band, index) => index === 0 || band === sorted[index - 1] + 1)) {
    return `Bands ${sorted[0]}-${sorted[sorted.length - 1]}`;
  }
  return `Bands ${sorted.slice(0, -1).join(', ')} and ${sorted[sorted.length - 1]}`;
}

function buildSjtInterpretation(stage1Eligibility, groupIds = [], applicantContext = {}) {
  const policy = selectApplicableSjtPolicy(stage1Eligibility, groupIds);
  const band = applicantContext?.admissions_tests?.ucat?.sjt_band;
  const excludedBands = policy.excluded_bands || [];
  const acceptedBands = policy.accepted_bands || [];
  const usedInScore = policy.scoring?.used_in_score === true;
  const usedPostInterview =
    policy.used_after_interview === true ||
    policy.sjt_used_post_interview === true ||
    /post[- ]interview/i.test(String(policy.notes || policy.current_interview_score_contribution || ''));

  let outcome = 'ignored';
  let summary = Number.isFinite(band)
    ? `Band ${band} - not used for interview selection.`
    : 'SJT is not used for interview selection.';

  if (policy.used === false || policy.used_as_gate === false) {
    outcome = usedPostInterview ? 'post_interview' : 'ignored';
    summary = Number.isFinite(band)
      ? `Band ${band} - ${usedPostInterview ? 'used after interview, not for interview shortlisting.' : 'not used for interview selection.'}`
      : usedPostInterview
        ? 'SJT is used after interview, not for interview shortlisting.'
        : 'SJT is not used for interview selection.';
  } else if (excludedBands.includes(band)) {
    outcome = 'not_met';
    const excludedText = formatBandList(excludedBands) || `Band ${band}`;
    summary = `Not met - ${excludedText} ${excludedBands.length === 1 ? 'is' : 'are'} not accepted.`;
  } else if (usedInScore) {
    outcome = 'scored';
    summary = Number.isFinite(band)
      ? `Band ${band} - contributes to the university's selection score.`
      : 'SJT contributes to the university selection score.';
  } else if (policy.used_as_gate === true) {
    outcome = 'met';
    const acceptedText = formatBandList(acceptedBands);
    summary = acceptedText
      ? `Met - ${acceptedText} are accepted.`
      : Number.isFinite(band)
        ? `Band ${band} - accepted by the university's SJT gate.`
        : 'The SJT requirement is met.';
  }

  return {
    applicant_sjt_band: Number.isFinite(band) ? band : null,
    sjt_policy: policy.notes || policy.policy || summary,
    sjt_outcome: outcome,
    summary
  };
}

function deriveHistoricalBenchmark(guidancePool = {}, scoreModel = {}) {
  const pool = guidancePool || {};
  const rules = (pool.band_rules || []).filter((rule) =>
    rule.metric === undefined || rule.metric === pool.metric
  );
  if (pool.metric !== 'ucat_total' || rules.length === 0) {
    return { comparison_type: 'ranking_only', benchmark_min: null, benchmark_max: null };
  }

  if (pool.comparison_guidance?.comparison_type === 'current_guidance') {
    const guidanceKey = String(pool.pool_id || '').includes('international')
      ? 'international'
      : 'home';
    const guidance = scoreModel?.current_scale_guidance?.[guidanceKey];
    if (Number.isFinite(guidance?.value)) {
      return {
        comparison_type: 'current_guidance',
        benchmark_min: guidance.value,
        benchmark_max: null,
        benchmark_label: pool.comparison_guidance?.label || null,
        caveat: pool.comparison_guidance?.caveat || null
      };
    }
  }

  const realisticRange = rules.find((rule) =>
    rule.band === 'realistic' &&
    rule.operator === 'between_inclusive' &&
    Number.isFinite(rule.min) &&
    Number.isFinite(rule.max)
  );
  if (realisticRange) {
    return {
      comparison_type: 'historical_range',
      benchmark_min: realisticRange.min,
      benchmark_max: realisticRange.max,
      benchmark_label: pool.comparison_guidance?.label || null,
      caveat: pool.comparison_guidance?.caveat || null
    };
  }

  const thresholdRule =
    rules.find((rule) =>
      ['interview_likely', 'realistic'].includes(rule.band) &&
      ['greater_than', 'greater_than_or_equal'].includes(rule.operator) &&
      Number.isFinite(rule.value)
    ) ||
    rules.find((rule) =>
      ['ambitious', 'high_risk'].includes(rule.band) &&
      ['less_than', 'less_than_or_equal'].includes(rule.operator) &&
      Number.isFinite(rule.value)
    );

  return thresholdRule
    ? {
      comparison_type: pool.comparison_guidance?.comparison_type || 'historical_threshold',
      benchmark_min: thresholdRule.value,
      benchmark_max: null,
      benchmark_label: pool.comparison_guidance?.label || null,
      caveat: pool.comparison_guidance?.caveat || null
    }
    : { comparison_type: 'ranking_only', benchmark_min: null, benchmark_max: null };
}

function positionAgainstBenchmark(applicantUcat, comparison) {
  if (!Number.isFinite(applicantUcat)) return null;
  if (comparison.comparison_type === 'historical_range') {
    if (applicantUcat < comparison.benchmark_min) return 'below';
    if (applicantUcat > comparison.benchmark_max) return 'above';
    return 'within';
  }
  if (
    ['official_minimum', 'historical_threshold', 'historical_average', 'current_guidance'].includes(comparison.comparison_type) &&
    Number.isFinite(comparison.benchmark_min)
  ) {
    return applicantUcat < comparison.benchmark_min ? 'below' : 'above';
  }
  return null;
}

function buildUcatComparison(options = {}) {
  const applicantUcat =
    options.bandMetric?.metric === 'ucat_total' && Number.isFinite(options.bandMetric.value)
      ? options.bandMetric.value
      : options.applicantContext?.admissions_tests?.ucat?.total_score;
  const officialMinimum = resolveApplicantUcatMinimum(
    options.stage1Eligibility,
    options.applicantGroupIds
  );
  const minimumFailure = (options.eligibilityFailures || [])
    .some((failure) => String(failure).startsWith('minimum_ucat_total_not_met'));
  const benchmark = deriveHistoricalBenchmark(options.guidancePool, options.scoreModel);
  const comparison = minimumFailure && officialMinimum
    ? {
      comparison_type: 'official_minimum',
      benchmark_min: officialMinimum,
      benchmark_max: null
    }
    : benchmark;
  const position = positionAgainstBenchmark(applicantUcat, comparison);
  const differenceFromBenchmark =
    Number.isFinite(applicantUcat) &&
    ['official_minimum', 'historical_threshold', 'historical_average', 'current_guidance'].includes(comparison.comparison_type) &&
    Number.isFinite(comparison.benchmark_min)
      ? applicantUcat - comparison.benchmark_min
      : null;
  const sjt = buildSjtInterpretation(
    options.stage1Eligibility,
    options.applicantGroupIds,
    options.applicantContext
  );

  return {
    comparison_type: comparison.comparison_type,
    applicant_ucat: Number.isFinite(applicantUcat) ? applicantUcat : null,
    benchmark_min: comparison.benchmark_min,
    benchmark_max: comparison.benchmark_max,
    benchmark_label: comparison.benchmark_label || null,
    caveat: comparison.caveat || null,
    difference_from_benchmark: differenceFromBenchmark,
    position,
    applicant_pool: options.applicantPool ||
      humanApplicantPoolLabel(options.applicantGroupIds, options.applicantContext) ||
      null,
    sjt_policy: sjt.sjt_policy,
    sjt_outcome: sjt.sjt_outcome,
    sjt_summary: sjt.summary,
    applicant_sjt_band: sjt.applicant_sjt_band,
    official_ucat_minimum: Number.isFinite(officialMinimum)
      ? {
        minimum: officialMinimum,
        met: Number.isFinite(applicantUcat) ? applicantUcat >= officialMinimum : false,
        summary: Number.isFinite(applicantUcat)
          ? `${applicantUcat >= officialMinimum ? 'Met' : 'Not met'} - your score is ${applicantUcat} and the published minimum is ${officialMinimum}.`
          : `Not met - the published minimum is ${officialMinimum}.`
      }
      : null
  };
}

function ucatComparisonAssessmentText(comparison) {
  const ucat = comparison?.applicant_ucat;
  if (!comparison || !Number.isFinite(ucat)) {
    return 'UCAT ranking: Eligible applicants are ranked by UCAT. No reliable numerical historical comparison is available.';
  }
  const comparisonName = ucatComparisonDisplayName(comparison);

  if (comparison.comparison_type === 'official_minimum') {
    return `UCAT minimum: ${comparison.position === 'below' ? 'Not met' : 'Met'} - your score is ${ucat} and the published minimum is ${comparison.benchmark_min}.`;
  }
  if (comparison.comparison_type === 'historical_threshold') {
    const difference = comparison.difference_from_benchmark;
    if (Number.isFinite(difference)) {
      const direction = difference >= 0 ? 'above' : 'below';
      return `UCAT: ${ucat} - ${Math.abs(difference)} points ${direction} the ${comparisonName} of ${comparison.benchmark_min}.`;
    }
    return `UCAT: ${ucat} - compared with the ${comparisonName} of ${comparison.benchmark_min}.`;
  }
  if (comparison.comparison_type === 'current_guidance') {
    const difference = comparison.difference_from_benchmark;
    if (Number.isFinite(difference)) {
      const direction = difference >= 0 ? 'above' : 'below';
      return `UCAT: ${ucat}/2700 - ${Math.abs(difference)} points ${direction} the ${comparisonName} of ${comparison.benchmark_min}/2700.`;
    }
    return `UCAT: ${ucat}/2700 - compared with the ${comparisonName} of ${comparison.benchmark_min}/2700.`;
  }
  if (comparison.comparison_type === 'historical_range') {
    const positionText = { above: 'above', within: 'within', below: 'below' }[comparison.position] || 'compared with';
    return `UCAT: ${ucat} - ${positionText} the ${comparisonName} of ${comparison.benchmark_min}-${comparison.benchmark_max}.`;
  }
  if (comparison.comparison_type === 'historical_average') {
    const direction = comparison.position === 'below' ? 'below' : 'above';
    return `UCAT: ${ucat} - ${direction} the ${comparisonName} of ${comparison.benchmark_min}.`;
  }

  return 'UCAT ranking: Eligible applicants are ranked by UCAT. No reliable numerical historical comparison is available.';
}

function ucatComparisonRecommendationText(comparison) {
  if (!comparison || comparison.position === null) {
    return 'You meet the academic requirements. Eligible applicants are ranked by UCAT. No reliable numerical historical comparison is available.';
  }
  if (comparison.comparison_type === 'official_minimum') {
    return comparison.position === 'below'
      ? 'A published UCAT minimum is not met.'
      : 'You meet the published UCAT minimum.';
  }

  const comparator = ucatComparisonDisplayName(comparison);
  const position = { above: 'above', within: 'within', below: 'below' }[comparison.position] || 'against';
  return `You meet the academic requirements. Your UCAT is ${position} the ${comparator} for applicants in your group.`;
}

function officialPredictionInstitutionName(context = {}) {
  const profileId =
    context.course_identity?.profile_id ||
    context.profile_id ||
    context.course_profile_id ||
    context.score_model?.course_profile_id ||
    '';
  if (profileId === 'kent-and-medway-a100') {
    return 'KMMS';
  }
  return context.course_identity?.university_name || context.university_name || 'the university';
}

// When the official university prediction is unavailable, the headline
// must still show the canonical public label for the calculated band (see
// CANONICAL_BAND_LABELS) - the fact that this is ApplySmart advisory
// guidance rather than an official prediction is conveyed separately via
// primary_explanation/trust_statement, never by swapping in an alternate
// "Interview Potential" wording family for the label itself.
function officialPredictionUnavailableHeadline(interviewBand) {
  return CANONICAL_BAND_LABELS[interviewBand] || 'ApplySmart Analysis Available';
}

function officialPredictionUnavailableExplanation(context = {}) {
  const comparison = context.ucat_comparison;
  const institution = officialPredictionInstitutionName(context);
  const eligibilitySentence =
    `Based on the official ${institution} entry requirements and the applicant information provided, you meet the supported entry requirements.`;
  const analysisSentence =
    `ApplySmart has analysed your profile against ${institution}'s available selection information and admissions evidence.`;
  const limitationSentence =
    `Use this as interview competitiveness guidance alongside ${institution}'s published admissions policy; it is not a guarantee of interview.`;

  if (comparison?.comparison_type === 'historical_range' && Number.isFinite(comparison.applicant_ucat)) {
    const comparisonName = ucatComparisonDisplayName(comparison);
    const benchmarkText = Number.isFinite(comparison.benchmark_min) && Number.isFinite(comparison.benchmark_max)
      ? `the ${comparisonName} of ${comparison.benchmark_min}-${comparison.benchmark_max}`
      : `the ${comparisonName}`;
    const position = { above: 'above', within: 'within', below: 'below' }[comparison.position] || 'against';
    const interpretation =
      comparison.position === 'above'
        ? 'indicating a competitive applicant profile'
        : comparison.position === 'within'
          ? 'indicating a competitive applicant profile when considered alongside the full published criteria'
          : 'indicating a more cautious ApplySmart recommendation';
    return `${eligibilitySentence} ${analysisSentence} Your UCAT score of ${comparison.applicant_ucat} is ${position} ${benchmarkText}, ${interpretation}. ${limitationSentence}`;
  }

  if (comparison) {
    return `${eligibilitySentence} ${analysisSentence} ${ucatComparisonRecommendationText(comparison)} ${limitationSentence}`;
  }

  return `${eligibilitySentence} ${analysisSentence} ${limitationSentence}`;
}

function officialPredictionUnavailableSelectionSummary(context = {}) {
  const institution = officialPredictionInstitutionName(context);
  return `ApplySmart analysis uses the official ${institution} eligibility criteria and available admissions evidence to support interview competitiveness guidance. This is not a university decision or a guarantee of interview.`;
}

function isUcatRankingContext(context = {}) {
  const rankingHasComponents = Object.keys(context.ranking?.components || {}).length > 0;
  return (
    context.band_metric?.metric === 'ucat_total' ||
    context.stage_2_selection?.represented_ranking_input?.metric === 'ucat_total' ||
    (
      context.score_model?.type === 'ranking_metric' &&
      context.score_model?.metric === 'ucat_total' &&
      !rankingHasComponents
    )
  );
}

function ucatRankingExplanation(interviewBand, context = {}) {
  const recommendation = UCAT_RANKING_RECOMMENDATIONS[interviewBand];
  const comparisonText = ucatComparisonRecommendationText(context.ucat_comparison);
  const configuredExplanation =
    context.guidance_pool?.presentation?.ucat_band_explanations?.[interviewBand] ||
    context.score_model?.presentation?.ucat_band_explanations?.[interviewBand];

  if (!recommendation) {
    return configuredExplanation || comparisonText;
  }

  return configuredExplanation || comparisonText;
}

function completedCardScoreBreakdown(card, transparency) {
  if (!completedCardHasScoringSurface(card, transparency)) {
    return null;
  }

  const existingScoreBreakdown = transparency?.score_breakdown || {};
  const value = completedCardScoreValue(card);
  const max = completedCardScoreMax(card);
  const checks = scoreBreakdownChecksFromCompletedCard(card, transparency);
  const breakdown = {
    name:
      existingScoreBreakdown.name ||
      card.estimated_selection_score?.label ||
      (card.official_score ? 'Official Nottingham pre-interview score' : 'Selection score'),
    value,
    max,
    status: Number.isFinite(value) ? 'calculated' : 'unavailable',
    explanation:
      card.estimated_selection_score?.disclosure ||
      card.stage_2?.formula ||
      card.official_score?.formula ||
      null,
    checks
  };
  if (card.estimated_selection_score?.official === false) {
    breakdown.unofficial = true;
  }
  for (const field of ['applicable_max_score', 'selection_score_max', 'global_max']) {
    if (Number.isFinite(existingScoreBreakdown[field])) {
      breakdown[field] = existingScoreBreakdown[field];
    }
  }
  return breakdown;
}

function normaliseExistingDecisionTransparency(card) {
  const transparency = card.decision_transparency;
  if (!transparency || typeof transparency !== 'object') {
    return null;
  }

  const normalised = {
    ...transparency,
    evidence_confidence: transparency.evidence_confidence || card.evidence_confidence || buildEvidenceConfidence(card),
    warnings: [],
    manual_review_reason: transparency.manual_review_reason ?? null,
    insufficient_evidence_reason: transparency.insufficient_evidence_reason ?? null
  };

  const scoreBreakdown = completedCardScoreBreakdown(card, normalised);
  if (scoreBreakdown) {
    normalised.score_breakdown = scoreBreakdown;
  } else {
    delete normalised.score_breakdown;
  }

  return normalised;
}

function decisionState(card, options = {}) {
  if (isNotEligible(card)) {
    return 'not_eligible';
  }
  if (isManualReview(card, options)) {
    return 'manual_review';
  }
  if (isEligibilityOnlyContext(card, options)) {
    return 'eligibility_only';
  }
  if (isInsufficientEvidence(card)) {
    return 'insufficient_evidence';
  }
  return 'standard';
}

function buildDecisionTimeline(card, options = {}) {
  const state = decisionState(card, options);
  const profileId = getProfileId(card);
  const university = UNIVERSITY_EXPLANATIONS[profileId] || {};
  const presentation = configuredPresentation(card, options);
  const eligibilityStatus =
    state === 'not_eligible'
      ? 'Not eligible'
      : state === 'manual_review'
        ? 'Manual review'
        : card.eligibility?.status === 'insufficient_evidence'
          ? 'Insufficient evidence'
          : 'Eligible';
  const eligibilitySummary = {
    'Not eligible':
      'One or more published entry requirements covered by ApplySmart are not met.',
    'Manual review':
      'Some applicant information must be checked before eligibility can be confirmed.',
    'Insufficient evidence':
      'There is not enough verified applicant information to complete the eligibility assessment.',
    Eligible:
      'You meet the published entry requirements covered by ApplySmart.'
  }[eligibilityStatus];
  const officialPredictionReason =
    officialPredictionUnavailable(card, options)
      ? card.prediction?.official_prediction?.explanation ||
        options.officialPrediction?.explanation ||
        card.primary_explanation ||
        null
      : null;
  const officialPredictionSelectionSummary = officialPredictionReason
    ? officialPredictionUnavailableSelectionSummary(card)
    : null;
  const selectionSummary =
    presentation.timeline_selection_summary ||
    TIMELINE_SELECTION_SUMMARIES[profileId] ||
    presentation.selection_summary ||
    university.selectionSummary ||
    studentFacingText(card.stage_2_selection?.summary) ||
    officialPredictionSelectionSummary ||
    (officialPredictionReason ? `Official prediction unavailable. ${officialPredictionReason}` : null) ||
    'The university selection approach was applied after the eligibility checks.';
  const hideSelectionDetails = hideSelectionScoreDetails(presentation);
  const finalStatus =
    card.prediction?.result_band === 'eligible_to_apply'
      ? 'Eligible to apply'
      : CANONICAL_BAND_LABELS[card.prediction?.result_band] || 'Insufficient evidence';
  const selectionScoreComparison = hideSelectionDetails
    ? null
    : options.selectionScoreComparison || selectionScoreThresholdComparison(options);
  const selectionScoreText =
    hideSelectionDetails
      ? null
      : selectionScoreThresholdText(selectionScoreComparison) ||
        existingSelectionScoreThresholdText(card);
  const ucatComparisonText =
    ['current_guidance', 'historical_range', 'historical_threshold', 'historical_average'].includes(options.ucatComparison?.comparison_type)
      ? ucatComparisonAssessmentText(options.ucatComparison)
      : null;
  const historicalPresentationSummary =
    presentation.historical_summary ||
    (profileId === 'king-s-college-london-a100'
      ? card.decision_transparency?.decision_path?.find((stage) => stage.stage === 'Historical guidance')?.summary
      : null);
  const insufficientEvidenceReasonCode = options.insufficientEvidenceReasonCode ||
    card.decision_transparency?.insufficient_evidence_reason_code ||
    null;
  const applicantInformationGap = isApplicantInformationReasonCode(insufficientEvidenceReasonCode);
  const insufficientHistoricalSummary = reasonScopedPresentationValue(
    presentation,
    'insufficient_evidence_timeline_historical_summaries',
    insufficientEvidenceReasonCode
  );

  return [
    {
      step: 1,
      title: 'Applicant details checked',
      status: 'Complete',
      summary: state === 'eligibility_only'
        ? 'Your applicant type and qualifications were checked.'
        : 'Your applicant type, qualifications and UCAT details were checked.'
    },
    {
      step: 2,
      title: 'Eligibility assessed',
      status: eligibilityStatus,
      summary: eligibilitySummary
    },
    {
      step: 3,
      title: 'Selection model applied',
      status:
        state === 'eligibility_only'
          ? 'Not predicted'
          : state === 'standard'
          ? 'Complete'
          : state === 'manual_review'
            ? 'Manual review'
            : state === 'insufficient_evidence'
              ? 'Insufficient evidence'
              : 'Not applied',
      summary:
        state === 'eligibility_only'
          ? selectionSummary
          : state === 'standard'
          ? selectionSummary
          : state === 'manual_review'
            ? 'The selection approach needs adviser review before it can be completed.'
            : state === 'insufficient_evidence'
              ? selectionSummary
              : 'The selection approach was not applied because the entry requirements are not met.'
    },
    {
      step: 4,
      title: 'Historical guidance compared',
      status:
        state === 'eligibility_only'
          ? 'Not used'
          : state === 'standard'
          ? 'Complete'
          : state === 'insufficient_evidence'
            ? 'Insufficient evidence'
            : 'Not applied',
      summary:
        state === 'eligibility_only'
          ? historicalSummary(card, state, { selectionScoreComparison, ucatComparison: options.ucatComparison })
          : state === 'standard'
          ? historicalPresentationSummary
            ? historicalPresentationSummary
            : selectionScoreText
            ? `${selectionScoreText} It was compared with historical admissions data. ${HISTORICAL_GUIDANCE_CAVEAT}`
            : ucatComparisonText
              ? `${ucatComparisonText} ${options.ucatComparison?.caveat || HISTORICAL_GUIDANCE_CAVEAT}`
              : `${card.prediction?.ranking_metric === 'ucat_total' ? 'Your UCAT' : 'Your result'} was compared with historical admissions data. ${HISTORICAL_GUIDANCE_CAVEAT}`
		          : state === 'insufficient_evidence'
		            ? insufficientHistoricalSummary ||
	              (applicantInformationGap
	                ? `Historical admissions data was not compared because a required applicant scoring input is missing. ${HISTORICAL_GUIDANCE_CAVEAT}`
	                : `There is not enough verified historical admissions data for this applicant route. ${HISTORICAL_GUIDANCE_CAVEAT}`)
	            : state === 'manual_review'
	              ? `Historical admissions data was not compared while adviser review is required. ${HISTORICAL_GUIDANCE_CAVEAT}`
	              : `Historical admissions data was not compared because the entry requirements are not met. ${HISTORICAL_GUIDANCE_CAVEAT}`
    },
    {
      step: 5,
      title: 'Interview recommendation produced',
      status:
        state === 'not_eligible'
          ? 'Not eligible'
          : state === 'manual_review'
            ? 'Manual review'
            : state === 'eligibility_only'
              ? 'Eligible to apply'
            : state === 'insufficient_evidence'
              ? 'Insufficient evidence'
              : finalStatus,
      summary: recommendationSummary(card, state, {
        selectionScoreComparison,
        selectionScoreText,
        insufficientEvidenceReasonCode,
        guidancePool: options.guidancePool,
        scoreModel: options.scoreModel
      })
    }
  ];
}

function buildDecisionTransparency(card, options = {}) {
  if (!hasBuilderOptions(options)) {
    const existing = normaliseExistingDecisionTransparency(card);
    if (existing) {
      return existing;
    }
  }

  const profileId = getProfileId(card);
  const university = UNIVERSITY_EXPLANATIONS[profileId] || {};
  const presentation = configuredPresentation(card, options);
  const state = decisionState(card, options);
  const notEligible = state === 'not_eligible';
  // A guaranteed-interview override (e.g. Birmingham UKWPMED) resolves to a
  // distinct guidance pool from the university's default static pool label -
  // showing the default label here would misleadingly suggest the standard
  // scored pool applied when it didn't.
  const pool = options.interviewOutcome === 'guaranteed_interview'
    ? 'Guaranteed-interview verified applicants'
    : options.applicantPool ||
      humanApplicantPoolLabel(options.applicantGroupIds, options.applicantContext) ||
      presentation.pool_label ||
      university.pool ||
      'The applicant group matching the supplied fee status and entry route';
  const eligibilitySummary = studentFacingText(
    options.eligibilitySummary ||
    card.eligibility?.summary ||
    (notEligible
      ? 'One or more supported entry requirements are not met.'
      : 'The supported entry requirements are met.')
  );
  const manualReviewReason =
    state === 'manual_review'
      ? options.manualReviewReason ||
        'Some required applicant information is missing or needs confirmation by an adviser.'
      : null;
  const insufficientEvidenceReasonCode =
    state === 'insufficient_evidence' ? options.insufficientEvidenceReasonCode || null : null;
  const insufficientEvidenceReason =
    state === 'insufficient_evidence'
      ? options.insufficientEvidenceReason ||
        reasonScopedPresentationValue(
          presentation,
          'insufficient_evidence_reason_messages',
          insufficientEvidenceReasonCode
        ) ||
        card.prediction?.cannot_predict_explanation ||
        (card.prediction?.missing_data_reasons || [])[0] ||
        (insufficientEvidenceReasonCode === 'university_methodology_gap'
          ? 'This university has not published a complete scoring or ranking methodology that ApplySmart can apply to this specific applicant route.'
            : isApplicantInformationReasonCode(insufficientEvidenceReasonCode)
              ? 'ApplySmart needs more applicant information before it can calculate this selection score.'
          : 'Verified historical interview information is not available for this applicant group.')
      : null;
  const officialPrediction = options.officialPrediction || card.prediction?.official_prediction || null;
  const officialPredictionReason =
    officialPrediction?.available === false
      ? officialPrediction.explanation ||
        'Official interview prediction is unavailable because the university has not published enough current-cycle information for ApplySmart to reproduce it.'
      : null;
  const selectionSummary =
    presentation.selection_summary ||
    university.selectionSummary ||
    card.stage_2_selection?.summary ||
    'The university selection approach is applied after eligibility checks.';
  const guaranteedInterview = options.interviewOutcome === 'guaranteed_interview';
  const hideScoreBreakdown = presentation.hide_score_breakdown === true;
  const hideSelectionDetails = hideSelectionScoreDetails(presentation);
  const scoreBreakdown =
    state === 'standard' && !guaranteedInterview && !hideScoreBreakdown
      ? buildScoreBreakdown(options)
      : null;
  const selectionScoreComparison = hideSelectionDetails
    ? null
    : options.selectionScoreComparison || selectionScoreThresholdComparison(options);
  const ucatComparison =
    options.ucatComparison ||
    (isUcatRankingContext(options) && !guaranteedInterview
      ? buildUcatComparison(options)
      : null);
  const selectionChecks = [
    check('Applicant pool', 'Used', pool),
    ...(guaranteedInterview
      ? [check(
        'Selection approach',
        'Guaranteed interview',
        'Every published guaranteed-interview condition for this route has been verified as met, so the usual scored/ranked selection approach does not apply.'
      )]
        : state === 'eligibility_only'
          ? [
            check('Selection approach', 'Not predicted', selectionSummary),
            check('Interview prediction', 'Unavailable', 'ApplySmart does not estimate digital MMA or MMI progression for this course.')
          ]
        : state !== 'standard'
          ? [check('Selection approach', 'Not applied', selectionSummary)]
        : scoreBreakdown
          ? scoreBreakdown.checks
          : hideSelectionDetails
            ? [check('Selection approach', 'Assessed', selectionSummary)]
          : options.applicantContext
            ? buildRankingEvidence({ ...options, selectionSummary, ucatComparison })
            : [check('Selection approach', 'Assessed', selectionSummary)]),
    ...(selectionScoreComparison && state === 'standard'
      ? [selectionScoreThresholdComparisonCheck(selectionScoreComparison)]
      : [])
  ];
  const evidenceConfidence = buildEvidenceConfidence(card, options);
  const selectionMetric = buildSelectionMetric({
    state,
    scoreBreakdown,
    selectionScoreComparison,
    ucatComparison,
    options
  });
  const compactStatus = buildCompactStatus({
    state,
    selectionMetric,
    insufficientEvidenceReasonCode,
    predictionAvailable: card.prediction?.available !== false
  });
  const comparisonMetrics = buildComparisonMetrics({
    state,
    selectionMetric,
    ucatComparison,
    options
  });
  const comparisonMetricsTitle = buildComparisonMetricsTitle({
    state,
    comparisonMetrics,
    options
  });

  return {
    decision_path: [
      {
        stage: 'Eligibility',
        status: notEligible ? 'Not met' : state === 'manual_review' ? 'Needs review' : 'Met',
        summary: eligibilitySummary,
        checks: studentFacingEligibilityChecks(card, {
          eligibilityChecks: options.eligibilityChecks,
          eligibilityFailures: options.eligibilityFailures
        })
      },
      {
        stage: 'Selection model',
        status:
          state === 'eligibility_only'
            ? 'Not predicted'
            : state === 'standard'
            ? 'Assessed'
            : state === 'manual_review'
              ? 'Needs review'
              : 'Not applied',
        summary:
          state === 'eligibility_only'
            ? selectionSummary
            : state === 'standard'
            ? selectionSummary
            : state === 'manual_review'
              ? 'The selection approach cannot be completed until the required review is finished.'
              : state === 'not_eligible'
                ? 'The selection approach is not applied because the entry requirements are not met.'
                : 'The selection approach cannot support a confident result with the available evidence.',
        checks: selectionChecks
      },
      {
        stage: 'Historical guidance',
        status:
          state === 'eligibility_only'
            ? 'Not used'
            : state === 'standard'
            ? 'Guidance available'
            : state === 'insufficient_evidence'
              ? 'Insufficient evidence'
              : 'Not applied',
        summary: historicalSummary(card, state, { ...options, selectionScoreComparison, ucatComparison }),
        checks: [
          check('Applicant pool', 'Used', pool),
          ...(ucatComparison && state === 'standard'
            ? [check('UCAT comparison', 'Compared', ucatComparisonAssessmentText(ucatComparison))]
            : []),
          ...(state === 'standard' || state === 'insufficient_evidence'
            ? historicalAdmissionsChecks(options.historicalAdmissions, options.applicantGroupIds)
            : []),
          state === 'eligibility_only'
            ? check('Interview prediction', 'Unavailable', 'No UCAT ranking, interview cut-off, MMA threshold or MMI progression estimate is applied.')
            : check('Important limitation', 'Guidance only', HISTORICAL_GUIDANCE_CAVEAT)
        ]
      },
      {
        stage: 'Recommendation',
        status:
          state === 'eligibility_only'
            ? 'Eligible to apply'
            : state === 'standard'
            ? 'Guidance only'
            : state === 'manual_review'
              ? 'Needs review'
              : state === 'not_eligible'
                ? 'Not eligible'
                : 'Insufficient evidence',
        summary: recommendationSummary(card, state, { selectionScoreComparison }),
        checks: []
      }
    ],
    key_reasons:
      state === 'not_eligible'
        ? [eligibilitySummary, 'Interview guidance cannot override an unsuccessful eligibility decision.']
        : state === 'manual_review'
          ? [manualReviewReason, 'Normal recommendation wording is withheld until the review is complete.']
          : state === 'eligibility_only'
            ? [
              eligibilitySummary,
              'UCAT is not required or ranked for this course.',
              'Interview prediction is unavailable because the MMA/MMI progression thresholds are not published.'
            ]
          : state === 'insufficient_evidence'
            ? [insufficientEvidenceReason, 'A confident recommendation is not shown.']
            : [
              eligibilitySummary,
              ...(officialPredictionReason ? [officialPredictionReason] : []),
              `The result uses ${pool}.`,
              selectionScoreComparison
                ? selectionScoreThresholdText(selectionScoreComparison)
                : scoreBreakdown && Number.isFinite(scoreBreakdown.value)
                  ? `${scoreBreakdown.name} is ${scoreBreakdown.value}${Number.isFinite(scoreBreakdown.max) ? ` out of ${scoreBreakdown.max}` : ''}.`
                : ucatComparison
                  ? ucatComparisonRecommendationText(ucatComparison)
                  : presentation.selection_summary ||
                    university.selectionSummary ||
                    'The recommendation is based on historical interview guidance.'
            ],
    evidence_used: options.evidenceUsed || presentation.evidence_used || university.evidence || (state === 'eligibility_only' ? EVIDENCE.eligibilityOnly : EVIDENCE.standard),
    evidence_confidence: evidenceConfidence,
    // Public result cards only expose applicant-facing checks/reasons above.
    // Raw classifier/readiness warnings remain available at their source
    // (classification output and engine_notes) for audits and validation, but
    // they are not part of the applicant-facing warning contract.
    warnings: [],
    official_prediction: officialPredictionReason
      ? {
        available: false,
        prediction_status: 'prediction_unavailable',
        reason_code: officialPrediction.reason_code || 'official_prediction_unavailable',
        explanation: officialPredictionReason,
        source_ids: officialPrediction.source_ids || []
      }
      : undefined,
    manual_review_reason: manualReviewReason,
    insufficient_evidence_reason: insufficientEvidenceReason,
    insufficient_evidence_reason_code: insufficientEvidenceReasonCode,
    compact_status: compactStatus,
    comparison_metrics_title: comparisonMetricsTitle,
    comparison_metrics: comparisonMetrics,
    selection_metric: selectionMetric,
    score_breakdown: scoreBreakdown,
    ucat_comparison: ucatComparison
  };
}

function presentResultCard({
  eligibilityStatus,
  interviewBand,
  manualReviewRequired = false,
  manualReviewReason = null,
  insufficientEvidenceReason = null,
  insufficientEvidenceReasonCode = null,
  transparencyContext = {}
}) {
  let display;
  const presentation = mergePresentations(
    transparencyContext.score_model?.presentation,
    transparencyContext.guidance_pool?.presentation
  );
  const guaranteedInterview = transparencyContext.interview_outcome === 'guaranteed_interview';
  const resultBand = guaranteedInterview && !interviewBand ? 'interview_likely' : interviewBand;
  const eligibilityOnly =
    transparencyContext.readiness?.assessment_mode === 'eligibility_only' ||
    transparencyContext.readiness?.eligibility_only_ready === true ||
    transparencyContext.score_model?.assessment_mode === 'eligibility_only' ||
    resultBand === 'eligible_to_apply';
  const ucatRanking = isUcatRankingContext(transparencyContext);
  const ucatComparison = ucatRanking && !guaranteedInterview
    ? buildUcatComparison({
      applicantContext: transparencyContext.applicant_context,
      applicantGroupIds: transparencyContext.applicant_group_ids,
      applicantPool: transparencyContext.applicantPool,
      eligibilityFailures: transparencyContext.eligibility_failures,
	      stage1Eligibility: transparencyContext.stage_1_eligibility,
	      bandMetric: transparencyContext.band_metric,
	      guidancePool: transparencyContext.guidance_pool,
	      scoreModel: transparencyContext.score_model
	    })
    : null;
  const selectionScoreComparison = hideSelectionScoreDetails(presentation)
    ? null
    : selectionScoreThresholdComparison({
      guidancePool: transparencyContext.guidance_pool,
      ranking: transparencyContext.ranking,
      scoreModel: transparencyContext.score_model
    });
  const selectionScoreText = selectionScoreThresholdText(selectionScoreComparison);
  const feeInformation = publicFeeInformation(
    transparencyContext.fee_information,
    transparencyContext.applicant_group_ids
  );
  const officialPrediction = transparencyContext.official_prediction || null;
  const officialPredictionUnavailable = officialPrediction?.available === false;
  const reasonScopedInsufficientRecommendation = reasonScopedPresentationValue(
    presentation,
    'insufficient_evidence_recommendations',
    insufficientEvidenceReasonCode
  );
  const reasonScopedInsufficientExplanation = insufficientEvidenceReason ||
    reasonScopedPresentationValue(
      presentation,
      'insufficient_evidence_reason_messages',
      insufficientEvidenceReasonCode
    );

  if (guaranteedInterview) {
    // A guaranteed-interview override (e.g. Birmingham UKWPMED) means every
    // published condition for this route has already been verified as met -
    // this is categorically different from a scored/ranked recommendation
    // and must not fall through to the generic insufficient_evidence
    // messaging just because interviewBand is null for this route.
    display = {
      primary_user_facing_recommendation: 'Interview guaranteed under this university’s published criteria',
      recommendation_display_state: 'standard',
      primary_explanation:
        transparencyContext.guaranteed_interview_explanation ||
        'The applicant qualifies under a verified published guaranteed-interview policy. All mandatory academic, admissions-test and programme-specific conditions must still be satisfied. This applies to interview invitation only, not an offer.',
      historical_guidance_caveat: null
    };
  } else if (eligibilityStatus === 'not_eligible' || interviewBand === 'not_eligible') {
    display = {
      primary_user_facing_recommendation:
        presentation.not_eligible_recommendation
          ? presentation.not_eligible_recommendation
          : eligibilityOnly
          ? 'Not Currently Eligible'
          : 'You do not currently meet the published entry requirements',
      recommendation_display_state: 'not_eligible',
      primary_explanation:
        presentation.not_eligible_explanation ||
        'Based on the information entered, one or more supported entry requirements are not met.',
      historical_guidance_caveat: null
    };
  } else if (manualReviewRequired || eligibilityStatus === 'manual_review') {
    display = {
      primary_user_facing_recommendation: eligibilityOnly
        ? 'Eligibility Requires Review'
        : 'Needs adviser review',
      recommendation_display_state: 'manual_review',
      primary_explanation:
        eligibilityOnly
          ? 'An adviser needs to review this applicant route or evidence before eligibility can be confirmed.'
          : 'We need more information to confirm your eligibility before showing interview guidance.',
      historical_guidance_caveat: null
    };
  } else if (
    eligibilityStatus === 'insufficient_evidence' ||
    interviewBand === 'insufficient_evidence'
  ) {
    display = {
      primary_user_facing_recommendation:
        reasonScopedInsufficientRecommendation ||
        presentation.insufficient_evidence_recommendation ||
        'Evidence not yet available',
      recommendation_display_state: 'insufficient_evidence',
      primary_explanation:
        reasonScopedInsufficientExplanation ||
        presentation.insufficient_evidence_explanation ||
        'Your academic profile meets the published requirements. ApplySmart cannot fully position this application because verified historical interview data for this applicant group is currently limited.',
      historical_guidance_caveat: null
    };
  } else if (eligibilityOnly && eligibilityStatus === 'eligible') {
    display = {
      primary_user_facing_recommendation:
        presentation.eligible_to_apply_recommendation || 'Eligible to Apply',
      recommendation_display_state: 'eligibility_only',
      primary_explanation:
        presentation.eligible_to_apply_explanation ||
        'You meet the supported academic entry requirements. ApplySmart does not predict digital MMA or MMI progression for this course.',
      historical_guidance_caveat: null
    };
	  } else {
	    const recommendation = ucatRanking
	      ? UCAT_RANKING_RECOMMENDATIONS[interviewBand]
	      : STANDARD_RECOMMENDATIONS[interviewBand];
	    const configuredRecommendation =
	      transparencyContext.score_model?.presentation?.band_recommendations?.[interviewBand] ||
	      transparencyContext.guidance_pool?.presentation?.band_recommendations?.[interviewBand] ||
	      transparencyContext.score_model?.presentation?.ucat_band_recommendations?.[interviewBand] ||
	      transparencyContext.guidance_pool?.presentation?.ucat_band_recommendations?.[interviewBand];
	    const configuredHeadline =
	      transparencyContext.score_model?.presentation?.band_headlines?.[interviewBand] ||
	      transparencyContext.guidance_pool?.presentation?.band_headlines?.[interviewBand] ||
	      transparencyContext.score_model?.presentation?.ucat_band_headlines?.[interviewBand] ||
	      transparencyContext.guidance_pool?.presentation?.ucat_band_headlines?.[interviewBand];
	    const configuredExplanation =
	      transparencyContext.score_model?.presentation?.band_explanations?.[interviewBand] ||
	      transparencyContext.guidance_pool?.presentation?.band_explanations?.[interviewBand];
	    const officialUnavailableContext = officialPredictionUnavailable
	      ? {
	        ...transparencyContext,
	        ucat_comparison: ucatComparison
	      }
	      : null;
	    const officialUnavailableHeadline = officialUnavailableContext
	      ? officialPredictionUnavailableHeadline(interviewBand)
	      : null;
	    const officialUnavailableExplanation = officialUnavailableContext
	      ? officialPredictionUnavailableExplanation(officialUnavailableContext)
	      : null;
	    display = recommendation
	      ? {
	        primary_user_facing_recommendation:
	          officialUnavailableHeadline || configuredHeadline || recommendation.headline,
	        recommendation_display_state: 'standard',
	        internal_recommendation: configuredRecommendation || recommendation.recommendation,
        primary_explanation: officialUnavailableExplanation || configuredExplanation || (ucatRanking
		          ? ucatRankingExplanation(interviewBand, {
	            ...transparencyContext,
	            ucat_comparison: ucatComparison
	          })
	          : selectionScoreText || calculatedScoreExplanation(transparencyContext) || recommendation.explanation),
        trust_statement: presentation.trust_statement || (officialPredictionUnavailable
          ? OFFICIAL_UNAVAILABLE_TRUST_STATEMENT
          : null),
        historical_guidance_caveat: HISTORICAL_GUIDANCE_CAVEAT
      }
      : {
        primary_user_facing_recommendation: 'Evidence not yet available',
        recommendation_display_state: 'insufficient_evidence',
        primary_explanation:
          'Your academic profile meets the published requirements. ApplySmart cannot fully position this application because verified historical interview data for this applicant group is currently limited.',
        historical_guidance_caveat: null
      };
  }

  const transparencyCard = {
    ...transparencyContext,
    eligibility: {
      ...(transparencyContext.eligibility || {}),
      status: eligibilityStatus
    },
    prediction: {
      ...(transparencyContext.prediction || {}),
      available: officialPredictionUnavailable
        ? false
        : eligibilityOnly || resultBand !== 'insufficient_evidence',
      result_band: eligibilityOnly && eligibilityStatus === 'eligible' && resultBand !== 'insufficient_evidence'
        ? 'eligible_to_apply'
        : resultBand,
      prediction_status: officialPredictionUnavailable
        ? 'prediction_unavailable'
        : transparencyContext.prediction?.prediction_status,
      prediction_type: eligibilityOnly ? 'eligibility_only' : 'interview_prediction',
      official_prediction: officialPredictionUnavailable
        ? {
          available: false,
          prediction_status: 'prediction_unavailable',
          reason_code: officialPrediction.reason_code || 'official_prediction_unavailable',
          explanation:
            officialPrediction.explanation ||
            'The university has not published enough current-cycle information for ApplySmart to reproduce the official interview prediction.',
          source_ids: officialPrediction.source_ids || []
        }
        : { available: true },
      applysmart_advisory_guidance: officialPredictionUnavailable
        ? {
          available: resultBand !== 'insufficient_evidence' && resultBand !== 'not_eligible',
          result_band: resultBand,
          guidance_only: true,
          trust_statement: OFFICIAL_UNAVAILABLE_TRUST_STATEMENT
        }
        : undefined,
      assessment: {
        type: eligibilityOnly ? 'eligibility_only' : 'interview_prediction',
        available: !officialPredictionUnavailable
      },
      interview_prediction: {
        available: !officialPredictionUnavailable && !eligibilityOnly && resultBand !== 'insufficient_evidence',
        unavailable_reason: eligibilityOnly
          ? 'ApplySmart does not estimate interview likelihood for this eligibility-only course.'
          : officialPredictionUnavailable
            ? officialPrediction.explanation || 'Official interview prediction is unavailable.'
            : null
      },
      ranking_metric: isUcatRankingContext(transparencyContext) ? 'ucat_total' : undefined
    },
    display
  };
  const transparencyOptions = {
    manualReviewRequired,
    manualReviewReason,
    insufficientEvidenceReason,
    insufficientEvidenceReasonCode,
    applicantPool: transparencyContext.applicantPool,
    applicantGroupIds: transparencyContext.applicant_group_ids,
    evidenceUsed: transparencyContext.evidenceUsed,
    readiness: transparencyContext.readiness,
    applicantContext: transparencyContext.applicant_context,
    eligibilityChecks: transparencyContext.eligibility_checks,
    eligibilityFailures: transparencyContext.eligibility_failures,
    stage1Eligibility: transparencyContext.stage_1_eligibility,
    historicalAdmissions: transparencyContext.historical_admissions,
    ranking: transparencyContext.ranking,
    bandMetric: transparencyContext.band_metric,
    scoreModel: transparencyContext.score_model,
    selectionScoreComparison,
    officialScore: transparencyContext.official_score,
    estimatedSelectionScore: transparencyContext.estimated_selection_score,
    interviewOutcome: transparencyContext.interview_outcome,
    guidancePoolId: transparencyContext.guidance_pool_id,
    guidancePool: transparencyContext.guidance_pool,
    ucatComparison,
    officialPrediction,
    warnings: transparencyContext.warnings,
    insufficientEvidenceReasonCode
  };
  const evidenceConfidence = buildEvidenceConfidence(
    transparencyCard,
    transparencyOptions
  );
  const prediction = transparencyCard.prediction;

  return {
    ...display,
    fee_information: feeInformation,
    trust_statement: display.trust_statement || null,
    prediction,
    interview_outcome: transparencyContext.interview_outcome || null,
    evidence_confidence: evidenceConfidence,
    decision_timeline: buildDecisionTimeline(
      transparencyCard,
      transparencyOptions
    ),
    decision_transparency: buildDecisionTransparency(
      transparencyCard,
      transparencyOptions
    )
  };
}

module.exports = {
  HISTORICAL_GUIDANCE_CAVEAT,
  CANONICAL_BAND_LABELS,
  buildEvidenceConfidence,
  buildDecisionTimeline,
  buildDecisionTransparency,
  humanManualReviewReason,
  humanApplicantPoolLabel,
  insufficientEvidenceReasonCodeFromWarnings,
  presentResultCard
};
