import { useEffect, useRef, useState } from 'react';
import Icon from '../common/Icon';
import { FormAlert } from '../common/Form';
import { useUploadAvatar, useUploadCover } from '../../hooks/creatorQueries';

// Khớp backend: image, mimes jpg/jpeg/png/webp, max 5120 KB
const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

const checkFile = (file) => {
  if (!ACCEPT.split(',').includes(file.type)) return 'Chỉ nhận ảnh JPG, PNG hoặc WEBP.';
  if (file.size > MAX_BYTES) return 'Ảnh tối đa 5MB.';
  return null;
};

/** Chọn ảnh -> xem trước ngay -> upload ngay, không cần bấm lưu. */
function useImageUpload(mutation) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  // Giải phóng URL xem trước cũ
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const onPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại cùng một file
    if (!file) return;
    const problem = checkFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
    mutation.mutate(file, {
      onSuccess: () => setPreview(null),
      onError: (err) => {
        setPreview(null);
        setError(err.errors?.image ? 'Ảnh không hợp lệ (JPG, PNG, WEBP, tối đa 5MB).' : err.message);
      },
    });
  };

  return { preview, uploading: mutation.isPending, error, inputRef, onPick };
}

export default function ShopImages({ profile }) {
  const cover = useImageUpload(useUploadCover());
  const avatar = useImageUpload(useUploadAvatar());

  const coverSrc = cover.preview ?? profile.cover_url;
  const avatarSrc = avatar.preview ?? profile.avatar_url;

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          onClick={() => cover.inputRef.current?.click()}
          disabled={cover.uploading}
          aria-label="Đổi ảnh bìa"
          className="group relative block aspect-[3/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary-container to-secondary"
        >
          {coverSrc && <img src={coverSrc} alt="" className="h-full w-full object-cover" />}
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-inverse-surface/70 px-2.5 py-1 text-[11px] font-semibold text-on-primary backdrop-blur">
            <Icon name={cover.uploading ? 'progress_activity' : 'photo_camera'} className={`text-sm ${cover.uploading ? 'animate-spin' : ''}`} />
            {cover.uploading ? 'Đang tải...' : 'Ảnh bìa'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => avatar.inputRef.current?.click()}
          disabled={avatar.uploading}
          aria-label="Đổi ảnh đại diện"
          className="absolute -bottom-8 left-4 size-20 overflow-hidden rounded-full border-4 border-surface-container-lowest bg-surface-container shadow-md"
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">
              {profile.shop_name?.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 flex justify-center bg-inverse-surface/60 py-0.5 text-on-primary">
            <Icon
              name={avatar.uploading ? 'progress_activity' : 'photo_camera'}
              className={`text-sm ${avatar.uploading ? 'animate-spin' : ''}`}
            />
          </span>
        </button>
      </div>

      <input ref={cover.inputRef} type="file" accept={ACCEPT} hidden onChange={cover.onPick} />
      <input ref={avatar.inputRef} type="file" accept={ACCEPT} hidden onChange={avatar.onPick} />

      <p className="mt-10 text-xs text-on-surface-variant">
        Bấm vào ảnh bìa hoặc ảnh đại diện để đổi. JPG, PNG, WEBP, tối đa 5MB.
      </p>
      {(cover.error || avatar.error) && (
        <div className="mt-2">
          <FormAlert>{cover.error || avatar.error}</FormAlert>
        </div>
      )}
    </div>
  );
}
