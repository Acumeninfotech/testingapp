import { CheckboxField } from '../components/CheckboxField';
import type { StepProps } from './StepProps';

const FLAG_LABELS: { key: keyof StepProps['profile']['applicant_identity']['contextual_flags']; label: string }[] = [
  { key: 'care_experienced', label: 'I am care experienced' },
  { key: 'refugee_or_asylum_seeker', label: 'I am a refugee or asylum seeker' },
  { key: 'free_school_meals', label: 'I was eligible for free school meals' },
  { key: 'first_generation_higher_education', label: 'I am the first in my family to attend higher education' },
  { key: 'school_contextual_indicator', label: 'My school/college is flagged as a contextual indicator' },
  { key: 'ucat_bursary', label: 'I received a UCAT bursary' },
];

export function ContextualStep({ profile, updateProfile }: StepProps) {
  const identity = profile.applicant_identity;

  return (
    <div className="step-grid">
      <p>
        This information helps universities assess your application in context. All fields on this step are
        optional — only answer what applies to you.
      </p>
      <CheckboxField
        id="contextual"
        label="I consider myself a contextual or widening participation applicant"
        checked={identity.contextual}
        onChange={(checked) =>
          updateProfile((prev) => ({
            ...prev,
            applicant_identity: { ...prev.applicant_identity, contextual: checked },
          }))
        }
      />
      {identity.contextual && (
        <div className="checkbox-group">
          {FLAG_LABELS.map(({ key, label }) => (
            <CheckboxField
              key={key}
              id={`flag_${key}`}
              label={label}
              checked={identity.contextual_flags[key]}
              onChange={(checked) =>
                updateProfile((prev) => ({
                  ...prev,
                  applicant_identity: {
                    ...prev.applicant_identity,
                    contextual_flags: { ...prev.applicant_identity.contextual_flags, [key]: checked },
                  },
                }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
