import { useEffect, useState } from 'react';

import { SelectField } from '../components/SelectField';
import {
  DEFAULT_SCOTTISH_ADVANCED_HIGHER_ROWS,
  DEFAULT_SCOTTISH_HIGHER_ROWS,
  type ScottishSubject,
} from '../profileTypes';
import type { StepProps } from './StepProps';

const GRADE_OPTIONS = ['A', 'B', 'C', 'D'].map((g) => ({ value: g, label: g }));
const ADVANCED_HIGHER_GRADE_OPTIONS = ['A1', 'A2', 'A', 'B', 'C', 'D'].map((g) => ({
  value: g,
  label: g,
}));
const SCHOOL_YEAR_OPTIONS = [
  { value: 's4', label: 'S4' },
  { value: 's5', label: 'S5' },
  { value: 's6', label: 'S6' },
];
const FIRST_ATTEMPT_OPTIONS = [
  { value: 'yes', label: 'First attempt' },
  { value: 'no', label: 'Resit / repeat' },
];
const SAME_SITTING_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const SUBJECT_OPTIONS = [
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'biology', label: 'Biology' },
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'applications_of_mathematics', label: 'Applications of Mathematics' },
  { value: 'physics', label: 'Physics' },
  { value: 'english_language', label: 'English' },
  { value: 'other', label: 'Other' },
];

function enteredSubjectCount(subjects: ScottishSubject[]) {
  return subjects.filter((subject) => subject.subject_id || subject.grade).length;
}

function blankScottishSubject(): ScottishSubject {
  return { subject_id: '', grade: '' };
}

function padScottishSubjectRows(subjects: ScottishSubject[], minimumRows: number) {
  const rows = [...subjects];
  while (rows.length < minimumRows) rows.push(blankScottishSubject());
  return rows;
}

function SubjectGradeList({
  subjects,
  fieldPrefix,
  gradeOptions = GRADE_OPTIONS,
  onUpdate,
  errors,
}: {
  subjects: ScottishSubject[];
  fieldPrefix: string;
  gradeOptions?: { value: string; label: string }[];
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
            options={gradeOptions}
            error={errors[`${fieldPrefix}_${index}_grade`]}
            onChange={(value) => onUpdate(index, { ...subject, grade: value as ScottishSubject['grade'] })}
          />
          <SelectField
            id={`${fieldPrefix}_${index}_school_year`}
            label="School year"
            value={subject.school_year || ''}
            options={SCHOOL_YEAR_OPTIONS}
            error={errors[`${fieldPrefix}_${index}_school_year`]}
            onChange={(value) => onUpdate(index, { ...subject, school_year: value as ScottishSubject['school_year'] })}
          />
          <SelectField
            id={`${fieldPrefix}_${index}_first_attempt`}
            label="Attempt"
            value={subject.first_attempt == null ? '' : subject.first_attempt ? 'yes' : 'no'}
            options={FIRST_ATTEMPT_OPTIONS}
            error={errors[`${fieldPrefix}_${index}_first_attempt`]}
            onChange={(value) =>
              onUpdate(index, {
                ...subject,
                first_attempt: value === '' ? null : value === 'yes',
              })
            }
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
  gradeOptions,
  errors,
  defaultOpen = false,
  onUpdate,
}: {
  title: string;
  status: 'Required' | 'Optional';
  subjects: ScottishSubject[];
  fieldPrefix: string;
  gradeOptions?: { value: string; label: string }[];
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
          <SubjectGradeList
            subjects={subjects}
            fieldPrefix={fieldPrefix}
            gradeOptions={gradeOptions}
            errors={errors}
            onUpdate={onUpdate}
          />
        </div>
      </div>
    </details>
  );
}

export function ScottishStep({ profile, updateProfile, errors }: StepProps) {
  const {
    completed_in_one_sitting,
    national_5_subjects,
    higher_subjects,
    advanced_higher_subjects,
  } = profile.scottish_profile;
  const visibleHigherSubjects = padScottishSubjectRows(higher_subjects, DEFAULT_SCOTTISH_HIGHER_ROWS);
  const visibleAdvancedHigherSubjects = padScottishSubjectRows(
    advanced_higher_subjects,
    DEFAULT_SCOTTISH_ADVANCED_HIGHER_ROWS,
  );

  return (
    <div className="step-grid">
      <p>Enter your National 5 subjects (if applicable), Higher subjects (required) and Advanced Higher subjects (if applicable).</p>

      <SelectField
        id="scottish_completed_in_one_sitting"
        label="Were your required SQA subjects completed in the same sitting?"
        value={completed_in_one_sitting == null ? '' : completed_in_one_sitting ? 'yes' : 'no'}
        options={SAME_SITTING_OPTIONS}
        error={errors.scottish_completed_in_one_sitting}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            scottish_profile: {
              ...prev.scottish_profile,
              completed_in_one_sitting: value === '' ? null : value === 'yes',
            },
          }))
        }
      />

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
        subjects={visibleHigherSubjects}
        fieldPrefix="higher_subjects"
        errors={errors}
        defaultOpen
        onUpdate={(index, subject) =>
          updateProfile((prev) => {
            const next = padScottishSubjectRows(prev.scottish_profile.higher_subjects, DEFAULT_SCOTTISH_HIGHER_ROWS);
            next[index] = subject;
            return { ...prev, scottish_profile: { ...prev.scottish_profile, higher_subjects: next } };
          })
        }
      />

      <ScottishQualificationSection
        title="Advanced Highers"
        status="Optional"
        subjects={visibleAdvancedHigherSubjects}
        fieldPrefix="advanced_higher_subjects"
        gradeOptions={ADVANCED_HIGHER_GRADE_OPTIONS}
        errors={errors}
        onUpdate={(index, subject) =>
          updateProfile((prev) => {
            const next = padScottishSubjectRows(
              prev.scottish_profile.advanced_higher_subjects,
              DEFAULT_SCOTTISH_ADVANCED_HIGHER_ROWS,
            );
            next[index] = subject;
            return { ...prev, scottish_profile: { ...prev.scottish_profile, advanced_higher_subjects: next } };
          })
        }
      />
    </div>
  );
}
