import Icon from './Icon';
import { FormAlert } from './Form';

/** Thanh dưới cùng: mobile dính đáy màn hình (che tab dưới), desktop dính đáy vùng nội dung. */
/** secondary: nút phụ đặt trước nút chính (vd "Huỷ"). */
export default function ActionBar({
  summary,
  error,
  disabled,
  loading,
  onSubmit,
  label,
  icon = 'add',
  loadingText = 'Đang tạo...',
  secondary = null,
}) {
  // Mobile: z-[55] để nằm trên tab dưới (BottomNav z-50 render sau nên sẽ che thanh này nếu cùng z-index);
  // khoảng trống phía trên để nội dung cuối trang không bị thanh che
  return (
    <>
      <div aria-hidden="true" className="h-8 lg:hidden" />
      <div className="fixed bottom-0 left-0 right-0 z-[55] mx-auto max-w-[640px] border-t border-surface-container bg-surface-container-lowest p-3 lg:sticky lg:max-w-none lg:rounded-t-2xl lg:border lg:px-4">
        {error && (
          <div className="mb-2">
            <FormAlert>{error}</FormAlert>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-xs text-on-surface-variant">{summary}</div>
          {secondary}
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || loading}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary-container px-5 text-sm font-bold text-on-primary shadow-md shadow-primary-container/25 hover:bg-primary disabled:pointer-events-none disabled:opacity-50"
          >
            <Icon name={loading ? 'progress_activity' : icon} className={`text-lg ${loading ? 'animate-spin' : ''}`} />
            {loading ? loadingText : label}
          </button>
        </div>
      </div>
    </>
  );
}
