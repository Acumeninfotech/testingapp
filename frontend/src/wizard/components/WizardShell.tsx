import type { ReactNode } from 'react';

interface WizardShellProps {
  stepIndex: number;
  stepCount: number;
  title: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

function WizardNav({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  variant,
}: Pick<WizardShellProps, 'onBack' | 'onNext' | 'nextLabel' | 'nextDisabled'> & {
  variant: 'top' | 'bottom';
}) {
  return (
    <div className={`wizard-nav wizard-nav--${variant}`}>
      {onBack ? (
        <button type="button" onClick={onBack} className="btn btn-secondary wizard-nav-back">
          Back
        </button>
      ) : (
        <span />
      )}
      {onNext && (
        <button type="button" onClick={onNext} disabled={nextDisabled} className="btn">
          {nextLabel}
        </button>
      )}
    </div>
  );
}

export function WizardShell({
  stepIndex,
  stepCount,
  title,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
}: WizardShellProps) {
  return (
    <section className="wizard-shell">
      <p className="wizard-progress" data-testid="wizard-progress">
        Step {stepIndex + 1} of {stepCount}
      </p>
      <div className="wizard-progress-bar">
        <div
          className="wizard-progress-bar-fill"
          style={{ width: `${((stepIndex + 1) / stepCount) * 100}%` }}
        />
      </div>
      <h1>{title}</h1>
      <WizardNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={nextLabel}
        nextDisabled={nextDisabled}
        variant="top"
      />
      <div className="wizard-step-body">{children}</div>
      <WizardNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={nextLabel}
        nextDisabled={nextDisabled}
        variant="bottom"
      />
    </section>
  );
}
