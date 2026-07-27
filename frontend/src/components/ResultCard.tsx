import type {
  ComparisonMetric,
  DecisionPathCheck,
  PredictionResult,
  SelectionMetric,
  UcatComparison,
} from '../api/types';
import { Fragment } from 'react';
import { presentResult } from '../lib/resultPresenter';

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

function formatBenchmark(comparison: UcatComparison): string | null {
  if (comparison.comparison_type === 'historical_range') {
    return comparison.benchmark_min !== null && comparison.benchmark_max !== null
      ? `${comparison.benchmark_min}-${comparison.benchmark_max}`
      : null;
  }
  return comparison.benchmark_min !== null ? String(comparison.benchmark_min) : null;
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

function formatSelectionMetricValue(value: number | null, max: number | null): string {
  if (!Number.isFinite(value)) {
    return 'Not available';
  }
  const formattedValue = formatMetricNumber(Number(value));
  return Number.isFinite(max) ? `${formattedValue} / ${formatMetricNumber(Number(max))}` : formattedValue;
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

function formatSelectionMetricComparison(metric: SelectionMetric): string {
  const comparison = formatSelectionMetricValue(metric.comparison_value, null);
  if (!metric.comparison_max_value) {
    return comparison;
  }
  return `${comparison} (range ${comparison}-${formatMetricNumber(Number(metric.comparison_max_value))})`;
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

function positionLabel(comparison: UcatComparison): string {
  if (comparison.comparison_type === 'ranking_only') {
    return 'Ranking only';
  }
  const comparisonText = `${comparison.benchmark_label || ''} ${comparison.caveat || ''}`.toLowerCase();
  const label = /advisory|modelled|modeled|applysmart|historical-equivalent/.test(comparisonText) ||
    (comparison.comparison_type === 'historical_range' && /\b(published|official)\b/.test(comparisonText) && !/\bunpublished\b/.test(comparisonText) && /threshold|minimum/.test(comparisonText))
    ? 'ApplySmart advisory benchmark'
    : /\b(published|official)\b/.test(comparisonText) && !/\bunpublished\b/.test(comparisonText) && /threshold|minimum/.test(comparisonText)
    ? 'published threshold'
      : /observed|interviewed-score|lowest interviewed|average interviewed|interview scores/.test(comparisonText)
        ? 'historical interview data'
        : 'historical benchmark';
  return {
    above: `Above ${label}`,
    within: `Within ${label}`,
    below: `Below ${label}`,
  }[comparison.position || 'within'];
}

function kingsUcatComparisonSummary(card: PredictionResult['result_card']): string {
  const band = card.prediction?.result_band;
  if (band === 'interview_likely') return 'Above the historical interview benchmark';
  if (band === 'realistic') return 'Within the historical interview benchmark';
  if (band === 'ambitious') return 'Below the strongest historical interview benchmark';
  if (band === 'high_risk') return 'Below the historical interview benchmark';
  return 'Assessed against the historical interview benchmark';
}

export function ResultCard({ result }: { result: PredictionResult }) {
  const card = result.result_card;
  const { variant, label } = presentResult(card);
  const officialPredictionUnavailable = isOfficialPredictionUnavailable(card);
  const courseIdentity = card.course_identity as { profile_id?: string } | undefined;
  const profileId = String(courseIdentity?.profile_id || result.universityId || '');
  const transparency = card.decision_transparency;
  const feeInformation = card.fee_information as
    | {
        fee_status?: string;
        currency?: string;
        entry_cycle?: string;
        first_year?: number | null;
        course_total?: number | null;
        deposit?: number | null;
        fees_subject_to_change?: boolean;
        fee_increase_wording?: string | null;
        eligibility_effect?: string;
      }
    | undefined;
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
  const isUcatRankingCard = Boolean(ucatComparison);
  const parentFacingHistoricalChecks = historicalChecks.filter(
    (c) =>
      c.label.trim().toLowerCase() !== 'applicant pool' &&
      c.label.trim().toLowerCase() !== 'ucat comparison' &&
      c.label.trim().toLowerCase() !== 'important limitation',
  );

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

  const parentFacingSelectionChecks = selectionChecks.filter(
    (c) =>
      isParentFacingCheck(c.label) &&
      c.label.toLowerCase() !== 'sjt band' &&
      c.label.toLowerCase() !== 'ucat total entered',
  );
  const academicStatus = eligibilityStage?.status || (entryRequirementsMet ? 'Met' : 'Not met');
  const trustStatement =
    typeof card.trust_statement === 'string' && card.trust_statement.trim().length > 0
      ? card.trust_statement
      : null;
  const manualReviewReason =
    card.recommendation_display_state === 'manual_review' ? transparency?.manual_review_reason : null;
  const totalScoreText = scoreBreakdown ? formatScoreValue(scoreBreakdown.value, scoreBreakdown.max) : null;
  const sjtSummary = formatSjtSummary(sjtCheck, card, sjtRejected);
  const visibleFeeInformation = profileId === 'lincoln-a100' ? undefined : feeInformation;
  const isKingsA100 = profileId === 'king-s-college-london-a100';
  const showHistoricalSection = Boolean(
    historicalStage && (hasStructuredComparisonMetrics ? comparisonMetrics.length > 0 : true),
  );
  const historicalSectionTitle =
    typeof transparency?.comparison_metrics_title === 'string' && transparency.comparison_metrics_title.trim()
      ? transparency.comparison_metrics_title.trim()
      : 'Historical Context';

  return (
    <article className={`result-card result-card--${variant}`}>
      <div className="result-card-head">
        <h3>{result.university}</h3>
        <span className="result-card-status">{label}</span>
      </div>
      <p className="result-card-recommendation">{card.primary_user_facing_recommendation}</p>
      <p className="result-card-explanation">{card.primary_explanation}</p>
      {trustStatement && (
        <p className="result-card-explanation result-card-trust-statement">{trustStatement}</p>
      )}

      {scoreBreakdown && (
        <section className="result-card-total-score" aria-label="Total selection score">
          <span className="result-card-total-score-label">Total selection score</span>
          <strong className="result-card-total-score-value">{totalScoreText}</strong>
        </section>
      )}

      {isUnresolvedOrNotSuitable && (
        <p className="result-card-notice" role="status">
          {card.recommendation_display_state === 'insufficient_evidence' &&
          transparency?.insufficient_evidence_reason_code === 'university_methodology_gap'
            ? `${transparency?.insufficient_evidence_reason || 'This university has not published a complete scoring or ranking methodology that ApplySmart can apply to this specific applicant route.'} This is not a rejection.`
            : card.recommendation_display_state === 'insufficient_evidence' &&
                transparency?.insufficient_evidence_reason
              ? `${transparency.insufficient_evidence_reason} This is not a rejection.`
              : transparency?.manual_review_reason
                ? `${transparency.manual_review_reason} This is not a rejection.`
                : variant === 'not-eligible'
                  ? card.primary_explanation
                  : unresolvedResultNotice(card, result.university)}
        </p>
      )}

      {card.interview_outcome === 'guaranteed_interview' && (
        <p className="result-card-notice result-card-notice--guaranteed" role="status">
          Every published guaranteed-interview condition for this route has been verified as met.
        </p>
      )}

      {warningSummaries.length > 0 && (
        <ul className="result-card-warning-list">
          {warningSummaries.map((warning, i) => (
            <li key={i} className="result-card-warning">
              {warning}
            </li>
          ))}
        </ul>
      )}

      <section className="result-card-section result-card-checks">
        <h4>Checks</h4>
        <ul className="result-card-check-list">
          <li className="result-card-check">
            {officialPredictionUnavailable && entryRequirementsMet ? (
              <span className="result-card-check-label">Entry requirements met</span>
            ) : (
              <>
                <span className="result-card-check-label">
                  {isKingsA100 ? 'Academic requirements:' : 'Entry requirements:'}
                </span>{' '}
                <span className="result-card-check-summary">{academicStatus}</span>
              </>
            )}
          </li>
          {isKingsA100 && entryRequirementsMet && (
            <li className="result-card-check">
              <span className="result-card-check-label">UCAT comparison:</span>{' '}
              <span className="result-card-check-summary">{kingsUcatComparisonSummary(card)}</span>
            </li>
          )}
          {isUcatRankingCard && officialMinimumCheck && (
            <li className="result-card-check">
              <span className="result-card-check-label">UCAT minimum:</span>{' '}
              <span className="result-card-check-summary">{officialMinimumCheck.summary}</span>
            </li>
          )}
          {isUcatRankingCard && ucatComparisonCheck && (
            <li className="result-card-check">
              <span className="result-card-check-label">UCAT:</span>{' '}
              <span className="result-card-check-summary">{ucatComparisonCheck.summary}</span>
            </li>
          )}
          {!scoreBreakdown && !isUcatRankingCard && ucatEnteredCheck && (
            <li className="result-card-check">
              <span className="result-card-check-label">UCAT:</span>{' '}
              <span className="result-card-check-summary">{ucatEnteredCheck.summary}</span>
            </li>
          )}
          {!scoreBreakdown &&
            !isUcatRankingCard &&
            parentFacingSelectionChecks.map((c, i) => (
              <li key={i} className="result-card-check">
                <span className="result-card-check-label">{c.label}:</span>{' '}
                <span className="result-card-check-summary">{c.summary}</span>
              </li>
            ))}
          {isUcatRankingCard && sjtRequirementCheck && (
            <li className="result-card-check">
              <span className="result-card-check-label">SJT:</span>{' '}
              <span className="result-card-check-summary">{sjtRequirementCheck.summary}</span>
            </li>
          )}
          {!isUcatRankingCard && sjtCheck && (
            <li className="result-card-check">
              <span className="result-card-check-label">SJT:</span>{' '}
              <span className="result-card-check-summary">{sjtSummary}</span>
            </li>
          )}
        </ul>
      </section>

      <section className="result-card-section result-card-details">
        <h4>Selection</h4>
        <dl className="result-card-detail-list">
          {applicantPoolCheck && (
            <>
              <dt>Applicant pool</dt>
              <dd>{applicantPoolCheck.summary}</dd>
            </>
          )}
          {!isUcatRankingCard && (
            <>
              <dt>Academic status</dt>
              <dd>{eligibilityStage?.summary || academicStatus}</dd>
            </>
          )}
          {!isUcatRankingCard && ucatEnteredCheck && (
            <>
              <dt>UCAT</dt>
              <dd>{ucatEnteredCheck.summary}</dd>
            </>
          )}
          {selectionMetric && selectionMetric.display_mode !== 'eligibility' && (
            <>
              <dt>{selectionMetric.label}</dt>
              <dd>
                {formatSelectionMetricValue(
                  selectionMetric.applicant_value,
                  selectionMetric.maximum_value,
                )}
              </dd>
            </>
          )}
          {!isUcatRankingCard && sjtCheck && (
            <>
              <dt>SJT</dt>
              <dd>{sjtSummary}</dd>
            </>
          )}
          {(selectionApproachCheck?.summary || selectionStage?.summary) && (
            <>
              <dt>Selection approach</dt>
              <dd>{selectionApproachCheck?.summary || selectionStage?.summary}</dd>
            </>
          )}
        </dl>
      </section>

      {scoreBreakdown && scoreChecks.length > 0 && (
        <section className="result-card-section result-card-score">
          <h4>Score Breakdown</h4>
          <ul className="result-card-check-list">
            {scoreChecks.map((c, i) => (
              <li key={i} className="result-card-check">
                <span className="result-card-check-label">{c.label}:</span>{' '}
                <span className="result-card-check-summary">
                  {/SJT/i.test(c.label) ? formatSjtSummary(c, card, false) : c.summary}
                </span>
              </li>
            ))}
          </ul>
          {scoreBreakdown.explanation && (
            <p className="result-card-score-explanation">{scoreBreakdown.explanation}</p>
          )}
        </section>
      )}

      {showHistoricalSection && (
        <section className="result-card-section result-card-historical">
          <h4>{historicalSectionTitle}</h4>
          <p className="result-card-section-summary">{historicalStage?.summary}</p>
          {hasStructuredComparisonMetrics ? (
            <dl className="result-card-detail-list result-card-comparison-list">
              {comparisonMetrics.map((metric, i) => (
                <Fragment key={`${metric.label}-${i}`}>
                  <dt>{metric.label}</dt>
                  <dd>
                    <span>{metric.value}</span>
                    {metric.difference && (
                      <span className="result-card-comparison-difference">{metric.difference}</span>
                    )}
                  </dd>
                </Fragment>
              ))}
            </dl>
          ) : selectionMetric?.comparison_value !== null && selectionMetric?.comparison_value !== undefined ? (
            <dl className="result-card-detail-list result-card-comparison-list">
              <dt>{selectionMetric.label}</dt>
              <dd>
                {formatSelectionMetricValue(
                  selectionMetric.applicant_value,
                  selectionMetric.maximum_value,
                )}
              </dd>
              <dt>Comparison value</dt>
              <dd>{formatSelectionMetricComparison(selectionMetric)}</dd>
              {selectionMetric.comparison_label && (
                <>
                  <dt>Comparison type</dt>
                  <dd>{selectionMetric.comparison_label}</dd>
                </>
              )}
              {selectionMetric.comparison_context && (
                <>
                  <dt>Context</dt>
                  <dd>{selectionMetric.comparison_context}</dd>
                </>
              )}
              {selectionMetric.entry_year && (
                <>
                  <dt>Entry year</dt>
                  <dd>{selectionMetric.entry_year}</dd>
                </>
              )}
              {formatSelectionMetricDifference(selectionMetric) && (
                <>
                  <dt>Difference</dt>
                  <dd>{formatSelectionMetricDifference(selectionMetric)}</dd>
                </>
              )}
              {selectionMetric.caveat && (
                <>
                  <dt>Caveat</dt>
                  <dd>{selectionMetric.caveat}</dd>
                </>
              )}
            </dl>
          ) : ucatComparison ? (
            <dl className="result-card-detail-list result-card-comparison-list">
              <dt>Your UCAT</dt>
              <dd>{ucatComparison.applicant_ucat ?? 'Not available'}</dd>
              {ucatComparison.comparison_type !== 'ranking_only' ? (
                <>
                  <dt>
                    {positionLabel(ucatComparison).includes('published threshold')
                      ? 'Published threshold'
                      : positionLabel(ucatComparison).includes('advisory')
                        ? 'ApplySmart advisory benchmark'
                        : positionLabel(ucatComparison).includes('historical interview data')
                          ? 'Historical interview data'
                          : 'Historical benchmark'}
                  </dt>
                  <dd>{formatBenchmark(ucatComparison)}</dd>
                </>
              ) : null}
              {ucatComparison.difference_from_benchmark !== null && (
                <>
                  <dt>Difference</dt>
                  <dd>{formatDifference(ucatComparison.difference_from_benchmark)}</dd>
                </>
              )}
              <dt>Position</dt>
              <dd>{positionLabel(ucatComparison)}</dd>
            </dl>
          ) : null}
          {!hasStructuredComparisonMetrics && parentFacingHistoricalChecks.length > 0 && (
            <ul className="result-card-check-list">
              {parentFacingHistoricalChecks.slice(0, 4).map((c, i) => (
                <li key={i} className="result-card-check">
                  <span className="result-card-check-label">{c.label}:</span>{' '}
                  <span className="result-card-check-summary">{c.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {visibleFeeInformation && (
        <section className="result-card-section result-card-fees">
          <h4>Fees</h4>
          <dl className="result-card-detail-list">
            <dt>Fee status</dt>
            <dd>{visibleFeeInformation.fee_status || 'Not selected'}</dd>
            <dt>First year</dt>
            <dd>
              {visibleFeeInformation.currency || 'GBP'} {visibleFeeInformation.first_year ?? 'Not available'}
            </dd>
            <dt>Course total</dt>
            <dd>
              {visibleFeeInformation.currency || 'GBP'} {visibleFeeInformation.course_total ?? 'Not available'}
            </dd>
            {visibleFeeInformation.deposit !== undefined && visibleFeeInformation.deposit !== null && (
              <>
                <dt>Deposit</dt>
                <dd>
                  {visibleFeeInformation.currency || 'GBP'} {visibleFeeInformation.deposit}
                </dd>
              </>
            )}
            {visibleFeeInformation.entry_cycle && (
              <>
                <dt>Cycle</dt>
                <dd>{visibleFeeInformation.entry_cycle}</dd>
              </>
            )}
          </dl>
          {visibleFeeInformation.fees_subject_to_change && visibleFeeInformation.fee_increase_wording && (
            <p className="result-card-section-summary">{visibleFeeInformation.fee_increase_wording}</p>
          )}
        </section>
      )}

      {manualReviewReason && (
        <section className="result-card-section result-card-manual-review">
          <h4>Manual Review</h4>
          <p className="result-card-section-summary">{manualReviewReason}</p>
        </section>
      )}
    </article>
  );
}
