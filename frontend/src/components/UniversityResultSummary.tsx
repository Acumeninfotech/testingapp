import type { PredictionResult, SelectionMetric } from '../api/types';
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

function inlineComparisonLabel(metric: SelectionMetric): string {
  const label = metric.comparison_label || 'Comparison value';
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

function SelectionMetricPanel({ metric }: { metric: SelectionMetric | null }) {
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
  const headline = resultCardRecommendationHeadline(card);
  const reason = firstCompleteSentence(resultCardRecommendationExplanation(card));
  const academicStatus = resultCardAcademicStatus(card);
  const detailsId = `university-result-details-${result.universityId}`;
  const addDisabled = !shortlisted && shortlistFull;

  return (
    <div className={`university-result-summary university-result-summary--${variant}`}>
      <div className="university-result-content">
        <div className="university-result-summary-head">
          <h3>{result.university}</h3>
          <span className="result-card-status">{label}</span>
        </div>
        <p className="university-result-recommendation">{headline}</p>
        <p className={`university-result-reason${reason ? '' : ' university-result-reason--empty'}`}>
          {reason}
        </p>
        <p className="university-result-eligibility">
          <span className="university-result-eligibility-label">{academicStatus}</span>
        </p>
        <SelectionMetricPanel metric={metric} />
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
