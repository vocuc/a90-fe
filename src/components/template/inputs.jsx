import { useId } from 'react';

// Ô nhập gọn cho Template Builder
export const inputCls =
  'w-full rounded-lg border bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 disabled:opacity-60';
export const borderCls = (error) =>
  error
    ? 'border-error focus:border-error focus:ring-error/20'
    : 'border-outline-variant/40 focus:border-primary-container focus:ring-primary-container/20';

export function Field({ label, error, hint, children, id }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1 block text-xs font-semibold text-on-surface">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-error">{error}</p>
      ) : (
        hint && <p className="mt-1 text-[11px] text-on-surface-variant">{hint}</p>
      )}
    </div>
  );
}

export function Input({ label, error, hint, className = '', ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <input id={id} aria-invalid={!!error} className={`${inputCls} ${borderCls(error)} ${className}`} {...props} />
    </Field>
  );
}

export function Select({ label, error, hint, children, ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      <select id={id} aria-invalid={!!error} className={`${inputCls} ${borderCls(error)} pr-8`} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function Switch({ label, checked, onChange, disabled, hint }) {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span>
        <span className="block text-xs font-semibold text-on-surface">{label}</span>
        {hint && <span className="block text-[11px] text-on-surface-variant">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={!!checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-10 rounded-full bg-outline-variant transition-colors peer-checked:bg-primary-container peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container/40" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

// Nhập số; để trống -> null
export const numberOrNull = (v) => (v === '' || v == null ? null : Number(v));
