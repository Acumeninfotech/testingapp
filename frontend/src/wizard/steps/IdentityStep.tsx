import { SelectField } from '../components/SelectField';
import type { StepProps } from './StepProps';

const APPLICANT_TYPE_OPTIONS = [
  { value: 'school_leaver', label: 'Standard Entry' },
  { value: 'mature_standard', label: 'Mature applicant (non-graduate)', disabled: true },
  { value: 'mature_graduate', label: 'Graduate applicant', disabled: true },
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

const AGE_AT_COURSE_START_OPTIONS = [
  { value: 'under_17', label: 'Under 17' },
  { value: 'age_17', label: '17' },
  { value: 'age_18_or_over', label: '18 or over' },
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
      <SelectField
        id="age_at_course_start_band"
        label="Age when starting university"
        value={identity.age_at_course_start_band}
        options={AGE_AT_COURSE_START_OPTIONS}
        error={errors.age_at_course_start_band}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            applicant_identity: {
              ...prev.applicant_identity,
              age_at_course_start_band: value as typeof identity.age_at_course_start_band,
              date_of_birth: '',
            },
          }))
        }
      />
    </div>
  );
}
