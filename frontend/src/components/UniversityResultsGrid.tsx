import { useEffect, useMemo, useState } from 'react';
import type { PredictionResult } from '../api/types';
import { UniversityResultCard } from './UniversityResultCard';
import { ResultsEmptyState } from './ResultsEmptyState';
import { SHORTLIST_MAX } from '../results/useShortlist';

const RESULTS_PAGE_SIZE = 6;

export interface UniversityResultsGridProps {
  results: PredictionResult[];
  paginationResetKey: string;
  isShortlisted: (universityId: string) => boolean;
  shortlistCount: number;
  onToggleShortlist: (universityId: string) => void;
  onClearFilters: () => void;
}

export function UniversityResultsGrid({
  results,
  paginationResetKey,
  isShortlisted,
  shortlistCount,
  onToggleShortlist,
  onClearFilters,
}: UniversityResultsGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(RESULTS_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(RESULTS_PAGE_SIZE);
    setExpandedId(null);
  }, [paginationResetKey]);

  useEffect(() => {
    if (expandedId && !results.some((result) => result.universityId === expandedId)) {
      setExpandedId(null);
    }
  }, [expandedId, results]);

  const visibleResults = useMemo(() => results.slice(0, visibleCount), [results, visibleCount]);
  const hasMoreResults = visibleCount < results.length;

  if (results.length === 0) {
    return <ResultsEmptyState onClearFilters={onClearFilters} />;
  }

  return (
    <>
      <div className="university-results-grid" data-testid="result-card-list">
        {visibleResults.map((result) => (
          <UniversityResultCard
            key={result.universityId}
            result={result}
            expanded={expandedId === result.universityId}
            onToggleExpanded={() =>
              setExpandedId((prev) => (prev === result.universityId ? null : result.universityId))
            }
            shortlisted={isShortlisted(result.universityId)}
            shortlistFull={shortlistCount >= SHORTLIST_MAX}
            onToggleShortlist={() => onToggleShortlist(result.universityId)}
          />
        ))}
      </div>
      {hasMoreResults && (
        <div className="results-load-more">
          <button
            type="button"
            className="btn btn-secondary results-load-more-button"
            onClick={() => setVisibleCount((count) => count + RESULTS_PAGE_SIZE)}
          >
            Load More Universities
          </button>
        </div>
      )}
    </>
  );
}
