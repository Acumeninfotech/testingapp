import { TextField } from '../components/TextField';
import { SelectField } from '../components/SelectField';
import { CheckboxField } from '../components/CheckboxField';
import type { StepProps } from './StepProps';

const STATUS_OPTIONS = [
  { value: 'verified', label: 'Verified by a UK institution' },
  { value: 'pending', label: 'Verification pending' },
];

// The engine treats non-UK-school qualifications as a verification gate,
// not a computed equivalence — see eligibility-evaluator.js:1023-1104. This
// route relies on external verification, so most outcomes here will be
// manual_review unless equivalence_status is already 'verified'.
export function InternationalStep({ profile, updateProfile, errors }: StepProps) {
  const international = profile.international_qualification;

  return (
    <div className="step-grid">
      <p>Tell us about your international qualification. Verification status affects how it can be assessed.</p>
      <TextField
        id="name"
        label="Qualification name"
        value={international.name}
        error={errors.name}
        hint="e.g. Abitur, French Baccalauréat, American High School Diploma"
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            international_qualification: { ...prev.international_qualification, name: value },
          }))
        }
      />
      <SelectField
        id="equivalence_status"
        label="UK equivalence verification status"
        value={international.equivalence_status}
        options={STATUS_OPTIONS}
        error={errors.equivalence_status}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            international_qualification: {
              ...prev.international_qualification,
              equivalence_status: value as typeof international.equivalence_status,
            },
          }))
        }
      />
      <CheckboxField
        id="verified_by_institution"
        label="My qualification's UK equivalence has been verified by the institution I am applying to"
        checked={international.verified_by_institution}
        onChange={(checked) =>
          updateProfile((prev) => ({
            ...prev,
            international_qualification: { ...prev.international_qualification, verified_by_institution: checked },
          }))
        }
      />
      <CheckboxField
        id="requirements_met"
        label="I meet the equivalent grade requirements for this course"
        checked={international.requirements_met}
        onChange={(checked) =>
          updateProfile((prev) => ({
            ...prev,
            international_qualification: { ...prev.international_qualification, requirements_met: checked },
          }))
        }
      />
    </div>
  );
}
