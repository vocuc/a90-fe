import { useEffect, useRef, useState } from 'react';
import Icon from '../common/Icon';
import { Switch, borderCls, inputCls } from './inputs';
import { ASPECT_RATIOS, FIELD_TYPES, MAX_FIELDS, hasOptions, isImageType } from './templateSchema';

/*
 * Khung kéo thả: kéo thành phần từ thanh công cụ vào form, mỗi ô nhập trực tiếp key, label (và option nếu là select).
 * Trên điện thoại không kéo thả được -> bấm vào thành phần để thêm xuống cuối.
 */

const PALETTE = ['image'];
const TYPE_MIME = 'application/x-ai90-field-type';
const MOVE_MIME = 'application/x-ai90-field-id';

// Chữ có dấu -> key: chữ thường không dấu, nối bằng _
export const toKey = (v) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);

// Đang gõ tay ô Tên trường: giữ dấu _ (hoặc cách, -) vừa gõ ở cuối để gõ tiếp được anh_san_pham
const typedKey = (v) => {
  const key = toKey(v);
  return key && /[\s_-]$/.test(v) ? `${key}_`.slice(0, 50) : key;
};

function Palette({ onAdd, disabled, fields }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((type) => {
        const t = FIELD_TYPES[type];
        const off = disabled;
        return (
          <button
            key={type}
            type="button"
            draggable={!off}
            onDragStart={(e) => {
              e.dataTransfer.setData(TYPE_MIME, type);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => onAdd(type)}
            disabled={off}
            title={`${t.hint} — kéo vào form hoặc bấm để thêm`}
            className="flex cursor-grab items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2.5 py-1.5 text-xs font-semibold text-on-surface shadow-sm transition-colors hover:border-primary-container hover:text-primary active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name={t.icon} className="text-base text-primary" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function OptionList({ options, onChange, error }) {
  // Giá trị gửi đi tự sinh từ nhãn, không trùng nhau
  const withValues = (list) => {
    const seen = new Set();
    return list.map((o, i) => {
      let value = toKey(o.label) || `option_${i + 1}`;
      while (seen.has(value)) value = `${value}_${i + 1}`;
      seen.add(value);
      return { label: o.label, value };
    });
  };
  const setLabel = (i, label) => onChange(withValues(options.map((o, idx) => (idx === i ? { ...o, label } : o))));

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-on-surface">Các lựa chọn</p>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-5 text-center text-[11px] font-semibold text-outline">{i + 1}.</span>
          <input
            value={o.label}
            onChange={(e) => setLabel(i, e.target.value)}
            placeholder={`Lựa chọn ${i + 1}`}
            aria-label={`Lựa chọn ${i + 1}`}
            className={`${inputCls} ${borderCls(false)} py-1.5`}
          />
          <button
            type="button"
            onClick={() => onChange(withValues(options.filter((_, idx) => idx !== i)))}
            aria-label={`Xoá lựa chọn ${i + 1}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-outline hover:bg-error-container/40 hover:text-error"
          >
            <Icon name="close" className="text-base" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange(withValues([...options, { label: '' }]))}
        className="ml-6 flex items-center gap-1 text-xs font-bold text-primary hover:underline"
      >
        <Icon name="add" className="text-base" />
        Thêm lựa chọn
      </button>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

// Creator chọn 1 tỉ lệ mặc định; người mua được chọn sẵn tỉ lệ này và đổi được sang tỉ lệ khác
function RatioPicker({ field, onChange, error }) {
  const offered = field.options.map((o) => o.value);
  const pick = (r) => onChange({ ...field, options: [{ value: r, label: r }], default_value: r });
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-on-surface">Tỉ lệ mặc định</p>
      <p className="text-[11px] text-on-surface-variant">Người mua được chọn sẵn tỉ lệ này và có thể đổi sang tỉ lệ khác.</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {ASPECT_RATIOS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={offered.includes(r)}
            onClick={() => pick(r)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
              offered.includes(r)
                ? 'border-primary-container bg-primary-fixed/50 text-primary'
                : 'border-outline-variant/50 text-on-surface-variant hover:border-primary-container'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-on-surface">
        Mặc định
        <select
          value={field.default_value ?? ''}
          onChange={(e) => pick(e.target.value)}
          className={`${inputCls} ${borderCls(false)} !w-36 py-1`}
        >
          {ASPECT_RATIOS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

// Hình minh hoạ ô người mua sẽ thấy
function BuyerHint({ type }) {
  if (isImageType(type))
    return (
      <div className="flex h-16 items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant text-[11px] text-outline">
        <Icon name="add_photo_alternate" className="text-xl" />
        Người mua tải {type === 'image' ? 'một ảnh' : 'nhiều ảnh'} vào đây
      </div>
    );
  return null;
}

function FieldCard({ field, index, total, errors, selected, onSelect, onChange, onRemove, onMove, dragProps }) {
  const ref = useRef(null);
  const err = (k) => errors[`${field._id}.${k}`];
  const t = FIELD_TYPES[field.type];

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  // Tên trường tỉ lệ khung hình cố định là aspect_ratio
  const fixedKey = field.type === 'aspect_ratio';
  // Trường vừa kéo vào: tên trường tự theo label cho tới khi Creator tự sửa
  const setLabel = (label) => onChange({ ...field, label, ...(field._autoKey && !fixedKey ? { key: toKey(label) } : {}) });

  return (
    <div
      ref={ref}
      data-card
      onFocus={onSelect}
      onClick={onSelect}
      className={`rounded-xl border bg-surface-container-lowest p-3 shadow-sm transition-colors ${
        selected ? 'border-primary-container ring-2 ring-primary-container/20' : 'border-outline-variant/50'
      }`}
    >
      <div className="mb-2.5 flex items-center gap-1.5">
        <span
          draggable
          {...dragProps}
          className="flex cursor-grab items-center text-outline hover:text-on-surface active:cursor-grabbing"
          title="Kéo để đổi vị trí"
          aria-hidden="true"
        >
          <Icon name="drag_indicator" className="text-xl" />
        </span>
        <Icon name={t.icon} className="text-lg text-primary" />
        <span className="flex-1 text-xs font-bold text-on-surface">{t.label}</span>
        <button
          type="button"
          onClick={() => onMove(index - 1)}
          disabled={index === 0}
          aria-label="Đưa lên"
          className="flex size-7 items-center justify-center rounded-lg text-outline hover:bg-surface-container disabled:invisible"
        >
          <Icon name="arrow_upward" className="text-base" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index + 1)}
          disabled={index === total - 1}
          aria-label="Đưa xuống"
          className="flex size-7 items-center justify-center rounded-lg text-outline hover:bg-surface-container disabled:invisible"
        >
          <Icon name="arrow_downward" className="text-base" />
        </button>
        {/* Trường tỉ lệ khung hình là bắt buộc của mọi mẫu, không xoá được */}
        {!fixedKey && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Xoá ${field.label || t.label}`}
            className="flex size-7 items-center justify-center rounded-lg text-outline hover:bg-error-container/40 hover:text-error"
          >
            <Icon name="delete" className="text-base" />
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-on-surface">Label hiển thị</label>
            <input
              value={field.label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ví dụ: Ảnh sản phẩm"
              maxLength={100}
              className={`${inputCls} ${borderCls(err('label'))}`}
            />
            {err('label') && <p className="mt-1 text-xs text-error">{err('label')}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-on-surface">Tên trường</label>
            <input
              value={field.key}
              onChange={(e) => onChange({ ...field, key: typedKey(e.target.value), _autoKey: false })}
              readOnly={fixedKey}
              title={fixedKey ? 'Tên trường tỉ lệ khung hình cố định, không sửa được' : undefined}
              placeholder="vi_du_product_image"
              className={`${inputCls} ${borderCls(err('key'))} font-mono text-xs ${fixedKey ? 'cursor-not-allowed bg-surface-container text-on-surface-variant' : ''}`}
            />
            {err('key') && <p className="mt-1 text-xs text-error">{err('key')}</p>}
          </div>
        </div>

        {field.type === 'aspect_ratio' && <RatioPicker field={field} onChange={onChange} error={err('options')} />}
        {hasOptions(field.type) && field.type !== 'aspect_ratio' && <OptionList options={field.options} onChange={(options) => onChange({ ...field, options })} error={err('options')} />}
        <BuyerHint type={field.type} />

        {field.type !== 'toggle' && !fixedKey && (
          <Switch label="Bắt buộc" checked={field.required} onChange={(required) => onChange({ ...field, required })} />
        )}
      </div>
    </div>
  );
}

// Vạch báo vị trí sẽ thả
const Indicator = ({ show }) => <div className={`h-1 rounded-full transition-colors ${show ? 'bg-primary-container' : 'bg-transparent'}`} />;

export default function FormCanvas({ fields, errors, selectedId, onSelect, onAdd, onChange, onRemove, onMove }) {
  // Vị trí sẽ chèn khi thả (0..fields.length), null = không kéo
  const [dropIndex, setDropIndex] = useState(null);
  const full = fields.length >= MAX_FIELDS;

  const isFieldDrag = (e) => [...e.dataTransfer.types].some((t) => t === TYPE_MIME || t === MOVE_MIME);

  const overCard = (e, index) => {
    if (!isFieldDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDropIndex(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
  };

  const drop = (e) => {
    e.preventDefault();
    const at = dropIndex ?? fields.length;
    setDropIndex(null);
    const type = e.dataTransfer.getData(TYPE_MIME);
    if (type) {
      if (!full) onAdd(type, at);
      return;
    }
    const id = e.dataTransfer.getData(MOVE_MIME);
    const from = fields.findIndex((f) => f._id === id);
    if (from < 0) return;
    // Bỏ phần tử ra trước rồi mới chèn -> vị trí đích lùi 1 nếu kéo xuống
    onMove(from, at > from ? at - 1 : at);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-outline">
          Nguyên liệu — kéo vào form bên dưới ({fields.length}/{MAX_FIELDS})
        </p>
        <Palette onAdd={(type) => onAdd(type, fields.length)} disabled={full} fields={fields} />
      </div>

      <div
        onDragOver={(e) => {
          if (!isFieldDrag(e)) return;
          e.preventDefault();
          if (dropIndex == null || !fields.length) setDropIndex(fields.length);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDropIndex(null);
        }}
        onDrop={drop}
        className={`min-h-[22rem] rounded-2xl border-2 border-dashed p-3 transition-colors ${
          dropIndex != null ? 'border-primary-container bg-primary-fixed/20' : 'border-outline-variant/60 bg-surface-container-low'
        }`}
      >
        {fields.length === 0 ? (
          <div className="flex h-[20rem] flex-col items-center justify-center gap-2 text-center text-on-surface-variant">
            <Icon name="drag_pan" className="text-4xl text-outline" />
            <p className="text-sm font-semibold">Kéo thành phần vào đây</p>
            <p className="text-xs">Ví dụ: kéo "Ảnh" để người mua tải ảnh sản phẩm, "Danh sách chọn" để chọn phong cách.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {fields.map((f, i) => (
              <div key={f._id} onDragOver={(e) => overCard(e, i)}>
                <Indicator show={dropIndex === i} />
                <FieldCard
                  field={f}
                  index={i}
                  total={fields.length}
                  errors={errors}
                  selected={f._id === selectedId}
                  onSelect={() => onSelect(f._id)}
                  onChange={onChange}
                  onRemove={() => onRemove(f._id)}
                  onMove={(to) => onMove(i, to)}
                  dragProps={{
                    onDragStart: (e) => {
                      e.dataTransfer.setData(MOVE_MIME, f._id);
                      e.dataTransfer.effectAllowed = 'move';
                      const card = e.currentTarget.closest('[data-card]');
                      if (card) e.dataTransfer.setDragImage(card, 20, 20);
                    },
                    onDragEnd: () => setDropIndex(null),
                  }}
                />
                {i === fields.length - 1 && <Indicator show={dropIndex === fields.length} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
