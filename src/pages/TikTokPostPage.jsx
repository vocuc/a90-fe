import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import ImageViewer from '../components/common/ImageViewer';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SelectField, SubmitButton, TextArea, TextField } from '../components/common/Form';
import DynamicForm, { initialValues, validateValues } from '../components/template/DynamicForm';
import HashtagInput from '../components/template/HashtagInput';
import A51ImagePicker from '../components/tiktok/A51ImagePicker';
import OAuthResultNotice from '../components/tiktok/OAuthResultNotice';
import { PostStatusBadge } from '../components/tiktok/PostStatus';
import { formatVnd } from '../utils/format';
import { useCreative } from '../hooks/queries';
import {
  HASHTAG_MAX,
  IMAGE_STATUS,
  PHOTO_DESCRIPTION_MAX,
  PHOTO_MAX_COUNT,
  PHOTO_TITLE_MAX,
  POST_STATUS,
  PRIVACY_LABELS,
  authorizeTikTok,
  deletePost,
  disconnectTikTok,
  getCreatorInfo,
  getImageInputs,
  getPost,
  isImageBusy,
  newIdempotencyKey,
  publishPost,
  regenerateImage,
} from '../api/tiktok';

// Trạng thái còn đang chạy ở nền (hoặc còn ảnh đang tạo lại): hỏi lại mỗi 3 giây
const POLL_STATUSES = [POST_STATUS.GENERATING, POST_STATUS.PUBLISHING];
const POLL_INTERVAL = 3000;
const needsPolling = (post) =>
  !!post && (POLL_STATUSES.includes(post.status) || (post.status === POST_STATUS.PENDING_REVIEW && post.images.some(isImageBusy)));

const EDIT_FIELDS = ['images', 'title', 'content', 'hashtags', 'privacyLevel', 'allowComment', 'autoAddMusic'];
const pickEdit = (post) => Object.fromEntries(EDIT_FIELDS.map((k) => [k, post[k]]));

// Nội dung gửi TikTok = content + "\n" + dòng hashtag, tổng không quá 4000 ký tự
const captionLength = (content, hashtags) =>
  content.length + (hashtags.length ? 1 + hashtags.map((t) => `#${t}`).join(' ').length : 0);

// Lỗi theo trường của API đăng bài (snake_case, images.N) -> trường của form
const FIELD_FROM_API = { title: 'title', content: 'content', hashtags: 'hashtags', privacy_level: 'privacyLevel', images: 'images' };
const formErrorsFrom = (errors) =>
  Object.entries(errors ?? {}).reduce((acc, [field, msg]) => {
    const key = FIELD_FROM_API[field.split('.')[0]];
    if (key && !acc[key]) acc[key] = msg;
    return acc;
  }, {});

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

const NOT_CONNECTED_TEXT = {
  not_connected: { title: 'Chưa ủy quyền TikTok', hint: 'Ủy quyền tài khoản TikTok để đăng bài' },
  expired: { title: 'Kết nối TikTok đã hết hạn', hint: 'Vui lòng ủy quyền lại để tiếp tục đăng bài' },
  revoked: { title: 'Kết nối TikTok đã bị huỷ', hint: 'Vui lòng ủy quyền lại để tiếp tục đăng bài' },
  scope_missing: { title: 'Thiếu quyền đăng bài', hint: 'Cần cho phép quyền đăng bài để A51 đăng lên TikTok. Vui lòng ủy quyền lại.' },
};

/**
 * Tài khoản TikTok sẽ đăng bài: TikTok yêu cầu hiển thị rõ cho người dùng.
 * tiktok: undefined đang tải, còn lại là { connected, reason, account, creator } của GET /tiktok/account.
 */
function CreatorCard({ tiktok, error, onRetry, onAuthorize, authorizing, onDisconnect, disconnecting }) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (tiktok === undefined) return <Skeleton className="h-16" />;
  if (!tiktok.connected) {
    const text = NOT_CONNECTED_TEXT[tiktok.reason] ?? NOT_CONNECTED_TEXT.not_connected;
    // Hết hạn / bị huỷ / thiếu quyền: còn biết tài khoản cũ -> "Ủy quyền lại @username"
    const again = tiktok.reason !== 'not_connected' && tiktok.account;
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-outline-variant/40 p-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name="music_note" className="text-xl" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-on-surface">{text.title}</p>
          <p className="text-xs text-on-surface-variant">{text.hint}</p>
        </div>
        <button
          type="button"
          onClick={onAuthorize}
          disabled={authorizing}
          className="flex h-9 max-w-[50%] shrink-0 items-center gap-1 truncate rounded-lg bg-black px-3 text-xs font-bold text-white hover:bg-black/80 disabled:opacity-60"
        >
          {authorizing && <Icon name="progress_activity" className="animate-spin text-base" />}
          {authorizing
            ? 'Đang chuyển...'
            : again
              ? `Ủy quyền lại${tiktok.account.username ? ` @${tiktok.account.username}` : ''}`
              : 'Ủy quyền'}
        </button>
      </section>
    );
  }

  const c = tiktok.creator ?? {};
  const nickname = c.nickname ?? tiktok.account?.nickname;
  const username = c.username ?? tiktok.account?.username;
  const avatar = c.avatar_url ?? tiktok.account?.avatar_url;
  return (
    <section className="space-y-2 rounded-2xl border border-outline-variant/40 p-3">
      <div className="flex items-center gap-3">
        {avatar ? (
          <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-black text-white">
            <Icon name="music_note" className="text-xl" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface">{nickname || 'Tài khoản TikTok'}</p>
          {username && <p className="truncate text-xs text-on-surface-variant">@{username}</p>}
        </div>
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
          <Icon name="check_circle" fill className="text-sm" />
          Đã kết nối
        </span>
      </div>
      {c.can_post === false && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Icon name="block" className="text-base" />
          {c.cannot_post_reason?.message || 'Tài khoản TikTok này tạm thời không đăng được bài.'}
        </p>
      )}
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onAuthorize}
          disabled={authorizing || disconnecting}
          className="h-7 rounded-lg px-2 text-[11px] font-bold text-primary hover:bg-surface-container disabled:opacity-60"
        >
          {authorizing ? 'Đang chuyển...' : 'Đổi tài khoản'}
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={authorizing || disconnecting}
          className="h-7 rounded-lg px-2 text-[11px] font-bold text-on-surface-variant hover:bg-surface-container hover:text-error disabled:opacity-60"
        >
          {disconnecting ? 'Đang huỷ...' : 'Huỷ kết nối'}
        </button>
      </div>
    </section>
  );
}

/**
 * Ảnh của bài: ảnh đầu là ảnh bìa. editable: cho xoá, tạo lại, sửa nguyên liệu từng ảnh và thêm ảnh từ A51.
 * requesting: id các ảnh đang gửi yêu cầu tạo lại (sau đó ảnh có status queued / processing).
 */
function ImageStrip({ images, editable, onRemove, onAdd, onRegenerate, onEditInputs, requesting = [] }) {
  const [viewing, setViewing] = useState(null);
  return (
    <section className="space-y-2">
      <ImageViewer src={viewing} alt="Ảnh bài đăng" onClose={() => setViewing(null)} />
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-on-surface">Ảnh</h2>
        <span className="text-xs text-outline">
          {images.length}/{PHOTO_MAX_COUNT} · ảnh đầu làm ảnh bìa
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => {
          const busy = isImageBusy(img) || requesting.includes(img.id);
          const failed = img.status === IMAGE_STATUS.FAILED;
          // Tạo lại / sửa nguyên liệu: ảnh đã lưu trong bài (có id) và biết được mẫu đã tạo ra nó
          const canRegenerate = editable && img.id && img.creativeSlug;
          return (
            <li key={img.key} className="space-y-1.5">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-container">
                {img.url ? (
                  <button
                    type="button"
                    onClick={() => setViewing(img.url)}
                    aria-label={`Xem ảnh ${i + 1}`}
                    className="size-full cursor-zoom-in"
                  >
                    <CoverImage src={img.url} alt="" className="size-full" />
                  </button>
                ) : (
                  failed &&
                  !busy && (
                    <span className="flex size-full flex-col items-center justify-center gap-1 bg-error-container/40 p-2 text-center text-on-error-container">
                      <Icon name="broken_image" className="text-2xl" />
                      <span className="text-[11px] font-semibold leading-tight">{img.errorMessage || 'Tạo ảnh thất bại.'}</span>
                    </span>
                  )
                )}
                <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">
                  {i === 0 ? 'Ảnh bìa' : i + 1}
                </span>
                {busy && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-white">
                    <Icon name="progress_activity" className="animate-spin text-2xl" />
                    <span className="text-[11px] font-semibold">Đang tạo ảnh...</span>
                  </span>
                )}
                {canRegenerate && !busy && (
                  <button
                    type="button"
                    onClick={() => onEditInputs(img)}
                    aria-label={`Sửa nguyên liệu ảnh ${i + 1}`}
                    title="Sửa nguyên liệu"
                    className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <Icon name="edit" className="text-sm" />
                  </button>
                )}
              </div>
              {/* Tạo lại và xoá nằm dưới ảnh, không che ảnh */}
              {editable && (
                <div className="flex gap-1">
                  {canRegenerate ? (
                    <button
                      type="button"
                      onClick={() => onRegenerate(img)}
                      disabled={busy}
                      className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-outline-variant/50 text-[11px] font-bold text-primary hover:bg-surface-container disabled:opacity-50"
                    >
                      <Icon name="refresh" className="text-sm" />
                      Tạo lại
                    </button>
                  ) : (
                    <span className="flex-1" />
                  )}
                  {images.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemove(img.key)}
                      disabled={busy}
                      aria-label={`Xoá ảnh ${i + 1}`}
                      title="Xoá ảnh"
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-outline-variant/50 text-on-surface-variant hover:border-error hover:text-error disabled:opacity-50"
                    >
                      <Icon name="delete" className="text-base" />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {editable && images.length < PHOTO_MAX_COUNT && (
          <li>
            <button
              type="button"
              onClick={onAdd}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant hover:border-primary-container hover:text-primary"
            >
              <Icon name="add_photo_alternate" className="text-2xl" />
              <span className="text-[11px] font-semibold">Thêm ảnh</span>
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

/**
 * Popup sửa nguyên liệu (thông tin nhập theo form của mẫu) của một ảnh rồi tạo lại ảnh đó.
 * Điền sẵn thông tin đã dùng lần trước nếu còn (ảnh cũ giữ lại bằng file_id, không cần tải lên lại).
 */
function EditInputsDialog({ postId, image, onSubmit, onClose }) {
  const { data: c, isLoading, error, refetch } = useCreative(image.creativeSlug);
  const schema = c?.inputSchema ?? null;
  const [saved, setSaved] = useState(undefined); // undefined: đang tải, null: không còn thông tin cũ
  const [values, setValues] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getImageInputs(postId, image).then(
      (res) => setSaved(res.values),
      () => setSaved(null),
    );
  }, [postId, image]);
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
          <CoverImage src={image.url} alt="" className="size-10 shrink-0 rounded-lg" />
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

/** Popup chọn thêm ảnh đã có trên A51. exclude: key các ảnh đã có trong bài. */
function AddImagesDialog({ exclude, max, onAdd, onClose }) {
  const [selected, setSelected] = useState([]);
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
      aria-labelledby="add-images-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-surface-container-lowest shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-surface-container px-4 py-3">
          <h2 id="add-images-title" className="flex-1 text-base font-bold text-on-surface">
            Thêm ảnh từ A51
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <A51ImagePicker selected={selected} onChange={setSelected} max={max} exclude={exclude} />
        </div>
        <div className="flex items-center gap-3 border-t border-surface-container p-3">
          <span className="flex-1 text-xs text-on-surface-variant">Chọn thêm tối đa {max} ảnh</span>
          <button
            type="button"
            onClick={() => onAdd(selected)}
            disabled={!selected.length}
            className="flex h-10 items-center rounded-xl bg-primary-container px-4 text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            Thêm {selected.length || ''} ảnh
          </button>
        </div>
      </div>
    </div>
  );
}

/** Đang tạo ảnh: AI đang tạo ảnh từ các mẫu đã chọn, xong thì bài chờ người dùng điền nội dung và đăng. */
function GeneratingPanel({ post }) {
  const done = post.images.filter((i) => !isImageBusy(i)).length;
  const steps = [['images', `Tạo ${post.images.length} ảnh từ mẫu đã chọn (xong ${done}/${post.images.length})`]];
  return (
    <section className="space-y-5 p-4 lg:mx-auto lg:w-full lg:max-w-[640px] lg:py-10">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <Icon name="auto_awesome" className="animate-pulse text-3xl" />
        </span>
        <div>
          <h2 className="text-base font-bold text-on-surface">AI đang tạo ảnh</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Bạn có thể rời trang này. Khi ảnh xong, bài chuyển sang <b>Chờ đăng</b> để bạn điền tiêu đề, nội dung và đăng.
          </p>
        </div>
        <ul className="w-full space-y-1.5 text-left">
          {steps.map(([key, label]) => (
            <li
              key={key}
              className="flex items-center gap-2 rounded-lg bg-surface-container-lowest px-3 py-2 text-xs font-semibold text-on-surface"
            >
              <Icon name="progress_activity" className="animate-spin text-base text-sky-700" />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {post.images.map((t) =>
          t.url ? (
            <CoverImage key={t.key} src={t.url} alt="" className="aspect-[3/4] w-full rounded-xl opacity-70" />
          ) : (
            <Skeleton key={t.key} className="aspect-[3/4]" />
          ),
        )}
      </div>
      <Link
        to="/tiktok"
        className="flex h-11 items-center justify-center gap-1 rounded-xl border border-outline-variant/60 text-sm font-bold text-on-surface hover:bg-surface-container"
      >
        <Icon name="list" className="text-lg" />
        Về danh sách bài đăng
      </Link>
    </section>
  );
}

/** Đang đăng / Đã đăng: chỉ xem. */
function PostPreview({ post }) {
  return (
    <div className="flex flex-col gap-6 p-4 lg:mx-auto lg:grid lg:w-full lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8 lg:py-6">
      <ImageStrip images={post.images} />
      <section className="space-y-4">
        {post.status === POST_STATUS.PUBLISHING ? (
          <p className="flex items-center gap-2 rounded-xl bg-primary-fixed/40 px-3 py-2 text-xs font-semibold text-primary">
            <Icon name="progress_activity" className="animate-spin text-base" />
            Đã gửi lên TikTok, đang chờ TikTok phản hồi...
          </p>
        ) : (
          <div className="space-y-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <p className="flex items-center gap-2">
              <Icon name="check_circle" fill className="text-base" />
              Đã đăng lên TikTok{post.tiktokUsername ? ` @${post.tiktokUsername}` : ''}
              {post.publishedAt ? ` lúc ${new Date(post.publishedAt).toLocaleString('vi-VN')}` : ''}
            </p>
            {post.tiktokPostUrl && (
              <a
                href={post.tiktokPostUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Xem bài trên TikTok
                <Icon name="open_in_new" className="text-sm" />
              </a>
            )}
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-outline">Tiêu đề</p>
          <p className="text-sm font-bold text-on-surface">{post.title}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-outline">Nội dung</p>
          <p className="whitespace-pre-line text-sm text-on-surface">{post.content || '—'}</p>
        </div>
        {post.hashtags.length > 0 && (
          <p className="flex flex-wrap gap-x-1.5 text-sm font-semibold text-primary">
            {post.hashtags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </p>
        )}
        <p className="text-xs text-on-surface-variant">
          Ai có thể xem: <b>{PRIVACY_LABELS[post.privacyLevel] ?? post.privacyLevel}</b>
        </p>
      </section>
    </div>
  );
}

/** Chờ đăng: ảnh đã xong, người dùng điền tiêu đề, nội dung rồi đăng. onRefresh: tải lại bài (bắt đầu hỏi trạng thái ảnh). */
function ReviewForm({ post, onRefresh }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => pickEdit(post));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(null); // 'publish' | 'delete'
  const [adding, setAdding] = useState(false);
  const [requesting, setRequesting] = useState([]);
  const [editingInputs, setEditingInputs] = useState(null);
  // Khoá chống trừ tiền 2 lần khi bấm "Tạo lại" lại do lỗi mạng, theo id ảnh
  const regenerateKeys = useRef({});

  // Bài được tải lại (đang tạo lại ảnh): cập nhật ảnh trong form theo id, giữ thứ tự, ảnh đã gỡ và ảnh vừa thêm.
  // Ảnh không đổi thì giữ object cũ để link ký số không đổi (ảnh không phải tải lại)
  useEffect(() => {
    const byId = new Map(post.images.map((i) => [i.id, i]));
    setForm((f) => ({
      ...f,
      images: f.images.map((i) => {
        const fresh = i.id ? byId.get(i.id) : null;
        return fresh && (fresh.status !== i.status || fresh.outputId !== i.outputId || (!i.url && fresh.url)) ? fresh : i;
      }),
    }));
  }, [post.images]);

  // ---- Tài khoản TikTok ----
  const [tiktok, setTiktok] = useState(undefined);
  const [tiktokError, setTiktokError] = useState(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const loadTiktok = useCallback(() => {
    setTiktokError(null);
    setTiktok(undefined);
    getCreatorInfo().then(setTiktok, setTiktokError);
  }, []);
  useEffect(loadTiktok, [loadTiktok]);

  // Đã ủy quyền theo connected; creator có thể thiếu (backend không lấy được creator_info) -> vẫn cho đăng,
  // backend kiểm tra lại creator_info lúc đăng
  const connected = !!tiktok?.connected;
  const creator = connected ? (tiktok.creator ?? null) : null;
  const privacyOptions = !connected
    ? []
    : creator?.privacy_level_options?.length
      ? creator.privacy_level_options
      : Object.keys(PRIVACY_LABELS);
  const canPost = connected && creator?.can_post !== false;
  const commentDisabled = !!creator?.comment_disabled;

  // Quyền riêng tư đang chọn không có trong lựa chọn của tài khoản (vd. app chưa duyệt chỉ cho SELF_ONLY): bắt chọn lại
  const privacyKey = privacyOptions.join(',');
  useEffect(() => {
    if (!privacyKey) return;
    const options = privacyKey.split(',');
    setForm((f) => (f.privacyLevel && !options.includes(f.privacyLevel) ? { ...f, privacyLevel: '' } : f));
  }, [privacyKey]);

  const authorize = async () => {
    setAuthorizing(true);
    try {
      // Chuyển sang TikTok, xong quay lại đúng trang này
      await authorizeTikTok(location.pathname + location.search);
    } catch (err) {
      setTiktokError(err);
      setAuthorizing(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Huỷ kết nối tài khoản TikTok khỏi A51?')) return;
    setDisconnecting(true);
    setFormError(null);
    try {
      await disconnectTikTok();
      loadTiktok();
    } catch (err) {
      setFormError(err?.message || 'Không huỷ được kết nối, vui lòng thử lại.');
    } finally {
      setDisconnecting(false);
    }
  };

  // ---- Form ----
  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const run = async (kind, fn) => {
    setBusy(kind);
    setFormError(null);
    try {
      await fn();
    } catch (err) {
      setFormError(err?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setBusy(null);
    }
  };

  const remove = () => {
    if (!window.confirm('Xoá bài đăng này? Ảnh vẫn còn trong lịch sử tạo ảnh.')) return;
    run('delete', async () => {
      await deletePost(post.id);
      queryClient.invalidateQueries({ queryKey: ['tiktok', 'posts'] });
      navigate('/tiktok', { replace: true });
    });
  };

  const validate = () => {
    const e = {};
    if (!form.images.length) e.images = 'Bài đăng cần ít nhất một ảnh.';
    else if (form.images.length > PHOTO_MAX_COUNT) e.images = `Bài đăng tối đa ${PHOTO_MAX_COUNT} ảnh.`;
    if (!form.title.trim()) e.title = 'Hãy nhập tiêu đề.';
    if (form.hashtags.length > HASHTAG_MAX) e.hashtags = `Tối đa ${HASHTAG_MAX} hashtag.`;
    if (captionLength(form.content, form.hashtags) > PHOTO_DESCRIPTION_MAX)
      e.content = `Nội dung và hashtag cộng lại tối đa ${PHOTO_DESCRIPTION_MAX} ký tự.`;
    if (!form.privacyLevel) e.privacyLevel = 'Hãy chọn ai có thể xem bài đăng.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev) => {
    ev.preventDefault();
    setFormError(null);
    // Nút đăng luôn bấm được: chưa đủ điều kiện thì báo lý do thay vì khoá nút
    if (!connected) {
      setFormError(tiktok === undefined ? 'Đang kiểm tra tài khoản TikTok, vui lòng chờ.' : 'Hãy ủy quyền tài khoản TikTok trước khi đăng.');
      return;
    }
    if (!canPost) {
      setFormError(creator?.cannot_post_reason?.message || 'Tài khoản TikTok này tạm thời không đăng được bài.');
      return;
    }
    if (imagesNotReady) {
      setFormError('Còn ảnh đang tạo hoặc bị lỗi: hãy chờ ảnh xong, tạo lại hoặc xoá ảnh lỗi trước khi đăng.');
      return;
    }
    if (!validate()) return;
    run('publish', async () => {
      try {
        await publishPost(post.id, { ...form, allowComment: form.allowComment && !commentDisabled });
      } catch (err) {
        // Mất kết nối / tài khoản bị chặn đăng: tải lại trạng thái tài khoản để hiện nút "Ủy quyền" hoặc lý do
        if (err?.code === 'TIKTOK_NOT_CONNECTED' || err?.code === 'TIKTOK_CANNOT_POST') loadTiktok();
        setErrors(formErrorsFrom(err?.errors));
        // Đăng lỗi: backend vẫn lưu chỉnh sửa và đặt last_error
        onRefresh();
        throw err;
      }
      queryClient.invalidateQueries({ queryKey: ['tiktok', 'posts'] });
      navigate('/tiktok', { replace: true });
    });
  };

  const addImages = (picked) => {
    set('images')([
      ...form.images,
      ...picked.map((p) => ({
        id: null,
        key: p.key,
        generationId: p.generationId,
        outputId: p.outputId,
        status: IMAGE_STATUS.COMPLETED,
        url: p.url,
        errorMessage: null,
        creativeSlug: p.creativeSlug,
        creativeTitle: p.creativeTitle,
        price: 0,
      })),
    ]);
    setAdding(false);
  };

  // Tạo lại một ảnh: chạy lại mẫu đã tạo ra ảnh đó (tính phí), ảnh mới thay vào đúng vị trí cũ.
  // edit: { schema, values } từ popup "Sửa nguyên liệu" (popup đã hiện phí nên không hỏi lại)
  const regenerate = async (img, edit) => {
    if (!edit) {
      const cost = img.price > 0 ? ` Phí ${formatVnd(img.price)}.` : '';
      if (!window.confirm(`Tạo lại ảnh này${img.creativeTitle ? ` theo mẫu "${img.creativeTitle}"` : ''}?${cost}`)) return;
    }
    const keys = regenerateKeys.current;
    keys[img.id] ??= newIdempotencyKey();
    setRequesting((ids) => [...ids, img.id]);
    setFormError(null);
    try {
      const fresh = await regenerateImage(post.id, img, keys[img.id], edit);
      delete keys[img.id];
      setForm((f) => ({ ...f, images: f.images.map((i) => (i.id === img.id ? fresh : i)) }));
      // Đã trừ tiền -> tải lại số dư; tải lại bài để hỏi trạng thái ảnh tới khi xong
      queryClient.invalidateQueries({ queryKey: ['me'] });
      onRefresh();
    } catch (err) {
      // Máy chủ đã trả lỗi (không phải lỗi mạng): chưa bị trừ tiền, lần sau dùng khoá mới
      if (err?.status) delete keys[img.id];
      setFormError(err?.message || 'Không tạo lại được ảnh, vui lòng thử lại.');
    } finally {
      setRequesting((ids) => ids.filter((id) => id !== img.id));
    }
  };

  const imagesNotReady = form.images.some((i) => i.status !== IMAGE_STATUS.COMPLETED) || requesting.length > 0;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-6 p-4 lg:mx-auto lg:grid lg:w-full lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8 lg:py-6"
    >
      {editingInputs && (
        <EditInputsDialog
          postId={post.id}
          image={editingInputs}
          onClose={() => setEditingInputs(null)}
          onSubmit={(edit) => {
            regenerate(editingInputs, edit);
            setEditingInputs(null);
          }}
        />
      )}
      {adding && (
        <AddImagesDialog
          exclude={form.images.map((i) => i.key)}
          max={PHOTO_MAX_COUNT - form.images.length}
          onAdd={addImages}
          onClose={() => setAdding(false)}
        />
      )}

      <div className="space-y-6">
        {post.lastError && !formError && (
          <p className="flex items-start gap-2 rounded-xl bg-error-container/60 px-3 py-2 text-xs text-on-error-container">
            <Icon name="error" className="text-base" />
            <span>
              <b>Đăng lần trước không thành công.</b> {post.lastError.message}
            </span>
          </p>
        )}
        <CreatorCard
          tiktok={tiktok}
          error={tiktokError}
          onRetry={loadTiktok}
          onAuthorize={authorize}
          authorizing={authorizing}
          onDisconnect={disconnect}
          disconnecting={disconnecting}
        />
        <ImageStrip
          images={form.images}
          editable
          onRemove={(key) => set('images')(form.images.filter((i) => i.key !== key))}
          onAdd={() => setAdding(true)}
          onRegenerate={(img) => regenerate(img)}
          onEditInputs={setEditingInputs}
          requesting={requesting}
        />
        {errors.images && <p className="text-xs text-error">{errors.images}</p>}
      </div>

      <div className="space-y-6">
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-on-surface">Nội dung</h2>
          <TextField
            label="Tiêu đề"
            icon="title"
            placeholder="Tiêu đề bài đăng"
            maxLength={PHOTO_TITLE_MAX}
            value={form.title}
            error={errors.title}
            onChange={(e) => set('title')(e.target.value)}
          />
          <TextArea
            label="Nội dung"
            placeholder="Mô tả cho bài đăng"
            maxLength={PHOTO_DESCRIPTION_MAX}
            rows={6}
            value={form.content}
            error={errors.content}
            onChange={(e) => set('content')(e.target.value)}
          />
          <div>
            <HashtagInput
              value={form.hashtags}
              onChange={set('hashtags')}
              hint="Hashtag được thêm vào cuối nội dung khi đăng. Nhấn Enter hoặc dấu phẩy để thêm."
            />
            {errors.hashtags && <p className="mt-1 text-xs text-error">{errors.hashtags}</p>}
          </div>
          <SelectField
            label="Ai có thể xem bài đăng này"
            value={form.privacyLevel ?? ''}
            error={errors.privacyLevel}
            disabled={!canPost}
            onChange={(e) => set('privacyLevel')(e.target.value)}
          >
            <option value="" disabled>
              Chọn quyền riêng tư
            </option>
            {privacyOptions.map((opt) => (
              <option key={opt} value={opt}>
                {PRIVACY_LABELS[opt] ?? opt}
              </option>
            ))}
          </SelectField>
        </section>

        <section className="divide-y divide-surface-container rounded-2xl border border-outline-variant/40 px-4 py-1">
          <Switch
            label="Cho phép bình luận"
            hint={commentDisabled ? 'Tài khoản TikTok của bạn đã tắt bình luận' : undefined}
            checked={form.allowComment && !commentDisabled}
            disabled={commentDisabled}
            onChange={set('allowComment')}
          />
          <Switch
            label="Tự động thêm nhạc"
            hint="TikTok chọn nhạc nền phù hợp cho bài đăng ảnh"
            checked={form.autoAddMusic}
            onChange={set('autoAddMusic')}
          />
        </section>

        <p className="text-xs leading-relaxed text-on-surface-variant">
          Bằng việc đăng bài, bạn đồng ý với{' '}
          <a
            href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
            target="_blank"
            rel="noopener"
            className="font-semibold text-primary hover:underline"
          >
            Xác nhận sử dụng nhạc
          </a>{' '}
          của TikTok. Bài đăng có thể mất vài phút để xuất hiện trên hồ sơ của bạn.
        </p>

        {formError && <FormAlert>{formError}</FormAlert>}
        {imagesNotReady && !formError && (
          <p className="text-xs text-amber-700">Còn ảnh đang tạo hoặc bị lỗi: hãy chờ ảnh xong, tạo lại hoặc xoá ảnh lỗi trước khi đăng.</p>
        )}

        <div className="space-y-2">
          <SubmitButton
            loading={busy === 'publish'}
            loadingText="Đang gửi lên TikTok..."
            disabled={!!busy}
          >
            <Icon name="send" className="text-lg" />
            Đăng lên TikTok
          </SubmitButton>
          <button
            type="button"
            onClick={remove}
            disabled={!!busy}
            className="flex h-11 w-full items-center justify-center gap-1 rounded-xl text-sm font-bold text-error hover:bg-error-container/40 disabled:opacity-60"
          >
            <Icon name="delete" className="text-lg" />
            Xoá bài đăng
          </button>
        </div>
      </div>
    </form>
  );
}

function VideoComingSoon() {
  return (
    <div className="p-4 lg:py-10">
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-outline-variant p-10 text-center">
        <Icon name="construction" className="text-4xl text-outline" />
        <p className="text-sm font-bold text-on-surface">Đăng video đang được phát triển</p>
        <p className="text-xs text-on-surface-variant">Hiện bạn có thể đăng bài dạng ảnh.</p>
      </div>
    </div>
  );
}

/** /tiktok/post/:id: bước 3, xem lại và duyệt bài trước khi đăng lên TikTok. */
export default function TikTokPostPage() {
  useSeo({ title: 'Bài đăng TikTok', noindex: true });
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/tiktok', { replace: true }));

  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('photo');

  const load = useCallback(() => {
    setError(null);
    getPost(id).then(setPost, setError);
  }, [id]);
  useEffect(load, [load]);

  // Đang tạo ảnh / đang đăng / còn ảnh đang tạo lại: tự cập nhật tới khi xong
  const polling = needsPolling(post);
  useEffect(() => {
    if (!polling) return undefined;
    const timer = setInterval(() => getPost(id).then(setPost, () => {}), POLL_INTERVAL);
    return () => {
      clearInterval(timer);
      // Xong: ảnh lỗi được hoàn tiền -> tải lại số dư; danh sách bài đổi trạng thái
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['tiktok', 'posts'] });
    };
  }, [polling, id, queryClient]);

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
        <h1 className="flex-1 truncate text-base font-bold text-on-surface">Bài đăng TikTok</h1>
        {post && (
          <span className="mr-2">
            <PostStatusBadge status={post.status} />
          </span>
        )}
      </header>

      <OAuthResultNotice />

      {/* Desktop: cùng lưới 2 cột với nội dung bên dưới để tab rộng bằng cột trái */}
      <div className="px-4 pt-4 lg:mx-auto lg:grid lg:w-full lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
        <div role="tablist" aria-label="Loại bài đăng" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container p-1">
          {[
            ['photo', 'photo_library', 'Ảnh'],
            ['video', 'movie', 'Video'],
          ].map(([value, icon, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-colors ${
                mode === value ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon name={icon} className="text-lg" />
              {label}
              {value === 'video' && (
                <span className="rounded-full bg-surface-container-high px-1.5 text-[10px] font-semibold text-outline">Sắp có</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {mode === 'video' ? (
        <VideoComingSoon />
      ) : error ? (
        <div className="p-4">
          <ErrorState error={error} onRetry={error.status === 404 ? undefined : load} />
        </div>
      ) : !post ? (
        <div className="space-y-4 p-4 lg:mx-auto lg:w-full lg:max-w-[1000px]">
          <Skeleton className="h-16" />
          <Skeleton className="h-48" />
        </div>
      ) : post.status === POST_STATUS.GENERATING ? (
        <GeneratingPanel post={post} />
      ) : post.status === POST_STATUS.PENDING_REVIEW ? (
        <ReviewForm key={post.id} post={post} onRefresh={load} />
      ) : (
        <PostPreview post={post} />
      )}
    </>
  );
}
