import { TextField } from '../components/TextField';
import { SelectField } from '../components/SelectField';
import { CheckboxField } from '../components/CheckboxField';
import type { StepProps } from './StepProps';

const CLASSIFICATION_OPTIONS = [
  { value: 'first', label: 'First-class honours' },
  { value: 'upper_second', label: 'Upper second-class honours (2:1)' },
  { value: 'lower_second', label: 'Lower second-class honours (2:2)' },
  { value: 'third', label: 'Third-class honours' },
];

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'achieved', label: 'Achieved (awaiting confirmation)' },
  { value: 'predicted', label: 'Predicted' },
];

// Graduate-entry applicants still need a co-required A-level/school
// qualification profile per eligibility-evaluator.js:756-793 — that is
// collected on the separate A-level step, not duplicated here. GAMSAT is
// its own admissions test (applicant.admissions_tests.gamsat), used instead
// of UCAT by some universities that require it for graduate applicants.
export function GraduateStep({ profile, updateProfile, errors }: StepProps) {
  const graduate = profile.graduate_profile;
  const gamsat = profile.admissions_tests.gamsat;

  return (
    <div className="step-grid">
      <p>Tell us about the degree you already hold.</p>
      <SelectField
        id="degree_classification"
        label="Degree classification"
        value={graduate.degree_classification}
        options={CLASSIFICATION_OPTIONS}
        error={errors.degree_classification}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            graduate_profile: { ...prev.graduate_profile, degree_classification: value as typeof graduate.degree_classification },
          }))
        }
      />
      <SelectField
        id="degree_status"
        label="Degree status"
        value={graduate.degree_status}
        options={STATUS_OPTIONS}
        error={errors.degree_status}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            graduate_profile: { ...prev.graduate_profile, degree_status: value as typeof graduate.degree_status },
          }))
        }
      />
      <CheckboxField
        id="recognised_institution"
        label="My degree is from a UK-recognised institution"
        checked={graduate.recognised_institution}
        onChange={(checked) =>
          updateProfile((prev) => ({
            ...prev,
            graduate_profile: { ...prev.graduate_profile, recognised_institution: checked },
          }))
        }
      />
      <TextField
        id="degree_age_at_course_start_years"
        label="How many years old will your degree be at course start? (optional)"
        type="number"
        value={graduate.degree_age_at_course_start_years}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            graduate_profile: {
              ...prev.graduate_profile,
              degree_age_at_course_start_years: value === '' ? '' : Number(value),
            },
          }))
        }
      />

      <h3>GAMSAT</h3>
      <CheckboxField
        id="gamsat_taken"
        label="I have taken the GAMSAT"
        checked={gamsat.taken}
        onChange={(checked) =>
          updateProfile((prev) => ({
            ...prev,
            admissions_tests: { ...prev.admissions_tests, gamsat: { ...prev.admissions_tests.gamsat, taken: checked } },
          }))
        }
      />
      {gamsat.taken && (
        <>
          <TextField
            id="gamsat_overall_score"
            label="Overall score"
            type="number"
            value={gamsat.overall_score}
            error={errors.gamsat_overall_score}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                admissions_tests: {
                  ...prev.admissions_tests,
                  gamsat: { ...prev.admissions_tests.gamsat, overall_score: value === '' ? '' : Number(value) },
                },
              }))
            }
          />
          {gamsat.section_scores.map((score, index) => (
            <TextField
              key={index}
              id={`gamsat_section_${index}`}
              label={`Section ${index + 1} score`}
              type="number"
              value={score}
              error={errors[`gamsat_section_${index}`]}
              onChange={(value) =>
                updateProfile((prev) => {
                  const nextScores = [...prev.admissions_tests.gamsat.section_scores] as typeof gamsat.section_scores;
                  nextScores[index] = value === '' ? '' : Number(value);
                  return {
                    ...prev,
                    admissions_tests: {
                      ...prev.admissions_tests,
                      gamsat: { ...prev.admissions_tests.gamsat, section_scores: nextScores },
                    },
                  };
                })
              }
            />
          ))}
        </>
      )}
    </div>
  );
}
