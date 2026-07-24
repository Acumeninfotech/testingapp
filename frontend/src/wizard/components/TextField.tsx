import { FormField } from './FormField';

interface TextFieldProps {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: 'text' | 'number' | 'date';
  min?: number;
  max?: number;
}

export function TextField({ id, label, value, onChange, error, hint, type = 'text', min, max }: TextFieldProps) {
  return (
    <FormField label={label} htmlFor={id} error={error} hint={hint}>
      <input
        id={id}
        type={type}
        value={value}
        min={min}
        max={max}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}
