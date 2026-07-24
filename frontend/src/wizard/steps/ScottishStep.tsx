import { SelectField } from '../components/SelectField';
import type { ScottishSubject } from '../profileTypes';
import type { StepProps } from './StepProps';

const GRADE_OPTIONS = ['A', 'B', 'C', 'D'].map((g) => ({ value: g, label: g }));

const SUBJECT_OPTIONS = [
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'biology', label: 'Biology' },
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'physics', label: 'Physics' },
  { value: 'english', label: 'English' },
  { value: 'other', label: 'Other' },
];

function SubjectGradeList({
  subjects,
  fieldPrefix,
  onUpdate,
  errors,
}: {
  subjects: ScottishSubject[];
  fieldPrefix: string;
  onUpdate: (index: number, subject: ScottishSubject) => void;
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
            onChange={(value) => onUpdate(index, { ...subject, grade: value as ScottishSubject['grade'] })}
          />
        </fieldset>
      ))}
    </>
  );
}

export function ScottishStep({ profile, updateProfile, errors }: StepProps) {
  const { higher_subjects, advanced_higher_subjects } = profile.scottish_profile;

  return (
    <div className="step-grid">
      <p>Enter your Higher subjects (required) and Advanced Higher subjects (if applicable).</p>

      <h3>Highers</h3>
      <SubjectGradeList
        subjects={higher_subjects}
        fieldPrefix="higher_subjects"
        errors={errors}
        onUpdate={(index, subject) =>
          updateProfile((prev) => {
            const next = [...prev.scottish_profile.higher_subjects];
            next[index] = subject;
            return { ...prev, scottish_profile: { ...prev.scottish_profile, higher_subjects: next } };
          })
        }
      />

      <h3>Advanced Highers (optional)</h3>
      <SubjectGradeList
        subjects={advanced_higher_subjects}
        fieldPrefix="advanced_higher_subjects"
        errors={errors}
        onUpdate={(index, subject) =>
          updateProfile((prev) => {
            const next = [...prev.scottish_profile.advanced_higher_subjects];
            next[index] = subject;
            return { ...prev, scottish_profile: { ...prev.scottish_profile, advanced_higher_subjects: next } };
          })
        }
      />
    </div>
  );
}
