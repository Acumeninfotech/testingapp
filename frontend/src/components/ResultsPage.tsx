import { useMemo, useState } from 'react';
import type { PredictionResult } from '../api/types';
import {
  CATEGORY_PRIORITY,
  categoryRank,
  emptyFilterGroupCounts,
  filterGroupForCategory,
  presentResult,
  strongestPopulatedFilterGroup,
} from '../lib/resultPresenter';
import { useShortlist } from '../results/useShortlist';
import { ResultsHeader } from './ResultsHeader';
import { ResultCategoryPills, type PillKey } from './ResultCategoryPills';
import { ResultsToolbar, type SortOption } from './ResultsToolbar';
import { UniversityResultsGrid } from './UniversityResultsGrid';

function scoreValue(result: PredictionResult): number | null {
  const value = result.result_card.decision_transparency?.score_breakdown?.value;
  return Number.isFinite(value) ? Number(value) : null;
}

export interface ResultsPageProps {
  results: PredictionResult[];
  onStartOver: () => void;
}

export function ResultsPage({ results, onStartOver }: ResultsPageProps) {
  const { shortlist, isShortlisted, toggleShortlist, limitMessage, clearLimitMessage } = useShortlist();

  const categorised = useMemo(
    () =>
      results.map((result) => {
        const category = presentResult(result.result_card).category;
        return { result, category, filterGroup: filterGroupForCategory(category) };
      }),
    [results],
  );

  const counts = useMemo(() => {
    const base = emptyFilterGroupCounts();
    for (const { filterGroup } of categorised) {
      base[filterGroup] += 1;
    }
    return base;
  }, [categorised]);

  const initialCategory = useMemo(() => strongestPopulatedFilterGroup(counts), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeCategory, setActiveCategory] = useState<PillKey>(initialCategory);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('best_match');
  const paginationResetKey = `${activeCategory}:${query}:${sort}`;

  const scoreSortAvailable = useMemo(
    () => results.some((result) => scoreValue(result) !== null),
    [results],
  );

  const filtered = useMemo(() => {
    const normalisedQuery = query.trim().toLowerCase();
    return categorised
      .filter(({ filterGroup }) =>
        activeCategory === 'all' ? true : filterGroup === activeCategory,
      )
      .filter(({ result }) => (normalisedQuery ? result.university.toLowerCase().includes(normalisedQuery) : true));
  }, [categorised, activeCategory, query]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    if (sort === 'name_asc') {
      items.sort((a, b) => a.result.university.localeCompare(b.result.university));
    } else if (sort === 'name_desc') {
      items.sort((a, b) => b.result.university.localeCompare(a.result.university));
    } else if (sort === 'score_desc' || sort === 'score_asc') {
      items.sort((a, b) => {
        const scoreA = scoreValue(a.result);
        const scoreB = scoreValue(b.result);
        if (scoreA === null && scoreB === null) return 0;
        if (scoreA === null) return 1;
        if (scoreB === null) return -1;
        return sort === 'score_desc' ? scoreB - scoreA : scoreA - scoreB;
      });
    } else {
      items.sort((a, b) => {
        const rankDiff = categoryRank(a.category) - categoryRank(b.category);
        if (rankDiff !== 0) return rankDiff;
        return a.result.university.localeCompare(b.result.university);
      });
    }
    return items.map(({ result }) => result);
  }, [filtered, sort]);

  const clearFilters = () => {
    setActiveCategory('all');
    setQuery('');
    setSort('best_match');
  };

  return (
    <section className="results-page">
      <ResultsHeader universityCount={results.length} shortlistCount={shortlist.length} />
      <ResultCategoryPills
        counts={counts}
        totalCount={results.length}
        active={activeCategory}
        onChange={setActiveCategory}
      />
      {limitMessage && (
        <p className="results-shortlist-limit-notice" role="status">
          {limitMessage}{' '}
          <button type="button" className="btn-link" onClick={clearLimitMessage}>
            Dismiss
          </button>
        </p>
      )}
      <ResultsToolbar
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        scoreSortAvailable={scoreSortAvailable}
      />
      <UniversityResultsGrid
        results={sorted}
        paginationResetKey={paginationResetKey}
        isShortlisted={isShortlisted}
        shortlistCount={shortlist.length}
        onToggleShortlist={toggleShortlist}
        onClearFilters={clearFilters}
      />
      <div className="results-actions">
        <button type="button" className="btn" onClick={onStartOver}>
          Start a new profile
        </button>
      </div>
    </section>
  );
}

// Re-exported so callers/tests can enumerate the category priority without
// importing lib/resultPresenter directly.
export { CATEGORY_PRIORITY };
