import { useState } from 'react';
import Icon from '../common/Icon';
import { TAG_FIELDS, TAG_SOURCE, colorSlug, tagValueLabel } from '../../api/productTags';

/** Nhãn nhỏ "AI" / "Shop sửa" cạnh tên trường. */
export function SourceBadge({ source }) {
  if (!source) return null;
  const ai = source === TAG_SOURCE.AI;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${ai ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-surface-container text-on-surface-variant'}`}
      title={ai ? 'Do AI gắn, AI có thể cập nhật lại' : 'Shop đã sửa, AI không ghi đè'}
    >
      {ai ? 'AI' : 'Shop sửa'}
    </span>
  );
}

const chipClass = (on) =>
  `flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-40 ${
    on
      ? 'border-primary-container bg-primary-container text-on-primary'
      : 'border-outline-variant/60 text-on-surface-variant hover:border-primary-container hover:text-primary'
  }`;

/** Ô nhập màu tự do: Enter / dấu phẩy để thêm (lưu dạng không dấu). */
function ColorInput({ values, max, onChange }) {
  const [text, setText] = useState('');
  const add = () => {
    const slug = colorSlug(text);
    if (slug && !values.includes(slug) && (!max || values.length < max)) onChange([...values, slug]);
    setText('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((v) => (
        <span key={v} className={chipClass(true)}>
          {tagValueLabel('mau', v)}
          <button type="button" aria-label={`Bỏ màu ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
            <Icon name="close" className="text-sm" />
          </button>
        </span>
      ))}
      {(!max || values.length < max) && (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="VD: đỏ, kem rồi Enter"
          className="h-8 w-40 rounded-full border border-outline-variant/60 bg-surface-container-low px-3 text-xs text-on-surface focus:border-primary-container focus:outline-none"
        />
      )}
    </div>
  );
}

/**
 * Chọn tag theo bộ enum (api/productTags.js).
 * filter = false (sản phẩm): kiểu, gót chọn 1; màu / phong cách / dịp chọn nhiều có giới hạn.
 * filter = true (bộ lọc chủ đề): mọi trường chọn nhiều, không giới hạn (HOẶC trong trường, VÀ giữa các trường).
 * value: { [field]: string | string[] }, sources: { [field]: ai|owner } (chỉ sản phẩm).
 */
export default function TagPicker({ value, onChange, filter = false, sources = {} }) {
  const listOf = (key) => [].concat(value?.[key] ?? []);
  const set = (field, list) => {
    const next = { ...value };
    if (!list.length) delete next[field.key];
    else next[field.key] = field.multi || filter ? list : list[0];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {TAG_FIELDS.map((field) => {
        const selected = listOf(field.key);
        const multi = field.multi || filter;
        const max = filter ? null : field.max;
        return (
          <div key={field.key}>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-on-surface">
              {field.label}
              {!filter && <SourceBadge source={sources[field.key]} />}
              <span className="font-normal text-on-surface-variant">
                {multi ? (max ? `(tối đa ${max})` : '(chọn nhiều)') : '(chọn 1)'}
              </span>
            </p>
            {field.options ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(field.options).map(([v, label]) => {
                  const on = selected.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={on}
                      disabled={!on && multi && max && selected.length >= max}
                      onClick={() =>
                        set(field, on ? selected.filter((x) => x !== v) : multi ? [...selected, v] : [v])
                      }
                      className={chipClass(on)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <ColorInput values={selected} max={max} onChange={(list) => set(field, list)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
