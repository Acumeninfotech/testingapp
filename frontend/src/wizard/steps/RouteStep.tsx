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
        hint="UCAT is normally sat the year before entry - we'll pre-fill this on the UCAT step, and you can still edit it there."
        onChange={(value) =>
          updateProfile((prev) => {
            const applicationYear = value === '' ? '' : Number(value);
            const ucat = prev.admissions_tests.ucat;
            // Pre-fill the expected UCAT test year (entry year - 1) only
            // while the applicant hasn't set their own test year yet, so a
            // real/historic test year entered on the UCAT step is never
            // silently overwritten by changing the entry year afterwards.
            const nextTestYear =
              ucat.test_year === '' && typeof applicationYear === 'number'
                ? applicationYear - 1
                : ucat.test_year;
            return {
              ...prev,
              course_target: { ...prev.course_target, application_year: applicationYear },
              admissions_tests: {
                ...prev.admissions_tests,
                ucat: { ...ucat, test_year: nextTestYear },
              },
            };
          })
        }
      />
    </div>
  );
}
