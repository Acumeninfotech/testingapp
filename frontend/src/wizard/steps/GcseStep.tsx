import {
  GCSE_CORE_SUBJECT_IDS,
  GCSE_SEPARATE_SCIENCE_SUBJECT_IDS,
  MAX_GCSE_COUNT,
  type GcseCoreSubjectId,
  type GcseScienceMode,
  type GcseSeparateScienceSubjectId,
} from '../profileTypes';
import { SelectField } from '../components/SelectField';
import type { StepProps } from './StepProps';

const GRADE_OPTIONS = ['9', '8', '7', '6', '5', '4', '3', '2', '1', 'U'].map((g) => ({ value: g, label: g }));

const CORE_SUBJECT_LABELS: Record<GcseCoreSubjectId, string> = {
  english_language: 'English Language',
  mathematics: 'Mathematics',
};

const SCIENCE_SUBJECT_LABELS: Record<GcseSeparateScienceSubjectId, string> = {
  biology: 'Biology',
  chemistry: 'Chemistry',
  physics: 'Physics',
};

const SCIENCE_MODE_OPTIONS: { value: GcseScienceMode; label: string }[] = [
  { value: 'separate_sciences', label: 'Separate sciences (Biology, Chemistry, Physics)' },
  { value: 'combined_science', label: 'Combined Science / Double Science' },
];

const ADDITIONAL_SUBJECT_OPTIONS = [
  { value: 'english_literature', label: 'English Literature' },
  { value: 'further_mathematics', label: 'Further Mathematics' },
  { value: 'psychology', label: 'Psychology' },
  { value: 'human_biology', label: 'Human Biology' },
  { value: 'geography', label: 'Geography' },
  { value: 'history', label: 'History' },
  { value: 'religious_studies', label: 'Religious Studies' },
  { value: 'french', label: 'French' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'german', label: 'German' },
  { value: 'art_and_design', label: 'Art and Design' },
  { value: 'music', label: 'Music' },
  { value: 'computer_science', label: 'Computer Science' },
  { value: 'business_studies', label: 'Business Studies' },
  { value: 'physical_education', label: 'Physical Education' },
  { value: 'design_and_technology', label: 'Design and Technology' },
  { value: 'other', label: 'Other' },
];

export function GcseStep({ profile, updateProfile, errors }: StepProps) {
  const { subjects, science_mode, combined_science_grade, additional_subjects } = profile.gcse_profile;
  const coreCount =
    GCSE_CORE_SUBJECT_IDS.length +
    (science_mode === 'separate_sciences' ? GCSE_SEPARATE_SCIENCE_SUBJECT_IDS.length : 1);
  const totalCount = coreCount + additional_subjects.filter((s) => s.subject_id !== '').length;
  const canAddMore = totalCount < MAX_GCSE_COUNT;

  return (
    <div className="step-grid">
      <p>
        Enter your GCSE grades (or predicted grades). Many universities score your best 8 or 9
        GCSEs, so please enter all your GCSEs, or at least your strongest subjects, for the most
        accurate result.
      </p>

      {GCSE_CORE_SUBJECT_IDS.map((subjectId) => (
        <SelectField
          key={subjectId}
          id={`gcse_${subjectId}`}
          label={CORE_SUBJECT_LABELS[subjectId]}
          value={subjects[subjectId]}
          options={GRADE_OPTIONS}
          error={errors[`gcse_${subjectId}`]}
          onChange={(value) =>
            updateProfile((prev) => ({
              ...prev,
              gcse_profile: {
                ...prev.gcse_profile,
                subjects: { ...prev.gcse_profile.subjects, [subjectId]: value },
              },
            }))
          }
        />
      ))}

      <SelectField
        id="gcse_science_mode"
        label="How did you take your science GCSEs?"
        value={science_mode}
        options={SCIENCE_MODE_OPTIONS}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            gcse_profile: { ...prev.gcse_profile, science_mode: value as GcseScienceMode },
          }))
        }
      />

      {science_mode === 'separate_sciences' ? (
        GCSE_SEPARATE_SCIENCE_SUBJECT_IDS.map((subjectId) => (
          <SelectField
            key={subjectId}
            id={`gcse_${subjectId}`}
            label={SCIENCE_SUBJECT_LABELS[subjectId]}
            value={subjects[subjectId]}
            options={GRADE_OPTIONS}
            error={errors[`gcse_${subjectId}`]}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                gcse_profile: {
                  ...prev.gcse_profile,
                  subjects: { ...prev.gcse_profile.subjects, [subjectId]: value },
                },
              }))
            }
          />
        ))
      ) : (
        <SelectField
          id="gcse_combined_science"
          label="Combined Science / Double Science (grade pair, e.g. 66 or BB)"
          value={combined_science_grade}
          options={GRADE_OPTIONS}
          error={errors.gcse_combined_science}
          hint="Enter the lower of your two combined science grades."
          onChange={(value) =>
            updateProfile((prev) => ({
              ...prev,
              gcse_profile: { ...prev.gcse_profile, combined_science_grade: value as typeof combined_science_grade },
            }))
          }
        />
      )}

      <div className="gcse-additional-subjects">
        <h3>Additional GCSEs</h3>
        <p className="form-field-hint">
          Add any other GCSEs you have taken. Entering more of your strongest GCSEs can improve
          the accuracy of your results for universities that score your best 8 or 9 subjects.
        </p>
        {errors.additional_subjects && (
          <p className="form-field-error" role="alert">
            {errors.additional_subjects}
          </p>
        )}

        {additional_subjects.map((subject, index) => (
          <fieldset key={index} className="gcse-additional-subject">
            <legend>Additional GCSE {index + 1}</legend>
            <SelectField
              id={`additional_gcse_${index}_subject`}
              label="Subject"
              value={subject.subject_id}
              options={ADDITIONAL_SUBJECT_OPTIONS}
              error={errors[`additional_gcse_${index}_subject`]}
              onChange={(value) =>
                updateProfile((prev) => {
                  const next = [...prev.gcse_profile.additional_subjects];
                  next[index] = { ...next[index], subject_id: value };
                  return { ...prev, gcse_profile: { ...prev.gcse_profile, additional_subjects: next } };
                })
              }
            />
            <SelectField
              id={`additional_gcse_${index}_grade`}
              label="Grade"
              value={subject.grade}
              options={GRADE_OPTIONS}
              error={errors[`additional_gcse_${index}_grade`]}
              onChange={(value) =>
                updateProfile((prev) => {
                  const next = [...prev.gcse_profile.additional_subjects];
                  next[index] = { ...next[index], grade: value as typeof subject.grade };
                  return { ...prev, gcse_profile: { ...prev.gcse_profile, additional_subjects: next } };
                })
              }
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                updateProfile((prev) => ({
                  ...prev,
                  gcse_profile: {
                    ...prev.gcse_profile,
                    additional_subjects: prev.gcse_profile.additional_subjects.filter((_, i) => i !== index),
                  },
                }))
              }
            >
              Remove
            </button>
          </fieldset>
        ))}

        <button
          type="button"
          className="btn"
          disabled={!canAddMore}
          onClick={() =>
            updateProfile((prev) => ({
              ...prev,
              gcse_profile: {
                ...prev.gcse_profile,
                additional_subjects: [...prev.gcse_profile.additional_subjects, { subject_id: '', grade: '' }],
              },
            }))
          }
        >
          Add another GCSE
        </button>
        {!canAddMore && <p className="form-field-hint">You&rsquo;ve entered {MAX_GCSE_COUNT} GCSEs.</p>}
      </div>
    </div>
  );
}
