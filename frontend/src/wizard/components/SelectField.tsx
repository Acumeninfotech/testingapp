import { FormField } from './FormField';

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
}

export function SelectField({ id, label, value, options, onChange, error, hint, placeholder }: SelectFieldProps) {
  return (
    <FormField label={label} htmlFor={id} error={error} hint={hint}>
      <select
        id={id}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder ?? 'Select…'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
