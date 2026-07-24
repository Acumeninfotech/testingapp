import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, hint, children }: FormFieldProps) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {hint && <p className="form-field-hint">{hint}</p>}
      {children}
      {error && (
        <p className="form-field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
