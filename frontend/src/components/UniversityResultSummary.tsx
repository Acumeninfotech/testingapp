import type { PredictionResult, SelectionMetric, UcatAdjustment } from '../api/types';
import {
  presentResult,
  resultCardAcademicStatus,
  resultCardRecommendationExplanation,
  resultCardRecommendationHeadline,
} from '../lib/resultPresenter';
import { firstCompleteSentence } from '../lib/textSummary';

function keyMetric(card: PredictionResult['result_card']): SelectionMetric | null {
  const selectionMetric = card.decision_transparency?.selection_metric;
  if (selectionMetric) {
    return selectionMetric;
  }

  const scoreBreakdown = card.decision_transparency?.score_breakdown;
  if (scoreBreakdown && Number.isFinite(scoreBreakdown.value)) {
    const isPointsScore = Number.isFinite(scoreBreakdown.max) && Number(scoreBreakdown.max) > 10;
    return {
      type: isPointsScore ? 'points' : 'selection_score',
      label: isPointsScore ? 'Points score' : 'Selection score',
      applicant_value: scoreBreakdown.value,
      comparison_value: null,
      comparison_max_value: null,
      comparison_label: null,
      comparison_label_type: null,
      comparison_context: scoreBreakdown.name || null,
      difference: null,
      difference_direction: null,
      difference_word: null,
      maximum_value: Number.isFinite(scoreBreakdown.max) ? scoreBreakdown.max : null,
      display_mode: 'score',
      display_eligibility: true,
    };
  }
  const ucatComparison = card.decision_transparency?.ucat_comparison;
  if (ucatComparison && Number.isFinite(ucatComparison.applicant_ucat)) {
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
      maximum_value: 2700,
      display_mode: 'score',
      display_eligibility: true,
    };
  }
  return null;
}

function formatMetricNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function formatMetricValue(value: number | null, max: number | null): string {
  if (!Number.isFinite(value)) return '';
  const formattedValue = formatMetricNumber(Number(value));
  return Number.isFinite(max) ? `${formattedValue} / ${formatMetricNumber(Number(max))}` : formattedValue;
}

function hasAppliedUcatAdjustment(adjustment?: UcatAdjustment | null): adjustment is UcatAdjustment {
  return Boolean(
    adjustment &&
      Number.isFinite(adjustment.raw_ucat) &&
      Number.isFinite(adjustment.uplift_percent) &&
      Number(adjustment.uplift_percent) > 0 &&
      Number.isFinite(adjustment.adjusted_selection_ucat),
  );
}

function contextualUpliftValue(adjustment: UcatAdjustment): string {
  const reason = typeof adjustment.uplift_reason_label === 'string' && adjustment.uplift_reason_label.trim()
    ? ` (${adjustment.uplift_reason_label.trim()})`
    : '';
  return `+${Number(adjustment.uplift_percent)}%${reason}`;
}

function adjustedSelectionUcatLabel(adjustment?: UcatAdjustment | null): string {
  return typeof adjustment?.label === 'string' && adjustment.label.trim()
    ? adjustment.label.trim()
    : 'Adjusted selection UCAT';
}

function inlineComparisonLabel(metric: SelectionMetric): string {
  const label = metric.comparison_label || 'Comparison value';
  if (/^ApplySmart\b/.test(label)) {
    return label;
  }
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function inlineComparisonValue(metric: SelectionMetric): string {
  const min = formatMetricValue(metric.comparison_value, null);
  if (!min) return '';
  if (!Number.isFinite(metric.comparison_max_value)) {
    return min;
  }
  return `${min}-${formatMetricValue(metric.comparison_max_value, null)}`;
}

function differenceParts(metric: SelectionMetric): { value: string; label: string } | null {
  if (!Number.isFinite(metric.difference) || !metric.difference_direction) return null;
  const word = metric.difference_word || 'guide';
  if (metric.difference_direction === 'at') {
    return { value: 'At', label: word };
  }
  const value = metric.difference_direction === 'above'
    ? `+${formatMetricNumber(Number(metric.difference))}`
    : formatMetricNumber(Math.abs(Number(metric.difference)));
  return { value, label: `${metric.difference_direction} ${word}` };
}

function SelectionMetricPanel({
  metric,
  ucatAdjustment,
}: {
  metric: SelectionMetric | null;
  ucatAdjustment?: UcatAdjustment | null;
}) {
  if (hasAppliedUcatAdjustment(ucatAdjustment)) {
    const adjustedUcatLabel = adjustedSelectionUcatLabel(ucatAdjustment);
    return (
      <div
        className="university-result-selection-metric university-result-selection-metric--ucat-adjustment"
        aria-label={`Your UCAT ${ucatAdjustment.raw_ucat}, contextual uplift ${contextualUpliftValue(ucatAdjustment)}, ${adjustedUcatLabel} ${ucatAdjustment.adjusted_selection_ucat}`}
      >
        <span className="university-result-selection-label">UCAT adjustment</span>
        <dl className="university-result-ucat-adjustment-list">
          <div>
            <dt>Your UCAT</dt>
            <dd>{ucatAdjustment.raw_ucat}</dd>
          </div>
          <div>
            <dt>Contextual uplift</dt>
            <dd>{contextualUpliftValue(ucatAdjustment)}</dd>
          </div>
          <div>
            <dt>{adjustedUcatLabel}</dt>
            <dd>{ucatAdjustment.adjusted_selection_ucat}</dd>
          </div>
        </dl>
      </div>
    );
  }

  if (!metric) {
    return (
      <div
        className="university-result-selection-metric university-result-selection-metric--empty"
        aria-hidden="true"
      />
    );
  }

  if (metric.display_mode === 'eligibility') {
    return (
      <div className="university-result-selection-metric university-result-selection-metric--eligibility">
        <span className="university-result-selection-label">{metric.label}</span>
        <strong>{metric.value_label || 'Eligibility requirements met'}</strong>
      </div>
    );
  }

  const primaryValue = formatMetricValue(metric.applicant_value, metric.maximum_value);
  const comparisonValue = inlineComparisonValue(metric);
  const difference = differenceParts(metric);

  return (
    <div
      className={`university-result-selection-metric university-result-selection-metric--${metric.display_mode}`}
      aria-label={[
        metric.label,
        primaryValue,
        comparisonValue ? `versus ${inlineComparisonLabel(metric)} ${comparisonValue}` : null,
        difference ? `${difference.value} ${difference.label}` : null,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <span className="university-result-selection-label">{metric.label}</span>
      <div className="university-result-selection-row">
        <strong className="university-result-selection-value">{primaryValue}</strong>
        {comparisonValue && (
          <span className="university-result-selection-comparison">
            <span>vs</span> {inlineComparisonLabel(metric)} {comparisonValue}
          </span>
        )}
      </div>
      {difference && (
        <span
          className={`university-result-selection-difference university-result-selection-difference--${metric.difference_direction}`}
        >
          <strong>{difference.value}</strong>
          <span>{difference.label}</span>
        </span>
      )}
    </div>
  );
}

export interface UniversityResultSummaryProps {
  result: PredictionResult;
  expanded: boolean;
  onToggleExpanded: () => void;
  shortlisted: boolean;
  shortlistFull: boolean;
  onToggleShortlist: () => void;
}

export function UniversityResultSummary({
  result,
  expanded,
  onToggleExpanded,
  shortlisted,
  shortlistFull,
  onToggleShortlist,
}: UniversityResultSummaryProps) {
  const card = result.result_card;
  const { variant, label } = presentResult(card);
  const metric = keyMetric(card);
  const ucatAdjustment = card.decision_transparency?.ucat_adjustment || null;
  const headline = resultCardRecommendationHeadline(card);
  const reason = firstCompleteSentence(resultCardRecommendationExplanation(card));
  const academicStatus = resultCardAcademicStatus(card);
  const contextualCollapsedLabel =
    ['confirmed', 'information_needed'].includes(card.contextual_status || '') &&
    card.recommendation_display_state === 'standard' &&
    typeof card.contextual_confirmation?.collapsed_label === 'string' &&
    card.contextual_confirmation.collapsed_label.trim()
      ? card.contextual_confirmation.collapsed_label.trim()
      : null;
  const normaliseCompactStatus = (value: string | null) =>
    (value || '').trim().replace(/[.!?]+$/, '').toLocaleLowerCase();
  const academicStatusDuplicatesContextual =
    Boolean(contextualCollapsedLabel) &&
    normaliseCompactStatus(academicStatus) === normaliseCompactStatus(contextualCollapsedLabel);
  const academicStatusDuplicatesSelectionMetric =
    Boolean(metric) &&
    card.decision_transparency?.compact_status?.type === 'selection_comparison';
  const detailsId = `university-result-details-${result.universityId}`;
  const addDisabled = !shortlisted && shortlistFull;

  return (
    <div className={`university-result-summary university-result-summary--${variant}`}>
      <div className="university-result-content">
        <div className="university-result-summary-head">
          <h3>{result.university}</h3>
          <span className="result-card-status result-card-status--recommendation-badge">{label}</span>
        </div>
        <p className="university-result-recommendation">{headline}</p>
        <p className={`university-result-reason${reason ? '' : ' university-result-reason--empty'}`}>
          {reason}
        </p>
        {contextualCollapsedLabel && (
          <p className="university-result-contextual-status">{contextualCollapsedLabel}</p>
        )}
        {!academicStatusDuplicatesContextual && !academicStatusDuplicatesSelectionMetric && (
          <p className="university-result-eligibility">
            <span className="university-result-eligibility-label">{academicStatus}</span>
          </p>
        )}
        <SelectionMetricPanel metric={metric} ucatAdjustment={ucatAdjustment} />
      </div>
      <div className="university-result-actions">
        <button
          type="button"
          className="university-result-shortlist-btn"
          aria-pressed={shortlisted}
          aria-disabled={addDisabled}
          aria-label={`${shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}: ${result.university}`}
          onClick={onToggleShortlist}
          title={addDisabled ? 'Your UCAS shortlist already contains four universities.' : undefined}
        >
          {shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
        </button>
        <button
          type="button"
          className="university-result-details-toggle"
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? 'Hide details for' : 'View details for'} ${result.university}`}
          onClick={onToggleExpanded}
        >
          {expanded ? 'Hide details' : 'View details'}
        </button>
      </div>
    </div>
  );
}
