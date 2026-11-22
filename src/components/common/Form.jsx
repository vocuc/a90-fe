import { useId, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { MAINTENANCE_MESSAGE } from '../../api/client';

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

/** Textarea 1 dòng tự giãn chiều cao theo nội dung, chặn xuống dòng (dùng cho tiêu đề dài). */
function AutoGrowInput({ value, onChange, onKeyDown, className, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={`${className} resize-none overflow-hidden`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
        onKeyDown?.(e);
      }}
      onChange={(e) => {
        if (/[\r\n]/.test(e.target.value)) e.target.value = e.target.value.replace(/[\r\n]+/g, ' ');
        onChange?.(e);
      }}
      {...props}
    />
  );
}

/*
 * Chọn giờ 24h (thay <input type="time|datetime-local">: trình duyệt / máy đặt locale Mỹ hiện AM/PM).
 * Giá trị giữ đúng định dạng input gốc: time "HH:mm", datetime-local "YYYY-MM-DDTHH:mm".
 * onChange nhận { target: { value, name } } như sự kiện input thường.
 */
const pad2 = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const selectCls = 'cursor-pointer appearance-none border-none bg-transparent p-0 pr-0.5 text-sm font-medium text-on-surface focus:outline-none focus:ring-0 disabled:cursor-not-allowed';

function HourMinute({ id, value, onPick, disabled, labelPrefix = '' }) {
  const [h = '', m = ''] = (value || '').split(':');
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums">
      <select id={id} value={h} disabled={disabled} aria-label={`${labelPrefix}Giờ`} className={selectCls}
        style={{ backgroundImage: 'none' }} onChange={(e) => onPick(`${e.target.value}:${m || '00'}`)}>
        {!h && <option value="">--</option>}
        {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <span className="text-sm text-outline">:</span>
      <select value={m} disabled={disabled} aria-label={`${labelPrefix}Phút`} className={selectCls}
        style={{ backgroundImage: 'none' }} onChange={(e) => onPick(`${h || '00'}:${e.target.value}`)}>
        {!m && <option value="">--</option>}
        {MINUTES.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </span>
  );
}

/** Ô giờ 24h "HH:mm" (thay <input type="time">). */
export function TimeInput24({ value, onChange, name, disabled, className = '', 'aria-label': ariaLabel, id }) {
  return (
    <span className={`inline-flex items-center rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 ${className}`}>
      <HourMinute id={id} value={value} disabled={disabled} labelPrefix={ariaLabel ? `${ariaLabel} - ` : ''}
        onPick={(v) => onChange?.({ target: { value: v, name } })} />
    </span>
  );
}

/** Ngày + giờ 24h "YYYY-MM-DDTHH:mm" (thay <input type="datetime-local">), ngày dùng <input type="date">. */
function DateTimeInput24({ id, value, onChange, name, disabled, min, max, className, ...rest }) {
  const [date = '', time = ''] = (value || '').split('T');
  const emit = (d, t) => onChange?.({ target: { value: d ? `${d}T${t || '00:00'}` : '', name } });
  return (
    <span className="flex w-full items-center gap-2">
      <input id={id} type="date" value={date} disabled={disabled} name={name} className={`${className} min-w-0 flex-1`}
        min={min?.split('T')[0]} max={max?.split('T')[0]} onChange={(e) => emit(e.target.value, time)} {...rest} />
      <HourMinute value={time} disabled={disabled} onPick={(t) => emit(date || todayStr(), t)} />
    </span>
  );
}

export function TextField({ label, icon, error, hint, type = 'text', multiline = false, ...inputProps }) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-on-surface">
        {label}
      </label>
      <div className={`${boxCls(error)} ${multiline ? 'items-start' : 'items-center'}`}>
        <Icon name={icon} className="mr-2 text-[20px] text-outline" />
        {multiline ? (
          <AutoGrowInput
            id={id}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className={inputCls}
            {...inputProps}
          />
        ) : type === 'datetime-local' ? (
          <DateTimeInput24
            id={id}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className={inputCls}
            {...inputProps}
          />
        ) : type === 'time' ? (
          <HourMinute id={id} value={inputProps.value} disabled={inputProps.disabled}
            onPick={(v) => inputProps.onChange?.({ target: { value: v, name: inputProps.name } })} />
        ) : (
          <input
            id={id}
            type={isPassword && reveal ? 'text' : type}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className={inputCls}
            {...inputProps}
          />
        )}
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

// Thông báo bảo trì (không gọi được API) hiện màu xanh nhạt thay vì đỏ
export function FormAlert({ children }) {
  const maintenance = children === MAINTENANCE_MESSAGE;
  return (
    <p
      role="alert"
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs ${
        maintenance ? 'bg-emerald-50 text-emerald-800' : 'bg-error-container/60 text-on-error-container'
      }`}
    >
      <Icon name={maintenance ? 'construction' : 'error'} className="text-sm" />
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
