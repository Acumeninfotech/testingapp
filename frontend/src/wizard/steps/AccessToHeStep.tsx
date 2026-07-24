import { CheckboxField } from '../components/CheckboxField';
import type { StepProps } from './StepProps';

// The engine models Access to HE as two manual-attestation booleans, not a
// computed credit count — see eligibility-evaluator.js:1023-1036. Only
// universities with a verified provider-gate status can automate this
// route today; elsewhere it routes to manual review.
export function AccessToHeStep({ profile, updateProfile, errors }: StepProps) {
  const { provider_approved_by_institution, requirements_met } = profile.access_to_he_profile;

  return (
    <div className="step-grid">
      <p>Confirm the following about your Access to Higher Education Diploma.</p>
      <p className="step-note">
        Not all universities in this tool can automatically assess this route yet, so your result
        may show as requiring manual review rather than a firm prediction.
      </p>
      <CheckboxField
        id="provider_approved_by_institution"
        label="My Access to HE provider is approved by the institution(s) I am applying to"
        checked={provider_approved_by_institution}
        onChange={(checked) =>
          updateProfile((prev) => ({
            ...prev,
            access_to_he_profile: { ...prev.access_to_he_profile, provider_approved_by_institution: checked },
          }))
        }
      />
      {errors.provider_approved_by_institution && (
        <p className="form-field-error" role="alert">
          {errors.provider_approved_by_institution}
        </p>
      )}
      <CheckboxField
        id="requirements_met"
        label="I meet (or am predicted to meet) the diploma credit requirements for this course"
        checked={requirements_met}
        onChange={(checked) =>
          updateProfile((prev) => ({
            ...prev,
            access_to_he_profile: { ...prev.access_to_he_profile, requirements_met: checked },
          }))
        }
      />
      {errors.requirements_met && (
        <p className="form-field-error" role="alert">
          {errors.requirements_met}
        </p>
      )}
    </div>
  );
}
