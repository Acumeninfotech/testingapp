import { useEffect } from 'react';
import { CheckboxField } from '../components/CheckboxField';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import type { StepProps } from './StepProps';

const UCAT_SUBTEST_MIN = 300;
const UCAT_SUBTEST_MAX = 900;
const UCAT_TOTAL_MIN = 900;
const UCAT_TOTAL_MAX = 2700;
const WHOLE_NUMBER_PATTERN = '[0-9]*';

const SJT_BAND_OPTIONS = [
  { value: '1', label: 'Band 1' },
  { value: '2', label: 'Band 2' },
  { value: '3', label: 'Band 3' },
  { value: '4', label: 'Band 4' },
];

function parseWholeNumberInput(value: string): number | '' | null {
  if (value === '') return '';
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

function calculatedTotal(
  subtests: {
    verbal_reasoning: number | '';
    decision_making: number | '';
    quantitative_reasoning: number | '';
  },
): number | '' {
  const { verbal_reasoning, decision_making, quantitative_reasoning } = subtests;
  if (verbal_reasoning === '' || decision_making === '' || quantitative_reasoning === '') {
    return '';
  }
  return verbal_reasoning + decision_making + quantitative_reasoning;
}

export function UcatStep({ profile, updateProfile, errors }: StepProps) {
  const ucat = profile.admissions_tests.ucat;
  const totalScore = calculatedTotal(ucat.subtests);
  const applicationYear = profile.course_target.application_year;
  const testYearHint =
    typeof applicationYear === 'number'
      ? `Enter the year the UCAT was taken. For ${applicationYear} medicine entry, this will normally be ${applicationYear - 1}.`
      : 'Enter the year the UCAT was taken. UCAT is normally sat the year before medicine entry (e.g. for 2027 entry, this will normally be 2026).';

  useEffect(() => {
    if (ucat.total_score === totalScore) return;
    updateProfile((prev) => ({
      ...prev,
      admissions_tests: {
        ...prev.admissions_tests,
        ucat: { ...prev.admissions_tests.ucat, total_score: totalScore },
      },
    }));
  }, [totalScore, ucat.total_score, updateProfile]);

  const updateSubtest =
    (key: 'verbal_reasoning' | 'decision_making' | 'quantitative_reasoning') => (value: string) => {
      const parsed = parseWholeNumberInput(value);
      if (parsed === null) return;
      updateProfile((prev) => {
        const subtests = { ...prev.admissions_tests.ucat.subtests, [key]: parsed };
        return {
          ...prev,
          admissions_tests: {
            ...prev.admissions_tests,
            ucat: {
              ...prev.admissions_tests.ucat,
              subtests,
              total_score: calculatedTotal(subtests),
            },
          },
        };
      });
    };

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
            type="text"
            inputMode="numeric"
            pattern={WHOLE_NUMBER_PATTERN}
            min={UCAT_SUBTEST_MIN}
            max={UCAT_SUBTEST_MAX}
            value={ucat.subtests.verbal_reasoning}
            error={errors.verbal_reasoning}
            hint="Enter a whole number between 300 and 900."
            onChange={updateSubtest('verbal_reasoning')}
          />
          <TextField
            id="ucat_decision_making"
            label="Decision making score"
            type="text"
            inputMode="numeric"
            pattern={WHOLE_NUMBER_PATTERN}
            min={UCAT_SUBTEST_MIN}
            max={UCAT_SUBTEST_MAX}
            value={ucat.subtests.decision_making}
            error={errors.decision_making}
            hint="Enter a whole number between 300 and 900."
            onChange={updateSubtest('decision_making')}
          />
          <TextField
            id="ucat_quantitative_reasoning"
            label="Quantitative reasoning score"
            type="text"
            inputMode="numeric"
            pattern={WHOLE_NUMBER_PATTERN}
            min={UCAT_SUBTEST_MIN}
            max={UCAT_SUBTEST_MAX}
            value={ucat.subtests.quantitative_reasoning}
            error={errors.quantitative_reasoning}
            hint="Enter a whole number between 300 and 900."
            onChange={updateSubtest('quantitative_reasoning')}
          />
          {errors.subtests && (
            <p className="form-field-error" role="alert">
              {errors.subtests}
            </p>
          )}
          <TextField
            id="ucat_total_score"
            label="Total score"
            type="text"
            inputMode="numeric"
            pattern={WHOLE_NUMBER_PATTERN}
            min={UCAT_TOTAL_MIN}
            max={UCAT_TOTAL_MAX}
            value={totalScore}
            error={errors.total_score}
            hint="Calculated automatically from the three UCAT subtest scores."
            readOnly
            onChange={() => {}}
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
