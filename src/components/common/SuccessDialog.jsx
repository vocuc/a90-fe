import { useEffect } from 'react';
import Icon from './Icon';

/** Popup báo thành công; đóng bằng nút, bấm ra ngoài hoặc phím Esc. children: các nút thêm (vd. link). */
export default function SuccessDialog({ title, message, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs space-y-4 rounded-2xl bg-surface-container-lowest p-5 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary-container/15 text-primary">
          <Icon name="check_circle" fill className="text-4xl" />
        </span>
        <div className="space-y-1">
          <h2 id="success-dialog-title" className="text-base font-bold text-on-surface">
            {title}
          </h2>
          {message && <p className="text-sm text-on-surface-variant">{message}</p>}
        </div>
        <div className="space-y-2">
          {children}
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="flex h-10 w-full items-center justify-center rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
