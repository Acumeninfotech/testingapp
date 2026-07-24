import { useMemo, useState } from 'react';
import { submitPrediction } from '../api/client';
import type { PredictionResult } from '../api/types';
import { ResultCard } from '../components/ResultCard';
import { WizardShell } from '../wizard/components/WizardShell';
import { getWizardSteps } from '../wizard/steps';
import { toStudentProfile } from '../wizard/toStudentProfile';
import { useWizardProfile } from '../wizard/useWizardProfile';
import { hasErrors, type ValidationErrors } from '../wizard/validation';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

export function WizardPage() {
  const { profile, updateProfile, resetProfile } = useWizardProfile();
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [results, setResults] = useState<PredictionResult[]>([]);

  // Recomputed from the current profile so switching qualification route or
  // fee status immediately updates which steps are shown.
  const wizardSteps = useMemo(() => getWizardSteps(profile), [profile]);
  const clampedStepIndex = Math.min(stepIndex, wizardSteps.length - 1);
  const step = wizardSteps[clampedStepIndex];
  const isLastStep = clampedStepIndex === wizardSteps.length - 1;
  const StepComponent = useMemo(() => step.Component, [step]);

  const goNext = () => {
    const stepErrors = step.validate(profile);
    if (hasErrors(stepErrors)) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    if (isLastStep) {
      submit();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, wizardSteps.length - 1));
  };

  const goBack = () => {
    setErrors({});
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const submit = () => {
    setSubmitState('loading');
    submitPrediction({
      universityIds: profile.university_ids,
      studentProfile: toStudentProfile(profile),
    })
      .then((data) => {
        setResults(data.results);
        setSubmitState('success');
      })
      .catch(() => {
        setSubmitState('error');
      });
  };

  const startOver = () => {
    resetProfile();
    setStepIndex(0);
    setErrors({});
    setSubmitState('idle');
    setResults([]);
  };

  if (submitState === 'success') {
    return (
      <section>
        <div className="page-header">
          <h1>Your results</h1>
          <p>
            Here&rsquo;s how your profile compares against each university you selected. Results
            marked for review aren&rsquo;t a rejection &mdash; they mean an adviser needs to check
            something ApplySmart can&rsquo;t confirm automatically.
          </p>
        </div>
        <div className="result-card-list" data-testid="result-card-list">
          {results.map((result) => (
            <ResultCard key={result.universityId} result={result} />
          ))}
        </div>
        <div className="results-actions">
          <button type="button" className="btn" onClick={startOver}>
            Start a new profile
          </button>
        </div>
      </section>
    );
  }

  return (
    <WizardShell
      stepIndex={clampedStepIndex}
      stepCount={wizardSteps.length}
      title={step.title}
      onBack={clampedStepIndex > 0 ? goBack : undefined}
      onNext={goNext}
      nextLabel={isLastStep ? 'Submit for prediction' : 'Continue'}
      nextDisabled={submitState === 'loading'}
    >
      {submitState === 'error' && (
        <p className="wizard-error-banner" role="alert">
          Could not run the prediction. Is the API running? You can try submitting again.
        </p>
      )}
      <StepComponent profile={profile} updateProfile={updateProfile} errors={errors} />
    </WizardShell>
  );
}
