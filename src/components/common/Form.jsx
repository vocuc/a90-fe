import { useId, useState } from 'react';
import Icon from './Icon';

function FieldMessage({ id, error, hint }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="mt-1 text-xs text-error">
        {error}
      </p>
    );
  }
  return hint ? <p className="mt-1 text-xs text-on-surface-variant">{hint}</p> : null;
}

const boxCls = (error) =>
  `flex w-full rounded-xl border bg-surface-container-low px-3.5 py-2.5 transition-all focus-within:ring-2 ${
    error
      ? 'border-error focus-within:ring-error/20'
      : 'border-outline-variant/40 focus-within:border-primary-container focus-within:ring-primary-container/20'
  }`;

const inputCls =
  'w-full border-none bg-transparent p-0 text-sm font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-0';

export function TextArea({ label, error, hint, maxLength, value, ...props }) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-on-surface">
          {label}
        </label>
        {maxLength && (
          <span className="text-[11px] text-outline">
            {value?.length ?? 0}/{maxLength}
          </span>
        )}
      </div>
      <div className={boxCls(error)}>
        <textarea
          id={id}
          value={value}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${inputCls} min-h-24 resize-y`}
          {...props}
        />
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

export function TextField({ label, icon, error, hint, type = 'text', ...inputProps }) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-on-surface">
        {label}
      </label>
      <div className={`${boxCls(error)} items-center`}>
        <Icon name={icon} className="mr-2 text-[20px] text-outline" />
        <input
          id={id}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={inputCls}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="ml-2 text-outline hover:text-on-surface"
          >
            <Icon name={reveal ? 'visibility_off' : 'visibility'} className="text-[20px]" />
          </button>
        )}
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

export function SelectField({ label, error, hint, children, ...props }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-on-surface">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-xl bg-surface-container-low text-sm font-medium text-on-surface focus:ring-2 ${
          error
            ? 'border-error focus:border-error focus:ring-error/20'
            : 'border-outline-variant/40 focus:border-primary-container focus:ring-primary-container/20'
        }`}
        {...props}
      >
        {children}
      </select>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}

export function FormAlert({ children }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-1.5 rounded-lg bg-error-container/60 px-3 py-2 text-xs text-on-error-container"
    >
      <Icon name="error" className="text-sm" />
      {children}
    </p>
  );
}

export function SubmitButton({ loading, loadingText, disabled, children, ...props }) {
  return (
    <button
      type="submit"
      {...props}
      disabled={loading || disabled}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-container text-sm font-bold text-on-primary shadow-md shadow-primary-container/25 transition-all hover:bg-primary active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
    >
      {loading ? (
        <>
          <Icon name="progress_activity" className="animate-spin text-lg" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
