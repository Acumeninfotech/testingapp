import { TextField } from '../components/TextField';
import { SelectField } from '../components/SelectField';
import type { QualificationRoute } from '../profileTypes';
import type { StepProps } from './StepProps';

const ROUTE_OPTIONS: { value: QualificationRoute; label: string }[] = [
  { value: 'a_level', label: 'A-level' },
  { value: 'scottish', label: 'Scottish qualifications (National 5 / Higher / Advanced Higher)' },
  { value: 'international_baccalaureate', label: 'International Baccalaureate (IB)' },
  { value: 'btec', label: 'BTEC' },
  { value: 'access_to_he', label: 'Access to Higher Education Diploma' },
  { value: 'graduate', label: 'Graduate-entry (I already hold a degree)' },
  { value: 'international_qualification', label: 'Other international qualification' },
];

// Course target is otherwise selected from production medicine profiles; the
// qualification route determines which academic-profile step appears next.
export function RouteStep({ profile, updateProfile, errors }: StepProps) {
  return (
    <div className="step-grid">
      <p>Select the qualification route that best matches your academic background.</p>
      <SelectField
        id="qualification_route"
        label="Qualification route"
        value={profile.course_target.qualification_route}
        options={ROUTE_OPTIONS}
        error={errors.qualification_route}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            course_target: { ...prev.course_target, qualification_route: value as QualificationRoute },
          }))
        }
      />
      <TextField
        id="application_year"
        label="Which year do you plan to start your course?"
        type="number"
        value={profile.course_target.application_year}
        error={errors.application_year}
        onChange={(value) =>
          updateProfile((prev) => ({
            ...prev,
            course_target: { ...prev.course_target, application_year: value === '' ? '' : Number(value) },
          }))
        }
      />
    </div>
  );
}
