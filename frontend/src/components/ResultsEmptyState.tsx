export interface ResultsEmptyStateProps {
  onClearFilters: () => void;
}

export function ResultsEmptyState({ onClearFilters }: ResultsEmptyStateProps) {
  return (
    <div className="results-empty-state">
      <p>No universities match your current filters.</p>
      <p>Try another category or clear your search.</p>
      <button type="button" className="btn btn-secondary results-empty-state-action" onClick={onClearFilters}>
        Clear filters
      </button>
    </div>
  );
}
