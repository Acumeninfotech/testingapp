import type { PredictionResult } from '../api/types';

export type CardVariant =
  | 'safe'
  | 'realistic'
  | 'ambitious'
  | 'high-risk'
  | 'not-eligible'
  | 'manual-review';

// A finer-grained public category than CardVariant, used for the results
// dashboard's filter pills, counts and "best match" sort order. Every
// category still maps 1:1 onto an existing CardVariant for styling, so this
// never introduces a visual state the engine hasn't already produced.
//
// ambitious and high_risk are kept as separate categories (not merged) so
// each canonical band gets its own filter pill, count and group, per the
// approved public wording table.
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
    return {
      variant: 'manual-review',
      label: UNRESOLVED_LABELS.needsReview,
      category: 'manual_review',
      officialPredictionUnavailable,
    };
  }
  if (displayState === 'insufficient_evidence' || band === 'insufficient_evidence') {
    const reasonCode = card.decision_transparency?.insufficient_evidence_reason_code;
    // 'university_methodology_gap' means eligibility/evidence is known but
    // ApplySmart cannot produce a reliable interview prediction for this
    // applicant group (the university's own methodology has a gap, not the
    // applicant's data) - the eligibility result stays visible elsewhere on
    // the card. Any other/no reason code means required applicant
    // information itself is what's missing.
    const label =
      reasonCode === 'university_methodology_gap'
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
    return {
      variant: 'safe',
      label: 'Guaranteed',
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

export function categoryRank(category: ResultCategory): number {
  const index = CATEGORY_PRIORITY.indexOf(category);
  return index === -1 ? CATEGORY_PRIORITY.length : index;
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
