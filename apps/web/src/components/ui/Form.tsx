import clsx from 'clsx';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';

export const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 text-body-md text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-500';

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-label-lg text-slate-700">
        {label}
        {required ? <span className="text-error"> *</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-body-sm text-on-surface-variant">{hint}</p> : null}
      {error ? (
        <p className="mt-1 flex items-start gap-1 text-body-sm text-red-700" role="alert">
          <Icon name="error" className="mt-px text-[14px]" filled />
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  wrapperClassName?: string;
}

export function TextInput({ label, error, hint, required, wrapperClassName, className, id, ...rest }: TextInputProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FormField label={label} htmlFor={fid} error={error} hint={hint} required={required} className={wrapperClassName}>
      <input id={fid} required={false} aria-required={required} aria-invalid={!!error} className={clsx(inputClass, 'h-9', error && 'border-red-500', className)} {...rest} />
    </FormField>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  wrapperClassName?: string;
}

export function SelectField({ label, error, hint, required, wrapperClassName, className, id, children, ...rest }: SelectFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FormField label={label} htmlFor={fid} error={error} hint={hint} required={required} className={wrapperClassName}>
      <select id={fid} aria-invalid={!!error} className={clsx(inputClass, 'h-9', error && 'border-red-500', className)} {...rest}>
        {children}
      </select>
    </FormField>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  wrapperClassName?: string;
}

export function TextAreaField({ label, error, hint, required, wrapperClassName, className, id, ...rest }: TextAreaFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FormField label={label} htmlFor={fid} error={error} hint={hint} required={required} className={wrapperClassName}>
      <textarea id={fid} aria-invalid={!!error} rows={3} className={clsx(inputClass, 'py-2', error && 'border-red-500', className)} {...rest} />
    </FormField>
  );
}
