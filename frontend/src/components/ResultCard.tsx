import type {
  ComparisonMetric,
  DecisionPathCheck,
  PredictionResult,
  ScoreBreakdown,
  SelectionMetric,
  UcatAdjustment,
  UcatComparison,
} from '../api/types';
import {
  presentResult,
  resultCardAcademicStatus,
  resultCardRecommendationExplanation,
  resultCardRecommendationHeadline,
} from '../lib/resultPresenter';
import { UNIVERSITY_CODES } from '../data/universityCodes';
import { AlternativeAcademicOffer } from './AlternativeAcademicOffer';

const CONTEXTUAL_CONFIRMED_MESSAGE =
  "Contextual eligibility confirmed. Your application has been assessed using this university's published contextual admissions criteria.";

const GLASGOW_REACH_COMPLETION_REQUIRED_REASON = 'glasgow_reach_completion_required';

function isOfficialPredictionUnavailable(card: PredictionResult['result_card']): boolean {
  const officialPrediction = card.prediction?.official_prediction as
    | { available?: boolean; prediction_status?: string }
    | undefined;
  return (
    officialPrediction?.available === false ||
    card.prediction?.prediction_status === 'prediction_unavailable'
  );
}

// A manual-review/insufficient-evidence card reaching the frontend with no
// presenter-supplied information_needed_reason means the engine failed to
// attach the structured reason it's expected to always provide for these states - a
// contract/configuration defect, not a normal outcome. Never silently show
// the old generic "needs a closer look" copy as if it were expected
// behaviour: fail loudly in dev/test so the defect is caught before
// shipping, and in production show a safe message that still names the
// affected university/assessment while logging the gap for investigation.
function unresolvedResultNotice(
  card: PredictionResult['result_card'],
  universityName: string,
): string {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    throw new Error(
      `Result card contract violation: "${universityName}" reached recommendation_display_state ` +
        `"${card.recommendation_display_state}" with no presenter-supplied ` +
        'information_needed_reason. The engine must always attach a public structured reason for this state.',
    );
  }
  // eslint-disable-next-line no-console
  console.error(
    'Result card missing presenter-supplied information_needed_reason.',
    { universityName, recommendationDisplayState: card.recommendation_display_state },
  );
  return `ApplySmart could not confirm a specific reason for this result. This is not a rejection - please check back later or contact ${universityName} directly. (Reference: missing structured reason)`;
}

// Labels that only exist to describe how the engine computed a result, not
// what the applicant needs to know (evidence trail, not a parent-facing
// check). These are filtered out of the "Checks" list rather than removed at
// the engine level, since result-card-presenter.js still needs to produce
// them for other consumers (adviser-facing views, audits).
const NON_PARENT_FACING_LABELS = new Set([
  'applicant pool',
  'selection approach',
  'ucat total entered',
  'gamsat total entered',
  'important limitation',
]);

function isParentFacingCheck(label: string): boolean {
  return !NON_PARENT_FACING_LABELS.has(label.trim().toLowerCase());
}

// A genuine warning: something that actually caused or could cause a
// rejection/verify outcome, per the acceptance criteria. Anything else
// (an SJT band simply "on file", a UCAT total simply "entered") is
// evidence-trail noise, not a warning a parent needs to see.
function isGenuineWarningCheck(check: { label: string; status: string }): boolean {
  const status = check.status.trim().toLowerCase();
  return status === 'not met' || status === 'excluded' || status === 'not accepted';
}

function findCheck(checks: DecisionPathCheck[], pattern: RegExp): DecisionPathCheck | undefined {
  return checks.find((c) => pattern.test(c.label) || pattern.test(c.summary));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isRenderableComparisonMetric(metric: unknown): metric is ComparisonMetric {
  if (!metric || typeof metric !== 'object') {
    return false;
  }
  const candidate = metric as Partial<ComparisonMetric>;
  return (
    typeof candidate.label === 'string' &&
    candidate.label.trim().length > 0 &&
    typeof candidate.value === 'string' &&
    candidate.value.trim().length > 0
  );
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

function publicThresholdGroup(text = ''): string | null {
  if (/contextual|widening participation|wp\b|ukwpmed/.test(text)) return 'contextual';
  if (/overseas|international|non-uk/.test(text)) return 'Overseas';
  if (/\bhome\b|uk-domicile/.test(text)) return 'Home';
  const accessRoute = text.match(/\b([a-z\s-]*access[a-z\s-]*)\s+(?:interview\s+|ucat\s+)?(?:threshold|minimum)\b/);
  if (accessRoute) {
    return accessRoute[1]
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return null;
}

function publicUcatComparisonPhrase(comparison?: UcatComparison | null): string {
  const comparisonType = comparison?.comparison_type || '';
  const evidenceStatus = comparison?.evidence_status || '';
  const labelText = String(comparison?.benchmark_label || '').toLowerCase();
  const text = [
    comparison?.benchmark_label,
    comparison?.caveat,
    evidenceStatus,
    comparisonType,
  ].filter(Boolean).join(' ').toLowerCase();
  const published =
    /\b(published|official)\b/.test(text) &&
    !/\b(unpublished|not official|no official)\b/.test(text);
  const advisory = /advisory|modelled|modeled|applysmart|historical-equivalent|working/.test(text);

  if (comparisonType === 'official_minimum') return 'published UCAT minimum';
  if (comparisonType === 'applysmart_prediction_band' || evidenceStatus === 'applysmart_derived') {
    return 'ApplySmart prediction band';
  }
  if (/historical ucat range|ucat range/.test(labelText) && !/interview/.test(labelText)) {
    return 'historical UCAT range';
  }
  if (advisory && /ucat/.test(labelText) && !/threshold|minimum|reference range/.test(labelText)) {
    return 'historical UCAT range';
  }
  if (published && /threshold|minimum/.test(labelText)) {
    const group = publicThresholdGroup(text);
    return group ? `published ${group} threshold` : 'published UCAT threshold';
  }
  if (published && /reference range/.test(labelText)) return 'published UCAT reference range';
  if (published && /threshold|minimum/.test(text)) {
    const group = publicThresholdGroup(text);
    return group ? `published ${group} threshold` : 'published UCAT threshold';
  }
  if (advisory && /score|point/.test(text) && !/ucat/.test(text)) return 'historical score guide';
  if (comparisonType === 'historical_average') return 'historical UCAT range';
  if (/ucat/.test(text) && !/interview/.test(text)) return 'historical UCAT range';
  return 'historical interview range';
}

function publicComparisonCaveat(comparison?: UcatComparison | null): string {
  const phrase = publicUcatComparisonPhrase(comparison);
  if (phrase.startsWith('published')) {
    return 'Published thresholds and reference ranges can change between cycles and do not guarantee an interview.';
  }
  if (comparison?.comparison_type === 'applysmart_prediction_band' || comparison?.evidence_status === 'applysmart_derived') {
    if (/Glasgow-published current 2027 cutoff/i.test(comparison?.caveat || '')) {
      return comparison?.caveat || '';
    }
    return 'ApplySmart prediction bands are derived from admissions evidence; they are not university-published ranges, thresholds or guarantees.';
  }
  return 'Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview.';
}

function containsAdmissionYearOrInternalTerms(value: string | null): boolean {
  if (!value) return false;
  return /\b20\d{2}\b|20\d{2}-entry|future cycle|current-scale|current-format|ApplySmart band range|benchmark model|band computation/i.test(value);
}

function formatDifference(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return value > 0 ? `+${value}` : String(value);
}

function formatUcatDifference(value: number | null, position: string | null | undefined): string | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (position === 'within') {
    return 'Within reference range';
  }
  const direction = position === 'below' ? 'below' : 'above';
  return `${formatDifference(Number(value))} ${direction} guide`;
}

function formatMetricNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function formatSelectionMetricDifference(metric: SelectionMetric): string | null {
  if (!Number.isFinite(metric.difference) || !metric.difference_direction) {
    return null;
  }
  const word = metric.difference_word || 'guide';
  const displayWord = metric.type === 'selection_score' || metric.type === 'points' || metric.type === 'ucat' ? 'guide' : word;
  if (metric.difference_direction === 'at') {
    return `Within ${displayWord}`;
  }
  const amount = metric.difference_direction === 'above'
    ? `+${formatMetricNumber(Number(metric.difference))}`
    : formatMetricNumber(Math.abs(Number(metric.difference)));
  return `${amount} ${metric.difference_direction} ${displayWord}`;
}

function formatScoreValue(value: number | null, max: number | null): string {
  if (!Number.isFinite(value)) {
    return 'Not available';
  }
  return Number.isFinite(max) ? `${value} / ${max}` : String(value);
}

function applicantSjtBand(card: PredictionResult['result_card']): number | null {
  const applicantContext = card.applicant_context as
    | { admissions_tests?: { ucat?: { sjt_band?: number | null } } }
    | undefined;
  const band = applicantContext?.admissions_tests?.ucat?.sjt_band;
  return Number.isFinite(band) ? Number(band) : null;
}

function sjtBandFromText(value: string | null | undefined): number | null {
  const match = String(value || '').match(/\bBand\s*([1-4])\b/i);
  return match ? Number(match[1]) : null;
}

function publicText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/\(\s*20\d{2}\s*\)/g, '')
    .replace(/\b20\d{2}[-\s]?entry\b/gi, '')
    .replace(/\b20\d{2}\s+(?=published|official|current-scale|entry|admissions cycle)/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

function compactSentence(value: string | null | undefined, fallback = ''): string {
  const cleaned = publicText(value);
  if (!cleaned) return fallback;
  const [firstSentence] = cleaned.split(/(?<=[.!?])\s+/);
  const sentence = firstSentence || cleaned;
  return sentence.length > 145 ? `${sentence.slice(0, 142).trim()}...` : sentence;
}

function splitContextualOfferGrade(body: string, grade: string | null) {
  if (!grade) return null;
  const index = body.indexOf(grade);
  if (index < 0) return null;
  return {
    before: body.slice(0, index),
    grade,
    after: body.slice(index + grade.length),
  };
}

function isPositiveAcademicStatusSummary(value: string): boolean {
  return value.trim() === 'You meet the academic requirements.';
}

function iconPath(shape: 'star' | 'shield' | 'academic' | 'bars' | 'person' | 'history' | 'info' | 'check' | 'x') {
  return {
    star: 'm10 2.2 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4L5 15.9l.9-5-3.6-3.5 5-.7L10 2.2Z',
    shield: 'M10 2.5 17 5v5.1c0 4-2.8 6.8-7 7.9-4.2-1.1-7-3.9-7-7.9V5l7-2.5Zm3.5 5.4-4.3 4.3-2-2-1.1 1.1 3.1 3.1 5.4-5.4-1.1-1.1Z',
    academic: 'M10 3 18 6.7 10 10.4 2 6.7 10 3Zm-5.6 6.1L10 11.7l5.6-2.6v4.2c-1.3 1-3.2 1.7-5.6 1.7s-4.3-.7-5.6-1.7V9.1Z',
    bars: 'M4 15.5h12v1.7H4v-1.7Zm1.2-5.4h2.1v4H5.2v-4Zm3.8-3h2.1v7H9v-7Zm3.8-3.5h2.1v10.5h-2.1V3.6Z',
    person: 'M10 10.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Zm-6.4 7.1c.6-3.2 3-5.3 6.4-5.3s5.8 2.1 6.4 5.3H14.7c-.6-2.2-2.3-3.6-4.7-3.6s-4.1 1.4-4.7 3.6H3.6Z',
    history: 'M10 3.1a6.9 6.9 0 1 1-6.4 9.5l1.5-.6A5.3 5.3 0 1 0 5 8.4h2.2v1.7H2.4V5.3h1.7v1.8A6.9 6.9 0 0 1 10 3.1Zm.8 3.5v3.7l2.7 1.6-.8 1.4-3.6-2.1V6.6h1.7Z',
    info: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-.9-9.4h1.8v5.6H9.1V8.6Zm0-2.8h1.8v1.7H9.1V5.8Z',
    check: 'M7.7 13.2 4.6 10l-1.2 1.2 4.3 4.3 8.9-9-1.2-1.2-7.7 7.9Z',
    x: 'm5.4 4.2 4.6 4.6 4.6-4.6 1.2 1.2-4.6 4.6 4.6 4.6-1.2 1.2-4.6-4.6-4.6 4.6-1.2-1.2L8.8 10 4.2 5.4l1.2-1.2Z',
  }[shape];
}

function ResultIcon({
  shape,
  className = '',
}: {
  shape: 'star' | 'shield' | 'academic' | 'bars' | 'person' | 'history' | 'info' | 'check' | 'x';
  className?: string;
}) {
  return (
    <svg className={`result-card-icon ${className}`} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d={iconPath(shape)} />
    </svg>
  );
}

function UniversityAvatar({ universityId }: { universityId: string }) {
  const code = UNIVERSITY_CODES[universityId];
  if (!code) return null;
  return (
    <span className="result-card-avatar" aria-label={`University code ${code}`}>
      {code}
    </span>
  );
}

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string | null; icon: 'shield' | 'person' | 'history' | 'info' }) {
  return (
    <div className="result-card-section-heading">
      <div>
        <ResultIcon shape={icon} />
        <h4>{title}</h4>
      </div>
      {subtitle && <span>{publicText(subtitle)}</span>}
    </div>
  );
}

function hasRenderableHistoricalStage(stage: { status?: string | null; summary?: string | null } | undefined): boolean {
  const status = String(stage?.status || '').trim().toLowerCase();
  const summary = publicText(stage?.summary);
  if (!summary) return false;
  return status !== 'not applied' && status !== 'not used';
}

function statusTone(status: string): 'positive' | 'negative' | 'warning' | 'neutral' {
  const normalized = status.toLowerCase();
  if (/not met|excluded|not accepted|below|rejected/.test(normalized)) return 'negative';
  if (/missing|review|unavailable|not applied|unknown/.test(normalized)) return 'warning';
  if (/not used|not specified|requirement not shown/.test(normalized)) return 'neutral';
  if (/met|accepted|above|within|assessed|counted|used|guidance|eligible|ranking/.test(normalized)) return 'positive';
  return 'neutral';
}

function applicantUcatContext(card: PredictionResult['result_card']): {
  score: number | null;
  max: number | null;
  sjtBand: number | null;
} {
  const applicantContext = card.applicant_context as
    | { admissions_tests?: { ucat?: { total_score?: number | null; score_scale?: number | null; sjt_band?: number | null } } }
    | undefined;
  const prediction = card.prediction as { score?: number | null; score_scale?: number | { max?: number | null } | null };
  const scoreScale =
    typeof prediction?.score_scale === 'object' && prediction.score_scale !== null
      ? prediction.score_scale.max
      : prediction?.score_scale;
  const ucat = applicantContext?.admissions_tests?.ucat;
  return {
    score: Number.isFinite(ucat?.total_score) ? Number(ucat?.total_score) : Number.isFinite(prediction?.score) ? Number(prediction?.score) : null,
    max: Number.isFinite(ucat?.score_scale) ? Number(ucat?.score_scale) : Number.isFinite(scoreScale) ? Number(scoreScale) : null,
    sjtBand: Number.isFinite(ucat?.sjt_band) ? Number(ucat?.sjt_band) : null,
  };
}

function reliableUcatComparison(
  ucatComparison: UcatComparison | null,
  selectionMetric: SelectionMetric | null,
) {
  if (
    ucatComparison &&
    ucatComparison.comparison_type !== 'ranking_only' &&
    Number.isFinite(ucatComparison.applicant_ucat) &&
    Number.isFinite(ucatComparison.benchmark_min)
  ) {
    return {
      applicant: Number(ucatComparison.applicant_ucat),
      max: 2700,
      referenceMin: Number(ucatComparison.benchmark_min),
      referenceMax: Number.isFinite(ucatComparison.benchmark_max) ? Number(ucatComparison.benchmark_max) : null,
      comparisonOperator: ucatComparison.comparison_operator || null,
      label: publicUcatComparisonPhrase(ucatComparison),
      difference:
        ucatComparison.position === 'within'
          ? ucatComparison.comparison_type === 'applysmart_prediction_band' || ucatComparison.evidence_status === 'applysmart_derived'
            ? 'Within prediction band'
            : 'Within reference range'
          : formatUcatDifference(ucatComparison.difference_from_benchmark, ucatComparison.position) ||
            (selectionMetric?.type === 'ucat' ? formatSelectionMetricDifference(selectionMetric) : null),
      position: ucatComparison.position,
      caveat: publicComparisonCaveat(ucatComparison),
    };
  }
  if (
    selectionMetric?.type === 'ucat' &&
    Number.isFinite(selectionMetric.applicant_value) &&
    Number.isFinite(selectionMetric.comparison_value)
  ) {
    return {
      applicant: Number(selectionMetric.applicant_value),
      max: Number.isFinite(selectionMetric.maximum_value) ? Number(selectionMetric.maximum_value) : 2700,
      referenceMin: Number(selectionMetric.comparison_value),
      referenceMax: Number.isFinite(selectionMetric.comparison_max_value) ? Number(selectionMetric.comparison_max_value) : null,
      label: publicText(selectionMetric.comparison_label || 'historical UCAT reference'),
      difference: formatSelectionMetricDifference(selectionMetric),
      position: selectionMetric.difference_direction === 'at' ? 'within' : selectionMetric.difference_direction,
      caveat: selectionMetric.caveat || 'Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview.',
    };
  }
  return null;
}

function comparisonRangeText(comparison: NonNullable<ReturnType<typeof reliableUcatComparison>>): string {
  if (comparison.comparisonOperator === 'greater_than_or_equal') return `${comparison.referenceMin}+`;
  if (comparison.comparisonOperator === 'greater_than') return `>${comparison.referenceMin}`;
  if (comparison.comparisonOperator === 'less_than') return `<${comparison.referenceMin}`;
  if (comparison.comparisonOperator === 'less_than_or_equal') return `<=${comparison.referenceMin}`;
  return comparison.referenceMax !== null
    ? `${comparison.referenceMin}-${comparison.referenceMax}`
    : String(comparison.referenceMin);
}

function scoreValueFromMetric(metric: SelectionMetric | null, fallback: string | null): string | null {
  if (metric && Number.isFinite(metric.applicant_value)) {
    return formatScoreValue(Number(metric.applicant_value), Number.isFinite(metric.maximum_value) ? Number(metric.maximum_value) : null);
  }
  return fallback;
}

function selectionGuideValue(metric: SelectionMetric | null, metrics: ComparisonMetric[]): string | null {
  if (metric && Number.isFinite(metric.comparison_value)) {
    const value = Number(metric.comparison_value);
    const max = Number.isFinite(metric.comparison_max_value) ? Number(metric.comparison_max_value) : null;
    return max !== null ? `${formatMetricNumber(value)}-${formatMetricNumber(max)}` : formatMetricNumber(value);
  }
  const historicalMetric = metrics.find((m) => /score|point|guide|benchmark/i.test(`${m.label} ${m.value}`));
  return historicalMetric ? publicText(historicalMetric.value) : null;
}

function scoreComponentValue(summary: string): string {
  return publicText(summary)
    .replace(/\s+out of\s+/i, ' / ')
    .replace(/\.$/, '');
}

function scoreComponentRows(scoreBreakdown: ScoreBreakdown | null | undefined) {
  const checks = scoreBreakdown?.checks || [];
  return checks
    .filter((check) => check.summary.trim())
    .map((check) => {
      const label = check.label.toLowerCase();
      let displayLabel = check.label;
      if (/gcse/.test(label)) {
        displayLabel = 'GCSE points';
      } else if (/ucat/.test(label)) {
        displayLabel = 'UCAT points';
      } else if (/sjt/.test(label)) {
        displayLabel = 'SJT points';
      } else if (/contextual/.test(label) && /uplift/.test(label)) {
        displayLabel = 'Contextual uplift';
      } else if (/contextual/.test(label)) {
        displayLabel = 'Contextual points';
      } else if (/academic/.test(label)) {
        displayLabel = 'Academic score';
      } else if (/grade profile/.test(label)) {
        displayLabel = 'Grade Profile Score';
      } else if (/achieved/.test(label)) {
        displayLabel = 'Achieved-grade uplift';
      }
      return { label: displayLabel, value: scoreComponentValue(check.summary) };
    });
}

function scoreComponentRow(scoreBreakdown: ScoreBreakdown | null | undefined, pattern: RegExp) {
  return scoreComponentRows(scoreBreakdown).find((row) => pattern.test(row.label));
}

type AssessmentKind = 'ucat' | 'selection-score' | 'ranking-only' | 'eligibility-only';

function assessmentKind({
  comparison,
  selectionMetric,
  scoreBreakdown,
  ucatComparison,
  displayState,
  selectionText,
}: {
  comparison: ReturnType<typeof reliableUcatComparison>;
  selectionMetric: SelectionMetric | null;
  scoreBreakdown: ScoreBreakdown | null | undefined;
  ucatComparison: UcatComparison | null;
  displayState: string;
  selectionText: string;
}): AssessmentKind {
  if (displayState === 'eligibility_only' || selectionMetric?.type === 'eligibility' || selectionMetric?.display_mode === 'eligibility') {
    return 'eligibility-only';
  }
  if (selectionMetric?.type === 'selection_score' || selectionMetric?.type === 'points' || scoreBreakdown) {
    return 'selection-score';
  }
  if (comparison) {
    return 'ucat';
  }
  if (ucatComparison?.comparison_type === 'ranking_only' || /rank(?:s|ed)? by (?:raw )?ucat|eligible applicants are ranked by ucat/i.test(selectionText)) {
    return 'ranking-only';
  }
  return 'eligibility-only';
}

function assessmentPanelRows({
  kind,
  comparison,
  selectionMetric,
  totalScoreText,
  summaryLineTwo,
  displayState,
  variant,
  informationNeededReason,
  unresolvedLabel,
  ucatAdjustment,
}: {
  kind: AssessmentKind;
  comparison: ReturnType<typeof reliableUcatComparison>;
  selectionMetric: SelectionMetric | null;
  totalScoreText: string | null;
  summaryLineTwo: string;
  displayState: string;
  variant: string;
  informationNeededReason?: string | null;
  unresolvedLabel?: string;
  ucatAdjustment?: UcatAdjustment | null;
}): Array<{ label: string; value: string; emphasis?: boolean }> {
  if (variant === 'manual-review' || /insufficient_evidence|manual_review|information/i.test(displayState)) {
    return [
      { label: 'Eligibility Status', value: unresolvedLabel || 'Information Needed', emphasis: true },
      ...(informationNeededReason ? [{ label: 'Reason', value: informationNeededReason }] : []),
    ];
  }
  if (hasAppliedUcatAdjustment(ucatAdjustment)) {
    return [
      { label: 'Your UCAT', value: String(ucatAdjustment.raw_ucat) },
      { label: 'Contextual uplift', value: contextualUpliftValue(ucatAdjustment) },
      {
        label: 'Aberdeen adjusted selection UCAT',
        value: String(ucatAdjustment.adjusted_selection_ucat),
        emphasis: true,
      },
    ];
  }
  if (kind === 'ucat' && comparison) {
    return [
      { label: 'Your UCAT', value: `${comparison.applicant} / ${comparison.max}`, emphasis: true },
    ];
  }
  if (kind === 'selection-score') {
    const value = scoreValueFromMetric(selectionMetric, totalScoreText);
    if (!value) return [];
    return [
      { label: 'Selection Score', value, emphasis: true },
    ];
  }
  if (kind === 'ranking-only') {
    return [
      { label: 'Selection Method', value: 'Ranked by UCAT', emphasis: true },
    ];
  }
  if (variant === 'not-eligible') {
    return [
      { label: 'Eligibility Status', value: 'Requirements not met', emphasis: true },
    ];
  }
  return [
    { label: 'Eligibility Status', value: /not meet|not currently/i.test(summaryLineTwo) ? 'Requirements not met' : 'Requirements met', emphasis: true },
  ];
}

type RequirementBadgeTone = 'positive' | 'negative' | 'warning' | 'neutral';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function overallRequirementRow(status: string | null | undefined) {
  const normalized = String(status || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (!normalized) return null;
  if (/not met|not eligible|ineligible|fail|failed|excluded|rejected/.test(normalized)) {
    return { label: 'Requirements not met', value: 'not-met', tone: 'negative' as const };
  }
  if (/information|review|required|missing|unknown|pending|unavailable|insufficient|manual/.test(normalized)) {
    return { label: 'More information needed', value: 'info', tone: 'warning' as const };
  }
  if (/met|eligible|pass|passed|accepted|confirmed|satisfied/.test(normalized)) {
    return { label: 'Requirements met', value: 'met', tone: 'positive' as const };
  }
  return null;
}

function exposedOverallAcademicStatus(
  card: PredictionResult['result_card'],
  eligibilityStage: { status?: string | null } | undefined,
): string | null {
  const eligibilityStatus = card.eligibility?.status;
  return asString(eligibilityStage?.status) || (typeof eligibilityStatus === 'string' ? eligibilityStatus : null);
}

function academicRequirementTone(status: string): RequirementBadgeTone {
  if (status === 'not_met') return 'negative';
  if (status === 'information_needed') return 'warning';
  if (status === 'met') return 'positive';
  return 'neutral';
}

function academicPathway(card: PredictionResult['result_card']): string {
  return asString(card.academic_pathway).toLowerCase().replace(/[\s-]+/g, '_');
}

function isEpqAlternativeRequirement(type: string, label: string): boolean {
  return /epq/i.test(type) || /epq/i.test(label);
}

const requirementTonePriority: Record<RequirementBadgeTone, number> = {
  neutral: 0,
  positive: 1,
  warning: 2,
  negative: 3,
};

const COMPACT_REQUIREMENT_ROW_LIMIT = 5;

type CompactRequirementRow = {
  label: string;
  value: string;
  tone: RequirementBadgeTone;
};

type CompactRequirementCandidate = CompactRequirementRow & {
  type: string;
  qualificationType: string;
};

function isALevelRequirementCandidate(row: CompactRequirementCandidate): boolean {
  return row.qualificationType === 'a_level' ||
    /a[-_\s]?levels?/i.test(`${row.type} ${row.label}`);
}

function compactRequirementRow(row: CompactRequirementCandidate): CompactRequirementRow {
  return {
    label: row.label,
    value: row.value,
    tone: row.tone,
  };
}

function visibleCompactRequirementRows(rows: CompactRequirementCandidate[]): CompactRequirementRow[] {
  if (rows.length <= COMPACT_REQUIREMENT_ROW_LIMIT) {
    return rows.map(compactRequirementRow);
  }

  const visible = rows.slice(0, COMPACT_REQUIREMENT_ROW_LIMIT);
  const visibleHasALevel = visible.some(isALevelRequirementCandidate);
  const firstALevel = rows.find(isALevelRequirementCandidate);
  const withRequiredALevel = !visibleHasALevel && firstALevel
    ? [...visible, firstALevel]
    : visible;

  return withRequiredALevel.map(compactRequirementRow);
}

function conciseRequirementRows(
  card: PredictionResult['result_card'],
  overallStatus: string | null,
) {
  const rowsByType = new Map<string, CompactRequirementCandidate>();
  const suppressEpqAlternative = academicPathway(card) === 'standard';
  (card.academic_requirement_checks || []).forEach((check) => {
    const type =
      asString(check.requirement_type) ||
      asString(check.label) ||
      asString(check.qualification_type);
    const qualificationType = asString(check.qualification_type);
    const label = asString(check.label);
    const status = asString(check.status);
    const tone = academicRequirementTone(status);
    if (!type || !label || tone === 'neutral') return;
    if (suppressEpqAlternative && isEpqAlternativeRequirement(type, label)) return;
    const current = rowsByType.get(type);
    if (current && requirementTonePriority[current.tone] >= requirementTonePriority[tone]) return;
    rowsByType.set(type, {
      type,
      qualificationType,
      label,
      value: tone === 'positive' ? 'met' : tone === 'negative' ? 'not-met' : 'info',
      tone,
    });
  });
  const qualificationRows = visibleCompactRequirementRows(Array.from(rowsByType.values()));

  if (qualificationRows.length > 0) return qualificationRows;

  const fallbackRow = overallRequirementRow(overallStatus);
  return fallbackRow ? [fallbackRow] : [];
}

function compactUcatMinimum(summary?: string | null): string | null {
  if (!summary) return null;
  const totalMinimum = summary.match(/minimum total\s+(\d{3,4})(?:\s*\/\s*(\d{3,4}))?/i);
  if (totalMinimum) {
    return totalMinimum[1];
  }
  const sectionMinimum = summary.match(/(?:per section|each (?:cognitive )?section|section minimum|minimum(?: of)?\s+(\d{3,4}).{0,30}(?:per|each).{0,20}section)/i);
  if (sectionMinimum) {
    const sectionScore = sectionMinimum[1] || summary.match(/\b(\d{3,4})\b/)?.[1];
    return sectionScore ? `${sectionScore} min per section` : compactSentence(summary);
  }
  const score = summary.match(/\b(\d{3,4})\b/);
  return score ? score[1] : compactSentence(summary);
}

function EligibilityCard({
  title,
  icon,
  status,
  rows,
  tone,
  badgeOnly = false,
}: {
  title: string;
  icon: 'academic' | 'bars' | 'person';
  status: string;
  rows: Array<{ label: string; value: string; tone?: 'positive' | 'negative' | 'warning' | 'neutral' }>;
  tone: 'positive' | 'negative' | 'warning' | 'neutral';
  badgeOnly?: boolean;
}) {
  return (
    <div className={`result-card-summary-card result-card-summary-card--${tone}`}>
      <div className="result-card-summary-card-head">
        <span className="result-card-card-icon">
          <ResultIcon shape={icon} />
        </span>
        <div>
          <h5>{title}</h5>
          {!badgeOnly && <strong>{publicText(status)}</strong>}
        </div>
      </div>
      {badgeOnly && rows.length > 0 ? (
        <ul className="result-card-requirement-badges" aria-label={`${title} status`}>
          {rows.map((row, index) => {
            const rowTone = row.tone || statusTone(row.value);
            const shape = rowTone === 'negative' ? 'x' : rowTone === 'warning' ? 'info' : 'check';
            return (
              <li key={`${row.label}-${index}`} className={`result-card-requirement-badge result-card-requirement-badge--${rowTone}`}>
                <ResultIcon shape={shape} />
                <span>{publicText(row.label)}</span>
              </li>
            );
          })}
        </ul>
      ) : rows.length > 0 ? (
        <dl className="result-card-summary-rows">
          {rows.slice(0, 5).map((row, index) => (
          <div key={`${row.label}-${index}`}>
            <dt>{publicText(row.label)}</dt>
            <dd>{publicText(row.value)}</dd>
          </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

type FactorState = 'used' | 'eligibility' | 'not-used' | 'unknown';

function factorState({
  factor,
  selectionText,
  eligibilityText,
  scoreChecks,
  selectionMetric,
  ucatComparison,
}: {
  factor: 'ucat' | 'gcse' | 'a-level' | 'interview' | 'sjt' | 'contextual' | 'ps';
  selectionText: string;
  eligibilityText: string;
  scoreChecks: DecisionPathCheck[];
  selectionMetric: SelectionMetric | null;
  ucatComparison: UcatComparison | null;
}): FactorState {
  const scoredText = scoreChecks.map((check) => `${check.label} ${check.summary}`).join(' ').toLowerCase();
  const negativePatterns: Record<typeof factor, RegExp> = {
    ucat: /ucat.{0,50}(not used|not scored|excluded)/,
    gcse: /(gcse.{0,60}(not scored|not used)|not scored.{0,60}gcse)/,
    'a-level': /(a[ -]?levels?.{0,60}(not scored|not used)|not scored.{0,60}a[ -]?levels?)/,
    interview: /(interview.{0,60}(not scored|not used)|post-interview)/,
    sjt: /(sjt|situational judgement).{0,70}(not used|not scored|excluded from applysmart selection|ignored)/,
    contextual: /contextual.{0,60}(not used|not applied)/,
    ps: /(personal statement|ps).{0,60}(not used|not scored)/,
  };
  if (negativePatterns[factor].test(selectionText)) return 'not-used';

  if (factor === 'ucat') {
    if (selectionMetric?.type === 'ucat' || ucatComparison || /rank(?:s|ed)? by (?:raw )?ucat|ucat.{0,30}(ranking|ranked|score|sole ranking|100%)/.test(selectionText)) return 'used';
    return /ucat/.test(eligibilityText) ? 'eligibility' : 'unknown';
  }
  if (factor === 'gcse') {
    if (/gcse/.test(scoredText) || /gcse.{0,30}(score|scored|points|weighted)/.test(selectionText)) return 'used';
    return /gcse/.test(eligibilityText) ? 'eligibility' : 'unknown';
  }
  if (factor === 'a-level') {
    if (/a[ -]?level.{0,30}(score|scored|points|weighted)/.test(selectionText)) return 'used';
    return /a[ -]?level/.test(eligibilityText) ? 'eligibility' : 'unknown';
  }
  if (factor === 'sjt') {
    if (/sjt/.test(scoredText) || /(sjt|situational judgement).{0,40}(score|scored|points|counted|used in selection)/.test(selectionText)) return 'used';
    return /(sjt|situational judgement)/.test(eligibilityText) ? 'eligibility' : 'unknown';
  }
  if (factor === 'contextual') {
    if (/contextual.{0,50}(score|adjust|used|weight|points)/.test(selectionText)) return 'used';
    return /contextual/.test(eligibilityText) ? 'eligibility' : 'unknown';
  }
  if (factor === 'ps') {
    if (/(personal statement|ps).{0,40}(score|scored|used|assessed)/.test(selectionText)) return 'used';
    return 'unknown';
  }
  return 'unknown';
}

function SelectionChip({ label, state }: { label: string; state: FactorState }) {
  const icon = state === 'used' ? 'check' : state === 'not-used' ? 'x' : 'info';
  return (
    <span className={`result-card-factor-chip result-card-factor-chip--${state}`}>
      <ResultIcon shape={icon} />
      {label}
    </span>
  );
}

export function ResultCard({ result }: { result: PredictionResult }) {
  const card = result.result_card;
  const { variant, label } = presentResult(card);
  const officialPredictionUnavailable = isOfficialPredictionUnavailable(card);
  const transparency = card.decision_transparency;
  const decisionPath = transparency?.decision_path || [];
  const eligibilityStage = decisionPath.find((stage) => stage.stage === 'Eligibility');
  const selectionStage = decisionPath.find((stage) => stage.stage === 'Selection model');
  const historicalStage = decisionPath.find((stage) => stage.stage === 'Historical guidance');
  const scoreBreakdown = transparency?.score_breakdown;
  const selectionChecks = selectionStage?.checks || [];
  const scoreChecks = scoreBreakdown?.checks || [];
  const historicalChecks = historicalStage?.checks || [];
  const ucatComparison = transparency?.ucat_comparison || null;
  const ucatAdjustment = transparency?.ucat_adjustment || null;
  const selectionMetric = transparency?.selection_metric || null;
  const hasStructuredComparisonMetrics = Array.isArray(transparency?.comparison_metrics);
  const comparisonMetrics = hasStructuredComparisonMetrics
    ? (transparency?.comparison_metrics || []).filter(isRenderableComparisonMetric)
    : [];
  const entryRequirementsMet = eligibilityStage
    ? !eligibilityStage.checks.some((c) => isGenuineWarningCheck(c))
    : variant !== 'not-eligible';

  const applicantPoolCheck = findCheck(selectionChecks, /^Applicant pool$/i);
  const selectionApproachCheck = findCheck(selectionChecks, /^Selection approach$/i);
  const sjtComponentCheck = findCheck(scoreChecks, /SJT/i);
  const sjtCheck =
    sjtComponentCheck ||
    selectionChecks.find((c) => c.label.toLowerCase() === 'sjt band') ||
    findCheck(eligibilityStage?.checks || [], /SJT/i);
  const sjtRejected = sjtCheck ? isGenuineWarningCheck(sjtCheck) : false;

  const ucatComparisonCheck =
    selectionChecks.find((c) => c.label.toLowerCase() === 'ucat') ||
    historicalChecks.find((c) => c.label.toLowerCase() === 'ucat comparison');
  const officialMinimumCheck = selectionChecks.find((c) => c.label.toLowerCase() === 'ucat minimum');
  const sjtRequirementCheck = selectionChecks.find((c) => c.label.toLowerCase() === 'sjt requirement');

  const genuineWarnings = [
    ...(eligibilityStage?.checks || []),
    ...selectionChecks,
    ...scoreChecks,
  ].filter((c) => isGenuineWarningCheck(c) && isParentFacingCheck(c.label));
  const warningSummaries = uniqueStrings(genuineWarnings.map((w) => w.summary));

  const isUnresolvedOrNotSuitable = variant === 'manual-review' || variant === 'not-eligible';

  const academicStatus = eligibilityStage?.status || (entryRequirementsMet ? 'Met' : 'Not met');
  const topAcademicStatus = resultCardAcademicStatus(card);
  const informationNeededReason =
    typeof card.information_needed_reason === 'string' && card.information_needed_reason.trim()
      ? card.information_needed_reason.trim()
      : typeof transparency?.information_needed_reason === 'string' && transparency.information_needed_reason.trim()
        ? transparency.information_needed_reason.trim()
        : null;
  const manualReviewReasonCode =
    typeof transparency?.manual_review_reason_code === 'string' && transparency.manual_review_reason_code.trim()
      ? transparency.manual_review_reason_code.trim()
      : null;
  const glasgowReachCompletionInformationNeeded =
    manualReviewReasonCode === GLASGOW_REACH_COMPLETION_REQUIRED_REASON;
  const trustStatement =
    typeof card.trust_statement === 'string' && card.trust_statement.trim().length > 0
      ? card.trust_statement
      : null;
  const totalScoreText =
    scoreBreakdown && Number.isFinite(scoreBreakdown.value)
      ? formatScoreValue(scoreBreakdown.value, scoreBreakdown.max)
      : null;
  const primaryExplanation = resultCardRecommendationExplanation(card);
  const visibleTrustStatement = containsAdmissionYearOrInternalTerms(trustStatement) ? null : trustStatement;
  const metadataSelectionApproach =
    typeof card.selection_approach_display === 'string' && card.selection_approach_display.trim()
      ? card.selection_approach_display.trim()
      : null;
  const selectionApproachSummary = metadataSelectionApproach || selectionApproachCheck?.summary || selectionStage?.summary;
  const applicantPoolSummary = applicantPoolCheck?.summary;
  const comparison = reliableUcatComparison(ucatComparison, selectionMetric);
  const ucatContext = applicantUcatContext(card);
  const courseIdentity = card.course_identity as
    | { course_name?: string | null; ucas_code?: string | null; entry_route?: string | null }
    | undefined;
  const courseText = publicText(
    [
      courseIdentity?.ucas_code || null,
      courseIdentity?.course_name || null,
    ].filter(Boolean).join(' '),
  ) || 'Medicine assessment';
  const applicantPoolText = publicText(applicantPoolSummary || ucatComparison?.applicant_pool || '');
  const summaryLineOne =
    isUnresolvedOrNotSuitable && variant !== 'not-eligible'
      ? publicText(primaryExplanation)
      : compactSentence(primaryExplanation, resultCardRecommendationHeadline(card));
  const summaryLineTwo = publicText(topAcademicStatus);
  const visibleSummaryLineTwo =
    glasgowReachCompletionInformationNeeded || isPositiveAcademicStatusSummary(summaryLineTwo)
      ? null
      : summaryLineTwo;
  const advisoryLine = visibleTrustStatement ? compactSentence(visibleTrustStatement) : null;
  const contextualStatusConfirmed =
    card.contextual_status === 'confirmed' && card.recommendation_display_state === 'standard';
  const contextualConfirmation =
    contextualStatusConfirmed && card.contextual_confirmation && typeof card.contextual_confirmation === 'object'
      ? card.contextual_confirmation
      : null;
  const contextualCollapsedMessage =
    typeof contextualConfirmation?.collapsed_label === 'string' && contextualConfirmation.collapsed_label.trim()
      ? null
      : contextualStatusConfirmed
        ? CONTEXTUAL_CONFIRMED_MESSAGE
        : null;
  const contextualExpandedHeading =
    typeof contextualConfirmation?.expanded_heading === 'string' && contextualConfirmation.expanded_heading.trim()
      ? contextualConfirmation.expanded_heading.trim()
      : null;
  const contextualExpandedBody =
    typeof contextualConfirmation?.expanded_body === 'string' && contextualConfirmation.expanded_body.trim()
      ? contextualConfirmation.expanded_body.trim()
      : null;
  const contextualConsiderationLabel =
    typeof contextualConfirmation?.consideration_label === 'string' && contextualConfirmation.consideration_label.trim()
      ? contextualConfirmation.consideration_label.trim()
      : null;
  const contextualOfferGrade =
    typeof contextualConfirmation?.contextual_offer_grade === 'string' && contextualConfirmation.contextual_offer_grade.trim()
      ? contextualConfirmation.contextual_offer_grade.trim()
      : null;
  const contextualBodyGradeParts = contextualExpandedBody
    ? splitContextualOfferGrade(contextualExpandedBody, contextualOfferGrade)
    : null;
  const visibleAlternativeAcademicOffer =
    academicPathway(card) === 'standard' && card.alternative_academic_offer?.type === 'epq'
      ? null
      : card.alternative_academic_offer;
  const guaranteedInterviewNotice =
    card.interview_outcome === 'guaranteed_interview' &&
    typeof card.guaranteed_interview_notice === 'string' &&
    card.guaranteed_interview_notice.trim().length > 0
      ? card.guaranteed_interview_notice.trim()
      : 'Every published guaranteed-interview condition for this route has been verified as met.';

  const eligibilityText = [
    ...(eligibilityStage?.checks || []).map((check) => `${check.label} ${check.status} ${check.summary}`),
  ].join(' ').toLowerCase();
  const selectionText = [
    ...selectionChecks.map((check) => `${check.label} ${check.status} ${check.summary}`),
    ...scoreChecks.map((check) => `${check.label} ${check.status} ${check.summary}`),
    selectionApproachSummary || '',
    scoreBreakdown?.name || '',
    scoreBreakdown?.explanation || '',
  ].join(' ').toLowerCase();
  const overallAcademicStatus = exposedOverallAcademicStatus(card, eligibilityStage);
  const academicRows = conciseRequirementRows(card, overallAcademicStatus);
  const academicTone = academicRows[0]?.tone || statusTone(academicStatus);
  const eligibilitySubtitle = glasgowReachCompletionInformationNeeded
    ? null
    : isPositiveAcademicStatusSummary(topAcademicStatus)
    ? 'You meet the published requirements'
    : topAcademicStatus;
  const factorUsageEntries = Array.isArray(card.factor_usage) ? card.factor_usage : [];
  const factorUsageById = new Map(factorUsageEntries.map((entry) => [entry.factor_id, entry]));
  const ucatFactor = factorUsageById.get('ucat');
  const sjtFactor = factorUsageById.get('sjt');
  const ucatPointsRow = scoreComponentRow(scoreBreakdown, /^UCAT points$/i);
  const sjtPointsRow = scoreComponentRow(scoreBreakdown, /^SJT points$/i);
  const ucatRole = ucatFactor?.role;
  const ucatRows: Array<{ label: string; value: string }> = [];
  const ucatMinimumText =
    ucatRole === 'ranking'
      ? null
      : compactUcatMinimum(officialMinimumCheck?.summary) ||
        compactUcatMinimum(ucatComparison?.official_ucat_minimum?.summary);
  if (ucatPointsRow) {
    ucatRows.push(ucatPointsRow);
  } else if (ucatMinimumText) {
    ucatRows.push({ label: 'Minimum', value: ucatMinimumText });
  }
  const ucatExplicitlyNotUsed = /ucat.{0,50}(not used|not scored)|not used.{0,50}ucat/i.test(selectionText);
  const ucatStatus = ucatPointsRow
    ? 'Counted'
    : ucatRole === 'not_used'
      ? 'Not used'
      : ucatRole === 'eligibility'
        ? 'Eligibility requirement'
        : ucatRole === 'ranking'
          ? 'Used for ranking'
          : ucatMinimumText
            ? officialMinimumCheck && isGenuineWarningCheck(officialMinimumCheck)
              ? 'Threshold not met'
              : 'Threshold met'
            : ucatRole === 'considered' || ucatRole === 'contextual'
              ? 'Used'
              : ucatExplicitlyNotUsed
                ? 'Not used'
                : ucatComparison?.comparison_type === 'ranking_only' || comparison || /rank(?:s|ed)? by (?:raw )?ucat|ucat.{0,30}(ranking|ranked|score|sole ranking|100%)/i.test(selectionText)
                  ? 'Used for ranking'
                  : 'Not used';

  const sjtBand =
    applicantSjtBand(card) ??
    ucatComparison?.applicant_sjt_band ??
    ucatContext.sjtBand ??
    sjtBandFromText(sjtCheck?.summary) ??
    sjtBandFromText(sjtRequirementCheck?.summary);
  const sjtUseEvidence = `${sjtRequirementCheck?.summary || ''} ${sjtCheck?.summary || ''} ${ucatComparison?.sjt_summary || ''} ${ucatComparison?.sjt_policy || ''}`;
  const sjtExplicitlyNotUsed = /not used|ignored/i.test(sjtUseEvidence);
  const sjtRows: Array<{ label: string; value: string }> = [];
  if (sjtPointsRow) {
    sjtRows.push(sjtPointsRow);
  } else if (sjtBand && (!sjtExplicitlyNotUsed || sjtRejected)) {
    sjtRows.push({ label: 'Applicant band', value: sjtRejected ? `Band ${sjtBand} (Rejected)` : `Band ${sjtBand}` });
  }
  const sjtRole = sjtFactor?.role;
  const sjtStatus = sjtPointsRow
    ? 'Counted'
    : sjtRole === 'not_used'
      ? 'Not used'
      : sjtRole === 'eligibility'
        ? 'Eligibility requirement'
        : sjtRole === 'ranking'
          ? 'Used for ranking'
          : sjtRole === 'considered' || sjtRole === 'contextual'
            ? 'Used'
            : sjtRejected
              ? 'Excluded by policy'
              : sjtExplicitlyNotUsed
                ? 'Not used'
                : sjtCheck || sjtRequirementCheck
                  ? 'Threshold met'
                  : 'Not used';
  const factors: Array<{ key: Parameters<typeof factorState>[0]['factor']; label: string }> = [
    { key: 'ucat', label: 'UCAT' },
    { key: 'gcse', label: 'GCSEs' },
    { key: 'a-level', label: 'A-Levels' },
    { key: 'sjt', label: 'SJT' },
    { key: 'contextual', label: 'Contextual' },
    { key: 'ps', label: 'PS' },
  ];
  const componentRows = scoreComponentRows(scoreBreakdown);
  const adjustedSelectionUcatApplied = hasAppliedUcatAdjustment(ucatAdjustment);
  const primaryAssessmentKind = assessmentKind({
    comparison,
    selectionMetric,
    scoreBreakdown,
    ucatComparison,
    displayState: card.recommendation_display_state,
    selectionText,
  });
  const assessmentRows = assessmentPanelRows({
    kind: primaryAssessmentKind,
    comparison,
    selectionMetric,
    totalScoreText,
    summaryLineTwo,
    displayState: card.recommendation_display_state,
    variant,
    informationNeededReason,
    unresolvedLabel: label,
    ucatAdjustment,
  });
  const assessmentTitle = adjustedSelectionUcatApplied
    ? 'UCAT adjustment'
    : primaryAssessmentKind === 'ucat'
    ? 'UCAT comparison'
    : primaryAssessmentKind === 'selection-score'
      ? 'Selection score'
      : primaryAssessmentKind === 'ranking-only'
        ? 'Ranking summary'
        : 'Eligibility summary';

  const noticeText = isUnresolvedOrNotSuitable
    ? variant === 'not-eligible'
      ? card.primary_explanation
      : informationNeededReason || unresolvedResultNotice(card, result.university)
    : null;
  const noticeDisplayText = publicText(noticeText);
  const selectionScoreHistoricalRows =
    primaryAssessmentKind === 'selection-score'
      ? [
          { label: 'Historical Selection Score Guide', value: selectionGuideValue(selectionMetric, comparisonMetrics) },
          { label: 'Your Selection Score', value: scoreValueFromMetric(selectionMetric, totalScoreText) },
          { label: 'Difference', value: selectionMetric ? formatSelectionMetricDifference(selectionMetric) : null },
        ].filter((row) => row.value)
      : [];
  const showSelectionScoreComparison = selectionScoreHistoricalRows.some((row) => /guide|benchmark|historical/i.test(row.label)) &&
    selectionScoreHistoricalRows.some((row) => /Your Selection Score/i.test(row.label));
  const rankingOnlySummary =
    variant === 'not-eligible' && historicalStage?.summary
      ? historicalStage.summary
      : ucatComparison?.comparison_type === 'ranking_only'
      ? 'Eligible applicants are ranked by UCAT; no reliable numerical comparison is available.'
      : ucatComparisonCheck?.summary || historicalStage?.summary || selectionApproachSummary || 'Eligible applicants are ranked by UCAT; no reliable numerical comparison is available.';
  const eligibilityOnlySummary =
    eligibilityStage?.summary || summaryLineTwo || 'Eligibility has been assessed against the supported entry requirements.';
  const historicalEvidenceSummary =
    historicalStage?.summary ||
    'Historical admissions evidence is available for this applicant group, but no reliable numerical comparison is available.';
  const historicalFallbackSummary =
    historicalStage?.summary
      ? historicalEvidenceSummary
      : 'A historical comparison cannot currently be provided for this applicant group.';
  const historicalNote = (value?: string | null): string =>
    isUnresolvedOrNotSuitable ? publicText(value) : compactSentence(value);
  const isExplicitEligibilityOnly =
    card.recommendation_display_state === 'eligibility_only' ||
    selectionMetric?.type === 'eligibility' ||
    selectionMetric?.display_mode === 'eligibility';
  const hasHistoricalContextForNotSuitable = Boolean(
    variant === 'not-eligible' &&
      (comparison ||
        comparisonMetrics.length > 0 ||
        (historicalStage && historicalStage.status !== 'Not applied' && historicalStage.summary)),
  );
  const renderableHistoricalStage = hasRenderableHistoricalStage(historicalStage);
  const showHistoricalContext = Boolean(
    (!isUnresolvedOrNotSuitable || hasHistoricalContextForNotSuitable || renderableHistoricalStage) &&
      (comparison ||
        primaryAssessmentKind === 'selection-score' ||
        primaryAssessmentKind === 'ranking-only' ||
        (primaryAssessmentKind === 'eligibility-only' && isExplicitEligibilityOnly) ||
        comparisonMetrics.length > 0 ||
        renderableHistoricalStage),
  );
  const isApplySmartPredictionComparison =
    ucatComparison?.comparison_type === 'applysmart_prediction_band' ||
    ucatComparison?.evidence_status === 'applysmart_derived' ||
    comparison?.label === 'ApplySmart prediction band';
  const historicalTitle =
    isApplySmartPredictionComparison
      ? 'UCAT PREDICTION CONTEXT'
      : typeof transparency?.comparison_metrics_title === 'string' && transparency.comparison_metrics_title.trim()
      ? publicText(transparency.comparison_metrics_title)
      : primaryAssessmentKind === 'selection-score'
        ? 'Historical Score Context'
        : primaryAssessmentKind === 'ranking-only'
          ? 'Ranking Context'
          : primaryAssessmentKind === 'eligibility-only' && isExplicitEligibilityOnly
            ? 'Eligibility Information'
            : 'Historical Context';
  const predictionContextRows =
    isApplySmartPredictionComparison && comparison
      ? [
          { label: 'ApplySmart Prediction Band', value: comparisonRangeText(comparison) },
          ...comparisonMetrics
            .filter((row) => {
              const isDuplicatePredictionBand =
                publicText(row.label).toLowerCase() === 'applysmart prediction band' &&
                publicText(row.value) === comparisonRangeText(comparison);
              return !isDuplicatePredictionBand;
            })
            .map((row) => ({ label: row.label, value: row.value })),
        ]
      : [];

  return (
    <article className={`result-card result-card--${variant}`}>
      <header className="result-card-head">
        <div className="result-card-hero-main">
          <div className="result-card-identity">
            <UniversityAvatar universityId={result.universityId} />
            <div>
              <h3>{result.university}</h3>
              <p className="result-card-meta">
                <span>{courseText}</span>
              </p>
            </div>
          </div>
          <div className="result-card-assessment-summary">
            <p className="result-card-explanation">{summaryLineOne}</p>
            {contextualCollapsedMessage && <p className="result-card-advisory">{contextualCollapsedMessage}</p>}
            {visibleSummaryLineTwo && <p className="result-card-academic-status">{visibleSummaryLineTwo}</p>}
            {advisoryLine && <p className="result-card-advisory">{advisoryLine}</p>}
          </div>
        </div>
        <div className="result-card-hero-side">
          <span className="result-card-status result-card-status--recommendation-badge">
            {label}
          </span>
          <aside className="result-card-assessment-panel" aria-label={assessmentTitle}>
            <span>{assessmentTitle}</span>
            <dl>
              {assessmentRows.map((row, index) => (
                <div key={`${row.label}-${index}`} className={row.emphasis ? 'result-card-assessment-row--emphasis' : undefined}>
                  <dt>{publicText(row.label)}</dt>
                  <dd>{publicText(row.value)}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </header>

      {isUnresolvedOrNotSuitable && (
        <p className="result-card-notice" role="status">
          {noticeDisplayText}
        </p>
      )}

      {card.interview_outcome === 'guaranteed_interview' && (
        <p className="result-card-notice result-card-notice--guaranteed" role="status">
          {guaranteedInterviewNotice}
        </p>
      )}

      {!isUnresolvedOrNotSuitable && warningSummaries.length > 0 && (
        <ul className="result-card-warning-list">
          {warningSummaries.map((warning, i) => (
            <li key={i} className="result-card-warning">
              {compactSentence(warning)}
            </li>
          ))}
        </ul>
      )}

      <section className="result-card-section result-card-checks">
        <SectionHeader
          title="Eligibility"
          subtitle={eligibilitySubtitle}
          icon="shield"
        />
        <div className="result-card-summary-grid">
          {academicRows.length > 0 && (
            <EligibilityCard
              title="Academic Requirements"
              icon="academic"
              status={officialPredictionUnavailable && entryRequirementsMet ? 'Met' : academicStatus}
              rows={academicRows}
              tone={academicTone}
              badgeOnly
            />
          )}
          <EligibilityCard
            title="UCAT"
            icon="bars"
            status={ucatStatus}
            rows={ucatRows}
            tone={statusTone(ucatStatus)}
          />
          <EligibilityCard
            title="SJT"
            icon="person"
            status={sjtStatus}
            rows={sjtRows}
            tone={sjtRejected ? 'negative' : statusTone(sjtStatus)}
          />
        </div>
      </section>

      {contextualExpandedHeading && contextualExpandedBody && (
        <section className="result-card-section result-card-contextual-confirmation">
          <SectionHeader title={contextualExpandedHeading} subtitle={undefined} icon="info" />
          <p className="result-card-compact-note">
            {contextualConsiderationLabel && <strong>{publicText(contextualConsiderationLabel)} </strong>}
            {contextualBodyGradeParts ? (
              <>
                {contextualBodyGradeParts.before}
                <strong>{contextualBodyGradeParts.grade}</strong>
                {contextualBodyGradeParts.after}
              </>
            ) : (
              publicText(contextualExpandedBody)
            )}
          </p>
        </section>
      )}

      <AlternativeAcademicOffer
        offer={visibleAlternativeAcademicOffer}
        contextualStatus={contextualStatusConfirmed && !contextualConfirmation ? card.contextual_status : null}
      />

      <section className="result-card-section result-card-details">
        <SectionHeader title="Selection" subtitle="How applicants are ranked for interview" icon="person" />
        <div className="result-card-selection-panel">
          <div className="result-card-factor-row" aria-label="Selection factors">
            {factors.map((factor) => (
              <SelectionChip
                key={factor.key}
                label={factor.label}
                state={(() => {
                  const entry = factorUsageById.get(factor.key === 'a-level' ? 'a_level' : factor.key === 'ps' ? 'personal_statement' : factor.key);
                  if (!entry) {
                    return factorState({
                      factor: factor.key,
                      selectionText,
                      eligibilityText,
                      scoreChecks,
                      selectionMetric,
                      ucatComparison,
                    });
                  }
                  if (entry.role === 'not_used') return 'not-used';
                  if (entry.role === 'eligibility') return 'eligibility';
                  if (entry.role === 'unknown') return 'unknown';
                  return 'used';
                })()}
              />
            ))}
          </div>
          <dl className="result-card-selection-facts">
            {applicantPoolText && (
              <div>
                <dt>Applicant Pool</dt>
                <dd>{applicantPoolText}</dd>
              </div>
            )}
            {selectionApproachSummary && (
              <div>
                <dt>Selection Approach</dt>
                <dd>{publicText(selectionApproachSummary)}</dd>
              </div>
            )}
            {componentRows.map((row, index) => (
              <div key={`${row.label}-${index}`}>
                <dt>{publicText(row.label)}</dt>
                <dd>{publicText(row.value)}</dd>
              </div>
            ))}
            {scoreBreakdown && totalScoreText && (componentRows.length > 0 || primaryAssessmentKind !== 'selection-score') && (
              <div>
                <dt>Total Selection Score</dt>
                <dd>{totalScoreText}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {showHistoricalContext && (
        <section className="result-card-section result-card-historical">
          <SectionHeader title={historicalTitle} subtitle={isApplySmartPredictionComparison ? null : comparison?.label} icon="history" />
          {primaryAssessmentKind === 'ucat' && comparison ? (
            isApplySmartPredictionComparison ? (
              <div className="result-card-historical-grid result-card-historical-grid--prediction-context">
                <section className="result-card-prediction-context-block" aria-label="Prediction Context values">
                  <dl>
                    {predictionContextRows.map((row, index) => (
                      <div key={`${row.label}-${index}`}>
                        <dt>{publicText(row.label)}</dt>
                        <dd>{publicText(row.value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p>
                    <ResultIcon shape="info" />
                    {publicText(comparison.caveat)}
                  </p>
                </section>
                <div>
                  <span>{adjustedSelectionUcatApplied ? 'Aberdeen adjusted selection UCAT' : 'Your UCAT'}</span>
                  <strong>{comparison.applicant}</strong>
                </div>
                {comparison.difference && (
                  <div>
                    <span>Difference</span>
                    <strong>{comparison.difference}</strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="result-card-historical-grid">
                <div>
                  <span>Historical UCAT Guide</span>
                  <strong>{comparisonRangeText(comparison)}</strong>
                </div>
                <div>
                  <span>{adjustedSelectionUcatApplied ? 'Aberdeen adjusted selection UCAT' : 'Your UCAT'}</span>
                  <strong>{comparison.applicant}</strong>
                </div>
                {comparison.difference && (
                  <div>
                    <span>Difference</span>
                    <strong>{comparison.difference}</strong>
                  </div>
                )}
                <p>
                  <ResultIcon shape="info" />
                  {publicText(comparison.caveat)}
                </p>
              </div>
            )
          ) : primaryAssessmentKind === 'selection-score' && showSelectionScoreComparison ? (
            <div className="result-card-historical-grid">
              {selectionScoreHistoricalRows.map((row, index) => (
                <div key={`${row.label}-${index}`}>
                  <span>{publicText(row.label)}</span>
                  <strong>{publicText(row.value)}</strong>
                </div>
              ))}
              <p>
                <ResultIcon shape="info" />
                {publicText(selectionMetric?.caveat || historicalStage?.summary || publicComparisonCaveat(ucatComparison))}
              </p>
            </div>
          ) : primaryAssessmentKind === 'selection-score' ? (
            <p className="result-card-compact-note">{historicalNote(historicalFallbackSummary)}</p>
          ) : comparisonMetrics.length > 0 ? (
            <div className="result-card-historical-grid result-card-historical-grid--metrics">
              {comparisonMetrics.slice(0, 3).map((metric, index) => (
                <div key={`${metric.label}-${index}`}>
                  <span>{publicText(metric.label)}</span>
                  <strong>{publicText(metric.value)}</strong>
                  {metric.difference && <em>{publicText(metric.difference)}</em>}
                </div>
              ))}
              <p>
                <ResultIcon shape="info" />
                {publicComparisonCaveat(ucatComparison)}
              </p>
            </div>
          ) : primaryAssessmentKind === 'ranking-only' ? (
            <p className="result-card-compact-note">{historicalNote(rankingOnlySummary)}</p>
          ) : primaryAssessmentKind === 'eligibility-only' && isExplicitEligibilityOnly ? (
            <p className="result-card-compact-note">{historicalNote(eligibilityOnlySummary)}</p>
          ) : (
            <p className="result-card-compact-note">{historicalNote(historicalStage?.summary)}</p>
          )}
        </section>
      )}
    </article>
  );
}
