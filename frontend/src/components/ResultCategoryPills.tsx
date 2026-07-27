import { CATEGORY_LABELS, CATEGORY_PRIORITY, type ResultCategory } from '../lib/resultPresenter';

export type PillKey = ResultCategory | 'all' | 'shortlist';

export interface ResultCategoryPillsProps {
  counts: Record<ResultCategory, number>;
  totalCount: number;
  shortlistCount: number;
  active: PillKey;
  onChange: (key: PillKey) => void;
}

export function ResultCategoryPills({ counts, totalCount, shortlistCount, active, onChange }: ResultCategoryPillsProps) {
  return (
    <div className="result-category-pills" role="tablist" aria-label="Filter results by category">
      {CATEGORY_PRIORITY.map((category) => {
        const count = counts[category] || 0;
        if (count === 0) return null;
        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={active === category}
            className={`result-category-pill${active === category ? ' result-category-pill--active' : ''}`}
            onClick={() => onChange(category)}
          >
            {CATEGORY_LABELS[category]} ({count})
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
      {shortlistCount > 0 && (
        <button
          type="button"
          role="tab"
          aria-selected={active === 'shortlist'}
          className={`result-category-pill result-category-pill--shortlist${active === 'shortlist' ? ' result-category-pill--active' : ''}`}
          onClick={() => onChange('shortlist')}
        >
          My Shortlist ({shortlistCount})
        </button>
      )}
    </div>
  );
}
