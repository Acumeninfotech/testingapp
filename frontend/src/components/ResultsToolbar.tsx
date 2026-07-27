export type SortOption = 'best_match' | 'name_asc' | 'name_desc' | 'score_desc' | 'score_asc';

export interface ResultsToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  scoreSortAvailable: boolean;
}

export function ResultsToolbar({ query, onQueryChange, sort, onSortChange, scoreSortAvailable }: ResultsToolbarProps) {
  return (
    <div className="results-toolbar">
      <div className="results-search">
        <label htmlFor="results-search-input" className="sr-only">
          Search universities
        </label>
        <input
          id="results-search-input"
          type="search"
          placeholder="Search universities"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {query && (
          <button
            type="button"
            className="results-search-clear"
            aria-label="Clear search"
            onClick={() => onQueryChange('')}
          >
            &times;
          </button>
        )}
      </div>
      <div className="results-sort">
        <label htmlFor="results-sort-select">Sort by</label>
        <select
          id="results-sort-select"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as SortOption)}
        >
          <option value="best_match">Best match</option>
          <option value="name_asc">University name A&ndash;Z</option>
          <option value="name_desc">University name Z&ndash;A</option>
          {scoreSortAvailable && <option value="score_desc">Highest selection score</option>}
          {scoreSortAvailable && <option value="score_asc">Lowest selection score</option>}
        </select>
      </div>
    </div>
  );
}
