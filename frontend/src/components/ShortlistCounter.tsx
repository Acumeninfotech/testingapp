import { SHORTLIST_MAX } from '../results/useShortlist';

export function ShortlistCounter({ count }: { count: number }) {
  return (
    <span className="shortlist-counter" aria-live="polite">
      <span className="shortlist-counter-label">UCAS Shortlist</span>{' '}
      <span className="shortlist-counter-value">
        {count} / {SHORTLIST_MAX}
      </span>
    </span>
  );
}
