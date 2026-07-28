import type { University } from '../api/types';
import { UNIVERSITY_CODES } from '../data/universityCodes';

interface UniversityCardProps {
  university: University;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
  onOpenDetails?: (university: University) => void;
  compareSelected?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: (university: University) => void;
}

function initials(name: string) {
  const words = name.replace(/^The\s+/i, '').split(/\s+/).filter(Boolean);
  const letters = [words[0]?.[0], words[1]?.[0] ?? words[0]?.[1]].filter(Boolean);
  return letters.join('').toUpperCase().slice(0, 2);
}

function badgeCode(university: University) {
  return UNIVERSITY_CODES[university.id] ?? initials(university.university_name);
}

const ROUTE_TAG_LABELS: Record<string, string> = {
  contextual: 'Contextual support',
  graduate: 'Graduate route',
  gateway: 'Gateway route',
  international: 'International route',
};

export function UniversityCard({
  university,
  selectable,
  selected,
  onToggle,
  onOpenDetails,
  compareSelected,
  compareDisabled,
  onToggleCompare,
}: UniversityCardProps) {
  const selectionLabel = university.selection_style?.label;
  const selectionSummary = university.selection_style?.summary;
  const routeTags = university.supported_route_tags || [];

  const content = (
    <>
      {selectable && (
        <span className="university-card-check" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8.5L6.2 11.5L13 4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}

      <div className="university-card-top">
        <h3>{university.university_name}</h3>
        <div className="university-card-avatar" aria-hidden="true">
          {badgeCode(university)}
        </div>
      </div>

      <div className="university-card-meta">
        <p className="university-card-meta-row">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="3" y="4.5" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M3 8h14" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          {university.course_name} ({university.course_code})
        </p>
        {university.location && (
          <p className="university-card-meta-row">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M10 17.5s5.5-4.7 5.5-9.1A5.5 5.5 0 1 0 4.5 8.4c0 4.4 5.5 9.1 5.5 9.1z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <circle cx="10" cy="8.3" r="1.9" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            {university.location}
          </p>
        )}
        {university.duration_years != null && (
          <p className="university-card-meta-row">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10 6.5V10l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            {university.duration_years} {university.duration_years === 1 ? 'Year' : 'Years'}
          </p>
        )}
        {(university.home_places != null || university.international_places != null) && (
          <p className="university-card-meta-row">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M2.5 17c0-3 2-5 4.5-5s4.5 2 4.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="14.5" cy="7.5" r="2.1" stroke="currentColor" strokeWidth="1.4" />
              <path d="M12.5 12.3c2-0.3 3.7 1.4 4 4.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span>
              {university.home_places != null ? (
                <>{university.places_approximate && '~'}{university.home_places} Home</>
              ) : (
                <span className="university-card-meta-unpublished">Home: not published</span>
              )}
            </span>
            <span aria-hidden="true"> &middot; </span>
            <span>
              {university.international_places != null ? (
                <>{university.places_approximate && '~'}{university.international_places} International</>
              ) : (
                <span className="university-card-meta-unpublished">International: not published</span>
              )}
            </span>
            {university.places_approximate && (
              <span className="university-card-meta-approx" title="Published place figures vary by source and cycle; treat as approximate.">
                approx.
              </span>
            )}
          </p>
        )}
      </div>

      <div className="university-card-badges">
        {selectionLabel && <span className="badge badge-selection">{selectionLabel}</span>}
        {university.interview_prediction_available === true && (
          <span className="badge badge-ready">Interview prediction ready</span>
        )}
        {university.fee_status.map((status) => (
          <span
            key={status}
            className={`badge badge-${status === 'home' ? 'home' : 'international'}`}
          >
            {status.replace(/_/g, ' ')}
          </span>
        ))}
        {university.intake_month && <span className="badge">{university.intake_month} intake</span>}
        {university.uses_ucat === false && <span className="badge">No UCAT</span>}
        {university.assessment_mode === 'eligibility_only' && (
          <span className="badge">Eligibility only</span>
        )}
        {university.institution_funding_type === 'independent_private' && (
          <span className="badge">Independent/private medical school</span>
        )}
      </div>

      {selectionSummary && (
        <p className="university-card-selection-summary">{selectionSummary}</p>
      )}

      {routeTags.length > 0 && (
        <div className="university-card-route-tags" aria-label="Supported routes and considerations">
          {routeTags.map((tag) => (
            <span key={tag}>{ROUTE_TAG_LABELS[tag] || tag.replace(/_/g, ' ')}</span>
          ))}
        </div>
      )}

      {(onOpenDetails || onToggleCompare) && !selectable && (
        <div className="university-card-actions">
          {onOpenDetails && (
            <button
              type="button"
              className="university-card-details-btn"
              onClick={() => onOpenDetails(university)}
            >
              View details
            </button>
          )}
          {onToggleCompare && (
            <button
              type="button"
              className={`university-card-compare-btn${compareSelected ? ' university-card-compare-btn--active' : ''}`}
              disabled={compareDisabled && !compareSelected}
              aria-pressed={Boolean(compareSelected)}
              onClick={() => onToggleCompare(university)}
            >
              {compareSelected ? 'Selected' : 'Compare'}
            </button>
          )}
        </div>
      )}
    </>
  );

  if (!selectable) {
    return <article className="university-card">{content}</article>;
  }

  return (
    <article className={`university-card university-card-selectable${selected ? ' selected' : ''}`}>
      <label>
        <input
          type="checkbox"
          className="sr-only-checkbox"
          checked={Boolean(selected)}
          onChange={() => onToggle?.(university.id)}
          aria-label={`Select ${university.university_name}`}
        />
        {content}
      </label>
    </article>
  );
}
