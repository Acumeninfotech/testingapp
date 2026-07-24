import { useEffect, useMemo, useState } from 'react';
import { fetchUniversities } from '../../api/client';
import type { University } from '../../api/types';
import { UniversityCard } from '../../components/UniversityCard';
import type { StepProps } from './StepProps';

type LoadState = 'loading' | 'success' | 'error';

export function UniversitySelectionStep({ profile, updateProfile, errors }: StepProps) {
  const [universities, setUniversities] = useState<University[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('all');

  useEffect(() => {
    let cancelled = false;
    fetchUniversities()
      .then((data) => {
        if (cancelled) return;
        setUniversities(data.universities);
        setState('success');
      })
      .catch(() => {
        if (cancelled) return;
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id: string) => {
    updateProfile((prev) => {
      const selected = prev.university_ids.includes(id)
        ? prev.university_ids.filter((existing) => existing !== id)
        : [...prev.university_ids, id];
      return { ...prev, university_ids: selected };
    });
  };

  const toggleSelectAll = (ids: string[], allSelected: boolean) => {
    updateProfile((prev) => {
      const university_ids = allSelected
        ? prev.university_ids.filter((existing) => !ids.includes(existing))
        : Array.from(new Set([...prev.university_ids, ...ids]));
      return { ...prev, university_ids };
    });
  };

  const countries = useMemo(
    () => Array.from(new Set(universities.map((u) => u.country))).sort(),
    [universities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return universities.filter((u) => {
      if (q && !u.university_name.toLowerCase().includes(q)) return false;
      if (country !== 'all' && u.country !== country) return false;
      return true;
    });
  }, [universities, query, country]);

  const selectedUniversities = useMemo(
    () => universities.filter((u) => profile.university_ids.includes(u.id)),
    [universities, profile.university_ids],
  );

  const hasActiveFilters = query.trim() !== '' || country !== 'all';

  const filteredIds = useMemo(() => filtered.map((u) => u.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => profile.university_ids.includes(id));

  const clearFilters = () => {
    setQuery('');
    setCountry('all');
  };

  return (
    <div className="step-grid">
      <p>Select the universities you&rsquo;d like a prediction for.</p>
      {errors.university_ids && (
        <p className="form-field-error" role="alert">
          {errors.university_ids}
        </p>
      )}

      {state === 'loading' && <p>Loading universities&hellip;</p>}
      {state === 'error' && <p role="alert">Could not load universities. Is the API running?</p>}

      {state === 'success' && universities.length === 0 && (
        <p>No production-ready universities are available yet.</p>
      )}

      {state === 'success' && universities.length > 0 && (
        <>
          {selectedUniversities.length > 0 && (
            <div className="uni-selected-bar" data-testid="selected-summary">
              <span className="uni-selected-count">
                {selectedUniversities.length} selected
              </span>
              <div className="uni-selected-chips">
                {selectedUniversities.map((u) => (
                  <span className="uni-selected-chip" key={u.id}>
                    {u.university_name}
                    <button
                      type="button"
                      aria-label={`Remove ${u.university_name}`}
                      onClick={() => toggle(u.id)}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="uni-filter-bar">
            <div className="uni-search">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M17 17L13.5 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                placeholder="Search universities…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search universities"
              />
            </div>

            <div className="uni-chip-row" role="group" aria-label="Filter by country">
              <button
                type="button"
                className={`uni-chip${country === 'all' ? ' uni-chip--active' : ''}`}
                onClick={() => setCountry('all')}
              >
                All
              </button>
              {countries.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`uni-chip${country === c ? ' uni-chip--active' : ''}`}
                  onClick={() => setCountry(c)}
                >
                  {c}
                </button>
              ))}
              {hasActiveFilters && (
                <button type="button" className="uni-chip uni-chip--clear" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="uni-result-row">
            <p className="uni-result-count">
              {filtered.length} {filtered.length === 1 ? 'university' : 'universities'}
              {hasActiveFilters ? ' match your filters' : ''}
            </p>
            {filtered.length > 0 && (
              <label className="uni-select-all">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={() => toggleSelectAll(filteredIds, allFilteredSelected)}
                />
                Select all{hasActiveFilters ? ' shown' : ''}
              </label>
            )}
          </div>

          {filtered.length === 0 && (
            <p className="uni-empty-state">
              No universities match your search. Try clearing a filter.
            </p>
          )}

          {filtered.length > 0 && (
            <div className="university-grid" data-testid="university-grid">
              {filtered.map((university) => (
                <UniversityCard
                  key={university.id}
                  university={university}
                  selectable
                  selected={profile.university_ids.includes(university.id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
