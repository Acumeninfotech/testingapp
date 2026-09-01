import { SelectField } from '../components/SelectField';
import { YES_NO_NOT_SURE_OPTIONS } from '../contextualRegistry';
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
  { value: 'age_18', label: '18' },
  { value: 'age_19', label: '19' },
  { value: 'age_20', label: '20' },
  { value: 'age_21_or_over', label: '21 or over' },
  { value: 'not_sure', label: 'Not sure' },
];

const LEGACY_AGE_OPTION = {
  value: 'age_18_or_over_legacy',
  label: '18 or over - legacy answer, please confirm',
} as const;

export function IdentityStep({ profile, updateProfile, errors }: StepProps) {
  const identity = profile.applicant_identity;
  const ageOptions = identity.age_at_course_start_band === 'age_18_or_over_legacy'
    ? [LEGACY_AGE_OPTION, ...AGE_AT_COURSE_START_OPTIONS]
    : AGE_AT_COURSE_START_OPTIONS;
  const ageHint = identity.age_at_course_start_band === 'age_18_or_over_legacy'
    ? 'This age answer came from an older saved profile. Please choose your exact current age band.'
    : undefined;

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
        label="Age on 1 September of your course-start year"
        value={identity.age_at_course_start_band}
        options={ageOptions}
        error={errors.age_at_course_start_band}
        hint={ageHint}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            applicant_identity: {
              ...prev.applicant_identity,
              age_at_course_start_band: value as typeof identity.age_at_course_start_band,
            },
          }))
        }
      />
      <SelectField
        id="current_uk_residence"
        label="Do you currently live in the UK?"
        value={identity.current_uk_residence}
        options={YES_NO_NOT_SURE_OPTIONS}
        error={errors.current_uk_residence}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            applicant_identity: {
              ...prev.applicant_identity,
              current_uk_residence: value as typeof identity.current_uk_residence,
            },
          }))
        }
      />
    </div>
  );
}
