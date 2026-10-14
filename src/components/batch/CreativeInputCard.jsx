import { useEffect, useState } from 'react';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { ErrorState, Skeleton } from '../common/Feedback';
import DynamicForm from '../template/DynamicForm';
import { formatVnd } from '../../utils/format';

/** Số ảnh: nút -/+ và ô nhập, tối thiểu 1, không giới hạn trên. */
function QuantityInput({ value, onChange, label }) {
  // Cho phép xoá trống khi đang gõ; rời ô mà trống / sai thì về giá trị cũ
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (raw) => {
    const n = Math.floor(Number(raw));
    if (Number.isFinite(n) && n >= 1) onChange(n);
    else setText(String(value));
  };
  const btn =
    'flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-40';
  return (
    <div className="flex shrink-0 items-center rounded-xl border border-outline-variant/50" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Bớt 1 ảnh" className={btn}>
        <Icon name="remove" className="text-base" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Math.floor(Number(e.target.value));
          if (Number.isFinite(n) && n >= 1) onChange(n);
        }}
        onBlur={(e) => commit(e.target.value)}
        aria-label="Số ảnh"
        className="w-10 border-none bg-transparent p-0 text-center text-sm font-bold text-on-surface [appearance:textfield] focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Thêm 1 ảnh" className={btn}>
        <Icon name="add" className="text-base" />
      </button>
    </div>
  );
}

/**
 * Thông tin nhập cho một mẫu (form theo input_schema của mẫu đó), thu gọn / mở rộng được.
 * quantity / onQuantity: số ảnh tạo từ cùng nguyên liệu.
 */
export default function CreativeInputCard({
  creative,
  detail,
  values,
  errors,
  missing,
  open,
  onToggleOpen,
  onChange,
  onRemove,
  quantity,
  onQuantity,
}) {
  const { data: c, isLoading, error, refetch } = detail;
  const ready = !!c?.inputSchema;
  return (
    <li id={`creative-input-${creative.id}`} className="scroll-mt-[136px] overflow-hidden rounded-2xl border border-outline-variant/40">
      <div className="flex items-center gap-3 p-3">
        <button type="button" onClick={onToggleOpen} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <CoverImage src={creative.imageUrl} alt="" className="size-12 shrink-0 rounded-xl" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-on-surface">{creative.title}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] text-outline">
                {creative.price > 0 ? `${formatVnd(creative.price)}/ảnh` : 'Miễn phí'}
              </span>
              {isLoading ? (
                <span className="text-[11px] text-outline">Đang tải...</span>
              ) : !ready ? null : missing ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Icon name="error" className="text-xs" />
                  Thiếu {missing} thông tin
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <Icon name="check_circle" fill className="text-xs" />
                  Đủ thông tin
                </span>
              )}
            </span>
          </span>
          <Icon name={open ? 'expand_less' : 'expand_more'} className="text-outline" />
        </button>
        <QuantityInput value={quantity} onChange={onQuantity} label={`Số ảnh mẫu ${creative.title}`} />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Bỏ mẫu ${creative.title}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-outline hover:bg-surface-container hover:text-error"
          >
            <Icon name="delete" className="text-lg" />
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-surface-container p-4">
          {error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : !ready ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <DynamicForm
              compact
              fields={c.inputSchema}
              values={values}
              errors={errors}
              aspectRatios={c.options?.aspect_ratios ?? []}
              onChange={onChange}
            />
          )}
        </div>
      )}
    </li>
  );
}
