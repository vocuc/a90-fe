import { useState } from 'react';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';

/**
 * Nút "Prompt" đặt trên ảnh của bài kế hoạch: mở popup xem prompt đã gửi tạo ảnh
 * (mô tả bối cảnh + câu lệnh của ảnh + ghi chú sản phẩm). Ảnh không có prompt (ảnh từ mẫu, ảnh upload) thì không hiện.
 */
export default function ImagePromptButton({ image, index, className = '' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!image?.prompt) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(image.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Trình duyệt chặn clipboard: người dùng tự bôi đen để chép
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Xem prompt ảnh ${index + 1}`}
        title="Xem prompt"
        className={`flex h-6 items-center gap-0.5 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white hover:bg-black/80 ${className}`}
      >
        <Icon name="description" className="text-sm" />
        Prompt
      </button>
      {open && (
        <Dialog
          title={`Prompt ảnh ${index + 1}${index === 0 ? ' (ảnh bìa)' : ''}`}
          subtitle="Mô tả bối cảnh + câu lệnh của ảnh + ghi chú sản phẩm, gửi kèm ảnh sản phẩm"
          onClose={() => setOpen(false)}
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={copy}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary"
              >
                <Icon name={copied ? 'check' : 'content_copy'} className="text-lg" />
                {copied ? 'Đã chép' : 'Chép prompt'}
              </button>
            </div>
          }
        >
          <p className="whitespace-pre-wrap break-words rounded-xl bg-surface-container p-3 text-sm leading-relaxed text-on-surface">
            {image.prompt}
          </p>
        </Dialog>
      )}
    </>
  );
}
