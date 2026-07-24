import type { WizardProfile } from '../profileTypes';
import type { ValidationErrors } from '../validation';

export interface StepProps {
  profile: WizardProfile;
  updateProfile: (updater: (prev: WizardProfile) => WizardProfile) => void;
  errors: ValidationErrors;
}
