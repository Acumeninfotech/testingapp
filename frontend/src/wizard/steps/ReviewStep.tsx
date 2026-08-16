import type { ReactNode } from 'react';
import { requiresEnglishLanguageEvidence } from '../validation';
import { normaliseEpqQualification, type EpqQualification } from '../profileTypes';
import {
  CONTEXTUAL_FIELD_LABELS,
  HOME_QUINTILE_FIELDS,
  OTHER_ACCESS_PROGRAMMES,
  PROGRAMME_STATUS_LABELS,
  QUINTILE_OPTIONS,
  HOME_REGION_OPTIONS,
  SCHOOL_AREA_OPTIONS,
  SIMD_QUINTILE_OPTIONS,
  SPECIFIC_HOME_AREA_OPTIONS,
  TRI_STATE_LABELS,
  UKWPMED_REGISTRY,
  universityLabel,
} from '../contextualRegistry';
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
  english: 'English',
  yes: 'Yes',
  no: 'No',
  not_sure: 'Not sure',
  english_literature: 'English Literature',
  mathematics: 'Mathematics',
  applications_of_mathematics: 'Applications of Mathematics',
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
  homes_for_ukraine: 'Homes for Ukraine',
  ukraine_family_scheme: 'Ukraine Family Scheme',
  ukraine_extension_scheme: 'Ukraine Extension Scheme',
  none: 'None of these',
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

function ReviewValueWithHint({ value, hint }: { value: ReactNode; hint?: string }) {
  return (
    <span className="review-value-with-hint">
      <span>{value}</span>
      {hint && <small>{hint}</small>}
    </span>
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

function MeaningfulContextualAnswers({
  answers,
  sensitive = false,
}: {
  answers: Record<string, string | undefined>;
  sensitive?: boolean;
}) {
  const fields = Object.entries(answers).filter(([, value]) => value && value !== 'no');
  if (fields.length === 0) return null;

  return (
    <ReviewFieldGrid>
      {fields.map(([key, value]) => (
        <ReviewField
          key={key}
          label={CONTEXTUAL_FIELD_LABELS[key] || displayLabel(key)}
          value={value ? TRI_STATE_LABELS[value as keyof typeof TRI_STATE_LABELS] || displayLabel(value) : 'Not provided'}
        />
      ))}
      {sensitive && fields.length > 0 && (
        <ReviewField label="Visibility" value="Shown here for your review only" />
      )}
    </ReviewFieldGrid>
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
  age_18: '18',
  age_19: '19',
  age_20: '20',
  age_21_or_over: '21 or over',
  age_18_or_over_legacy: '18 or over (legacy answer - please confirm)',
  not_sure: 'Not sure',
} as const;

export function ReviewStep({ profile }: StepProps) {
  const {
    applicant_identity,
    contextual_profile,
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
  const postcodeLookupValues = contextual_profile.home_area_region.postcode_lookup?.values;
  const postcodeLookupStatus = contextual_profile.home_area_region.postcode_lookup?.status ?? 'not_checked';
  const homeRegionLabel = HOME_REGION_OPTIONS.find((option) => option.value === contextual_profile.home_area_region.home_region)?.label ?? 'Not provided';
  const specificHomeAreaLabel = SPECIFIC_HOME_AREA_OPTIONS.find((option) => option.value === contextual_profile.home_area_region.specific_home_area)?.label ?? 'Not provided';
  const selectedSchoolAreas = Array.isArray(contextual_profile.home_area_region.school_areas)
    ? contextual_profile.home_area_region.school_areas
    : [];
  const legacySchoolAreaLabels = selectedSchoolAreas.flatMap((value) => {
    const label = SCHOOL_AREA_OPTIONS.find((option) => option.value === value)?.label;
    return label ? [label] : [];
  });
  const schoolAreaFromSingular =
    SCHOOL_AREA_OPTIONS.find((option) => option.value === contextual_profile.home_area_region.school_area)?.label ??
    (contextual_profile.home_area_region.school_area === 'none'
      ? 'None of the above'
      : contextual_profile.home_area_region.school_area === 'unknown'
        ? 'Not sure'
        : null);
  const schoolAreaDisplay = schoolAreaFromSingular ??
    (legacySchoolAreaLabels.length === 1
      ? legacySchoolAreaLabels[0]
      : legacySchoolAreaLabels.length > 1
        ? 'Not sure'
        : 'Not provided');
  const postcodeLookupStatusLabel = {
    matched: 'Matched',
    partial_match: 'Partially matched',
    not_found: 'Not matched',
    error: 'Error checking postcode',
    not_checked: 'Not checked',
  }[postcodeLookupStatus] || 'Not checked';
  const homeAreaRows = [
    contextual_profile.home_area_region.postcode
      ? { label: 'Postcode', value: contextual_profile.home_area_region.postcode }
      : null,
    { label: 'Postcode lookup status', value: postcodeLookupStatusLabel },
    { label: 'I live in', value: homeRegionLabel },
    { label: 'I live in the following area', value: specificHomeAreaLabel },
    ...HOME_QUINTILE_FIELDS
      .filter(({ key }) => {
        const value = contextual_profile.home_area_region[key];
        return value && value !== 'unknown';
      })
      .map(({ key, label }) => ({
        label,
        value: (
          <ReviewValueWithHint
            value={QUINTILE_OPTIONS.find((option) => option.value === contextual_profile.home_area_region[key])?.label ||
              displayLabel(contextual_profile.home_area_region[key])}
            hint={
              (
                (key === 'polar4_quintile' && postcodeLookupValues?.polar4.source === 'postcode_lookup') ||
                (key === 'tundra_quintile' && postcodeLookupValues?.tundra.source === 'postcode_lookup') ||
                (key === 'imd_quintile' && postcodeLookupValues?.imd.source === 'postcode_lookup')
              )
                ? 'Identified from postcode'
                : undefined
            }
          />
        ),
      })),
    contextual_profile.home_area_region.simd_quintile && contextual_profile.home_area_region.simd_quintile !== 'unknown'
      ? {
          label: 'Scottish Index of Multiple Deprivation (SIMD)',
          value:
            SIMD_QUINTILE_OPTIONS.find((option) => option.value === contextual_profile.home_area_region.simd_quintile)?.label ||
            displayLabel(contextual_profile.home_area_region.simd_quintile),
        }
      : null,
    { label: 'I attended school in', value: schoolAreaDisplay },
  ].filter(Boolean) as { label: string; value: ReactNode }[];
  const ukwpmed = contextual_profile.access_programmes.ukwpmed;
  const ukwpmedProgramme = UKWPMED_REGISTRY.recognised_programmes.find(
    (programme) => programme.programme_id === ukwpmed.programme_id,
  );
  const otherAccessProgrammes = contextual_profile.access_programmes.other_programmes.filter((programme) => programme.programme_id);
  const partnerSchoolRelationships = contextual_profile.partner_schools.relationships.filter(
    (relationship) => relationship.school_name || relationship.university_id || relationship.university_name,
  );

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
            label="Current UK residence"
            value={applicant_identity.current_uk_residence ? displayLabel(applicant_identity.current_uk_residence) : 'Not provided'}
          />
          <ReviewField
            label="Age on 1 September of your course-start year"
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
          <h3>National 5s</h3>
          <SubjectGradeSummary subjects={scottish_profile.national_5_subjects} />
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

      {homeAreaRows.length > 0 && (
        <ReviewSection title="Home area & region">
          <ReviewFieldGrid>
            {homeAreaRows.map((row) => (
              <ReviewField key={row.label} label={row.label} value={row.value} />
            ))}
          </ReviewFieldGrid>
        </ReviewSection>
      )}

      {Object.values(contextual_profile.financial_support).some((value) => value && value !== 'no') && (
        <ReviewSection title="Financial support">
          <MeaningfulContextualAnswers answers={contextual_profile.financial_support} />
        </ReviewSection>
      )}

      {Object.values(contextual_profile.school_education).some((value) => value && value !== 'no') && (
        <ReviewSection title="School & education">
          <MeaningfulContextualAnswers answers={contextual_profile.school_education} />
        </ReviewSection>
      )}

      {Object.values(contextual_profile.personal_circumstances).some((value) => value && value !== 'no') && (
        <ReviewSection title="Personal circumstances">
          <MeaningfulContextualAnswers answers={contextual_profile.personal_circumstances} sensitive />
        </ReviewSection>
      )}

      {(ukwpmed.status !== 'no' || otherAccessProgrammes.length > 0) && (
        <ReviewSection title="Access / WP programmes">
          {ukwpmed.status === 'not_sure' && (
            <ReviewFieldGrid>
              <ReviewField label="UKWPMED participation" value="Not sure" />
            </ReviewFieldGrid>
          )}
          {ukwpmed.status === 'yes' && (
            <>
              <h3>UKWPMED programme</h3>
              <ReviewFieldGrid>
                <ReviewField
                  label="Programme"
                  value={ukwpmed.not_sure_programme ? 'Not sure which programme' : ukwpmedProgramme?.label || displayLabel(ukwpmed.programme_id)}
                />
                {ukwpmedProgramme && (
                  <ReviewField
                    label="Provider"
                    value={universityLabel(ukwpmedProgramme.provider_university_id)}
                  />
                )}
                <ReviewField
                  label="Status"
                  value={
                    ukwpmed.programme_status
                      ? PROGRAMME_STATUS_LABELS[ukwpmed.programme_status]
                      : 'Not provided'
                  }
                />
                {ukwpmed.completion_year && (
                  <ReviewField label="Completion year" value={ukwpmed.completion_year} />
                )}
                <ReviewField
                  label="Recognised by"
                  value="Birmingham, Brighton and Sussex, Keele, Hull York, Leicester, Manchester and Plymouth"
                />
              </ReviewFieldGrid>
            </>
          )}
          {otherAccessProgrammes.length > 0 && (
            <>
              <h3>Other access programmes</h3>
              <ReviewFieldGrid>
                {otherAccessProgrammes.map((programme, index) => {
                  const knownProgramme = OTHER_ACCESS_PROGRAMMES.find(
                    (candidate) => candidate.programme_id === programme.programme_id,
                  );
                  const label = knownProgramme?.label || displayLabel(programme.programme_id);
                  const extraName = programme.programme_id === 'other_access_wp_programme'
                    ? contextual_profile.access_programmes.other_programme_name || programme.programme_name
                    : '';
                  return (
                    <ReviewField
                      key={`${programme.programme_id}-${index}`}
                      label={extraName ? `${label}: ${extraName}` : label}
                      value={programme.status ? PROGRAMME_STATUS_LABELS[programme.status] : 'Not provided'}
                    />
                  );
                })}
              </ReviewFieldGrid>
            </>
          )}
        </ReviewSection>
      )}

      {(contextual_profile.partner_schools.status === 'not_sure' || partnerSchoolRelationships.length > 0) && (
        <ReviewSection title="Partner schools">
          {contextual_profile.partner_schools.status === 'not_sure' && (
            <ReviewFieldGrid>
              <ReviewField label="Partner-school recognition" value="Not sure" />
            </ReviewFieldGrid>
          )}
          {partnerSchoolRelationships.length > 0 && (
            <ReviewFieldGrid>
              {partnerSchoolRelationships.map((relationship, index) => (
                <ReviewField
                  key={`${relationship.school_name}-${index}`}
                  label={relationship.school_name || `Relationship ${index + 1}`}
                  value={[
                    universityLabel(relationship.university_id, relationship.university_name),
                    relationship.relationship_type,
                  ].filter(Boolean).join('; ')}
                />
              ))}
            </ReviewFieldGrid>
          )}
        </ReviewSection>
      )}

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
