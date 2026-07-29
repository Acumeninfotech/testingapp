import { ShortlistCounter } from './ShortlistCounter';

export interface ResultsHeaderProps {
  universityCount: number;
  shortlistCount: number;
}

export function ResultsHeader({ universityCount, shortlistCount }: ResultsHeaderProps) {
  const universityLabel = universityCount === 1 ? 'University analysed' : 'Universities analysed';

  return (
    <header className="page-header results-header" aria-labelledby="results-heading">
      <div className="results-header-copy">
        <p className="results-header-kicker">ApplySmart assessment complete</p>
        <h1 id="results-heading">Your Personalised University Analysis</h1>
        <p className="results-header-lede">
          ApplySmart has reviewed your profile against UK medical school entry requirements and
          admissions processes. Your results combine published academic criteria with verified
          historical admissions evidence where it is available.
        </p>
      </div>

      <div className="results-header-summary" aria-label="Assessment summary">
        <div className="results-header-summary-card">
          <span className="results-header-summary-value">{universityCount}</span>
          <span className="results-header-summary-label">{universityLabel}</span>
        </div>
        <div className="results-header-summary-card">
          <span className="results-header-summary-value">Personalised</span>
          <span className="results-header-summary-label">Assessment based on your profile</span>
        </div>
        <div className="results-header-summary-card">
          <span className="results-header-summary-value">Historical evidence</span>
          <span className="results-header-summary-label">Admissions data reviewed where available</span>
        </div>
        <div className="results-header-summary-card results-header-summary-card--shortlist">
          <ShortlistCounter count={shortlistCount} />
          <span className="results-header-summary-label">Saved universities for your UCAS choices</span>
        </div>
      </div>
    </header>
  );
}
