import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label !== undefined && (
          <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-stone-600">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full min-h-[44px] rounded-md border px-3 py-2 text-sm transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
            error !== undefined
              ? 'border-error text-error'
              : 'border-stone-200 text-stone-900 focus:border-primary'
          } ${className}`}
          aria-invalid={error !== undefined}
          aria-describedby={
            error !== undefined
              ? `${inputId}-error`
              : helperText !== undefined
                ? `${inputId}-helper`
                : undefined
          }
          {...props}
        />
        {error !== undefined && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-error">
            {error}
          </p>
        )}
        {helperText !== undefined && error === undefined && (
          <p id={`${inputId}-helper`} className="mt-1 text-sm text-stone-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, rows = 4, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label !== undefined && (
          <label htmlFor={textareaId} className="mb-1 block text-sm font-medium text-stone-600">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`w-full rounded-md border px-3 py-2 text-sm transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
            error !== undefined
              ? 'border-error text-error'
              : 'border-stone-200 text-stone-900 focus:border-primary'
          } ${className}`}
          aria-invalid={error !== undefined}
          aria-describedby={
            error !== undefined
              ? `${textareaId}-error`
              : helperText !== undefined
                ? `${textareaId}-helper`
                : undefined
          }
          {...props}
        />
        {error !== undefined && (
          <p id={`${textareaId}-error`} className="mt-1 text-sm text-error">
            {error}
          </p>
        )}
        {helperText !== undefined && error === undefined && (
          <p id={`${textareaId}-helper`} className="mt-1 text-sm text-stone-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
