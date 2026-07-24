import { TextField } from '../components/TextField';
import { SelectField } from '../components/SelectField';
import type { IbSubject } from '../profileTypes';
import type { StepProps } from './StepProps';

const GRADE_OPTIONS = ['7', '6', '5', '4', '3', '2', '1'].map((g) => ({ value: g, label: g }));

const SUBJECT_OPTIONS = [
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'biology', label: 'Biology' },
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'physics', label: 'Physics' },
  { value: 'english_a', label: 'English A' },
  { value: 'other', label: 'Other' },
];

function SubjectGradeList({
  subjects,
  fieldPrefix,
  onUpdate,
  errors,
}: {
  subjects: IbSubject[];
  fieldPrefix: string;
  onUpdate: (index: number, subject: IbSubject) => void;
  errors: StepProps['errors'];
}) {
  return (
    <>
      {errors[fieldPrefix] && (
        <p className="form-field-error" role="alert">
          {errors[fieldPrefix]}
        </p>
      )}
      {subjects.map((subject, index) => (
        <fieldset key={index} className="a-level-subject">
          <legend>Subject {index + 1}</legend>
          <SelectField
            id={`${fieldPrefix}_${index}_id`}
            label="Subject"
            value={subject.subject_id}
            options={SUBJECT_OPTIONS}
            onChange={(value) => onUpdate(index, { ...subject, subject_id: value })}
          />
          <SelectField
            id={`${fieldPrefix}_${index}_grade`}
            label="Grade"
            value={subject.grade}
            options={GRADE_OPTIONS}
            error={errors[`${fieldPrefix}_${index}_grade`]}
            onChange={(value) => onUpdate(index, { ...subject, grade: value })}
          />
        </fieldset>
      ))}
    </>
  );
}

export function IbStep({ profile, updateProfile, errors }: StepProps) {
  const { total_points, higher_level_subjects, standard_level_subjects } = profile.ib_profile;

  return (
    <div className="step-grid">
      <p>Enter your IB total points and your Higher Level (required) and Standard Level (optional) subjects.</p>

      <TextField
        id="total_points"
        label="Total IB points"
        type="number"
        value={total_points}
        error={errors.total_points}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            ib_profile: { ...prev.ib_profile, total_points: value === '' ? '' : Number(value) },
          }))
        }
      />

      <h3>Higher Level subjects</h3>
      <SubjectGradeList
        subjects={higher_level_subjects}
        fieldPrefix="higher_level_subjects"
        errors={errors}
        onUpdate={(index, subject) =>
          updateProfile((prev) => {
            const next = [...prev.ib_profile.higher_level_subjects];
            next[index] = subject;
            return { ...prev, ib_profile: { ...prev.ib_profile, higher_level_subjects: next } };
          })
        }
      />

      <h3>Standard Level subjects (optional)</h3>
      <SubjectGradeList
        subjects={standard_level_subjects}
        fieldPrefix="standard_level_subjects"
        errors={errors}
        onUpdate={(index, subject) =>
          updateProfile((prev) => {
            const next = [...prev.ib_profile.standard_level_subjects];
            next[index] = subject;
            return { ...prev, ib_profile: { ...prev.ib_profile, standard_level_subjects: next } };
          })
        }
      />
    </div>
  );
}
