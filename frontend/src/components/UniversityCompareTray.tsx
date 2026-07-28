import { useMemo } from 'react';
import type { University } from '../api/types';
import { UNIVERSITY_CODES } from '../data/universityCodes';

interface UniversityCompareTrayProps {
  universities: University[];
  limit: number;
  onCompare: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function fallbackInitials(name: string) {
  const words = name.replace(/^The\s+/i, '').split(/\s+/).filter(Boolean);
  const letters = [words[0]?.[0], words[1]?.[0] ?? words[0]?.[1]].filter(Boolean);
  return letters.join('').toUpperCase().slice(0, 2);
}

function universityCode(university: University) {
  return UNIVERSITY_CODES[university.id] ?? fallbackInitials(university.university_name);
}

function compactName(university: University) {
  return university.university_name
    .replace(/^University of\s+/i, '')
    .replace(/\s+University$/i, '')
    .replace(/\s+Medical School$/i, '')
    .replace(/\s+College London$/i, '')
    .trim();
}

function selectionSummary(count: number, limit: number) {
  if (count === limit) return `Maximum of ${limit} universities selected`;
  return `${count} ${count === 1 ? 'university' : 'universities'} selected`;
}

export function UniversityCompareTray({
  universities,
  limit,
  onCompare,
  onRemove,
  onClear,
}: UniversityCompareTrayProps) {
  const selectedCount = universities.length;
  const compareDisabled = selectedCount < 2;
  const dots = useMemo(
    () => Array.from({ length: limit }, (_, index) => index < selectedCount),
    [limit, selectedCount],
  );

  if (selectedCount === 0) return null;

  return (
    <aside
      className="university-compare-tray"
      aria-label="University comparison shortlist"
    >
      <div className="university-compare-tray-head">
        <div className="university-compare-tray-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M5 19V9" />
            <path d="M12 19V5" />
            <path d="M19 19v-7" />
          </svg>
        </div>
        <div>
          <p>Compare Universities</p>
          <strong>{selectionSummary(selectedCount, limit)}</strong>
        </div>
      </div>

      <div className="university-compare-tray-progress" aria-label={`${selectedCount} of ${limit} selected`}>
        <span>{selectedCount} of {limit} selected</span>
        <span className="university-compare-tray-dots" aria-hidden="true">
          {dots.map((filled, index) => (
            <span
              key={index}
              className={filled ? 'university-compare-tray-dot university-compare-tray-dot--filled' : 'university-compare-tray-dot'}
            />
          ))}
        </span>
      </div>

      <div className="university-compare-tray-chips" aria-label="Selected universities">
        {universities.map((university) => (
          <span className="university-compare-chip" key={university.id}>
            <span className="university-compare-chip-code" aria-hidden="true">
              {universityCode(university)}
            </span>
            <span className="university-compare-chip-name">{compactName(university)}</span>
            <button
              type="button"
              aria-label={`Remove ${university.university_name} from comparison`}
              onClick={() => onRemove(university.id)}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {selectedCount === limit && (
        <p className="university-compare-tray-limit">You can compare up to {limit} universities.</p>
      )}

      <div className="university-compare-tray-actions">
        <button
          type="button"
          className="university-compare-primary"
          disabled={compareDisabled}
          aria-disabled={compareDisabled}
          onClick={onCompare}
        >
          {compareDisabled ? 'Select at least two universities' : 'Compare'}
        </button>
        <button type="button" className="university-compare-clear" onClick={onClear}>
          Clear all
        </button>
      </div>
    </aside>
  );
}
