import type { PredictionResult } from '../api/types';

export type CardVariant =
  | 'safe'
  | 'realistic'
  | 'ambitious'
  | 'high-risk'
  | 'not-eligible'
  | 'manual-review';

// A finer-grained public category than CardVariant, used for Result Card
// badges and best-match sorting. Filter chips use ResultFilterGroup below so
// the cards can keep precise labels while the Results page stays simple.
export type ResultCategory =
  | 'very_strong'
  | 'strong'
  | 'realistic'
  | 'ambitious'
  | 'high_risk'
  | 'eligible_to_apply'
  | 'manual_review'
  | 'not_eligible';

// The approved display order: Very Strong Choice, Strong Choice, Realistic
// Choice, Ambitious Choice, High Risk, Eligibility Only, Missing
// Information, then Not Eligible as a final distinct section for failed
// entry requirements. This single array drives filter-pill order, grouped
// result order and "best match" sort order (via categoryRank) so all three
// surfaces always agree.
export const CATEGORY_PRIORITY: ResultCategory[] = [
  'very_strong',
  'strong',
  'realistic',
  'ambitious',
  'high_risk',
  'eligible_to_apply',
  'manual_review',
  'not_eligible',
];

export const CATEGORY_LABELS: Record<ResultCategory, string> = {
  very_strong: 'Very Strong Choice',
  strong: 'Strong Choice',
  realistic: 'Realistic Choice',
  ambitious: 'Ambitious Choice',
  high_risk: 'High Risk',
  eligible_to_apply: 'Eligibility Only',
  manual_review: 'Missing Information',
  not_eligible: 'Not Eligible',
};

export type ResultFilterGroup =
  | 'recommended'
  | 'consider'
  | 'high_risk'
  | 'information_needed'
  | 'not_eligible';

export type ResultFilterKey = ResultFilterGroup | 'all';

export const FILTER_GROUP_PRIORITY: ResultFilterGroup[] = [
  'recommended',
  'consider',
  'high_risk',
  'information_needed',
  'not_eligible',
];

export const FILTER_GROUP_LABELS: Record<ResultFilterGroup, string> = {
  recommended: '⭐ Recommended',
  consider: '🟡 Consider',
  high_risk: '⚠️ High Risk',
  information_needed: 'ℹ️ Information Needed',
  not_eligible: '❌ Not Eligible',
};

export const RESULT_CATEGORY_FILTER_GROUP: Record<ResultCategory, ResultFilterGroup> = {
  very_strong: 'recommended',
  strong: 'recommended',
  realistic: 'consider',
  ambitious: 'consider',
  high_risk: 'high_risk',
  eligible_to_apply: 'information_needed',
  manual_review: 'information_needed',
  not_eligible: 'not_eligible',
};

// The single authoritative canonical band -> public label mapping on the
// frontend. Mirrors CANONICAL_BAND_LABELS in
// assets/js/engine/result-card-presenter.js exactly - that engine module is
// the source of truth (see presentResult() below), this is a same-values
// copy kept in sync by hand because the frontend build does not import
// server-side engine code across the API boundary.
const CANONICAL_BAND_LABELS: Record<string, string> = {
  very_strong_interview_potential: 'Very Strong Choice',
  interview_likely: 'Strong Choice',
  realistic: 'Realistic Choice',
  ambitious: 'Ambitious Choice',
  high_risk: 'High Risk',
};

const STANDARD_RECOMMENDATION_HEADLINES: Record<string, string> = {
  very_strong_interview_potential: 'Very strong choice for your application',
  interview_likely: 'Strong choice for your application',
  realistic: 'Possible choice for your application',
  ambitious: 'More cautious choice for your application',
  high_risk: 'More cautious choice for your application',
  eligible_to_apply: 'Entry requirements met',
  not_eligible: 'Not currently eligible',
  manual_review: 'More information is required',
  insufficient_evidence: 'More information is required',
  guaranteed_interview: 'Interview guaranteed under the published criteria',
};

const PUBLIC_STATUS_LABELS = new Set(Object.values(CANONICAL_BAND_LABELS));

// The three distinct public labels for an unresolved (non-band) result, used
// in place of a single generic "Verify" badge - each names what the
// applicant actually needs to know, driven only by the engine's structured
// recommendation_display_state / reason codes, never inferred from
// explanation text. All three still group under the single 'Missing
// Information' category/pill/section (CATEGORY_LABELS.manual_review) - see
// resultPresenter.test.ts for the approved grouping decision.
export const UNRESOLVED_LABELS = {
  informationNeeded: 'Information Needed',
  needsReview: 'Needs Review',
  predictionUnavailable: 'Prediction Unavailable',
} as const;

function isPredictionUnavailableReasonCode(reasonCode?: string | null): boolean {
  return reasonCode === 'university_methodology_gap' ||
    reasonCode === 'prediction_calibration_unavailable' ||
    reasonCode === 'academic_matrix_band_unavailable' ||
    /historical_evidence_gap/.test(reasonCode ?? '');
}

function firstNonEmptyString(...values: Array<string | null | undefined>): string | null {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) || null;
}

function isOfficialPredictionUnavailable(card: PredictionResult['result_card']): boolean {
  const officialPrediction = card.prediction?.official_prediction as
    | { available?: boolean; prediction_status?: string }
    | undefined;
  return (
    officialPrediction?.available === false ||
    card.prediction?.prediction_status === 'prediction_unavailable'
  );
}

export interface ResultPresentation {
  variant: CardVariant;
  label: string;
  category: ResultCategory;
  // True when this is ApplySmart advisory analysis (the university hasn't
  // published a current official prediction) rather than an official
  // prediction. The canonical band label above is retained either way -
  // this only controls whether the UI adds the separate "this is guidance,
  // not an official prediction" framing.
  officialPredictionUnavailable: boolean;
}

const BAND_CATEGORY: Record<string, { variant: CardVariant; category: ResultCategory }> = {
  very_strong_interview_potential: { variant: 'safe', category: 'very_strong' },
  interview_likely: { variant: 'safe', category: 'strong' },
  realistic: { variant: 'realistic', category: 'realistic' },
  ambitious: { variant: 'ambitious', category: 'ambitious' },
  high_risk: { variant: 'high-risk', category: 'high_risk' },
};

// The single source of truth for band/display-state -> UI mapping. Both the
// compact and expanded card views, and the results-dashboard category
// pills/sorting, read from this so there is exactly one place that
// interprets result_band and recommendation_display_state (both produced by
// assets/js/engine/result-card-presenter.js, and not modified here).
//
// A recognised canonical band always resolves to its CANONICAL_BAND_LABELS
// entry, whether or not an official prediction is available - "no official
// prediction" is advisory context shown separately, never a reason to swap
// out the label (see officialPredictionUnavailable on the return value).
export function presentResult(card: PredictionResult['result_card']): ResultPresentation {
  const displayState = card.recommendation_display_state;
  const band = card.prediction?.result_band;
  const officialPredictionUnavailable = isOfficialPredictionUnavailable(card);
  const publicLabel = PUBLIC_STATUS_LABELS.has(card.primary_user_facing_recommendation)
    ? card.primary_user_facing_recommendation
    : null;

  if (displayState === 'not_eligible' || band === 'not_eligible') {
    return {
      variant: 'not-eligible',
      label: 'Not suitable',
      category: 'not_eligible',
      officialPredictionUnavailable,
    };
  }
  if (displayState === 'manual_review') {
    // A genuine university-policy/manual-assessment condition ApplySmart
    // cannot safely calculate (e.g. a qualification route needing adviser
    // review) - distinct from missing applicant data.
    const manualReason = card.decision_transparency?.manual_review_reason || '';
    const label = /please confirm|missing|required applicant information|more information/i.test(manualReason)
      ? UNRESOLVED_LABELS.informationNeeded
      : UNRESOLVED_LABELS.needsReview;
    return {
      variant: 'manual-review',
      label,
      category: 'manual_review',
      officialPredictionUnavailable,
    };
  }
  if (displayState === 'insufficient_evidence' || band === 'insufficient_evidence') {
    const reasonCode = card.decision_transparency?.insufficient_evidence_reason_code;
    // 'university_methodology_gap' means eligibility/evidence is known but
    // ApplySmart cannot produce a reliable interview prediction for this
    // applicant group (the university's own methodology has a gap, not the
    // applicant's data). '*historical_evidence_gap' reason codes mean the
    // applicant meets eligibility, but verified historical admissions
    // evidence is insufficient for interview competitiveness guidance. Any
    // other/no reason code means required applicant
    // information itself is what's missing.
    const label =
      isPredictionUnavailableReasonCode(reasonCode)
        ? UNRESOLVED_LABELS.predictionUnavailable
        : UNRESOLVED_LABELS.informationNeeded;
    return {
      variant: 'manual-review',
      label,
      category: 'manual_review',
      officialPredictionUnavailable,
    };
  }
  if (displayState === 'eligibility_only' || band === 'eligible_to_apply') {
    // 'Eligibility Only' is the approved group heading for this state (see
    // CATEGORY_LABELS.eligible_to_apply); the card badge keeps the engine's
    // own 'Eligible to Apply' headline.
    return {
      variant: 'safe',
      label: 'Eligible to Apply',
      category: 'eligible_to_apply',
      officialPredictionUnavailable,
    };
  }
  if (displayState === 'standard' && !band) {
    throw new Error('Result card contract violation: standard result_card is missing prediction.result_band.');
  }
  if (card.interview_outcome === 'guaranteed_interview') {
    const guaranteedBadgeLabel =
      typeof card.guaranteed_interview_badge_label === 'string' &&
      card.guaranteed_interview_badge_label.trim().length > 0
        ? card.guaranteed_interview_badge_label.trim()
        : 'Guaranteed';
    return {
      variant: 'safe',
      label: guaranteedBadgeLabel,
      category: 'very_strong',
      officialPredictionUnavailable,
    };
  }

  const resolved = band ? BAND_CATEGORY[band] : undefined;
  if (resolved) {
    return {
      variant: resolved.variant,
      label: publicLabel || CANONICAL_BAND_LABELS[band as string],
      category: resolved.category,
      officialPredictionUnavailable,
    };
  }

  // An unrecognised band is a contract/configuration defect, not a reason to
  // silently present a generic "Verify" outcome as if it were a genuine
  // manual-review case.
  throw new Error(`Result card contract violation: unrecognised prediction.result_band "${String(band)}".`);
}

export function resultCardRecommendationHeadline(card: PredictionResult['result_card']): string {
  if (card.interview_outcome === 'guaranteed_interview') {
    return STANDARD_RECOMMENDATION_HEADLINES.guaranteed_interview;
  }

  const state = card.recommendation_display_state;
  if (state === 'not_eligible' || card.prediction?.result_band === 'not_eligible') {
    return STANDARD_RECOMMENDATION_HEADLINES.not_eligible;
  }
  if (state === 'manual_review') {
    return STANDARD_RECOMMENDATION_HEADLINES.manual_review;
  }
  if (state === 'insufficient_evidence' || card.prediction?.result_band === 'insufficient_evidence') {
    return STANDARD_RECOMMENDATION_HEADLINES.insufficient_evidence;
  }
  if (state === 'eligibility_only' || card.prediction?.result_band === 'eligible_to_apply') {
    return STANDARD_RECOMMENDATION_HEADLINES.eligible_to_apply;
  }

  return (
    STANDARD_RECOMMENDATION_HEADLINES[card.prediction?.result_band] ||
    card.primary_user_facing_recommendation ||
    'More information is required'
  );
}

function lower(text?: string | null): string {
  return String(text || '').toLowerCase();
}

function publicComparisonLabel(card: PredictionResult['result_card']): string | null {
  const metricLabel = card.decision_transparency?.selection_metric?.comparison_label;
  const ucatComparison = card.decision_transparency?.ucat_comparison;
  const text = [
    metricLabel,
    ucatComparison?.benchmark_label,
    ucatComparison?.caveat,
    ucatComparison?.comparison_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!text.trim()) return null;
  if (/\bhome\b/.test(text) && /published|official/.test(text) && /threshold|minimum/.test(text)) {
    return 'published Home threshold';
  }
  if (/overseas|international|non-uk/.test(text) && /published|official/.test(text) && /threshold|minimum/.test(text)) {
    return 'published Overseas threshold';
  }
  if (/published|official/.test(text) && /reference range/.test(text)) {
    return 'published UCAT reference range';
  }
  if (/historical ucat range|ucat range/.test(text) && !/interview/.test(text)) {
    return 'historical UCAT range';
  }
  if (/score|point|selection/.test(text) && !/ucat/.test(text)) {
    return 'historical score guide';
  }
  if (/ucat/.test(text) && !/interview/.test(text)) {
    return 'historical UCAT range';
  }
  return 'historical interview range';
}

function recommendationBandGroup(band?: string): 'very_strong' | 'strong' | 'realistic' | 'cautious' {
  const bandGroups: Record<string, 'very_strong' | 'strong' | 'realistic' | 'cautious'> = {
    very_strong_interview_potential: 'very_strong',
    interview_likely: 'strong',
    realistic: 'realistic',
    ambitious: 'cautious',
    high_risk: 'cautious',
  };
  return bandGroups[band || ''] || 'realistic';
}

function selectionMetricText(card: PredictionResult['result_card']): string {
  const metric = card.decision_transparency?.selection_metric;
  const scoreBreakdown = card.decision_transparency?.score_breakdown;
  return [
    metric?.label,
    metric?.comparison_label,
    metric?.comparison_context,
    scoreBreakdown?.name,
    scoreBreakdown?.explanation,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function metricUsesAcademicAndUcat(card: PredictionResult['result_card']): boolean {
  const text = selectionMetricText(card);
  return /ucat/.test(text) && /(academic|gcse|a[ -]?level|qualification|contextual)/.test(text);
}

function recommendationAssessmentBasis(
  card: PredictionResult['result_card'],
):
  | 'ucat_ranking'
  | 'published_ucat_reference'
  | 'historical_ucat_range'
  | 'historical_interview_range'
  | 'academic_ucat'
  | 'selection_score'
  | 'academic_profile' {
  const comparisonLabel = publicComparisonLabel(card);
  const metricType = lower(card.decision_transparency?.selection_metric?.type);
  const hasStructuredUcatComparison = Boolean(card.decision_transparency?.ucat_comparison);

  if (comparisonLabel && (metricType === 'ucat' || hasStructuredUcatComparison)) {
    if (comparisonLabel.startsWith('published')) return 'published_ucat_reference';
    if (comparisonLabel === 'historical UCAT range') return 'historical_ucat_range';
    return 'historical_interview_range';
  }

  if (metricType === 'selection_score' || metricType === 'points') {
    return metricUsesAcademicAndUcat(card) ? 'academic_ucat' : 'selection_score';
  }

  if (metricType === 'ucat') return 'ucat_ranking';

  if (metricUsesAcademicAndUcat(card)) return 'academic_ucat';
  return 'academic_profile';
}

function standardRecommendationExplanation(card: PredictionResult['result_card']): string {
  const bandGroup = recommendationBandGroup(card.prediction?.result_band);
  const basis = recommendationAssessmentBasis(card);
  const competitivenessExplanation = (subject: string, verb = 'appears'): string => ({
    very_strong: `Based on ApplySmart's assessment, your ${subject} ${verb} highly competitive for this applicant group.`,
    strong: `Based on ApplySmart's assessment, your ${subject} ${verb} competitive for this applicant group.`,
    realistic: `Based on ApplySmart's assessment, your ${subject} may be competitive for this applicant group.`,
    cautious: `Based on ApplySmart's assessment, your ${subject} may be less competitive for this applicant group.`,
  }[bandGroup]);

  if (
    basis === 'ucat_ranking' ||
    basis === 'published_ucat_reference' ||
    basis === 'historical_ucat_range' ||
    basis === 'historical_interview_range'
  ) {
    return competitivenessExplanation('UCAT score');
  }

  if (basis === 'academic_ucat') {
    return competitivenessExplanation('academic profile and UCAT', 'appear');
  }

  if (basis === 'selection_score') {
    return competitivenessExplanation('selection score');
  }

  return competitivenessExplanation('academic profile');
}

export function resultCardRecommendationExplanation(card: PredictionResult['result_card']): string {
  const state = card.recommendation_display_state;
  const band = card.prediction?.result_band;

  if (card.interview_outcome === 'guaranteed_interview') {
    return (
      firstNonEmptyString(card.primary_explanation) ||
      "Based on ApplySmart's assessment, this applicant group meets the published guaranteed-interview evidence available for this route."
    );
  }
  if (state === 'not_eligible' || band === 'not_eligible') {
    return card.primary_explanation || 'Based on the information entered, one or more supported entry requirements are not met.';
  }
  if (state === 'manual_review') {
    return firstNonEmptyString(
      card.primary_explanation,
      card.decision_transparency?.manual_review_reason,
    ) || 'ApplySmart needs additional applicant information before it can provide a complete recommendation for this applicant group.';
  }
  if (state === 'insufficient_evidence' || band === 'insufficient_evidence') {
    return firstNonEmptyString(
      card.primary_explanation,
      card.decision_transparency?.insufficient_evidence_reason,
    ) || 'ApplySmart needs additional applicant information before it can provide a complete recommendation for this applicant group.';
  }
  if (state === 'eligibility_only' || band === 'eligible_to_apply') {
    return 'ApplySmart has confirmed your eligibility against the entry requirements currently supported for this applicant group.';
  }
  if ((band === 'ambitious' || band === 'high_risk') && card.risk_explanation?.summary) {
    return card.risk_explanation.summary;
  }
  if (
    (band === 'ambitious' || band === 'high_risk') &&
    card.decision_transparency?.risk_explanation &&
    typeof card.decision_transparency.risk_explanation === 'object' &&
    'summary' in card.decision_transparency.risk_explanation &&
    typeof card.decision_transparency.risk_explanation.summary === 'string'
  ) {
    return card.decision_transparency.risk_explanation.summary;
  }

  return standardRecommendationExplanation(card);
}

export function resultCardAcademicStatus(card: PredictionResult['result_card']): string {
  const compactStatusLabel =
    typeof card.decision_transparency?.compact_status?.label === 'string'
      ? card.decision_transparency.compact_status.label.trim()
      : '';
  if (compactStatusLabel) {
    return compactStatusLabel;
  }

  const state = card.recommendation_display_state;
  const eligibilityStatus = card.eligibility?.status;
  const eligibilityStage = card.decision_transparency?.decision_path?.find((s) => s.stage === 'Eligibility');
  const stageStatus = eligibilityStage?.status;
  const explicitEligibilityText = `${eligibilityStatus || ''} ${stageStatus || ''}`.toLowerCase();

  if (/not[_\s-]?eligible|not met/.test(explicitEligibilityText)) {
    return 'You do not currently meet the academic requirements.';
  }
  if (/manual[_\s-]?review|needs review|insufficient[_\s-]?evidence/.test(explicitEligibilityText)) {
    return 'ApplySmart needs more information to assess the academic requirements.';
  }
  if (/eligible|met/.test(explicitEligibilityText)) {
    return 'You meet the academic requirements.';
  }
  const statusText = `${state || ''} ${eligibilityStatus || ''} ${stageStatus || ''}`.toLowerCase();
  if (/manual[_\s-]?review|needs review|insufficient[_\s-]?evidence/.test(statusText)) {
    return 'ApplySmart needs more information to assess the academic requirements.';
  }
  return 'You meet the academic requirements.';
}

export function categoryRank(category: ResultCategory): number {
  const index = CATEGORY_PRIORITY.indexOf(category);
  return index === -1 ? CATEGORY_PRIORITY.length : index;
}

export function filterGroupForCategory(category: ResultCategory): ResultFilterGroup {
  return RESULT_CATEGORY_FILTER_GROUP[category];
}

export function emptyFilterGroupCounts(): Record<ResultFilterGroup, number> {
  return {
    recommended: 0,
    consider: 0,
    high_risk: 0,
    information_needed: 0,
    not_eligible: 0,
  };
}

export function strongestPopulatedFilterGroup(
  counts: Partial<Record<ResultFilterGroup, number>>,
): ResultFilterKey {
  for (const group of FILTER_GROUP_PRIORITY) {
    if ((counts[group] || 0) > 0) {
      return group;
    }
  }
  return 'all';
}

export function strongestPopulatedCategory(
  counts: Partial<Record<ResultCategory, number>>,
): ResultCategory | 'all' {
  for (const category of CATEGORY_PRIORITY) {
    if ((counts[category] || 0) > 0) {
      return category;
    }
  }
  return 'all';
}
