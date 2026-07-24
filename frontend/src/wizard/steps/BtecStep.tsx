import { TextField } from '../components/TextField';
import { SelectField } from '../components/SelectField';
import type { StepProps } from './StepProps';

const SUBJECT_OPTIONS = [
  { value: 'applied_science', label: 'Applied Science' },
  { value: 'science', label: 'Science' },
  { value: 'health_and_social_care', label: 'Health and Social Care' },
  { value: 'other', label: 'Other' },
];

// The engine reads one opaque overall grade string (e.g. "D*D*D*") rather
// than unit-level grades — see eligibility-evaluator.js:664-715. Most
// universities in the readiness bundle currently reject or cannot automate
// this route; the wizard still collects it accurately and lets the engine's
// own admissions rules decide the outcome.
export function BtecStep({ profile, updateProfile, errors }: StepProps) {
  const { qualification, grade, subject_id } = profile.btec_profile;

  return (
    <div className="step-grid">
      <p>Enter your BTEC qualification title and overall grade.</p>
      <p className="step-note">
        Most universities in this tool cannot yet automatically assess the BTEC route, so your
        result may show as requiring manual review rather than a firm prediction.
      </p>
      <TextField
        id="qualification"
        label="BTEC qualification title"
        value={qualification}
        error={errors.qualification}
        hint="e.g. BTEC Extended Diploma"
        onChange={(value) =>
          updateProfile((prev) => ({ ...prev, btec_profile: { ...prev.btec_profile, qualification: value } }))
        }
      />
      <TextField
        id="grade"
        label="Overall grade"
        value={grade}
        error={errors.grade}
        hint="e.g. D*D*D*"
        onChange={(value) => updateProfile((prev) => ({ ...prev, btec_profile: { ...prev.btec_profile, grade: value } }))}
      />
      <SelectField
        id="subject_id"
        label="Subject area"
        value={subject_id}
        options={SUBJECT_OPTIONS}
        onChange={(value) =>
          updateProfile((prev) => ({ ...prev, btec_profile: { ...prev.btec_profile, subject_id: value } }))
        }
      />
    </div>
  );
}
