import { useRef, useState } from 'react';
import Icon from '../common/Icon';
import { useUploadCreativeAsset } from '../../hooks/creatorQueries';
import { IMAGE_MIME_TYPES, MAX_FILE_MB } from './templateSchema';

/**
 * Ảnh của trường Nguyên liệu ẩn: chọn ảnh là tải lên ngay (POST /creator/creative-assets),
 * lưu asset_id vào trường; lưu Creative thì backend gắn ảnh vào Creative.
 * maxKb: dung lượng tối đa admin cấu hình (generation.input_max_size_kb).
 */
export default function HiddenAssetUpload({ field, onChange, error, maxKb = MAX_FILE_MB * 1024 }) {
  const inputRef = useRef(null);
  const upload = useUploadCreativeAsset();
  const [localError, setLocalError] = useState(null);
  // Link ký số hết hạn sau 15 phút (nháp cũ) -> báo đã có ảnh thay vì ảnh vỡ
  const [broken, setBroken] = useState(false);
  const [over, setOver] = useState(false);

  const accept = (file) => {
    if (!file) return;
    if (!IMAGE_MIME_TYPES.includes(file.type)) return setLocalError('Chỉ nhận ảnh JPG, PNG hoặc WEBP.');
    if (file.size > maxKb * 1024) return setLocalError(`Ảnh tối đa ${Math.floor(maxKb / 1024)}MB.`);
    setLocalError(null);
    upload.mutate(file, {
      onSuccess: (asset) => {
        setBroken(false);
        onChange({ ...field, asset_id: asset.id, asset_url: asset.url });
      },
      onError: (err) => setLocalError(err.message),
    });
  };

  const isFileDrag = (e) => [...e.dataTransfer.types].includes('Files');
  const message = localError ?? error;
  const hasImage = !!field.asset_id;

  return (
    <div className="space-y-1.5">
      <div
        onDragOver={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={`flex items-center gap-3 rounded-lg border border-dashed p-2 transition-colors ${
          over ? 'border-primary-container bg-primary-fixed/30' : message ? 'border-error' : 'border-outline-variant'
        }`}
      >
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container">
          {upload.isPending ? (
            <Icon name="progress_activity" className="animate-spin text-xl text-outline" />
          ) : hasImage && field.asset_url && !broken ? (
            <img src={field.asset_url} alt={field.label} onError={() => setBroken(true)} className="h-full w-full object-cover" />
          ) : (
            <Icon name={hasImage ? 'image' : 'add_photo_alternate'} className="text-2xl text-outline" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] text-on-surface-variant">
            {upload.isPending
              ? 'Đang tải ảnh lên...'
              : hasImage
                ? 'Đã tải ảnh. Người mua không thấy ảnh này, ảnh luôn được gửi kèm tới AI.'
                : 'Tải ảnh lên hoặc kéo ảnh thả vào đây (JPG, PNG, WEBP).'}
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-50"
          >
            <Icon name="upload" className="text-base" />
            {hasImage ? 'Đổi ảnh' : 'Chọn ảnh'}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_MIME_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            accept(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </div>
      {message && <p className="text-xs text-error">{message}</p>}
    </div>
  );
}
