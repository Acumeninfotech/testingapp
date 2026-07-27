import { ShortlistCounter } from './ShortlistCounter';

export interface ResultsHeaderProps {
  universityCount: number;
  shortlistCount: number;
}

export function ResultsHeader({ universityCount, shortlistCount }: ResultsHeaderProps) {
  return (
    <div className="page-header results-header">
      <h1>Your ApplySmart Results</h1>
      <p>
        We analysed {universityCount} {universityCount === 1 ? 'university' : 'universities'} using your
        academic profile, admissions tests, applicant category and each university&rsquo;s admissions
        process. Results are grouped by suitability &mdash; a result marked for review isn&rsquo;t a
        rejection, it means an adviser needs to check something ApplySmart can&rsquo;t confirm
        automatically.
      </p>
      <div className="results-header-meta">
        <span className="results-header-count">
          {universityCount} {universityCount === 1 ? 'university' : 'universities'} analysed
        </span>
        <ShortlistCounter count={shortlistCount} />
      </div>
    </div>
  );
}
