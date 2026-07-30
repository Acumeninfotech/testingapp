import {
  FILTER_GROUP_LABELS,
  FILTER_GROUP_PRIORITY,
  type ResultFilterGroup,
  type ResultFilterKey,
} from '../lib/resultPresenter';

export type PillKey = ResultFilterKey;

export interface ResultCategoryPillsProps {
  counts: Record<ResultFilterGroup, number>;
  totalCount: number;
  active: PillKey;
  onChange: (key: PillKey) => void;
}

export function ResultCategoryPills({ counts, totalCount, active, onChange }: ResultCategoryPillsProps) {
  return (
    <div className="result-category-pills" role="tablist" aria-label="Filter results by category">
      {FILTER_GROUP_PRIORITY.map((group) => {
        const count = counts[group] || 0;
        return (
          <button
            key={group}
            type="button"
            role="tab"
            aria-selected={active === group}
            className={`result-category-pill${active === group ? ' result-category-pill--active' : ''}`}
            onClick={() => onChange(group)}
          >
            {FILTER_GROUP_LABELS[group]} ({count})
          </button>
        );
      })}
      <button
        type="button"
        role="tab"
        aria-selected={active === 'all'}
        className={`result-category-pill${active === 'all' ? ' result-category-pill--active' : ''}`}
        onClick={() => onChange('all')}
      >
        All Results ({totalCount})
      </button>
    </div>
  );
}
