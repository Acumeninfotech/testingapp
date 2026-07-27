import { CheckboxField } from '../components/CheckboxField';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import type { StepProps } from './StepProps';

const SJT_BAND_OPTIONS = [
  { value: '1', label: 'Band 1' },
  { value: '2', label: 'Band 2' },
  { value: '3', label: 'Band 3' },
  { value: '4', label: 'Band 4' },
];

export function UcatStep({ profile, updateProfile, errors }: StepProps) {
  const ucat = profile.admissions_tests.ucat;
  const applicationYear = profile.course_target.application_year;
  const testYearHint =
    typeof applicationYear === 'number'
      ? `Enter the year the UCAT was taken. For ${applicationYear} medicine entry, this will normally be ${applicationYear - 1}.`
      : 'Enter the year the UCAT was taken. UCAT is normally sat the year before medicine entry (e.g. for 2027 entry, this will normally be 2026).';

  return (
    <div className="step-grid">
      <p>Enter UCAT evidence if it applies to the universities you plan to select.</p>
      <CheckboxField
        id="ucat_taken"
        label="I have taken the UCAT"
        checked={ucat.taken}
        onChange={(checked) =>
          updateProfile((prev) => ({
            ...prev,
            admissions_tests: {
              ...prev.admissions_tests,
              ucat: { ...prev.admissions_tests.ucat, taken: checked },
            },
          }))
        }
      />
      {errors.taken && (
        <p className="form-field-error" role="alert">
          {errors.taken}
        </p>
      )}

      {ucat.taken && (
        <>
          <TextField
            id="ucat_verbal_reasoning"
            label="Verbal reasoning score"
            type="number"
            value={ucat.subtests.verbal_reasoning}
            error={errors.verbal_reasoning}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                admissions_tests: {
                  ...prev.admissions_tests,
                  ucat: {
                    ...prev.admissions_tests.ucat,
                    subtests: { ...prev.admissions_tests.ucat.subtests, verbal_reasoning: value === '' ? '' : Number(value) },
                  },
                },
              }))
            }
          />
          <TextField
            id="ucat_decision_making"
            label="Decision making score"
            type="number"
            value={ucat.subtests.decision_making}
            error={errors.decision_making}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                admissions_tests: {
                  ...prev.admissions_tests,
                  ucat: {
                    ...prev.admissions_tests.ucat,
                    subtests: { ...prev.admissions_tests.ucat.subtests, decision_making: value === '' ? '' : Number(value) },
                  },
                },
              }))
            }
          />
          <TextField
            id="ucat_quantitative_reasoning"
            label="Quantitative reasoning score"
            type="number"
            value={ucat.subtests.quantitative_reasoning}
            error={errors.quantitative_reasoning}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                admissions_tests: {
                  ...prev.admissions_tests,
                  ucat: {
                    ...prev.admissions_tests.ucat,
                    subtests: {
                      ...prev.admissions_tests.ucat.subtests,
                      quantitative_reasoning: value === '' ? '' : Number(value),
                    },
                  },
                },
              }))
            }
          />
          {errors.subtests && (
            <p className="form-field-error" role="alert">
              {errors.subtests}
            </p>
          )}
          <TextField
            id="ucat_total_score"
            label="Total score"
            type="number"
            value={ucat.total_score}
            error={errors.total_score}
            hint="Should equal the sum of your three subtest scores."
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                admissions_tests: {
                  ...prev.admissions_tests,
                  ucat: { ...prev.admissions_tests.ucat, total_score: value === '' ? '' : Number(value) },
                },
              }))
            }
          />
          <TextField
            id="ucat_test_year"
            label="Year you took (or will take) the UCAT"
            type="number"
            value={ucat.test_year}
            error={errors.test_year}
            hint={testYearHint}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                admissions_tests: {
                  ...prev.admissions_tests,
                  ucat: { ...prev.admissions_tests.ucat, test_year: value === '' ? '' : Number(value) },
                },
              }))
            }
          />
          <SelectField
            id="sjt_band"
            label="Situational Judgement Test (SJT) band"
            value={ucat.sjt_band ? String(ucat.sjt_band) : ''}
            options={SJT_BAND_OPTIONS}
            error={errors.sjt_band}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                admissions_tests: {
                  ...prev.admissions_tests,
                  ucat: { ...prev.admissions_tests.ucat, sjt_band: value ? (Number(value) as 1 | 2 | 3 | 4) : 0 },
                },
              }))
            }
          />
        </>
      )}
    </div>
  );
}
