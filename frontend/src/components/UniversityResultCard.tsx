import type { PredictionResult } from '../api/types';
import { ResultCard } from './ResultCard';
import { UniversityResultSummary } from './UniversityResultSummary';

export interface UniversityResultCardProps {
  result: PredictionResult;
  expanded: boolean;
  onToggleExpanded: () => void;
  shortlisted: boolean;
  shortlistFull: boolean;
  onToggleShortlist: () => void;
}

export function UniversityResultCard({
  result,
  expanded,
  onToggleExpanded,
  shortlisted,
  shortlistFull,
  onToggleShortlist,
}: UniversityResultCardProps) {
  const detailsId = `university-result-details-${result.universityId}`;

  return (
    <div className={`university-result-card${expanded ? ' university-result-card--expanded' : ''}`}>
      <UniversityResultSummary
        result={result}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        shortlisted={shortlisted}
        shortlistFull={shortlistFull}
        onToggleShortlist={onToggleShortlist}
      />
      {expanded && (
        <div id={detailsId} className="university-result-details">
          <ResultCard result={result} />
        </div>
      )}
    </div>
  );
}
