import { TextField } from '../components/TextField';
import { SelectField } from '../components/SelectField';
import type { EnglishLanguageTest } from '../profileTypes';
import type { StepProps } from './StepProps';

// Only test types the engine can actually score are offered — several
// universities' marketing pages advertise TOEFL/Trinity ISE/etc. as
// accepted, but engine code (eligibility-evaluator.js:1213-1219,
// nottingham-a100-consumer.js:492-504) can only score IELTS Academic
// everywhere and additionally PTE Academic / Cambridge Advanced / Cambridge
// Proficiency at Nottingham. Anything else routes to manual review, so we
// don't offer it as a selectable option that implies automated scoring.
const TEST_OPTIONS: { value: EnglishLanguageTest; label: string }[] = [
  { value: 'ielts_academic', label: 'IELTS Academic' },
  { value: 'pte_academic', label: 'PTE Academic' },
  { value: 'cambridge_advanced', label: 'Cambridge English: Advanced (CAE)' },
  { value: 'cambridge_proficiency', label: 'Cambridge English: Proficiency (CPE)' },
  { value: 'exemption_claimed', label: 'I am claiming an exemption' },
];

export function EnglishLanguageStep({ profile, updateProfile, errors }: StepProps) {
  const english = profile.english_language_profile;
  const showScores = english.test && english.test !== 'exemption_claimed';

  return (
    <div className="step-grid">
      <p>
        Because your fee status is international, universities require evidence of English language proficiency.
        Only test types this tool can automatically assess are listed below; other test types will need manual
        review by the university.
      </p>
      <SelectField
        id="test"
        label="English language test"
        value={english.test}
        options={TEST_OPTIONS}
        error={errors.test}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            english_language_profile: {
              ...prev.english_language_profile,
              test: value as EnglishLanguageTest,
              exemption_claimed: value === 'exemption_claimed',
            },
          }))
        }
      />
      {showScores && (
        <>
          <TextField
            id="overall"
            label="Overall score"
            type="number"
            value={english.overall}
            error={errors.overall}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                english_language_profile: { ...prev.english_language_profile, overall: value === '' ? '' : Number(value) },
              }))
            }
          />
          <TextField
            id="reading"
            label="Reading score"
            type="number"
            value={english.reading}
            error={errors.reading}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                english_language_profile: { ...prev.english_language_profile, reading: value === '' ? '' : Number(value) },
              }))
            }
          />
          <TextField
            id="writing"
            label="Writing score"
            type="number"
            value={english.writing}
            error={errors.writing}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                english_language_profile: { ...prev.english_language_profile, writing: value === '' ? '' : Number(value) },
              }))
            }
          />
          <TextField
            id="listening"
            label="Listening score"
            type="number"
            value={english.listening}
            error={errors.listening}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                english_language_profile: { ...prev.english_language_profile, listening: value === '' ? '' : Number(value) },
              }))
            }
          />
          <TextField
            id="speaking"
            label="Speaking score"
            type="number"
            value={english.speaking}
            error={errors.speaking}
            onChange={(value) =>
              updateProfile((prev) => ({
                ...prev,
                english_language_profile: { ...prev.english_language_profile, speaking: value === '' ? '' : Number(value) },
              }))
            }
          />
        </>
      )}
    </div>
  );
}
