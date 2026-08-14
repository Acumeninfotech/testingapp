import { useEffect, useState } from 'react';

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

function enteredSubjectCount(subjects: ScottishSubject[]) {
  return subjects.filter((subject) => subject.subject_id || subject.grade).length;
}

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
        <fieldset key={index} className="scottish-subject-row">
          <legend className="sr-only">Subject {index + 1}</legend>
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

function ScottishQualificationSection({
  title,
  status,
  subjects,
  fieldPrefix,
  errors,
  defaultOpen = false,
  onUpdate,
}: {
  title: string;
  status: 'Required' | 'Optional';
  subjects: ScottishSubject[];
  fieldPrefix: string;
  errors: StepProps['errors'];
  defaultOpen?: boolean;
  onUpdate: (index: number, subject: ScottishSubject) => void;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const enteredCount = enteredSubjectCount(subjects);
  const enteredSummary = `${enteredCount} entered`;
  const hasErrors = Boolean(
    errors[fieldPrefix] || subjects.some((_, index) => errors[`${fieldPrefix}_${index}_grade`]),
  );

  useEffect(() => {
    if (hasErrors) {
      setIsOpen(true);
    }
  }, [hasErrors]);

  return (
    <details
      className="scottish-qualification-section"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="scottish-qualification-title">
          {title}
          <span>{status}</span>
        </span>
        <span className="scottish-qualification-count" aria-label={enteredSummary}>
          {enteredSummary}
        </span>
      </summary>
      <div className="scottish-qualification-body">
        <div className="scottish-subject-grid" aria-label={`${title} subject and grade rows`}>
          <SubjectGradeList subjects={subjects} fieldPrefix={fieldPrefix} errors={errors} onUpdate={onUpdate} />
        </div>
      </div>
    </details>
  );
}

export function ScottishStep({ profile, updateProfile, errors }: StepProps) {
  const { national_5_subjects, higher_subjects, advanced_higher_subjects } = profile.scottish_profile;

  return (
    <div className="step-grid">
      <p>Enter your National 5 subjects (if applicable), Higher subjects (required) and Advanced Higher subjects (if applicable).</p>

      <ScottishQualificationSection
        title="National 5s"
        status="Optional"
        subjects={national_5_subjects}
        fieldPrefix="national_5_subjects"
        errors={errors}
        onUpdate={(index, subject) =>
          updateProfile((prev) => {
            const next = [...prev.scottish_profile.national_5_subjects];
            next[index] = subject;
            return { ...prev, scottish_profile: { ...prev.scottish_profile, national_5_subjects: next } };
          })
        }
      />

      <ScottishQualificationSection
        title="Highers"
        status="Required"
        subjects={higher_subjects}
        fieldPrefix="higher_subjects"
        errors={errors}
        defaultOpen
        onUpdate={(index, subject) =>
          updateProfile((prev) => {
            const next = [...prev.scottish_profile.higher_subjects];
            next[index] = subject;
            return { ...prev, scottish_profile: { ...prev.scottish_profile, higher_subjects: next } };
          })
        }
      />

      <ScottishQualificationSection
        title="Advanced Highers"
        status="Optional"
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
