import { useEffect, useId } from 'react';
import Icon from './Icon';

/**
 * Khung popup: đáy màn hình trên điện thoại, giữa màn hình trên desktop. Esc / bấm nền để đóng, khoá cuộn trang.
 * footer: các nút ở đáy (luôn hiện, nội dung cuộn ở giữa).
 */
export default function Dialog({ title, subtitle, onClose, footer, children }) {
  const titleId = useId();

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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-surface-container-lowest shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-surface-container px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold text-on-surface">
              {title}
            </h2>
            {subtitle && <p className="truncate text-xs text-on-surface-variant">{subtitle}</p>}
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
        <div className="flex-1 space-y-3 overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex items-center gap-2 border-t border-surface-container p-3">{footer}</div>}
      </div>
    </div>
  );
}
