import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { University } from '../api/types';
import { UNIVERSITY_CODES } from '../data/universityCodes';

interface UniversityCompareDrawerProps {
  universities: University[];
  open: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
}

type CompareSectionId = 'overview' | 'requirements' | 'admissions' | 'routes' | 'prediction' | 'notes';
type CompareValueKind = 'text' | 'badge' | 'status';
type CompareValueTone = 'default' | 'gold' | 'green' | 'muted';

interface CompareValue {
  text: string;
  kind?: CompareValueKind;
  tone?: CompareValueTone;
}

interface CompareRow {
  id: string;
  label: string;
  highlightDifferences?: boolean;
  value: (university: University) => CompareValue;
}

interface CompareSection {
  id: CompareSectionId;
  title: string;
  navLabel: string;
  rows: CompareRow[];
}

const ALL_SECTION_IDS: CompareSectionId[] = ['overview', 'requirements', 'admissions', 'routes', 'prediction', 'notes'];

function badgeCode(university: University) {
  if (UNIVERSITY_CODES[university.id]) return UNIVERSITY_CODES[university.id];
  return university.university_name
    .split(/\s+/)
    .filter((word) => !['of', 'the', 'and'].includes(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

function formatPlaces(university: University) {
  if (university.home_places == null && university.international_places == null) {
    return 'Published places not available';
  }

  const home = university.home_places == null
    ? 'Home not published'
    : `${university.places_approximate ? '~' : ''}${university.home_places} Home`;
  const international = university.international_places == null
    ? 'International not published'
    : `${university.places_approximate ? '~' : ''}${university.international_places} International`;

  return `${home} / ${international}`;
}

function cleanStudentFacingText(text: string) {
  let cleaned = text.replace(/\s+/g, ' ').trim();

  if (/subject wording conflicts between official/i.test(cleaned)) {
    cleaned = cleaned
      .replace(/A-level grades are official\.\s*/i, '')
      .replace(/Subject wording conflicts between official[^.]*\./gi, 'Requirements vary; review the official course page.')
      .replace(/AS exception is official\./gi, 'Check the university\'s official admissions guidance for AS-level exceptions.');
  }

  cleaned = cleaned
    .replace(/SL subject checks are retained as metadata\./gi, 'Check the university\'s official admissions guidance for Standard Level subject requirements.')
    .replace(/Official\/FOI-verified\s+[^.]*?\s+evidence confirms\s+/gi, '')
    .replace(/verified in the supplied evidence/gi, 'currently included in ApplySmart')
    .replace(/\bwhere verified\b/gi, 'where published')
    .replace(/\bverified percentage uplifts\b/gi, 'published percentage uplifts')
    .replace(/were not found in the checked official [^.]+ sources/gi, 'are not currently included in ApplySmart')
    .replace(/was not found in the checked official [^.]+ sources/gi, 'is not currently included in ApplySmart')
    .replace(/not found in checked official [^.]+ sources/gi, 'not currently included in ApplySmart')
    .replace(/retained as metadata/gi, 'check the university\'s official admissions guidance')
    .replace(/before interview guidance/gi, 'when selecting applicants for interview')
    .replace(/before interview selection/gi, 'when selecting applicants for interview');

  return cleaned;
}

function academicRequirement(university: University, key: keyof NonNullable<University['academic_requirements']>) {
  const requirement = university.academic_requirements?.[key];
  return requirement ? cleanStudentFacingText(requirement) : 'Not published';
}

function sjtPolicyText(university: University) {
  const policy = university.sjt_policy;
  if (!policy) return 'SJT policy not published';
  return policy.summary;
}

function interviewFormatText(university: University) {
  const format = university.interview_format?.trim();
  if (!format || /^not published$/i.test(format) || /^not modelled$/i.test(format) || /^interview$/i.test(format)) {
    return 'Interview format not confirmed';
  }

  const parts = format
    .replace(/\bMMI\s*\(\s*MMI\s*\(Multiple Mini Interviews\)\s*\)/gi, 'MMI')
    .replace(/\bMMI\s*\(Multiple Mini Interviews\)/gi, 'MMI')
    .split(';')
    .map((part) => cleanStudentFacingText(part).replace(/\.$/, '').trim())
    .filter(Boolean);
  const source = parts.join('; ');
  const firstPart = parts[0] || source;
  const isMmi = /\bmmi\b|multiple mini interviews?/i.test(source);
  const isVirtualMmi = /virtual\s+(mmi|multiple mini interviews?)/i.test(firstPart);
  const isPanel = /\bpanel\b/i.test(firstPart) && !isMmi;

  const primary = isVirtualMmi
    ? 'Virtual Multiple Mini Interviews (MMI)'
    : isMmi
      ? 'Multiple Mini Interviews (MMI)'
      : isPanel
        ? 'Panel interview'
        : firstPart;
  const details = parts.filter((part, index) => {
    if (index === 0) return false;
    return !/^(virtual\s+)?mmi$|^multiple mini interviews?$/i.test(part);
  });

  return details.length > 0 ? `${primary}. ${details.join('; ')}` : primary;
}

function applicantGroups(university: University) {
  const labels = university.fee_status
    .map((status) => {
      if (status === 'home') return 'Home';
      if (status === 'international') return 'International';
      return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    })
    .filter(Boolean);

  if (labels.length === 0) return 'Applicant groups not specified';
  if (labels.length === 1) return `${labels[0]} applicants`;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]} applicants`;
}

function routeAvailabilityValue(isListed: boolean): CompareValue {
  return {
    text: isListed ? 'Available' : 'Not listed',
    kind: 'status',
    tone: isListed ? 'green' : 'muted',
  };
}

function predictionValue(university: University): CompareValue {
  if (university.interview_prediction_available) {
    return { text: 'Available', kind: 'badge', tone: 'green' };
  }
  if (university.assessment_mode === 'eligibility_only') {
    return { text: 'Eligibility guidance only', kind: 'badge', tone: 'muted' };
  }
  return { text: 'Unavailable', kind: 'badge', tone: 'muted' };
}

function ucatRoleValue(university: University): CompareValue {
  if (university.uses_ucat === false) return { text: 'Not used', kind: 'status', tone: 'muted' };
  if (university.uses_ucat !== true) return { text: 'Role not confirmed', kind: 'status', tone: 'muted' };
  if (university.assessment_mode === 'eligibility_only') return { text: 'Eligibility check only', kind: 'status', tone: 'muted' };

  const selectionKey = university.selection_style?.key || '';
  if (['academic_ucat_score', 'gcse_ucat_sjt_score', 'ucat_contextual', 'ucat_ranking', 'ucat_threshold'].includes(selectionKey)) {
    return { text: 'Used in interview selection', kind: 'status', tone: 'green' };
  }

  return { text: 'Used in selection', kind: 'status', tone: 'green' };
}

function selectionSummaryText(university: University) {
  const summary = university.selection_style?.summary;
  if (!summary) return 'Uses the published admissions process when selecting applicants for interview.';
  return cleanStudentFacingText(summary)
    .replace(/Uses a scored selection model/gi, 'Uses a points-based scoring method')
    .replace(/Uses a points model/gi, 'Uses a points-based scoring method')
    .replace(/Ranks eligible applicants primarily by UCAT performance/gi, 'Ranks eligible applicants primarily by UCAT score')
    .replace(/for interview selection/gi, 'when selecting applicants for interview');
}

function normalizeValue(value: CompareValue) {
  return value.text
    .trim()
    .toLowerCase()
    .replace(/\bprediction available\b/g, 'available')
    .replace(/\bsupported\b/g, 'available')
    .replace(/\bapplicants?\b/g, 'applicant')
    .replace(/&/g, 'and')
    .replace(/[.,;:()[\]{}'"’]/g, ' ')
    .replace(/\s+/g, ' ');
}

function rowValues(row: CompareRow, universities: University[]) {
  return universities.map((university) => row.value(university));
}

function rowHasDifference(row: CompareRow, universities: University[]) {
  return new Set(rowValues(row, universities).map(normalizeValue)).size > 1;
}

function differentValueIndexes(row: CompareRow, values: CompareValue[]) {
  if (!row.highlightDifferences) return new Set<number>();

  const counts = values.reduce<Record<string, number>>((acc, value) => {
    const key = normalizeValue(value);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const entries = Object.entries(counts);
  if (entries.length <= 1) return new Set<number>();

  const majority = entries.reduce((current, next) => (next[1] > current[1] ? next : current));
  const hasMajority = majority[1] > 1;
  if (!hasMajority) return new Set<number>();
  return new Set(values.flatMap((value, index) => {
    return normalizeValue(value) !== majority[0] ? [index] : [];
  }));
}

function compareSections(): CompareSection[] {
  return [
    {
      id: 'overview',
      title: 'Course Overview',
      navLabel: 'Overview',
      rows: [
        { id: 'course', label: 'Course', value: (university) => ({ text: university.course_name }) },
        { id: 'location', label: 'Location', value: (university) => ({ text: university.location || university.country }) },
        {
          id: 'duration',
          label: 'Duration',
          highlightDifferences: true,
          value: (university) => ({ text: university.duration_years ? `${university.duration_years} years` : 'Not published' }),
        },
        { id: 'places', label: 'Places', value: (university) => ({ text: formatPlaces(university) }) },
      ],
    },
    {
      id: 'requirements',
      title: 'Entry Requirements',
      navLabel: 'Requirements',
      rows: [
        { id: 'gcse', label: 'GCSE', value: (university) => ({ text: academicRequirement(university, 'gcse') }) },
        { id: 'a-level', label: 'A-level', value: (university) => ({ text: academicRequirement(university, 'a_level') }) },
        { id: 'scottish', label: 'Scottish', value: (university) => ({ text: academicRequirement(university, 'scottish') }) },
        { id: 'ib', label: 'IB', value: (university) => ({ text: academicRequirement(university, 'ib') }) },
      ],
    },
    {
      id: 'admissions',
      title: 'Admissions Process',
      navLabel: 'Admissions',
      rows: [
        {
          id: 'selection-style',
          label: 'Selection approach',
          highlightDifferences: true,
          value: (university) => ({
            text: university.selection_style?.label || 'Published selection process',
            kind: 'badge',
            tone: 'gold',
          }),
        },
        {
          id: 'ucat',
          label: 'UCAT role',
          highlightDifferences: true,
          value: ucatRoleValue,
        },
        { id: 'interview-format', label: 'Interview format', highlightDifferences: true, value: (university) => ({ text: interviewFormatText(university) }) },
        { id: 'sjt', label: 'SJT role', value: (university) => ({ text: sjtPolicyText(university) }) },
      ],
    },
    {
      id: 'routes',
      title: 'Applicant Routes',
      navLabel: 'Routes',
      rows: [
        { id: 'home-route', label: 'Home', highlightDifferences: true, value: (university) => routeAvailabilityValue(university.fee_status.includes('home')) },
        {
          id: 'international-route',
          label: 'International',
          highlightDifferences: true,
          value: (university) => routeAvailabilityValue(university.fee_status.includes('international')),
        },
        {
          id: 'graduate-route',
          label: 'Graduate',
          highlightDifferences: true,
          value: (university) => routeAvailabilityValue(Boolean(university.has_graduate_entry || university.supported_route_tags?.includes('graduate'))),
        },
        {
          id: 'gateway-route',
          label: 'Gateway',
          highlightDifferences: true,
          value: (university) => routeAvailabilityValue(Boolean(university.has_gateway_course || university.supported_route_tags?.includes('gateway'))),
        },
        {
          id: 'contextual-route',
          label: 'Contextual',
          highlightDifferences: true,
          value: (university) => routeAvailabilityValue(Boolean(university.has_contextual_admissions || university.supported_route_tags?.includes('contextual'))),
        },
      ],
    },
    {
      id: 'prediction',
      title: 'Prediction Coverage',
      navLabel: 'Prediction',
      rows: [
        {
          id: 'interview-prediction',
          label: 'ApplySmart interview prediction',
          highlightDifferences: true,
          value: predictionValue,
        },
        { id: 'applicant-groups', label: 'Prediction available for', highlightDifferences: true, value: (university) => ({ text: applicantGroups(university) }) },
      ],
    },
    {
      id: 'notes',
      title: 'Additional Notes',
      navLabel: 'Notes',
      rows: [
        {
          id: 'selection-notes',
          label: 'How applicants are shortlisted',
          value: (university) => ({ text: selectionSummaryText(university) }),
        },
      ],
    },
  ];
}

function uniqueSelectionStyles(universities: University[]) {
  return new Set(universities.map((university) => university.selection_style?.key || university.selection_style?.label || 'Published selection process')).size;
}

function predictionSummary(universities: University[]) {
  const available = universities.filter((university) => university.interview_prediction_available).length;
  if (available === universities.length) return `Available for all ${universities.length}`;
  if (available === 0) return 'Eligibility guidance only';
  return `${available} of ${universities.length} available`;
}

function internationalRouteSummary(universities: University[]) {
  const listed = universities.filter((university) => university.fee_status.includes('international')).length;
  return `Listed for ${listed} of ${universities.length}`;
}

function CompareValueView({ value }: { value: CompareValue }) {
  if (value.kind === 'badge') {
    return <span className={`university-compare-value-badge university-compare-value-badge--${value.tone || 'default'}`}>{value.text}</span>;
  }

  if (value.kind === 'status') {
    return (
      <span className={`university-compare-status university-compare-status--${value.tone || 'default'}`}>
        <span aria-hidden="true" />
        {value.text}
      </span>
    );
  }

  return <span>{value.text}</span>;
}

export function UniversityCompareDrawer({
  universities,
  open,
  onClose,
  onRemove,
}: UniversityCompareDrawerProps) {
  const sections = useMemo(compareSections, []);
  const [activeSection, setActiveSection] = useState<CompareSectionId>('overview');
  const [openSections, setOpenSections] = useState<Set<CompareSectionId>>(() => new Set(ALL_SECTION_IDS));
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const scrollAreasRef = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollSyncingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const compareStyle = { '--compare-count': universities.length } as CSSProperties;
  const universityNoun = universities.length === 1 ? 'university' : 'universities';

  const handleNavClick = (sectionId: CompareSectionId) => {
    setActiveSection(sectionId);
    document.getElementById(`university-compare-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSectionToggle = (sectionId: CompareSectionId, isOpen: boolean) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (isOpen) {
        next.add(sectionId);
        setActiveSection(sectionId);
      } else {
        next.delete(sectionId);
      }
      return next;
    });
  };

  const registerScrollArea = (key: string) => (node: HTMLDivElement | null) => {
    scrollAreasRef.current[key] = node;
  };

  const handleHorizontalScroll = (sourceKey: string, scrollLeft: number) => {
    if (scrollSyncingRef.current) return;
    scrollSyncingRef.current = true;
    Object.entries(scrollAreasRef.current).forEach(([key, node]) => {
      if (key !== sourceKey && node) {
        node.scrollLeft = scrollLeft;
      }
    });

    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        scrollSyncingRef.current = false;
      });
    } else {
      scrollSyncingRef.current = false;
    }
  };

  return (
    <div className="university-compare-layer" role="presentation">
      <button
        type="button"
        className="university-compare-backdrop"
        aria-label="Close university comparison"
        onClick={onClose}
      />
      <aside
        className="university-compare-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="university-compare-title"
      >
        <div className="university-compare-head">
          <div>
            <p className="university-detail-kicker">Compare Universities</p>
            <h2 id="university-compare-title">Comparing {universities.length} {universityNoun}</h2>
          </div>
          <button type="button" className="university-detail-close" onClick={onClose} aria-label="Close university comparison">
            ×
          </button>
        </div>

        <div className="university-compare-workspace" style={compareStyle}>
          <div className="university-compare-summary-grid" aria-label="Comparison summary">
            <div>
              <span>{universities.length}</span>
              <p>{universities.length === 1 ? 'university selected' : 'universities selected'}</p>
            </div>
            <div>
              <span>{uniqueSelectionStyles(universities)}</span>
              <p>selection approaches</p>
            </div>
            <div>
              <span>{predictionSummary(universities)}</span>
              <p>ApplySmart interview prediction</p>
            </div>
            <div>
              <span>{internationalRouteSummary(universities)}</span>
              <p>International route</p>
            </div>
          </div>

          <div className="university-compare-controls">
            <nav className="university-compare-nav" aria-label="Comparison sections">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={activeSection === section.id ? 'university-compare-nav-button university-compare-nav-button--active' : 'university-compare-nav-button'}
                  onClick={() => handleNavClick(section.id)}
                >
                  {section.navLabel}
                </button>
              ))}
            </nav>

            <div className="university-compare-difference-control">
              <p id="university-compare-difference-help">Highlighted values differ between the selected universities.</p>
              <label className="university-compare-toggle">
                <input
                  type="checkbox"
                  checked={differencesOnly}
                  onChange={(event) => setDifferencesOnly(event.target.checked)}
                  aria-describedby="university-compare-difference-help"
                />
                <span>Differences only</span>
              </label>
            </div>
          </div>

          <div
            className="university-compare-header-cards"
            aria-label="Selected universities"
            ref={registerScrollArea('headers')}
            onScroll={(event) => handleHorizontalScroll('headers', event.currentTarget.scrollLeft)}
          >
            <div className="university-compare-feature-spacer" aria-hidden="true" />
            {universities.map((university) => (
              <article className="university-compare-university-card" key={university.id}>
                <span className="university-compare-university-code" aria-hidden="true">{badgeCode(university)}</span>
                <div>
                  <h3>{university.university_name}</h3>
                  <p>{university.course_name}</p>
                  <span className="university-compare-card-badge">{university.selection_style?.label || 'Published selection process'}</span>
                </div>
                <button type="button" onClick={() => onRemove(university.id)} aria-label={`Remove ${university.university_name} from comparison`}>
                  Remove
                </button>
              </article>
            ))}
          </div>

          <div className="university-compare-sections">
            {sections.map((section) => {
              const visibleRows = differencesOnly
                ? section.rows.filter((row) => rowHasDifference(row, universities))
                : section.rows;
              return (
                <details
                  key={section.id}
                  id={`university-compare-${section.id}`}
                  className="university-compare-section"
                  open={openSections.has(section.id)}
                  onToggle={(event) => handleSectionToggle(section.id, event.currentTarget.open)}
                >
                  <summary>
                    <span>
                      {section.title}
                      {section.id === 'routes' && (
                        <small>
                          "Not listed" means the route is not currently recorded for this course in the University Explorer.
                        </small>
                      )}
                    </span>
                    <em>{visibleRows.length} {visibleRows.length === 1 ? 'item' : 'items'}</em>
                  </summary>

                  {visibleRows.length > 0 ? (
                    <>
                      <div
                        className="university-compare-table-wrap"
                        ref={registerScrollArea(section.id)}
                        onScroll={(event) => handleHorizontalScroll(section.id, event.currentTarget.scrollLeft)}
                      >
                        <table className="university-compare-table">
                          <caption className="sr-only">{section.title} comparison</caption>
                          <thead>
                            <tr>
                              <th scope="col">Feature</th>
                              {universities.map((university) => (
                                <th key={university.id} scope="col">{university.university_name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRows.map((row) => {
                              const values = rowValues(row, universities);
                              const differenceIndexes = differentValueIndexes(row, values);
                              return (
                                <tr key={row.id} className={differenceIndexes.size > 0 ? 'university-compare-row--has-difference' : undefined}>
                                  <th scope="row">
                                    <span>{row.label}</span>
                                  </th>
                                  {values.map((value, index) => (
                                    <td
                                      key={universities[index].id}
                                      className={differenceIndexes.has(index) ? 'university-compare-cell--different' : undefined}
                                    >
                                      <CompareValueView value={value} />
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="university-compare-mobile-list" aria-label={`${section.title} mobile comparison`}>
                        {visibleRows.map((row) => {
                          const values = rowValues(row, universities);
                          const differenceIndexes = differentValueIndexes(row, values);
                          return (
                            <article className="university-compare-mobile-feature" key={row.id}>
                              <h4>{row.label}</h4>
                              <div>
                                {values.map((value, index) => (
                                  <section
                                    key={universities[index].id}
                                    className={differenceIndexes.has(index) ? 'university-compare-mobile-value university-compare-mobile-value--different' : 'university-compare-mobile-value'}
                                  >
                                    <strong>{universities[index].university_name}</strong>
                                    <CompareValueView value={value} />
                                  </section>
                                ))}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="university-compare-empty-section">No differences in this section for the selected universities.</p>
                  )}
                </details>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
