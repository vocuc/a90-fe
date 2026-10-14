import { useEffect, useState } from 'react';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { ErrorState, Skeleton } from '../common/Feedback';
import DynamicForm, { initialValues, validateValues } from '../template/DynamicForm';
import { getBatchImageInputs } from '../../api/batches';
import { useCreative } from '../../hooks/queries';
import { formatVnd } from '../../utils/format';

/**
 * Popup sửa nguyên liệu (thông tin nhập theo form của mẫu) của một ảnh rồi tạo lại ảnh đó.
 * Điền sẵn thông tin đã dùng lần trước nếu còn (ảnh cũ giữ lại bằng file_id, không cần tải lên lại).
 */
export default function EditInputsDialog({ batchId, image, onSubmit, onClose }) {
  const { data: c, isLoading, error, refetch } = useCreative(image.creativeSlug);
  const schema = c?.inputSchema ?? null;
  const [saved, setSaved] = useState(undefined); // undefined: đang tải, null: không còn thông tin cũ
  const [values, setValues] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getBatchImageInputs(batchId, image).then(
      (res) => setSaved(res.values),
      () => setSaved(null),
    );
  }, [batchId, image]);
  // Có form của mẫu và đã biết thông tin cũ thì điền vào form (thiếu trường nào lấy mặc định)
  useEffect(() => {
    if (schema && saved !== undefined && values === null) setValues({ ...initialValues(schema), ...(saved ?? {}) });
  }, [schema, saved, values]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const errors = schema && values && submitted ? validateValues(schema, values) : {};
  const price = c?.price ?? image.price ?? 0;

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(validateValues(schema, values)).length) return;
    onSubmit({ schema, values });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-inputs-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-surface-container-lowest shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-surface-container px-4 py-3">
          <CoverImage src={image.thumbUrl ?? image.url} alt="" className="size-10 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <h2 id="edit-inputs-title" className="text-base font-bold text-on-surface">
              Sửa nguyên liệu
            </h2>
            <p className="truncate text-xs text-on-surface-variant">Mẫu: {c?.title ?? image.creativeTitle ?? '...'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : isLoading || !values ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <>
              {saved === null && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <Icon name="info" className="text-base" />
                  Không còn thông tin đã nhập lần trước, hãy nhập lại.
                </p>
              )}
              <DynamicForm
                compact
                fields={schema}
                values={values}
                errors={errors}
                aspectRatios={c.options?.aspect_ratios ?? []}
                onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-surface-container p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!values}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            <Icon name="refresh" className="text-lg" />
            Tạo lại ảnh · {price > 0 ? formatVnd(price) : 'Miễn phí'}
          </button>
        </div>
      </div>
    </div>
  );
}
