import { useEffect, useRef, useState } from 'react';
import Icon from '../common/Icon';
import { borderCls, inputCls } from './inputs';
import { ASPECT_RATIOS, MIME_LABEL, hasOptions, isFieldVisible, isImageType } from './templateSchema';

/*
 * Dynamic Form Renderer (§4): render form người mua từ Template schema.
 * values: { [key]: value }; trường ảnh lưu File[], image_set lưu { [slotKey]: File[] }.
 */

export const initialValues = (fields) =>
  Object.fromEntries(
    fields.map((f) => {
      if (f.type === 'image_set') return [f.key, {}];
      if (isImageType(f.type)) return [f.key, []];
      if (f.type === 'multi_select') return [f.key, Array.isArray(f.default_value) ? f.default_value : []];
      if (f.type === 'toggle') return [f.key, !!f.default_value];
      return [f.key, f.default_value ?? ''];
    }),
  );

const checkFiles = (files, v, { required, min, max }) => {
  if (required && !files.length) return 'Vui lòng tải ảnh lên.';
  if (min && files.length && files.length < min) return `Cần ít nhất ${min} ảnh.`;
  if (max && files.length > max) return `Tối đa ${max} ảnh.`;
  if (files.some((f) => v.allowed_types?.length && !v.allowed_types.includes(f.type)))
    return `Chỉ nhận ${v.allowed_types.map((m) => MIME_LABEL[m] ?? m).join(', ')}.`;
  if (files.some((f) => v.max_size_mb && f.size > v.max_size_mb * 1024 * 1024)) return `Mỗi ảnh tối đa ${v.max_size_mb}MB.`;
  return null;
};

/** Validate giống backend sẽ làm: chỉ trường đang hiện mới bị kiểm tra. Trả { [key | key.slot]: msg }. */
export function validateValues(fields, values) {
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const errors = {};
  fields.forEach((f) => {
    if (!isFieldVisible(f, values, byKey)) return;
    const v = f.validation ?? {};
    const value = values[f.key];
    let msg = null;
    if (f.type === 'image') msg = checkFiles(value ?? [], v, { required: f.required, max: 1 });
    else if (f.type === 'image_list')
      msg = checkFiles(value ?? [], v, { required: f.required, min: v.min_files, max: v.max_files });
    else if (f.type === 'image_set') {
      f.slots.forEach((s) => {
        const m = checkFiles(value?.[s.key] ?? [], v, { required: s.required, max: 1 });
        if (m) errors[`${f.key}.${s.key}`] = m;
      });
    } else if (f.type === 'multi_select') {
      const n = value?.length ?? 0;
      if (f.required && !n) msg = 'Vui lòng chọn ít nhất 1 phương án.';
      else if (v.min_selected && n && n < v.min_selected) msg = `Chọn ít nhất ${v.min_selected} phương án.`;
      else if (v.max_selected && n > v.max_selected) msg = `Chọn tối đa ${v.max_selected} phương án.`;
    } else if (f.type === 'number') {
      if (value === '' || value == null) msg = f.required ? 'Vui lòng nhập số.' : null;
      else if (Number.isNaN(Number(value))) msg = 'Giá trị không hợp lệ.';
      else if (v.min != null && Number(value) < v.min) msg = `Nhỏ nhất là ${v.min}.`;
      else if (v.max != null && Number(value) > v.max) msg = `Lớn nhất là ${v.max}.`;
    } else if (f.type !== 'toggle') {
      const s = String(value ?? '').trim();
      if (f.required && !s) msg = hasOptions(f.type) ? 'Vui lòng chọn một phương án.' : 'Vui lòng nhập thông tin.';
      else if (v.max_length && s.length > v.max_length) msg = `Tối đa ${v.max_length} ký tự.`;
    }
    if (msg) errors[f.key] = msg;
  });
  return errors;
}

function Thumb({ file, onRemove, label }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-surface-container">
      {url && <img src={url} alt={label} className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Xoá ${label}`}
        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface hover:text-error"
      >
        <Icon name="close" className="text-sm" />
      </button>
    </div>
  );
}

function ImageInput({ files, onChange, max, validation, label, error }) {
  const ref = useRef(null);
  const accept = validation?.allowed_types?.join(',') || 'image/*';
  const pick = (e) => {
    const picked = [...(e.target.files ?? [])];
    e.target.value = '';
    onChange(max === 1 ? picked.slice(0, 1) : [...files, ...picked]);
  };
  const types = validation?.allowed_types?.map((m) => MIME_LABEL[m] ?? m).join(', ');

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {files.map((file, i) => (
          <Thumb key={`${file.name}-${file.lastModified}-${i}`} file={file} label={`${label} ${i + 1}`} onRemove={() => onChange(files.filter((_, idx) => idx !== i))} />
        ))}
        {(!max || files.length < max) && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-on-surface-variant hover:border-primary-container hover:text-primary ${
              error ? 'border-error' : 'border-outline-variant'
            }`}
          >
            <Icon name="add_photo_alternate" className="text-2xl" />
            <span className="text-[10px] font-semibold">Tải ảnh</span>
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept={accept} multiple={max !== 1} hidden onChange={pick} />
      <p className="mt-1 text-[11px] text-on-surface-variant">
        {max && max > 1 ? `${files.length}/${max} ảnh · ` : ''}
        {types}
        {validation?.max_size_mb ? ` · tối đa ${validation.max_size_mb}MB/ảnh` : ''}
      </p>
    </div>
  );
}

function FieldControl({ field: f, value, onChange, errors, aspectRatios = ASPECT_RATIOS }) {
  const v = f.validation ?? {};
  const error = errors[f.key];
  const id = `df-${f.key}`;

  switch (f.type) {
    case 'image':
      return <ImageInput files={value ?? []} onChange={onChange} max={1} validation={v} label={f.label} error={error} />;
    case 'image_list':
      return <ImageInput files={value ?? []} onChange={onChange} max={v.max_files} validation={v} label={f.label} error={error} />;
    case 'image_set':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {f.slots.map((s) => (
            <div key={s.key} className="rounded-lg bg-surface-container-low p-2">
              <p className="mb-1.5 text-xs font-semibold text-on-surface">
                {s.label} {s.required && <span className="text-error">*</span>}
              </p>
              <ImageInput
                files={value?.[s.key] ?? []}
                onChange={(files) => onChange({ ...value, [s.key]: files })}
                max={1}
                validation={v}
                label={s.label}
                error={errors[`${f.key}.${s.key}`]}
              />
              {errors[`${f.key}.${s.key}`] && <p className="mt-1 text-xs text-error">{errors[`${f.key}.${s.key}`]}</p>}
            </div>
          ))}
        </div>
      );
    case 'textarea':
      return (
        <textarea
          id={id}
          rows={4}
          value={value ?? ''}
          maxLength={v.max_length || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} ${borderCls(error)} resize-y`}
        />
      );
    case 'text':
    case 'number':
      return (
        <input
          id={id}
          type={f.type === 'number' ? 'number' : 'text'}
          value={value ?? ''}
          min={v.min ?? undefined}
          max={v.max ?? undefined}
          step={v.step ?? undefined}
          maxLength={v.max_length || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} ${borderCls(error)}`}
        />
      );
    case 'select':
      return (
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${borderCls(error)}`}>
          <option value="">Chọn...</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'radio':
    case 'multi_select': {
      const multi = f.type === 'multi_select';
      const selected = (o) => (multi ? (value ?? []).includes(o.value) : value === o.value);
      const toggle = (o) =>
        onChange(multi ? (selected(o) ? value.filter((x) => x !== o.value) : [...(value ?? []), o.value]) : o.value);
      return (
        <div className="flex flex-wrap gap-2">
          {f.options.map((o) => (
            <button
              key={o.value}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={selected(o)}
              onClick={() => toggle(o)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                selected(o)
                  ? 'border-primary-container bg-primary-fixed/50 text-primary'
                  : 'border-outline-variant/50 text-on-surface hover:border-primary-container'
              }`}
            >
              <Icon
                name={multi ? (selected(o) ? 'check_box' : 'check_box_outline_blank') : selected(o) ? 'radio_button_checked' : 'radio_button_unchecked'}
                className="text-base"
              />
              {o.label}
            </button>
          ))}
        </div>
      );
    }
    case 'aspect_ratio':
      return (
        // Creator chỉ đặt tỉ lệ mặc định, người mua được đổi sang mọi tỉ lệ
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {aspectRatios.map((r) => ({ value: r, label: r })).map((o) => {
            const [w, h] = o.value.split(':').map(Number);
            const scale = 18 / Math.max(w, h);
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={value === o.value}
                onClick={() => onChange(o.value)}
                className={`flex min-w-16 flex-col items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  value === o.value
                    ? 'border-primary-container bg-primary-fixed/50 text-primary'
                    : 'border-outline-variant/50 text-on-surface hover:border-primary-container'
                }`}
              >
                {/* Khung minh hoạ đúng tỉ lệ */}
                <span className="flex size-5 items-center justify-center">
                  <span className="rounded-sm border-2 border-current" style={{ width: w * scale, height: h * scale }} />
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      );
    case 'toggle':
      return (
        <button
          type="button"
          role="switch"
          aria-checked={!!value}
          onClick={() => onChange(!value)}
          className={`relative h-6 w-10 rounded-full transition-colors ${value ? 'bg-primary-container' : 'bg-outline-variant'}`}
        >
          <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
        </button>
      );
    default:
      return null;
  }
}

/** aspectRatios: tỉ lệ người mua được chọn (theo model của Creative); không truyền thì dùng danh sách chung. */
export default function DynamicForm({ fields, values, onChange, errors = {}, aspectRatios }) {
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const visible = fields.filter((f) => isFieldVisible(f, values, byKey));

  if (!visible.length) {
    return <p className="py-6 text-center text-xs text-on-surface-variant">Form chưa có trường nào đang hiển thị.</p>;
  }

  return (
    <div className="space-y-4">
      {visible.map((f) => (
        <div key={f._id ?? f.key} className={f.type === 'toggle' ? 'flex items-center justify-between gap-3' : ''}>
          <div className={f.type === 'toggle' ? '' : 'mb-1.5'}>
            <label htmlFor={`df-${f.key}`} className="text-sm font-semibold text-on-surface">
              {f.label}
              {f.required && f.type !== 'image_set' && f.type !== 'toggle' && <span className="text-error"> *</span>}
            </label>
            {f.description && <p className="text-[11px] text-on-surface-variant">{f.description}</p>}
          </div>
          <FieldControl
            field={f}
            value={values[f.key]}
            onChange={(v) => onChange(f.key, v)}
            errors={errors}
            aspectRatios={aspectRatios}
          />
          {errors[f.key] && <p className="mt-1 text-xs text-error">{errors[f.key]}</p>}
        </div>
      ))}
    </div>
  );
}
