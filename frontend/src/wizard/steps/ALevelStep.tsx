import {
  A_LEVEL_SCIENCE_SUBJECTS,
  DEFAULT_EPQ_QUALIFICATION,
  type EpqStatus,
} from '../profileTypes';
import { SelectField } from '../components/SelectField';
import { CheckboxField } from '../components/CheckboxField';
import type { StepProps } from './StepProps';

const GRADE_OPTIONS = ['A*', 'A', 'B', 'C', 'D', 'E', 'U'].map((g) => ({ value: g, label: g }));
const EPQ_GRADE_OPTIONS = ['A*', 'A', 'B', 'C', 'D', 'E'].map((g) => ({ value: g, label: g }));

const SUBJECT_OPTIONS = [
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'biology', label: 'Biology' },
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'physics', label: 'Physics' },
  { value: 'psychology', label: 'Psychology' },
  { value: 'computer_science', label: 'Computer Science' },
  { value: 'further_mathematics', label: 'Further Mathematics' },
  { value: 'english_literature', label: 'English Literature' },
  { value: 'other', label: 'Other' },
];

const SITTING_STATUS_OPTIONS = [
  { value: 'first_sitting', label: 'First sitting' },
  { value: 'resit', label: 'Resit' },
  { value: 'repeat', label: 'Repeated year' },
];

const SAME_SITTING_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const EPQ_TAKEN_ALONGSIDE_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
];

const PRACTICAL_OPTIONS = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
];

const EPQ_STATUS_OPTIONS = [
  { value: 'not_taken', label: 'Not taking an EPQ' },
  { value: 'planning', label: 'Planning to take an EPQ' },
  { value: 'predicted', label: 'Predicted grade' },
  { value: 'achieved', label: 'Achieved grade' },
];

export function ALevelStep({ profile, updateProfile, errors }: StepProps) {
  const { subjects, sitting_status, completed_in_one_sitting } = profile.a_level_profile;
  const epq = profile.a_level_profile.epq ?? DEFAULT_EPQ_QUALIFICATION;
  const resit = profile.applicant_identity.resit;
  const showEpqGrade = epq.status === 'predicted' || epq.status === 'achieved';

  return (
    <div className="step-grid">
      <p>
        Enter your three A-level subjects. Most medical schools require Chemistry, plus one
        other science or Maths subject &mdash; the exact combination varies by university, so
        enter what you&rsquo;re actually taking and we&rsquo;ll check it against each school&rsquo;s
        published requirements.
      </p>
      {errors.subjects && (
        <p className="form-field-error" role="alert">
          {errors.subjects}
        </p>
      )}

      {subjects.map((subject, index) => (
        <fieldset key={index} className="a-level-subject">
          <legend>Subject {index + 1}</legend>
          <SelectField
            id={`subject_${index}_id`}
            label="Subject"
            value={subject.subject_id}
            options={SUBJECT_OPTIONS}
            error={errors[`subject_${index}_id`]}
            onChange={(value) =>
              updateProfile((prev) => {
                const nextSubjects = [...prev.a_level_profile.subjects];
                nextSubjects[index] = { ...nextSubjects[index], subject_id: value };
                return { ...prev, a_level_profile: { ...prev.a_level_profile, subjects: nextSubjects } };
              })
            }
          />
          <SelectField
            id={`subject_${index}_predicted`}
            label="Predicted grade"
            value={subject.predicted_grade}
            options={GRADE_OPTIONS}
            error={errors[`subject_${index}_grade`]}
            onChange={(value) =>
              updateProfile((prev) => {
                const nextSubjects = [...prev.a_level_profile.subjects];
                nextSubjects[index] = { ...nextSubjects[index], predicted_grade: value as typeof subject.predicted_grade };
                return { ...prev, a_level_profile: { ...prev.a_level_profile, subjects: nextSubjects } };
              })
            }
          />
          <SelectField
            id={`subject_${index}_achieved`}
            label="Achieved grade (if you already have it)"
            value={subject.achieved_grade}
            options={GRADE_OPTIONS}
            onChange={(value) =>
              updateProfile((prev) => {
                const nextSubjects = [...prev.a_level_profile.subjects];
                nextSubjects[index] = { ...nextSubjects[index], achieved_grade: value as typeof subject.achieved_grade };
                return { ...prev, a_level_profile: { ...prev.a_level_profile, subjects: nextSubjects } };
              })
            }
          />
          {A_LEVEL_SCIENCE_SUBJECTS.includes(subject.subject_id as (typeof A_LEVEL_SCIENCE_SUBJECTS)[number]) && (
            <SelectField
              id={`subject_${index}_practical`}
              label="Science practical endorsement"
              value={subject.practical_endorsement === 'not_applicable' ? '' : subject.practical_endorsement}
              options={PRACTICAL_OPTIONS}
              error={errors[`subject_${index}_practical`]}
              onChange={(value) =>
                updateProfile((prev) => {
                  const nextSubjects = [...prev.a_level_profile.subjects];
                  nextSubjects[index] = {
                    ...nextSubjects[index],
                    practical_endorsement: (value || 'not_applicable') as typeof subject.practical_endorsement,
                  };
                  return { ...prev, a_level_profile: { ...prev.a_level_profile, subjects: nextSubjects } };
                })
              }
            />
          )}
        </fieldset>
      ))}

      <fieldset className="a-level-subject epq-section">
        <legend>Extended Project Qualification (EPQ)</legend>
        <div className="epq-section-heading">
          <h3>Extended Project Qualification (EPQ)</h3>
          <span>Optional</span>
        </div>
        <p>Some medical schools may recognise an EPQ as part of an alternative A-level offer.</p>
        <SelectField
          id="epq_status"
          label="EPQ status"
          value={epq.status}
          options={EPQ_STATUS_OPTIONS}
          onChange={(value) => {
            const status = value as EpqStatus;
            updateProfile((prev) => ({
              ...prev,
              a_level_profile: {
                ...prev.a_level_profile,
                epq: {
                  status,
                  grade: status === 'predicted' || status === 'achieved'
                    ? prev.a_level_profile.epq?.grade ?? null
                    : null,
                  taken_alongside_a_levels: status === 'predicted' || status === 'achieved'
                    ? prev.a_level_profile.epq?.taken_alongside_a_levels ?? null
                    : null,
                },
              },
            }));
          }}
        />
        {showEpqGrade && (
          <SelectField
            id="epq_grade"
            label={epq.status === 'predicted' ? 'Predicted EPQ grade' : 'Achieved EPQ grade'}
            value={epq.grade ?? ''}
            options={EPQ_GRADE_OPTIONS}
            error={errors.epq_grade}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                a_level_profile: {
                  ...prev.a_level_profile,
                  epq: {
                    status: prev.a_level_profile.epq?.status ?? epq.status,
                    grade: value === '' ? null : value as typeof epq.grade,
                    taken_alongside_a_levels:
                      prev.a_level_profile.epq?.taken_alongside_a_levels ?? null,
                  },
                },
              }))
            }
          />
        )}
        {showEpqGrade && (
          <SelectField
            id="epq_taken_alongside_a_levels"
            label="Was your EPQ taken alongside your A-levels?"
            value={
              epq.taken_alongside_a_levels == null
                ? 'not_sure'
                : epq.taken_alongside_a_levels
                  ? 'yes'
                  : 'no'
            }
            options={EPQ_TAKEN_ALONGSIDE_OPTIONS}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                a_level_profile: {
                  ...prev.a_level_profile,
                  epq: {
                    status: prev.a_level_profile.epq?.status ?? epq.status,
                    grade: prev.a_level_profile.epq?.grade ?? null,
                    taken_alongside_a_levels: value === 'yes'
                      ? true
                      : value === 'no'
                        ? false
                        : null,
                  },
                },
              }))
            }
          />
        )}
      </fieldset>

      <SelectField
        id="sitting_status"
        label="Sitting status"
        value={sitting_status}
        options={SITTING_STATUS_OPTIONS}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            a_level_profile: { ...prev.a_level_profile, sitting_status: value as typeof sitting_status },
          }))
        }
      />

      <SelectField
        id="completed_in_one_sitting"
        label="Will all required A-level qualifications be completed in the same examination sitting?"
        value={completed_in_one_sitting == null ? '' : completed_in_one_sitting ? 'yes' : 'no'}
        options={SAME_SITTING_OPTIONS}
        error={errors.completed_in_one_sitting}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            a_level_profile: {
              ...prev.a_level_profile,
              completed_in_one_sitting: value === '' ? null : value === 'yes',
            },
          }))
        }
      />

      <CheckboxField
        id="has_resits"
        label="I am resitting one or more subjects"
        checked={resit.has_resits}
        onChange={(checked) =>
          updateProfile((prev) => ({
            ...prev,
            applicant_identity: {
              ...prev.applicant_identity,
              resit: { ...prev.applicant_identity.resit, has_resits: checked },
            },
          }))
        }
      />
      {resit.has_resits && (
        <SelectField
          id="subjects_resat"
          label="Which subject are you resitting?"
          value={resit.subjects_resat[0] ?? ''}
          options={SUBJECT_OPTIONS}
          error={errors.subjects_resat}
          onChange={(value) =>
            updateProfile((prev) => ({
              ...prev,
              applicant_identity: {
                ...prev.applicant_identity,
                resit: { ...prev.applicant_identity.resit, subjects_resat: value ? [value] : [] },
              },
            }))
          }
        />
      )}
    </div>
  );
}
