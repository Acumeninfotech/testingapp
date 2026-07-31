import type {
  ComparisonMetric,
  DecisionPathCheck,
  PredictionResult,
  SelectionMetric,
  UcatComparison,
} from '../api/types';
import type { CSSProperties } from 'react';
import {
  presentResult,
  resultCardAcademicStatus,
  resultCardRecommendationExplanation,
  resultCardRecommendationHeadline,
} from '../lib/resultPresenter';
import { UNIVERSITY_CODES } from '../data/universityCodes';

function isOfficialPredictionUnavailable(card: PredictionResult['result_card']): boolean {
  const officialPrediction = card.prediction?.official_prediction as
    | { available?: boolean; prediction_status?: string }
    | undefined;
  return (
    officialPrediction?.available === false ||
    card.prediction?.prediction_status === 'prediction_unavailable'
  );
}

function isHistoricalEvidenceGap(reasonCode?: string | null): boolean {
  return /historical_evidence_gap/.test(reasonCode ?? '');
}

// A manual-review/insufficient-evidence card reaching the frontend with no
// specific reason (transparency.manual_review_reason or a matched
// insufficient_evidence_reason_code) means the engine failed to attach the
// structured reason it's expected to always provide for these states - a
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
        `"${card.recommendation_display_state}" with no specific manual_review_reason or ` +
        'insufficient_evidence_reason_code. The engine must always attach a structured reason for this state.',
    );
  }
  // eslint-disable-next-line no-console
  console.error(
    'Result card missing a specific manual-review/insufficient-evidence reason.',
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
  const labelText = String(comparison?.benchmark_label || '').toLowerCase();
  const text = [
    comparison?.benchmark_label,
    comparison?.caveat,
    comparisonType,
  ].filter(Boolean).join(' ').toLowerCase();
  const published =
    /\b(published|official)\b/.test(text) &&
    !/\b(unpublished|not official|no official)\b/.test(text);
  const advisory = /advisory|modelled|modeled|applysmart|historical-equivalent|working/.test(text);

  if (comparisonType === 'official_minimum') return 'published UCAT minimum';
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

function formatMetricNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function formatSelectionMetricDifference(metric: SelectionMetric): string | null {
  if (!Number.isFinite(metric.difference) || !metric.difference_direction) {
    return null;
  }
  const word = metric.difference_word || 'guide';
  if (metric.difference_direction === 'at') {
    return `At ${word}`;
  }
  const amount = metric.difference_direction === 'above'
    ? `+${formatMetricNumber(Number(metric.difference))}`
    : formatMetricNumber(Math.abs(Number(metric.difference)));
  return `${amount} ${metric.difference_direction} ${word}`;
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

function formatSjtSummary(
  check: DecisionPathCheck | undefined,
  card: PredictionResult['result_card'],
  rejected: boolean,
): string | null {
  if (!check) {
    return null;
  }
  if (rejected) {
    return 'Excluded by this university’s SJT policy.';
  }

  const band = applicantSjtBand(card);
  const pointsMatch = check.summary.match(/(\d+(?:\.\d+)?)\s+out of\s+(\d+(?:\.\d+)?)/i);
  if (pointsMatch) {
    const pointsText = `${pointsMatch[1]} / ${pointsMatch[2]} SJT points`;
    return band ? `Band ${band}: ${pointsText} counted.` : `${pointsText} counted.`;
  }

  if (band && /met|accepted|pass|counted/i.test(check.status)) {
    return `Band ${band}: accepted by this university.`;
  }

  return check.summary;
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

function titleCaseLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactSentence(value: string | null | undefined, fallback = ''): string {
  const cleaned = publicText(value);
  if (!cleaned) return fallback;
  const [firstSentence] = cleaned.split(/(?<=[.!?])\s+/);
  const sentence = firstSentence || cleaned;
  return sentence.length > 145 ? `${sentence.slice(0, 142).trim()}...` : sentence;
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

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string | null; icon: 'shield' | 'person' | 'history' }) {
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

function statusTone(status: string): 'positive' | 'negative' | 'warning' | 'neutral' {
  const normalized = status.toLowerCase();
  if (/not met|excluded|not accepted|below|rejected/.test(normalized)) return 'negative';
  if (/missing|review|unavailable|not applied|unknown/.test(normalized)) return 'warning';
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
      label: publicUcatComparisonPhrase(ucatComparison),
      difference: formatDifference(ucatComparison.difference_from_benchmark),
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
  return comparison.referenceMax !== null
    ? `${comparison.referenceMin}-${comparison.referenceMax}`
    : String(comparison.referenceMin);
}

function comparisonPositionText(position: string | null | undefined): string {
  if (position === 'above') return 'Above range';
  if (position === 'below') return 'Below range';
  return 'Within range';
}

function comparisonBarStyle(comparison: NonNullable<ReturnType<typeof reliableUcatComparison>>): CSSProperties {
  const upper = comparison.referenceMax ?? comparison.referenceMin;
  const max = Math.max(comparison.max || 2700, comparison.applicant, upper);
  const applicantPosition = Math.min(100, Math.max(0, (comparison.applicant / max) * 100));
  const referencePosition = Math.min(100, Math.max(0, (comparison.referenceMin / max) * 100));
  return {
    '--applicant-position': `${applicantPosition}%`,
    '--reference-position': `${referencePosition}%`,
  } as CSSProperties;
}

function conciseRequirementRows(checks: DecisionPathCheck[]) {
  const academicChecks = checks
    .filter((check) => {
      const label = check.label.toLowerCase();
      return isParentFacingCheck(check.label) && !/ucat|sjt|situational judgement|gamsat/.test(label);
    })
    .slice(0, 2);

  if (academicChecks.length === 0) {
    return [{ label: 'Requirements', value: 'Requirements met' }];
  }

  return academicChecks.map((check) => {
    const label = check.label.toLowerCase();
    const displayLabel = /gcse/.test(label)
      ? 'GCSEs'
      : /a[ -]?level/.test(label)
        ? 'A-levels'
        : /ib/.test(label)
          ? 'IB'
          : /scottish/.test(label)
            ? 'Scottish'
            : /graduate/.test(label)
              ? 'Graduate'
              : titleCaseLabel(check.label.replace(/\b(threshold|gate|requirement|requirements)\b/gi, '').trim() || check.label);
    const tone = statusTone(check.status);
    return {
      label: displayLabel,
      value: tone === 'positive' ? 'Requirements met' : tone === 'negative' ? 'Attention needed' : publicText(check.status),
    };
  });
}

function compactUcatMinimum(summary?: string | null): string | null {
  if (!summary) return null;
  const sectionMinimum = summary.match(/(?:at least|minimum(?: of)?)\s+(\d{3,4})/i);
  if (sectionMinimum) return `${sectionMinimum[1]} min per section`;
  const score = summary.match(/\b(\d{3,4})\b/);
  return score ? score[1] : compactSentence(summary);
}

function EligibilityCard({
  title,
  icon,
  status,
  rows,
  tone,
}: {
  title: string;
  icon: 'academic' | 'bars' | 'person';
  status: string;
  rows: Array<{ label: string; value: string }>;
  tone: 'positive' | 'negative' | 'warning' | 'neutral';
}) {
  return (
    <div className={`result-card-summary-card result-card-summary-card--${tone}`}>
      <div className="result-card-summary-card-head">
        <span className="result-card-card-icon">
          <ResultIcon shape={icon} />
        </span>
        <div>
          <h5>{title}</h5>
          <strong>{publicText(status)}</strong>
        </div>
      </div>
      <dl className="result-card-summary-rows">
        {rows.slice(0, 3).map((row, index) => (
          <div key={`${row.label}-${index}`}>
            <dt>{publicText(row.label)}</dt>
            <dd>{publicText(row.value)}</dd>
          </div>
        ))}
      </dl>
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
  const ucatComponentCheck = findCheck(scoreChecks, /UCAT|GAMSAT/i);
  const sjtComponentCheck = findCheck(scoreChecks, /SJT/i);
  const sjtCheck =
    sjtComponentCheck ||
    selectionChecks.find((c) => c.label.toLowerCase() === 'sjt band') ||
    findCheck(eligibilityStage?.checks || [], /SJT/i);
  const sjtRejected = sjtCheck ? isGenuineWarningCheck(sjtCheck) : false;

  const ucatEnteredCheck =
    ucatComponentCheck ||
    selectionChecks.find((c) => c.label.toLowerCase() === 'ucat total entered') ||
    findCheck(selectionChecks, /GAMSAT total entered/i);
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
  const trustStatement =
    typeof card.trust_statement === 'string' && card.trust_statement.trim().length > 0
      ? card.trust_statement
      : null;
  const manualReviewReason =
    card.recommendation_display_state === 'manual_review' ? transparency?.manual_review_reason : null;
  const totalScoreText =
    scoreBreakdown && Number.isFinite(scoreBreakdown.value)
      ? formatScoreValue(scoreBreakdown.value, scoreBreakdown.max)
      : null;
  const sjtSummary = formatSjtSummary(sjtCheck, card, sjtRejected);
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
  const summaryLineOne = compactSentence(primaryExplanation, resultCardRecommendationHeadline(card));
  const summaryLineTwo = publicText(topAcademicStatus);
  const advisoryLine = visibleTrustStatement ? compactSentence(visibleTrustStatement) : null;

  const academicRows = conciseRequirementRows(eligibilityStage?.checks || []);
  const ucatRows: Array<{ label: string; value: string }> = [];
  const ucatMinimumText =
    compactUcatMinimum(officialMinimumCheck?.summary) ||
    compactUcatMinimum(ucatComparison?.official_ucat_minimum?.summary);
  if (ucatMinimumText) {
    ucatRows.push({ label: 'Minimum', value: ucatMinimumText });
  }
  if (comparison) {
    ucatRows.push({ label: 'Reference', value: comparisonRangeText(comparison) });
    ucatRows.push({ label: 'Position', value: comparisonPositionText(comparison.position) });
  } else if (ucatComparison?.comparison_type === 'ranking_only' || ucatComparisonCheck || ucatEnteredCheck) {
    ucatRows.push({ label: 'Ranking', value: 'Eligible applicants ranked by UCAT' });
    ucatRows.push({ label: 'Comparison', value: 'Numerical comparison unavailable' });
  }
  const ucatStatus = comparison
    ? comparisonPositionText(comparison.position)
    : ucatComparison?.comparison_type === 'ranking_only'
      ? 'Ranking factor'
      : ucatEnteredCheck
        ? 'Recorded'
        : 'Not specified';

  const sjtBand = applicantSjtBand(card) ?? ucatComparison?.applicant_sjt_band ?? ucatContext.sjtBand;
  const sjtStatus = sjtBand ? `Band ${sjtBand}` : publicText(sjtRequirementCheck?.status || sjtCheck?.status || ucatComparison?.sjt_outcome || 'Not specified');
  const sjtUseText =
    sjtRejected
      ? 'Excluded by policy'
      : /not used|ignored/i.test(`${sjtRequirementCheck?.summary || ''} ${ucatComparison?.sjt_summary || ''} ${ucatComparison?.sjt_policy || ''}`)
        ? 'Not used for interview selection'
        : sjtSummary
          ? compactSentence(sjtSummary)
          : 'Policy not specified';

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
  const factors: Array<{ key: Parameters<typeof factorState>[0]['factor']; label: string }> = [
    { key: 'ucat', label: 'UCAT' },
    { key: 'gcse', label: 'GCSEs' },
    { key: 'a-level', label: 'A-Levels' },
    { key: 'sjt', label: 'SJT' },
    { key: 'contextual', label: 'Contextual' },
    { key: 'ps', label: 'PS' },
  ];

  const noticeText = isUnresolvedOrNotSuitable
    ? card.recommendation_display_state === 'insufficient_evidence' &&
      transparency?.insufficient_evidence_reason_code === 'university_methodology_gap'
      ? `${transparency?.insufficient_evidence_reason || 'This university has not published a complete scoring or ranking methodology that ApplySmart can apply to this specific applicant route.'} This is not a rejection.`
      : card.recommendation_display_state === 'insufficient_evidence' &&
          isHistoricalEvidenceGap(transparency?.insufficient_evidence_reason_code) &&
          transparency?.insufficient_evidence_reason
        ? transparency.insufficient_evidence_reason
        : card.recommendation_display_state === 'insufficient_evidence' &&
            transparency?.insufficient_evidence_reason
          ? `${transparency.insufficient_evidence_reason} This is not a rejection.`
          : transparency?.manual_review_reason
            ? `${transparency.manual_review_reason} This is not a rejection.`
            : variant === 'not-eligible'
              ? card.primary_explanation
              : unresolvedResultNotice(card, result.university)
    : null;
  const compactNoticeText = compactSentence(noticeText);
  const noticeDisplayText =
    noticeText && /not a rejection/i.test(noticeText) && !/not a rejection/i.test(compactNoticeText)
      ? `${compactNoticeText} This is not a rejection.`
      : compactNoticeText;
  const showHistoricalContext = Boolean(
    comparison ||
    comparisonMetrics.length > 0 ||
    (!isUnresolvedOrNotSuitable &&
      !comparison &&
      historicalStage &&
      historicalStage.status !== 'Not applied' &&
      historicalStage.summary),
  );
  const historicalTitle =
    typeof transparency?.comparison_metrics_title === 'string' && transparency.comparison_metrics_title.trim()
      ? publicText(transparency.comparison_metrics_title)
      : 'Historical Context';

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
          <div className="result-card-recommendation-row">
            <span className="result-card-recommendation-medal">
              <ResultIcon shape="star" />
            </span>
            <div>
              <p className="result-card-recommendation">{label}</p>
              <p className="result-card-explanation">{summaryLineOne}</p>
              {summaryLineTwo && <p className="result-card-academic-status">{summaryLineTwo}</p>}
              {advisoryLine && <p className="result-card-advisory">{advisoryLine}</p>}
            </div>
          </div>
        </div>
        <div className="result-card-hero-side">
          <span className="result-card-status">
            <ResultIcon shape="star" />
            {label}
          </span>
          {comparison && (
            <aside className="result-card-ucat-summary" aria-label="UCAT summary">
              <span>Your UCAT</span>
              <p>
                <strong>{comparison.applicant}</strong>
                <em>/ {comparison.max}</em>
              </p>
              <div>
                <span>{comparisonPositionText(comparison.position)}</span>
                {comparison.difference && <strong>{publicText(comparison.difference)}</strong>}
              </div>
            </aside>
          )}
        </div>
      </header>

      {isUnresolvedOrNotSuitable && (
        <p className="result-card-notice" role="status">
          {noticeDisplayText}
        </p>
      )}

      {card.interview_outcome === 'guaranteed_interview' && (
        <p className="result-card-notice result-card-notice--guaranteed" role="status">
          Every published guaranteed-interview condition for this route has been verified as met.
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
          subtitle={entryRequirementsMet ? 'You meet the published requirements' : 'Some published requirements need attention'}
          icon="shield"
        />
        <div className="result-card-summary-grid">
          <EligibilityCard
            title="Academic Requirements"
            icon="academic"
            status={officialPredictionUnavailable && entryRequirementsMet ? 'Met' : academicStatus}
            rows={academicRows}
            tone={statusTone(academicStatus)}
          />
          <EligibilityCard
            title="UCAT"
            icon="bars"
            status={ucatStatus}
            rows={ucatRows.length > 0 ? ucatRows : [{ label: 'Status', value: 'No UCAT requirement shown' }]}
            tone={statusTone(ucatStatus)}
          />
          <EligibilityCard
            title="SJT"
            icon="person"
            status={sjtStatus}
            rows={[{ label: 'Use', value: sjtUseText }]}
            tone={sjtRejected ? 'negative' : statusTone(sjtStatus)}
          />
        </div>
      </section>

      <section className="result-card-section result-card-details">
        <SectionHeader title="Selection" subtitle="How applicants are ranked for interview" icon="person" />
        <div className="result-card-selection-panel">
          <div className="result-card-factor-row" aria-label="Selection factors">
            {factors.map((factor) => (
              <SelectionChip
                key={factor.key}
                label={factor.label}
                state={factorState({
                  factor: factor.key,
                  selectionText,
                  eligibilityText,
                  scoreChecks,
                  selectionMetric,
                  ucatComparison,
                })}
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
                <dd>{compactSentence(selectionApproachSummary)}</dd>
              </div>
            )}
            {scoreBreakdown && totalScoreText && (
              <div>
                <dt>Total Selection Score</dt>
                <dd>{totalScoreText}</dd>
              </div>
            )}
          </dl>
          {comparison ? (
            <div className="result-card-ucat-comparison" aria-label="UCAT comparison">
              <div className="result-card-comparison-copy">
                <strong>{comparison.label}</strong>
                <span>{comparisonRangeText(comparison)}</span>
                {comparison.difference && <em>{publicText(comparison.difference)}</em>}
              </div>
              <div className="result-card-comparison-bar" aria-hidden="true" style={comparisonBarStyle(comparison)}>
                <span className="result-card-reference-marker" />
                <span className="result-card-applicant-marker" />
              </div>
              <div className="result-card-comparison-labels">
                <span>{comparison.referenceMin} reference</span>
                <strong>{comparison.applicant} you</strong>
                <span>{comparison.max}</span>
              </div>
            </div>
          ) : (
            ucatComparison?.comparison_type === 'ranking_only' && (
              <p className="result-card-compact-note">Reliable numerical UCAT comparison is not available for this applicant group.</p>
            )
          )}
        </div>
      </section>

      {showHistoricalContext && (
        <section className="result-card-section result-card-historical">
          <SectionHeader title={historicalTitle} subtitle={comparison?.label} icon="history" />
          {comparison ? (
            <div className="result-card-historical-grid">
              <div>
                <span>{comparison.label}</span>
                <strong>{comparisonRangeText(comparison)}</strong>
              </div>
              <div>
                <span>Your UCAT</span>
                <strong>{comparison.applicant}</strong>
              </div>
              <div>
                <span>Difference</span>
                <strong>{comparison.difference || 'At reference'}</strong>
              </div>
              <p>
                <ResultIcon shape="info" />
                {publicText(comparison.caveat)}
              </p>
            </div>
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
          ) : (
            <p className="result-card-compact-note">{compactSentence(historicalStage?.summary)}</p>
          )}
        </section>
      )}

      {manualReviewReason && (
        <section className="result-card-section result-card-manual-review">
          <SectionHeader title="Selection" subtitle="Manual review required" icon="person" />
          <p className="result-card-compact-note">{compactSentence(manualReviewReason)}</p>
        </section>
      )}
    </article>
  );
}
