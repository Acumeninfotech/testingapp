import { useEffect } from 'react';
import type { University } from '../api/types';

interface UniversityDetailDrawerProps {
  university: University | null;
  onClose: () => void;
}

const ROUTE_TAG_LABELS: Record<string, string> = {
  contextual: 'Contextual support',
  graduate: 'Graduate route',
  gateway: 'Gateway route',
  international: 'International route',
};

function formatPlaces(university: University) {
  if (university.home_places == null && university.international_places == null) {
    return 'Published places not available';
  }
  const home = university.home_places == null ? 'Home not published' : `${university.places_approximate ? '~' : ''}${university.home_places} Home`;
  const international = university.international_places == null
    ? 'International not published'
    : `${university.places_approximate ? '~' : ''}${university.international_places} International`;
  return `${home} / ${international}`;
}

function sjtPolicyText(university: University) {
  const policy = university.sjt_policy;
  if (!policy) return 'SJT policy not published';
  return policy.summary;
}

function academicRequirement(university: University, key: keyof NonNullable<University['academic_requirements']>) {
  return university.academic_requirements?.[key] || 'Not published';
}

const CONTEXTUAL_REQUIREMENT_LABELS = {
  a_level: 'A-level',
  gcse: 'GCSE',
  scottish: 'Scottish',
  ib: 'IB',
} as const;

function contextualRequirements(university: University) {
  const support = university.contextual_support;
  if (!support) return [];

  return (Object.keys(CONTEXTUAL_REQUIREMENT_LABELS) as Array<keyof typeof CONTEXTUAL_REQUIREMENT_LABELS>)
    .flatMap((key) => {
      const value = support[key]?.trim();
      if (!value) return [];
      return [{
        key,
        label: CONTEXTUAL_REQUIREMENT_LABELS[key],
        value,
      }];
    });
}

function interviewFormatText(university: University) {
  const format = university.interview_format?.trim();
  if (!format || /^not published$/i.test(format) || /^not modelled$/i.test(format) || /^interview$/i.test(format)) {
    return 'Published interview format not specified.';
  }
  return format
    .replace(/\bMultiple Mini Interviews?\b/g, 'MMI (Multiple Mini Interviews)')
    .replace(/\bMMI\b(?!\s*\()/g, 'MMI (Multiple Mini Interviews)');
}

function applicantGroupText(university: University) {
  const labels = university.fee_status
    .map((status) => {
      if (status === 'home') return 'Home';
      if (status === 'international') return 'International';
      return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    })
    .filter(Boolean);

  if (labels.length === 0) return 'Applicant groups supported: Not specified.';
  if (labels.length === 1) return `Applicant groups supported: ${labels[0]} applicants.`;
  return `Applicant groups supported: ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]} applicants.`;
}

export function UniversityDetailDrawer({ university, onClose }: UniversityDetailDrawerProps) {
  useEffect(() => {
    if (!university) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [university, onClose]);

  if (!university) return null;

  const routeTags = university.supported_route_tags || [];
  const predictionText = university.interview_prediction_available
    ? 'ApplySmart can provide interview competitiveness guidance for supported applicant groups.'
    : 'ApplySmart checks eligibility for this course but does not provide interview competitiveness guidance.';
  const contextualSupport = university.contextual_support;
  const showContextualSupport = university.has_contextual_admissions || routeTags.includes('contextual') || contextualSupport;
  const publishedContextualRequirements = contextualRequirements(university);
  const hasPublishedContextualRequirements = publishedContextualRequirements.length > 0;

  return (
    <div className="university-detail-layer" role="presentation">
      <button
        type="button"
        className="university-detail-backdrop"
        aria-label="Close university details"
        onClick={onClose}
      />
      <aside
        className="university-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="university-detail-title"
      >
        <div className="university-detail-head">
          <div>
            <p className="university-detail-kicker">{university.course_code} Medicine</p>
            <h2 id="university-detail-title">{university.university_name}</h2>
          </div>
          <button type="button" className="university-detail-close" onClick={onClose} aria-label="Close university details">
            ×
          </button>
        </div>

        <div className="university-detail-section">
          <h3>Course Snapshot</h3>
          <dl className="university-detail-facts">
            <div>
              <dt>Course</dt>
              <dd>{university.course_name}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{university.location || university.country}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{university.duration_years ? `${university.duration_years} years` : 'Not published'}</dd>
            </div>
            <div>
              <dt>Places</dt>
              <dd>{formatPlaces(university)}</dd>
            </div>
          </dl>
        </div>

        <div className="university-detail-section">
          <h3>Selection Approach</h3>
          <p className="university-detail-lede">
            <strong>{university.selection_style?.label || 'Published selection process'}.</strong>{' '}
            {university.selection_style?.summary || 'ApplySmart uses the published admissions process and available verified evidence.'}
          </p>
          <p>{predictionText}</p>
        </div>

        <div className="university-detail-section">
          <h3>Academic Requirements</h3>
          <dl className="university-detail-facts">
            <div>
              <dt>GCSE</dt>
              <dd>{academicRequirement(university, 'gcse')}</dd>
            </div>
            <div>
              <dt>A-level</dt>
              <dd>{academicRequirement(university, 'a_level')}</dd>
            </div>
            <div>
              <dt>Scottish</dt>
              <dd>{academicRequirement(university, 'scottish')}</dd>
            </div>
            <div>
              <dt>IB</dt>
              <dd>{academicRequirement(university, 'ib')}</dd>
            </div>
          </dl>
        </div>

        {showContextualSupport && (
          <div className="university-detail-section">
            <h3>Contextual Support</h3>
            <p className="university-detail-lede">
              Contextual offers apply only if the applicant meets the university's published contextual eligibility criteria.
            </p>
            {hasPublishedContextualRequirements ? (
              <dl className="university-detail-facts">
                {publishedContextualRequirements.map((requirement) => (
                  <div key={requirement.key}>
                    <dt>{requirement.label}</dt>
                    <dd>{requirement.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>No published contextual grade reduction available.</p>
            )}
            {contextualSupport?.criteria_summary && (
              <p className="university-detail-context-note">{contextualSupport.criteria_summary}</p>
            )}
          </div>
        )}

        <div className="university-detail-section">
          <h3>Supported Routes</h3>
          {routeTags.length > 0 ? (
            <div className="university-detail-tags">
              {routeTags.map((tag) => (
                <span key={tag}>{ROUTE_TAG_LABELS[tag] || tag.replace(/_/g, ' ')}</span>
              ))}
            </div>
          ) : (
            <p>Standard applicant route only.</p>
          )}
        </div>

        <div className="university-detail-section">
          <h3>Assessment Summary</h3>
          <ul className="university-detail-notes">
            <li>{university.uses_ucat === false ? 'UCAT: Not required for this university.' : "UCAT: Included in ApplySmart's assessment for this university."}</li>
            <li>SJT: {sjtPolicyText(university)}</li>
            <li>Interview format: {interviewFormatText(university)}</li>
            <li>{applicantGroupText(university)}</li>
            {university.assessment_mode === 'eligibility_only' && (
              <li>ApplySmart provides an eligibility check for this university.</li>
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}
