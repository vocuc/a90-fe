import { useEffect } from 'react';
import Icon from './Icon';

/**
 * Xem ảnh toàn màn hình; đóng bằng nút X, phím Esc hoặc bấm ra ngoài ảnh.
 * actions: nút thêm đặt cạnh nút đóng (vd. "Cắt ảnh" ở trang lô).
 */
export default function ImageViewer({ src, alt, onClose, actions }) {
  useEffect(() => {
    if (!src) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Khoá cuộn trang phía sau khi đang xem ảnh
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [src, onClose]);

  if (!src) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
    >
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full object-contain" />
      <div className="absolute right-3 top-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
        >
          <Icon name="close" className="text-2xl" />
        </button>
      </div>
    </div>
  );
}
