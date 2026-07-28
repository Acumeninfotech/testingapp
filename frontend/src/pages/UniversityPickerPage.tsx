import { useEffect, useMemo, useState } from 'react';
import { fetchUniversities } from '../api/client';
import type { University } from '../api/types';
import { UniversityCard } from '../components/UniversityCard';
import { UniversityCompareDrawer } from '../components/UniversityCompareDrawer';
import { UniversityCompareTray } from '../components/UniversityCompareTray';
import { UniversityDetailDrawer } from '../components/UniversityDetailDrawer';

type LoadState = 'loading' | 'success' | 'error';
type PredictionFilter = 'all' | 'prediction_ready' | 'eligibility_only';
type SortKey = 'name' | 'country' | 'prediction_ready' | 'places';
const COMPARE_LIMIT = 4;
const PAGE_SIZE = 8;

const ROUTE_FILTERS = [
  { value: 'all', label: 'All routes' },
  { value: 'home', label: 'Home route' },
  { value: 'contextual', label: 'Contextual support' },
  { value: 'international', label: 'International route' },
  { value: 'graduate', label: 'Graduate route' },
  { value: 'gateway', label: 'Gateway route' },
] as const;

const PREDICTION_FILTERS = [
  { value: 'all', label: 'All coverage' },
  { value: 'prediction_ready', label: 'Interview prediction ready' },
  { value: 'eligibility_only', label: 'Eligibility only' },
] as const;

const SORT_OPTIONS = [
  { value: 'name', label: 'A-Z' },
  { value: 'country', label: 'Country' },
  { value: 'prediction_ready', label: 'Prediction ready first' },
  { value: 'places', label: 'Most places first' },
] as const;

type QuickFilter =
  | { id: string; label: string; kind: 'route'; value: string }
  | { id: string; label: string; kind: 'prediction'; value: PredictionFilter }
  | { id: string; label: string; kind: 'selection'; value: string };

const QUICK_FILTERS: QuickFilter[] = [
  { id: 'home', label: 'Home', kind: 'route', value: 'home' },
  { id: 'international', label: 'International', kind: 'route', value: 'international' },
  { id: 'graduate', label: 'Graduate', kind: 'route', value: 'graduate' },
  { id: 'gateway', label: 'Gateway', kind: 'route', value: 'gateway' },
  { id: 'contextual', label: 'Contextual', kind: 'route', value: 'contextual' },
  { id: 'interview-prediction', label: 'Interview Prediction', kind: 'prediction', value: 'prediction_ready' },
  { id: 'ucat-ranking', label: 'UCAT Ranking', kind: 'selection', value: 'ucat_ranking' },
  { id: 'academic-ucat-score', label: 'Academic + UCAT', kind: 'selection', value: 'academic_ucat_score' },
  { id: 'points-based', label: 'Points-Based', kind: 'selection', value: 'points_system' },
  { id: 'holistic-review', label: 'Holistic Review', kind: 'selection', value: 'holistic_review' },
];

function placeTotal(university: University) {
  return (university.home_places ?? 0) + (university.international_places ?? 0);
}

function hasFeeStatus(university: University, status: string) {
  return (university.fee_status || []).some((value) => value.toLowerCase() === status);
}

function matchesRouteFilter(university: University, value: string) {
  if (value === 'home') return hasFeeStatus(university, 'home');
  return (university.supported_route_tags || []).includes(value);
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}

export function UniversityPickerPage() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('all');
  const [route, setRoute] = useState('all');
  const [selectionStyle, setSelectionStyle] = useState('all');
  const [predictionFilter, setPredictionFilter] = useState<PredictionFilter>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareAnnouncement, setCompareAnnouncement] = useState('');
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  const countries = useMemo(
    () => [...new Set(universities.map((university) => university.country).filter(Boolean))].sort(),
    [universities],
  );
  const selectionStyles = useMemo(
    () => [...new Map(
      universities
        .map((university) => university.selection_style)
        .filter(Boolean)
        .map((style) => [style!.key, style!.label]),
    )].sort((a, b) => a[1].localeCompare(b[1])),
    [universities],
  );
  const availableQuickFilters = useMemo(() => {
    const selectionStyleKeys = new Set(selectionStyles.map(([value]) => value));
    return QUICK_FILTERS.filter((chip) => {
      if (chip.kind === 'route') {
        return universities.some((university) => matchesRouteFilter(university, chip.value));
      }
      if (chip.kind === 'prediction') {
        return universities.some((university) => university.interview_prediction_available === true);
      }
      return selectionStyleKeys.has(chip.value);
    });
  }, [selectionStyles, universities]);

  const filteredUniversities = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = universities.filter((university) => {
      const searchable = [
        university.university_name,
        university.course_name,
        university.course_code,
        university.country,
        university.location,
        university.selection_style?.label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (
        (!q || searchable.includes(q)) &&
        (country === 'all' || university.country === country) &&
        (route === 'all' || matchesRouteFilter(university, route)) &&
        (selectionStyle === 'all' || university.selection_style?.key === selectionStyle) &&
        (
          predictionFilter === 'all' ||
          (predictionFilter === 'prediction_ready' && university.interview_prediction_available === true) ||
          (predictionFilter === 'eligibility_only' && university.assessment_mode === 'eligibility_only')
        )
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'country') {
        const countryCompare = a.country.localeCompare(b.country);
        if (countryCompare !== 0) return countryCompare;
      }
      if (sort === 'prediction_ready') {
        const predictionCompare = Number(b.interview_prediction_available === true) - Number(a.interview_prediction_available === true);
        if (predictionCompare !== 0) return predictionCompare;
      }
      if (sort === 'places') {
        const placesCompare = placeTotal(b) - placeTotal(a);
        if (placesCompare !== 0) return placesCompare;
      }
      return a.university_name.localeCompare(b.university_name);
    });
  }, [universities, query, country, route, selectionStyle, predictionFilter, sort]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, country, route, selectionStyle, predictionFilter, sort]);

  const clearFilters = () => {
    setQuery('');
    setCountry('all');
    setRoute('all');
    setSelectionStyle('all');
    setPredictionFilter('all');
    setSort('name');
  };
  const comparedUniversities = useMemo(
    () => compareIds
      .map((id) => universities.find((university) => university.id === id))
      .filter((university): university is University => Boolean(university)),
    [compareIds, universities],
  );
  const toggleCompare = (university: University) => {
    setCompareIds((current) => {
      if (current.includes(university.id)) {
        setCompareAnnouncement(`${university.university_name} removed from comparison.`);
        return current.filter((id) => id !== university.id);
      }
      if (current.length >= COMPARE_LIMIT) {
        setCompareAnnouncement(`You can compare up to ${COMPARE_LIMIT} universities.`);
        return current;
      }
      setCompareAnnouncement(`${university.university_name} added to comparison.`);
      return [...current, university.id];
    });
  };
  const removeCompare = (id: string) => {
    const university = universities.find((item) => item.id === id);
    if (university) {
      setCompareAnnouncement(`${university.university_name} removed from comparison.`);
    }
    setCompareIds((current) => current.filter((currentId) => currentId !== id));
  };
  const clearCompare = () => {
    setCompareAnnouncement('Comparison selection cleared.');
    setCompareIds([]);
  };
  const toggleQuickFilter = (chip: QuickFilter) => {
    if (chip.kind === 'route') {
      setRoute((current) => (current === chip.value ? 'all' : chip.value));
    } else if (chip.kind === 'prediction') {
      setPredictionFilter((current) => (current === chip.value ? 'all' : chip.value));
    } else {
      setSelectionStyle((current) => (current === chip.value ? 'all' : chip.value));
    }
  };
  const isQuickFilterActive = (chip: QuickFilter) => (
    (chip.kind === 'route' && route === chip.value) ||
    (chip.kind === 'prediction' && predictionFilter === chip.value) ||
    (chip.kind === 'selection' && selectionStyle === chip.value)
  );
  const routeLabel = ROUTE_FILTERS.find((option) => option.value === route)?.label;
  const predictionLabel = PREDICTION_FILTERS.find((option) => option.value === predictionFilter)?.label;
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label;
  const selectionStyleLabel = selectionStyles.find(([value]) => value === selectionStyle)?.[1];
  const activeFilters = [
    query.trim() ? `Search: "${query.trim()}"` : null,
    country !== 'all' ? country : null,
    route !== 'all' ? routeLabel : null,
    selectionStyle !== 'all' ? selectionStyleLabel : null,
    predictionFilter !== 'all' ? predictionLabel : null,
    sort !== 'name' ? `Sort: ${sortLabel}` : null,
  ].filter((label): label is string => Boolean(label));
  const hasAdvancedFilters = country !== 'all' || route !== 'all' || selectionStyle !== 'all' || predictionFilter !== 'all' || sort !== 'name';
  const advancedActiveCount = [
    country !== 'all',
    route !== 'all',
    selectionStyle !== 'all',
    predictionFilter !== 'all',
    sort !== 'name',
  ].filter(Boolean).length;
  const visibleUniversities = filteredUniversities.slice(0, visibleCount);
  const hasMoreUniversities = visibleCount < filteredUniversities.length;
  const nextLoadCount = Math.min(PAGE_SIZE, filteredUniversities.length - visibleUniversities.length);

  return (
    <section className="university-explorer">
      {state === 'loading' && <p>Loading universities&hellip;</p>}
      {state === 'error' && <p role="alert">Could not load universities. Is the API running?</p>}
      {state === 'success' && universities.length === 0 && (
        <p>No production-ready universities are available yet.</p>
      )}
      {state === 'success' && universities.length > 0 && (
        <>
          <div className="university-explorer-panel">
            <div className="page-header university-explorer-header">
              <p className="university-explorer-kicker">University Explorer</p>
              <h1>Find the right medical school for your profile</h1>
              <p>
                Explore supported UK medical schools by entry requirements, admissions style,
                applicant route and ApplySmart interview-prediction coverage.
              </p>
            </div>

            <div className="university-explorer-stats" aria-label="University Explorer summary">
              <div>
                <strong>{universities.length}</strong>
                <span>Medical Schools</span>
              </div>
              <div>
                <strong>Multiple</strong>
                <span>Applicant Routes</span>
              </div>
              <div>
                <strong>ApplySmart</strong>
                <span>Interview Prediction Coverage</span>
              </div>
              <div>
                <strong>Compare</strong>
                <span>Up to {COMPARE_LIMIT}</span>
              </div>
            </div>

            <div className="university-explorer-controls" aria-label="University explorer filters">
              <label className="university-explorer-search">
                <span>Search medical schools</span>
                <span className="university-explorer-search-field">
                  <SearchIcon />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by university, course or location"
                  />
                </span>
              </label>

              <div className="university-quick-filters" aria-label="Quick filters">
                {availableQuickFilters.map((chip) => {
                  const active = isQuickFilterActive(chip);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      className={`university-quick-chip${active ? ' university-quick-chip--active' : ''}`}
                      aria-pressed={active}
                      aria-label={`${active ? 'Remove' : 'Apply'} ${chip.label} filter`}
                      onClick={() => toggleQuickFilter(chip)}
                    >
                      <span>{chip.label}</span>
                      {active && <span className="university-quick-chip-state">Selected</span>}
                    </button>
                  );
                })}
              </div>

              <div className={`university-advanced${hasAdvancedFilters ? ' university-advanced--active' : ''}`}>
                <button
                  type="button"
                  className="university-advanced-toggle"
                  aria-expanded={advancedExpanded}
                  aria-controls="university-advanced-filters"
                  onClick={() => setAdvancedExpanded((expanded) => !expanded)}
                >
                  <span>Advanced filters</span>
                  {advancedActiveCount > 0 && (
                    <span className="university-advanced-count">{advancedActiveCount} active</span>
                  )}
                </button>
                {advancedExpanded && (
                  <div id="university-advanced-filters" className="university-advanced-grid">
                    <label>
                      <span>Country</span>
                      <select value={country} onChange={(event) => setCountry(event.target.value)}>
                        <option value="all">All countries</option>
                        {countries.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Route</span>
                      <select value={route} onChange={(event) => setRoute(event.target.value)}>
                        {ROUTE_FILTERS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Selection style</span>
                      <select value={selectionStyle} onChange={(event) => setSelectionStyle(event.target.value)}>
                        <option value="all">All styles</option>
                        {selectionStyles.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Prediction coverage</span>
                      <select value={predictionFilter} onChange={(event) => setPredictionFilter(event.target.value as PredictionFilter)}>
                        {PREDICTION_FILTERS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Sort</span>
                      <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                        {SORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>

              {activeFilters.length > 0 && (
                <div className="university-explorer-summary">
                  <span>
                    {filteredUniversities.length} {filteredUniversities.length === 1 ? 'medical school' : 'medical schools'}
                  </span>
                  <span className="university-active-filter-list">
                    {activeFilters.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </span>
                  <button type="button" className="btn-link" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            <p className="university-explorer-note">
              Admissions information and prediction coverage are based on ApplySmart-supported data and
              applicant groups. Always check the university&rsquo;s official admissions guidance before applying.
            </p>
          </div>

          {filteredUniversities.length === 0 ? (
            <div className="university-explorer-empty" role="status">
              <h2>No universities match these filters</h2>
              <p>Try broadening the route, country or selection-style filters.</p>
              <button type="button" className="btn-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="university-grid" data-testid="university-grid">
                {visibleUniversities.map((university) => (
                  <UniversityCard
                    key={university.id}
                    university={university}
                    onOpenDetails={setSelectedUniversity}
                    compareSelected={compareIds.includes(university.id)}
                    compareDisabled={compareIds.length >= COMPARE_LIMIT}
                    onToggleCompare={toggleCompare}
                  />
                ))}
              </div>
              <div className="university-load-more" aria-live="polite">
                <p>
                  Showing {visibleUniversities.length} of {filteredUniversities.length} medical schools
                </p>
                {hasMoreUniversities && (
                  <button
                    type="button"
                    className="btn btn-secondary university-load-more-button"
                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  >
                    Load {nextLoadCount} more
                  </button>
                )}
              </div>
            </>
          )}
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {compareAnnouncement}
          </p>
          <UniversityCompareTray
            universities={comparedUniversities}
            limit={COMPARE_LIMIT}
            onCompare={() => setCompareOpen(true)}
            onRemove={removeCompare}
            onClear={clearCompare}
          />
          <UniversityDetailDrawer
            university={selectedUniversity}
            onClose={() => setSelectedUniversity(null)}
          />
          <UniversityCompareDrawer
            universities={comparedUniversities}
            open={compareOpen}
            onClose={() => setCompareOpen(false)}
            onRemove={removeCompare}
          />
        </>
      )}
    </section>
  );
}
