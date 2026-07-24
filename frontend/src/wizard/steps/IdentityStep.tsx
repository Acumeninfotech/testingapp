import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import type { StepProps } from './StepProps';

const APPLICANT_TYPE_OPTIONS = [
  { value: 'school_leaver', label: 'School or college leaver' },
  { value: 'mature_standard', label: 'Mature applicant (non-graduate)' },
  { value: 'mature_graduate', label: 'Graduate applicant' },
];

const FEE_STATUS_OPTIONS = [
  { value: 'home', label: 'Home (UK)' },
  { value: 'rest_of_uk', label: 'Rest of UK / ROI' },
  { value: 'international', label: 'International' },
];

const DOMICILE_OPTIONS = [
  { value: 'england', label: 'England' },
  { value: 'scotland', label: 'Scotland' },
  { value: 'wales', label: 'Wales' },
  { value: 'northern_ireland', label: 'Northern Ireland' },
  { value: 'other', label: 'Other / outside the UK' },
];

export function IdentityStep({ profile, updateProfile, errors }: StepProps) {
  const identity = profile.applicant_identity;

  return (
    <div className="step-grid">
      <SelectField
        id="applicant_type"
        label="Which best describes you?"
        value={identity.applicant_type}
        options={APPLICANT_TYPE_OPTIONS}
        error={errors.applicant_type}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            applicant_identity: {
              ...prev.applicant_identity,
              applicant_type: value as typeof identity.applicant_type,
              graduate: value === 'mature_graduate',
            },
          }))
        }
      />
      <SelectField
        id="fee_status"
        label="Fee status"
        value={identity.fee_status}
        options={FEE_STATUS_OPTIONS}
        error={errors.fee_status}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            applicant_identity: { ...prev.applicant_identity, fee_status: value as typeof identity.fee_status },
          }))
        }
      />
      <SelectField
        id="domicile"
        label="Domicile"
        value={identity.domicile}
        options={DOMICILE_OPTIONS}
        error={errors.domicile}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            applicant_identity: { ...prev.applicant_identity, domicile: value as typeof identity.domicile },
          }))
        }
      />
      <TextField
        id="date_of_birth"
        label="Date of birth"
        type="date"
        value={identity.date_of_birth}
        error={errors.date_of_birth}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            applicant_identity: { ...prev.applicant_identity, date_of_birth: value },
          }))
        }
      />
    </div>
  );
}
