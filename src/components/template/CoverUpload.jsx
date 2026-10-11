import { useRef, useState } from 'react';
import Icon from '../common/Icon';

// Khớp giới hạn ảnh Creative hiện tại của backend (CreativeImageController)
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** Ảnh đại diện của Creative: bấm để chọn hoặc kéo file ảnh thả vào. value: data URL | null. */
export default function CoverUpload({ value, onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [over, setOver] = useState(false);

  const accept = async (file) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return setError('Chỉ nhận ảnh JPG, PNG hoặc WEBP.');
    if (file.size > MAX_BYTES) return setError('Ảnh tối đa 10MB.');
    setError(null);
    try {
      onChange(await readAsDataUrl(file));
    } catch {
      setError('Không đọc được ảnh, hãy thử ảnh khác.');
    }
  };

  const isFileDrag = (e) => [...e.dataTransfer.types].includes('Files');

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          setOver(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={`relative aspect-square w-full overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
          over ? 'border-primary-container bg-primary-fixed/30' : value ? 'border-transparent' : 'border-outline-variant bg-surface-container-low'
        }`}
      >
        {value ? (
          <>
            <img src={value} alt="Ảnh đại diện Creative" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/60 to-transparent p-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-surface-container-lowest/95 text-xs font-bold text-on-surface hover:bg-surface-container-lowest"
              >
                <Icon name="swap_horiz" className="text-base" />
                Đổi ảnh
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                aria-label="Xoá ảnh đại diện"
                className="flex size-8 items-center justify-center rounded-lg bg-surface-container-lowest/95 text-on-surface hover:text-error"
              >
                <Icon name="delete" className="text-base" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-on-surface-variant hover:text-primary"
          >
            <Icon name="add_photo_alternate" className="text-5xl" />
            <span className="text-sm font-semibold">Tải lên ảnh đại diện</span>
            <span className="text-[11px]">Bấm để chọn hoặc kéo ảnh vào đây</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(',')}
        hidden
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error ? (
        <p className="text-xs text-error">{error}</p>
      ) : (
        <p className="text-[11px] text-on-surface-variant">JPG, PNG, WEBP tối đa 10MB. Hiển thị trên sàn để người mua nhận biết Creative.</p>
      )}
    </div>
  );
}
