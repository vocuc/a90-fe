import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import SuccessDialog from '../components/common/SuccessDialog';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SelectField, SubmitButton, TextArea, TextField } from '../components/common/Form';
import {
  PHOTO_DESCRIPTION_MAX,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  PHOTO_TITLE_MAX,
  PHOTO_TYPES,
  PRIVACY_LABELS,
  VIDEO_MAX_BYTES,
  VIDEO_TITLE_MAX,
  VIDEO_TYPES,
  getCreatorInfo,
  publishPhotos,
  publishVideo,
} from '../api/tiktok';

const EMPTY_FORM = {
  title: '',
  description: '',
  privacyLevel: '',
  allowComment: true,
  allowDuet: true,
  allowStitch: true,
  autoAddMusic: true,
  disclose: false,
  brandOrganic: false,
  brandedContent: false,
};

// Đọc thời lượng video ở trình duyệt để kiểm tra trước giới hạn của tài khoản
const readDuration = (url) =>
  new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = () => resolve(null);
    video.src = url;
  });

const formatDuration = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

function Switch({ label, hint, checked, disabled, onChange }) {
  return (
    <label className={`flex items-center gap-3 py-2 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-on-surface">{label}</span>
        {hint && <span className="block text-xs text-on-surface-variant">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-outline-variant transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-primary-container peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container/40"
      />
    </label>
  );
}

function CheckOption({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/40 p-3 hover:bg-surface-container-low">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded text-primary-container focus:ring-primary-container/30"
      />
      <span>
        <span className="block text-sm font-semibold text-on-surface">{label}</span>
        <span className="block text-xs text-on-surface-variant">{hint}</span>
      </span>
    </label>
  );
}

/** Chọn video (1 file) hoặc ảnh (nhiều file). items: [{ id, file, url, duration? }] */
function MediaPicker({ mode, items, maxDuration, onAdd, onRemove }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const isVideo = mode === 'video';
  const isFileDrag = (e) => [...e.dataTransfer.types].includes('Files');

  const dropProps = {
    onDragOver: (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      setOver(false);
      onAdd([...e.dataTransfer.files]);
    },
  };

  const picker = (
    <input
      ref={inputRef}
      type="file"
      hidden
      multiple={!isVideo}
      accept={(isVideo ? VIDEO_TYPES : PHOTO_TYPES).join(',')}
      onChange={(e) => {
        onAdd([...(e.target.files ?? [])]);
        e.target.value = '';
      }}
    />
  );

  if (isVideo && items[0]) {
    const { url, duration } = items[0];
    return (
      <div className="space-y-2">
        <div className="relative mx-auto aspect-[9/16] max-h-[420px] overflow-hidden rounded-2xl bg-black">
          <video src={url} controls playsInline className="h-full w-full object-contain" />
          <button
            type="button"
            onClick={() => onRemove(items[0].id)}
            aria-label="Xoá video"
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>
        <p className="text-center text-xs text-on-surface-variant">
          {items[0].file.name}
          {duration ? ` · ${formatDuration(duration)}` : ''}
        </p>
      </div>
    );
  }

  if (!isVideo && items.length > 0) {
    return (
      <div className="space-y-2" {...dropProps}>
        <div className={`grid grid-cols-3 gap-2 rounded-2xl p-1 sm:grid-cols-4 ${over ? 'bg-primary-fixed/30' : ''}`}>
          {items.map((item, i) => (
            <div key={item.id} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-container">
              <img src={item.url} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Ảnh bìa
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Xoá ảnh ${i + 1}`}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <Icon name="close" className="text-base" />
              </button>
            </div>
          ))}
          {items.length < PHOTO_MAX_COUNT && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant hover:border-primary-container hover:text-primary"
            >
              <Icon name="add" className="text-3xl" />
              <span className="text-[11px] font-semibold">Thêm ảnh</span>
            </button>
          )}
        </div>
        <p className="text-xs text-on-surface-variant">
          {items.length}/{PHOTO_MAX_COUNT} ảnh. Ảnh đầu tiên làm ảnh bìa.
        </p>
        {picker}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        {...dropProps}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-12 text-center transition-colors ${
          over
            ? 'border-primary-container bg-primary-fixed/30 text-primary'
            : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-primary'
        }`}
      >
        <Icon name={isVideo ? 'video_call' : 'add_photo_alternate'} className="text-5xl" />
        <span className="text-sm font-semibold">{isVideo ? 'Chọn video để đăng' : 'Chọn ảnh để đăng'}</span>
        <span className="text-[11px]">Bấm để chọn hoặc kéo file vào đây</span>
      </button>
      <p className="text-[11px] text-on-surface-variant">
        {isVideo
          ? `MP4, MOV hoặc WEBM, tối đa 4GB, dài tối đa ${formatDuration(maxDuration)}.`
          : `JPG hoặc WEBP, tối đa ${PHOTO_MAX_COUNT} ảnh, mỗi ảnh tối đa 20MB.`}
      </p>
      {picker}
    </div>
  );
}

/** /tiktok/post: đăng video hoặc ảnh lên TikTok (đang giả lập API, chưa có backend). */
export default function TikTokPostPage() {
  useSeo({ title: 'Đăng bài lên TikTok', canonical: '/tiktok/post' });
  const navigate = useNavigate();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));

  const [creator, setCreator] = useState(null);
  const [creatorError, setCreatorError] = useState(null);
  const [mode, setMode] = useState('video');
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [done, setDone] = useState(null);

  const loadCreator = () => {
    setCreatorError(null);
    getCreatorInfo().then(setCreator, setCreatorError);
  };
  useEffect(loadCreator, []);

  // Giải phóng object URL khi rời trang
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url)), []);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const clearMedia = () => {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    setItems([]);
  };

  const switchMode = (next) => {
    if (next === mode) return;
    clearMedia();
    setMode(next);
    setErrors({});
    setFormError(null);
  };

  const isVideo = mode === 'video';
  const maxDuration = creator?.maxVideoPostDurationSec ?? 600;

  const addFiles = async (files) => {
    if (!files.length) return;
    setErrors((e) => ({ ...e, media: undefined }));
    const types = isVideo ? VIDEO_TYPES : PHOTO_TYPES;
    const maxBytes = isVideo ? VIDEO_MAX_BYTES : PHOTO_MAX_BYTES;

    const picked = isVideo ? files.slice(0, 1) : files.slice(0, PHOTO_MAX_COUNT - items.length);
    const valid = picked.filter((f) => types.includes(f.type) && f.size <= maxBytes);
    if (valid.length < picked.length) {
      setErrors((e) => ({
        ...e,
        media: isVideo ? 'Video phải là MP4, MOV hoặc WEBM và không quá 4GB.' : 'Một số ảnh bị bỏ qua: chỉ nhận JPG, WEBP tối đa 20MB.',
      }));
    } else if (!isVideo && files.length > picked.length) {
      setErrors((e) => ({ ...e, media: `Tối đa ${PHOTO_MAX_COUNT} ảnh cho một bài đăng.` }));
    }

    const next = valid.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    if (isVideo && next[0]) {
      const duration = await readDuration(next[0].url);
      if (duration && duration > maxDuration) {
        URL.revokeObjectURL(next[0].url);
        setErrors((e) => ({ ...e, media: `Video dài ${formatDuration(duration)}, tài khoản này chỉ đăng được tối đa ${formatDuration(maxDuration)}.` }));
        return;
      }
      next[0].duration = duration;
      clearMedia();
    }
    setItems((prev) => (isVideo ? next : [...prev, ...next]));
  };

  const removeItem = (id) =>
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((it) => it.id !== id);
    });

  // Nội dung có thương hiệu (branded content) không được để chế độ "Chỉ mình tôi"
  const brandedPrivate = form.disclose && form.brandedContent && form.privacyLevel === 'SELF_ONLY';

  const validate = () => {
    const e = {};
    if (!items.length) e.media = isVideo ? 'Hãy chọn video để đăng.' : 'Hãy chọn ít nhất một ảnh.';
    if (!isVideo && !form.title.trim()) e.title = 'Hãy nhập tiêu đề cho bài đăng ảnh.';
    if (!form.privacyLevel) e.privacyLevel = 'Hãy chọn ai có thể xem bài đăng.';
    if (form.disclose && !form.brandOrganic && !form.brandedContent) e.disclose = 'Hãy chọn loại nội dung quảng cáo.';
    if (brandedPrivate) e.privacyLevel = 'Nội dung có thương hiệu không thể để chế độ "Chỉ mình tôi".';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const common = {
      privacyLevel: form.privacyLevel,
      disableComment: !form.allowComment,
      brandOrganic: form.disclose && form.brandOrganic,
      brandedContent: form.disclose && form.brandedContent,
    };
    setProgress(0);
    try {
      const result = isVideo
        ? await publishVideo(
            items[0].file,
            { ...common, title: form.title, disableDuet: !form.allowDuet, disableStitch: !form.allowStitch },
            setProgress,
          )
        : await publishPhotos(
            items.map((it) => it.file),
            { ...common, title: form.title, description: form.description, autoAddMusic: form.autoAddMusic },
            setProgress,
          );
      setDone({ ...result, privacyLevel: form.privacyLevel });
    } catch (err) {
      setFormError(err?.message || 'Đăng bài thất bại, vui lòng thử lại.');
    } finally {
      setProgress(null);
    }
  };

  const closeDone = () => {
    setDone(null);
    clearMedia();
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const posting = progress !== null;

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={goBack}
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </button>
        <h1 className="text-base font-bold text-on-surface">Đăng bài lên TikTok</h1>
      </header>

      <form onSubmit={submit} noValidate className="space-y-6 p-4">
        {/* Tài khoản TikTok đang đăng: TikTok yêu cầu hiển thị rõ cho người dùng */}
        {creatorError ? (
          <ErrorState error={creatorError} onRetry={loadCreator} />
        ) : !creator ? (
          <Skeleton className="h-16" />
        ) : (
          <section className="flex items-center gap-3 rounded-2xl border border-outline-variant/40 p-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-black text-white">
              <Icon name="music_note" className="text-xl" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-on-surface">{creator.creatorNickname}</p>
              <p className="truncate text-xs text-on-surface-variant">@{creator.creatorUsername}</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              <Icon name="check_circle" fill className="text-sm" />
              Đã kết nối
            </span>
          </section>
        )}

        <div role="tablist" aria-label="Loại bài đăng" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container p-1">
          {[
            ['video', 'movie', 'Video'],
            ['photo', 'photo_library', 'Ảnh'],
          ].map(([value, icon, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              disabled={posting}
              onClick={() => switchMode(value)}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-colors ${
                mode === value ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon name={icon} className="text-lg" />
              {label}
            </button>
          ))}
        </div>

        <section className="space-y-2">
          <MediaPicker mode={mode} items={items} maxDuration={maxDuration} onAdd={addFiles} onRemove={removeItem} />
          {errors.media && <p className="text-xs text-error">{errors.media}</p>}
        </section>

        <section className="space-y-4">
          {isVideo ? (
            <TextArea
              label="Mô tả"
              placeholder="Viết mô tả cho video, thêm #hashtag và @nhắc tên..."
              maxLength={VIDEO_TITLE_MAX}
              value={form.title}
              onChange={(e) => set('title')(e.target.value)}
            />
          ) : (
            <>
              <TextField
                label="Tiêu đề"
                icon="title"
                placeholder="Tiêu đề bài đăng ảnh"
                maxLength={PHOTO_TITLE_MAX}
                value={form.title}
                error={errors.title}
                hint={`${form.title.length}/${PHOTO_TITLE_MAX} ký tự`}
                onChange={(e) => set('title')(e.target.value)}
              />
              <TextArea
                label="Mô tả"
                placeholder="Viết mô tả, thêm #hashtag và @nhắc tên..."
                maxLength={PHOTO_DESCRIPTION_MAX}
                value={form.description}
                onChange={(e) => set('description')(e.target.value)}
              />
            </>
          )}

          {/* TikTok yêu cầu người dùng tự chọn quyền riêng tư, không đặt sẵn giá trị mặc định */}
          <SelectField
            label="Ai có thể xem bài đăng này"
            value={form.privacyLevel}
            error={errors.privacyLevel}
            onChange={(e) => set('privacyLevel')(e.target.value)}
          >
            <option value="" disabled>
              Chọn quyền riêng tư
            </option>
            {(creator?.privacyLevelOptions ?? []).map((opt) => (
              <option key={opt} value={opt} disabled={form.disclose && form.brandedContent && opt === 'SELF_ONLY'}>
                {PRIVACY_LABELS[opt] ?? opt}
              </option>
            ))}
          </SelectField>
        </section>

        <section className="divide-y divide-surface-container rounded-2xl border border-outline-variant/40 px-4 py-1">
          <Switch
            label="Cho phép bình luận"
            checked={form.allowComment && !creator?.commentDisabled}
            disabled={creator?.commentDisabled}
            onChange={set('allowComment')}
          />
          {isVideo ? (
            <>
              <Switch
                label="Cho phép Duet"
                checked={form.allowDuet && !creator?.duetDisabled}
                disabled={creator?.duetDisabled}
                onChange={set('allowDuet')}
              />
              <Switch
                label="Cho phép Stitch"
                checked={form.allowStitch && !creator?.stitchDisabled}
                disabled={creator?.stitchDisabled}
                onChange={set('allowStitch')}
              />
            </>
          ) : (
            <Switch
              label="Tự động thêm nhạc"
              hint="TikTok chọn nhạc nền phù hợp cho bài đăng ảnh"
              checked={form.autoAddMusic}
              onChange={set('autoAddMusic')}
            />
          )}
        </section>

        <section className="space-y-3">
          <div className="rounded-2xl border border-outline-variant/40 px-4 py-1">
            <Switch
              label="Công khai nội dung quảng cáo"
              hint="Bật nếu bài đăng quảng bá cho bạn, thương hiệu, sản phẩm hoặc dịch vụ"
              checked={form.disclose}
              onChange={set('disclose')}
            />
          </div>
          {form.disclose && (
            <div className="space-y-2">
              <CheckOption
                label="Thương hiệu của bạn"
                hint='Bạn quảng bá cho chính mình hoặc doanh nghiệp của bạn. Bài đăng sẽ có nhãn "Nội dung quảng cáo".'
                checked={form.brandOrganic}
                onChange={set('brandOrganic')}
              />
              <CheckOption
                label="Nội dung có thương hiệu"
                hint='Bạn quảng bá cho bên thứ ba. Bài đăng sẽ có nhãn "Hợp tác trả phí".'
                checked={form.brandedContent}
                onChange={(v) => {
                  set('brandedContent')(v);
                  if (v && form.privacyLevel === 'SELF_ONLY') set('privacyLevel')('');
                }}
              />
              {errors.disclose && <p className="text-xs text-error">{errors.disclose}</p>}
            </div>
          )}
        </section>

        <p className="text-xs leading-relaxed text-on-surface-variant">
          Bằng việc đăng bài, bạn đồng ý với{' '}
          {form.disclose && form.brandedContent && (
            <>
              <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener" className="font-semibold text-primary hover:underline">
                Chính sách nội dung có thương hiệu
              </a>{' '}
              và{' '}
            </>
          )}
          <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener" className="font-semibold text-primary hover:underline">
            Xác nhận sử dụng nhạc
          </a>{' '}
          của TikTok. Bài đăng có thể mất vài phút để xuất hiện trên hồ sơ của bạn.
        </p>

        {formError && <FormAlert>{formError}</FormAlert>}

        {posting && (
          <div className="space-y-1" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-right text-xs text-on-surface-variant">Đang tải lên {progress}%</p>
          </div>
        )}

        <SubmitButton loading={posting} loadingText="Đang đăng bài..." disabled={!creator}>
          <Icon name="send" className="text-lg" />
          Đăng bài
        </SubmitButton>
      </form>

      {done && (
        <SuccessDialog
          title="Đăng bài thành công"
          message={`${isVideo ? 'Video' : 'Bài đăng ảnh'} đã được gửi lên TikTok (${PRIVACY_LABELS[done.privacyLevel]}). TikTok có thể mất vài phút để xử lý trước khi bài xuất hiện trên hồ sơ.`}
          onClose={closeDone}
        />
      )}
    </>
  );
}
