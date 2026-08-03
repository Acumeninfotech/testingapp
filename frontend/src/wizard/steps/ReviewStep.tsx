import type { ReactNode } from 'react';
import { requiresEnglishLanguageEvidence } from '../validation';
import { normaliseEpqQualification, type EpqQualification } from '../profileTypes';
import type { StepProps } from './StepProps';

const FRIENDLY_LABELS: Record<string, string> = {
  school_leaver: 'Standard entry',
  mature_standard: 'Standard entry',
  mature_graduate: 'Graduate entry',
  graduate: 'Graduate entry',
  home: 'Home student',
  rest_of_uk: 'Rest of UK student',
  international: 'International student',
  england: 'England',
  scotland: 'Scotland',
  wales: 'Wales',
  northern_ireland: 'Northern Ireland',
  other: 'Other',
  a_level: 'A levels',
  scottish: 'Scottish qualifications',
  international_baccalaureate: 'International Baccalaureate',
  btec: 'BTEC',
  access_to_he: 'Access to HE',
  international_qualification: 'International qualification',
  medicine: 'Medicine',
  standard_medicine_a100: 'Standard medicine A100',
  first: 'First class',
  upper_second: 'Upper second class',
  lower_second: 'Lower second class',
  third: 'Third class',
  completed: 'Completed',
  predicted: 'Predicted',
  achieved: 'Achieved',
  verified: 'Verified',
  pending: 'Pending',
  ielts_academic: 'IELTS Academic',
  pte_academic: 'PTE Academic',
  cambridge_advanced: 'Cambridge Advanced',
  cambridge_proficiency: 'Cambridge Proficiency',
  exemption_claimed: 'Exemption claimed',
  first_sitting: 'First sitting',
  resit: 'Resit',
  repeat: 'Repeat',
  pass: 'Pass',
  fail: 'Fail',
  not_applicable: 'Not applicable',
  english_language: 'English Language',
  english_literature: 'English Literature',
  mathematics: 'Mathematics',
  biology: 'Biology',
  chemistry: 'Chemistry',
  physics: 'Physics',
  combined_science: 'Combined Science',
  further_mathematics: 'Further Mathematics',
  psychology: 'Psychology',
  human_biology: 'Human Biology',
  geography: 'Geography',
  history: 'History',
  religious_studies: 'Religious Studies',
  french: 'French',
  spanish: 'Spanish',
  german: 'German',
  art_and_design: 'Art and Design',
  music: 'Music',
  computer_science: 'Computer Science',
  business_studies: 'Business Studies',
  physical_education: 'Physical Education',
  design_and_technology: 'Design and Technology',
};

function humanizeId(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\ba\b/gi, 'A')
    .replace(/\bib\b/gi, 'IB')
    .replace(/\bgcse\b/gi, 'GCSE')
    .replace(/\bucat\b/gi, 'UCAT')
    .replace(/\bsjt\b/gi, 'SJT')
    .replace(/\bhe\b/gi, 'HE')
    .replace(/\w\S*/g, (word) => {
      if (/^(A|IB|GCSE|UCAT|SJT|HE)$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
}

function displayLabel(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  return FRIENDLY_LABELS[value] || humanizeId(value);
}

function formatGrade(grade: string | number | null | undefined) {
  if (grade === null || grade === undefined || grade === '') return 'Not provided';
  return String(grade);
}

function formatEpqSummary(epq: EpqQualification) {
  if (epq.status === 'planning') return 'Planning to take';
  if (epq.status === 'predicted') return `Predicted grade ${formatGrade(epq.grade)}`;
  if (epq.status === 'achieved') return `Achieved grade ${formatGrade(epq.grade)}`;
  return null;
}

function formatEpqTakenAlongside(epq: EpqQualification) {
  if (epq.status !== 'predicted' && epq.status !== 'achieved') return null;
  if (epq.taken_alongside_a_levels === true) return 'Yes';
  if (epq.taken_alongside_a_levels === false) return 'No';
  return 'Not sure';
}

function ReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="review-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ReviewField({ label, value }: { label: string; value: ReactNode }) {
  const isMissing = value === null || value === undefined || value === '' || value === 'Not provided';

  return (
    <div className="review-field">
      <dt>{label}</dt>
      <dd className={isMissing ? 'review-value-muted' : undefined}>{isMissing ? 'Not provided' : value}</dd>
    </div>
  );
}

function ReviewFieldGrid({ children }: { children: ReactNode }) {
  return <dl className="review-field-grid">{children}</dl>;
}

function GradeTile({ subject, grade }: { subject: string; grade: string | number | null | undefined }) {
  const displayedGrade = formatGrade(grade);

  return (
    <div className="grade-tile">
      <dt>{subject}</dt>
      <dd className={displayedGrade === 'Not provided' ? 'review-value-muted' : undefined}>{displayedGrade}</dd>
    </div>
  );
}

function SubjectGradeSummary({ subjects }: { subjects: { subject_id: string; grade: string }[] }) {
  return (
    <ReviewFieldGrid>
      {subjects
        .filter((s) => s.subject_id)
        .map((subject) => (
          <ReviewField
            key={subject.subject_id}
            label={displayLabel(subject.subject_id)}
            value={formatGrade(subject.grade)}
          />
        ))}
    </ReviewFieldGrid>
  );
}

const AGE_AT_COURSE_START_LABELS = {
  under_17: 'Under 17',
  age_17: '17',
  age_18_or_over: '18 or over',
} as const;

export function ReviewStep({ profile }: StepProps) {
  const {
    applicant_identity,
    course_target,
    gcse_profile,
    a_level_profile,
    scottish_profile,
    ib_profile,
    btec_profile,
    access_to_he_profile,
    graduate_profile,
    international_qualification,
    english_language_profile,
    admissions_tests,
    university_ids,
  } = profile;
  const route = course_target.qualification_route;
  const fixedGcseSubjectIds = new Set(Object.keys(gcse_profile.subjects));
  const additionalGcseSubjects = gcse_profile.additional_subjects.filter(
    (subject) => subject.subject_id && subject.grade && !fixedGcseSubjectIds.has(subject.subject_id),
  );
  const gcseSubjects = [
    ...Object.entries(gcse_profile.subjects).map(([subject_id, grade]) => ({ subject_id, grade })),
    ...additionalGcseSubjects,
  ];
  const epqSummary = formatEpqSummary(normaliseEpqQualification(a_level_profile.epq));
  const epqTakenAlongside = formatEpqTakenAlongside(normaliseEpqQualification(a_level_profile.epq));

  return (
    <div className="step-grid review-step">
      <div className="review-intro">
        <p>Review your profile before submitting for a prediction.</p>
      </div>

      <ReviewSection title="Identity">
        <ReviewFieldGrid>
          <ReviewField label="Applicant type" value={displayLabel(applicant_identity.applicant_type)} />
          <ReviewField label="Fee status" value={displayLabel(applicant_identity.fee_status)} />
          <ReviewField label="Domicile" value={displayLabel(applicant_identity.domicile)} />
          <ReviewField
            label="Age when starting university"
            value={
              applicant_identity.age_at_course_start_band
                ? AGE_AT_COURSE_START_LABELS[applicant_identity.age_at_course_start_band]
                : 'Not provided'
            }
          />
        </ReviewFieldGrid>
      </ReviewSection>

      <ReviewSection title="Course target">
        <ReviewFieldGrid>
          <ReviewField label="Qualification route" value={displayLabel(route)} />
          <ReviewField label="Application year" value={displayLabel(course_target.application_year)} />
        </ReviewFieldGrid>
      </ReviewSection>

      <ReviewSection title="GCSE grades">
        <dl className="grade-tile-grid">
          {gcseSubjects.map((subject, index) => (
            <GradeTile
              key={`${subject.subject_id}-${index}`}
              subject={displayLabel(subject.subject_id)}
              grade={subject.grade}
            />
          ))}
        </dl>
      </ReviewSection>

      {route === 'a_level' && (
        <ReviewSection title="A levels">
          <ReviewFieldGrid>
            {a_level_profile.subjects
              .filter((s) => s.subject_id)
              .map((subject) => (
                <ReviewField
                  key={subject.subject_id}
                  label={displayLabel(subject.subject_id)}
                  value={`Predicted ${formatGrade(subject.predicted_grade)}; achieved ${formatGrade(subject.achieved_grade)}`}
                />
              ))}
            {epqSummary && <ReviewField label="EPQ" value={epqSummary} />}
            {epqTakenAlongside && (
              <ReviewField label="Taken alongside A-levels" value={epqTakenAlongside} />
            )}
          </ReviewFieldGrid>
        </ReviewSection>
      )}

      {route === 'scottish' && (
        <ReviewSection title="Scottish qualifications">
          <h3>Highers</h3>
          <SubjectGradeSummary subjects={scottish_profile.higher_subjects} />
          <h3>Advanced Highers</h3>
          <SubjectGradeSummary subjects={scottish_profile.advanced_higher_subjects} />
        </ReviewSection>
      )}

      {route === 'international_baccalaureate' && (
        <ReviewSection title="IB profile">
          <ReviewFieldGrid>
            <ReviewField label="Total points" value={displayLabel(ib_profile.total_points)} />
          </ReviewFieldGrid>
          <h3>Higher Level subjects</h3>
          <SubjectGradeSummary subjects={ib_profile.higher_level_subjects} />
        </ReviewSection>
      )}

      {route === 'btec' && (
        <ReviewSection title="BTEC profile">
          <ReviewFieldGrid>
            <ReviewField label="Qualification" value={displayLabel(btec_profile.qualification)} />
            <ReviewField label="Grade" value={formatGrade(btec_profile.grade)} />
          </ReviewFieldGrid>
        </ReviewSection>
      )}

      {route === 'access_to_he' && (
        <ReviewSection title="Access to HE profile">
          <ReviewFieldGrid>
            <ReviewField
              label="Provider approved by institution"
              value={displayLabel(access_to_he_profile.provider_approved_by_institution)}
            />
            <ReviewField label="Requirements met" value={displayLabel(access_to_he_profile.requirements_met)} />
          </ReviewFieldGrid>
        </ReviewSection>
      )}

      {route === 'graduate' && (
        <ReviewSection title="Graduate profile">
          <ReviewFieldGrid>
            <ReviewField label="Degree classification" value={displayLabel(graduate_profile.degree_classification)} />
            <ReviewField label="Degree status" value={displayLabel(graduate_profile.degree_status)} />
          </ReviewFieldGrid>
        </ReviewSection>
      )}

      {route === 'international_qualification' && (
        <ReviewSection title="International qualification">
          <ReviewFieldGrid>
            <ReviewField label="Qualification" value={displayLabel(international_qualification.name)} />
            <ReviewField label="Equivalence status" value={displayLabel(international_qualification.equivalence_status)} />
          </ReviewFieldGrid>
        </ReviewSection>
      )}

      {requiresEnglishLanguageEvidence(profile) && (
        <ReviewSection title="English language evidence">
          <ReviewFieldGrid>
            <ReviewField label="Test" value={displayLabel(english_language_profile.test)} />
            <ReviewField label="Overall score" value={displayLabel(english_language_profile.overall)} />
          </ReviewFieldGrid>
        </ReviewSection>
      )}

      <ReviewSection title="UCAT / SJT">
        <ReviewFieldGrid>
          <ReviewField label="Total score" value={displayLabel(admissions_tests.ucat.total_score)} />
          <ReviewField label="SJT band" value={admissions_tests.ucat.sjt_band ? `Band ${admissions_tests.ucat.sjt_band}` : 'Not provided'} />
        </ReviewFieldGrid>
      </ReviewSection>

      <ReviewSection title="Universities">
        <ReviewFieldGrid>
          <ReviewField
            label="Selected universities"
            value={<span data-testid="review-university-count">{university_ids.length} selected</span>}
          />
        </ReviewFieldGrid>
      </ReviewSection>
    </div>
  );
}
