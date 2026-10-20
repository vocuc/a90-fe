import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import ImageViewer from '../components/common/ImageViewer';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SubmitButton, TextArea, TextField } from '../components/common/Form';
import HashtagInput from '../components/template/HashtagInput';
import A51ImagePicker from '../components/social/A51ImagePicker';
import { PlatformStatusList, PostStatusBadge } from '../components/social/PostStatus';
import {
  HASHTAG_MAX,
  IMAGE_STATUS,
  PHOTO_DESCRIPTION_MAX,
  PHOTO_MAX_COUNT,
  PHOTO_TITLE_MAX,
  PLATFORMS,
  PLATFORM_STATUS,
  POST_STATUS,
  TIKTOK_CONNECT_MESSAGES,
  authorizeTikTok,
  deletePost,
  doneLabelOf,
  getAccounts,
  getPost,
  isImageBusy,
  isPostLocked,
  publishPost,
  tiktokConnectionOf,
} from '../api/social';

// Đang chuẩn bị / chờ đăng / đang đăng: hỏi lại mỗi 3 giây
const POLL_INTERVAL = 3000;
const needsPolling = (post) => !!post && (post.status === POST_STATUS.GENERATING || isPostLocked(post));

const EDIT_FIELDS = ['images', 'title', 'content', 'hashtags'];
const pickEdit = (post) => Object.fromEntries(EDIT_FIELDS.map((k) => [k, post[k]]));

// Nội dung gửi lên nền tảng = content + "\n" + dòng hashtag, tổng không quá descriptionMax của nền tảng
const captionLength = (content, hashtags) =>
  content.length + (hashtags.length ? 1 + hashtags.map((t) => `#${t}`).join(' ').length : 0);

// Lỗi theo trường của API gửi bài (snake_case, images.N) -> trường của form
const FIELD_FROM_API = { title: 'title', content: 'content', hashtags: 'hashtags', images: 'images', platforms: 'platforms' };
const formErrorsFrom = (errors) =>
  Object.entries(errors ?? {}).reduce((acc, [field, msg]) => {
    const key = FIELD_FROM_API[field.split('.')[0]];
    if (key && !acc[key]) acc[key] = msg;
    return acc;
  }, {});

// Nền tảng đã đăng xong của bài: không đăng lại (tránh bài trùng)
const publishedPlatforms = (post) => post.platforms.filter((p) => p.status === PLATFORM_STATUS.PUBLISHED).map((p) => p.platform);
const failedPlatforms = (post) => post.platforms.filter((p) => p.status === PLATFORM_STATUS.FAILED).map((p) => p.platform);

// Cách đăng của từng nền tảng, hiện trong popup chọn nền tảng (TikTok tuỳ đã tự kết nối hay chưa: tiktokNote)
const PLATFORM_NOTE = {
  tiktok: 'Lưu vào nháp TikTok',
  facebook: 'Đăng thẳng lên trang / nhóm',
  instagram: 'Đăng thẳng, tối đa 10 ảnh',
};

/*
 * Chỉnh sửa chưa đăng được giữ lại khi người dùng sang TikTok kết nối rồi quay về trang bài (sessionStorage,
 * đọc một lần). Lỗi / chặn bộ nhớ thì bỏ qua: chỉ mất chỉnh sửa chưa đăng.
 */
const draftKey = (postId) => `a51_post_draft_${postId}`;
const saveDraft = (postId, form) => {
  try {
    sessionStorage.setItem(draftKey(postId), JSON.stringify(form));
  } catch {
    // bỏ qua
  }
};
const takeDraft = (postId) => {
  try {
    const raw = sessionStorage.getItem(draftKey(postId));
    sessionStorage.removeItem(draftKey(postId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Popup "Đăng lên đâu?": bấm Đăng bài thì chọn TikTok / Facebook / Instagram (một, vài hoặc cả 3) rồi mới tạo job.
 * Lần trước có nền tảng lỗi thì chọn sẵn các nền tảng lỗi; nền tảng đã đăng xong hiện "Đã đăng" và không chọn được.
 * imageCount / caption: để báo ngay nền tảng nào vượt giới hạn (vd Instagram 10 ảnh, 2200 ký tự).
 */
function PublishDialog({ post, accounts, imageCount, captionLen, busy, error, onConfirm, onClose, onConnectTikTok }) {
  const done = publishedPlatforms(post);
  // TikTok tự kết nối (đăng qua API, ảnh vào hộp thư TikTok); mất kết nối thì không chọn được tới khi kết nối lại
  const tiktok = tiktokConnectionOf(accounts);
  const tiktokLost = !!tiktok && tiktok.connection?.status !== 'active';
  const available = PLATFORMS.filter((p) => !done.includes(p.value) && !(p.value === 'tiktok' && tiktokLost));
  const [selected, setSelected] = useState(() => failedPlatforms(post).filter((v) => available.some((p) => p.value === v)));
  const [connecting, setConnecting] = useState(false);
  const toggle = (value) => setSelected((cur) => (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]));
  const allSelected = available.length > 0 && available.every((p) => selected.includes(p.value));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [busy, onClose]);

  // Lý do nền tảng không đăng được bài này (vượt giới hạn ảnh / ký tự)
  const limitError = (p) =>
    imageCount > p.maxImages
      ? `Tối đa ${p.maxImages} ảnh (bài có ${imageCount})`
      : captionLen > p.descriptionMax
        ? `Nội dung + hashtag tối đa ${p.descriptionMax} ký tự`
        : null;
  const chosen = PLATFORMS.filter((p) => selected.includes(p.value));
  const blocked = chosen.filter(limitError);
  const unassigned = chosen.filter((p) => !accounts.some((a) => a.platform === p.value));
  const tiktokWorker = accounts.some((a) => a.platform === 'tiktok' && a.driver === 'worker');
  const tiktokNote = tiktok
    ? `Gửi vào hộp thư TikTok${tiktok.username ? ` @${tiktok.username}` : ''}`
    : tiktokWorker
      ? 'Lưu vào nháp TikTok của A51'
      : PLATFORM_NOTE.tiktok;
  const connectTikTok = async () => {
    setConnecting(true);
    try {
      await onConnectTikTok();
    } catch {
      setConnecting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-dialog-title"
      onClick={() => !busy && onClose()}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-surface-container-lowest shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-surface-container px-4 py-3">
          <h2 id="publish-dialog-title" className="flex-1 text-base font-bold text-on-surface">
            Đăng lên đâu?
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
            className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-50"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-on-surface-variant">Chọn một hoặc nhiều nền tảng.</p>
            {available.length > 1 && (
              <button
                type="button"
                onClick={() => setSelected(allSelected ? [] : available.map((p) => p.value))}
                className="text-xs font-bold text-primary hover:underline"
              >
                {allSelected ? 'Bỏ chọn tất cả' : `Chọn cả ${available.length}`}
              </button>
            )}
          </div>

          <ul className="space-y-2">
            {PLATFORMS.map((p) => {
              const isDone = done.includes(p.value);
              const checked = isDone || selected.includes(p.value);
              const limit = !isDone && limitError(p);
              const lost = p.value === 'tiktok' && tiktokLost && !isDone;
              const doneDriver = post.platforms.find((x) => x.platform === p.value)?.driver;
              return (
                <li key={p.value}>
                  <label
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                      isDone
                        ? 'cursor-default border-emerald-200 bg-emerald-50/60'
                        : checked
                          ? 'cursor-pointer border-primary-container bg-primary-fixed/30'
                          : 'cursor-pointer border-outline-variant/60 hover:border-primary-container'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-5 rounded border-outline-variant text-primary focus:ring-primary-container disabled:opacity-50"
                      checked={checked}
                      disabled={isDone || lost || busy}
                      onChange={() => toggle(p.value)}
                    />
                    <Icon name={p.icon} className={`text-2xl ${checked ? 'text-primary' : 'text-outline'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-on-surface">{p.label}</span>
                      <span className={`block text-xs ${limit && checked ? 'text-error' : 'text-on-surface-variant'}`}>
                        {isDone
                          ? `${doneLabelOf(p.value, doneDriver)} — không đăng lại`
                          : limit || (p.value === 'tiktok' ? tiktokNote : PLATFORM_NOTE[p.value])}
                      </span>
                    </span>
                  </label>
                  {p.value === 'tiktok' && !isDone && (!tiktok || lost) && (
                    <div className="mt-1 flex items-center justify-between gap-2 px-1">
                      <span className={`text-[11px] ${lost ? 'text-error' : 'text-on-surface-variant'}`}>
                        {lost
                          ? (TIKTOK_CONNECT_MESSAGES[tiktok.connection?.status] ?? TIKTOK_CONNECT_MESSAGES.expired)
                          : 'Kết nối TikTok của bạn để gửi bài thẳng vào hộp thư TikTok.'}
                      </span>
                      <button
                        type="button"
                        onClick={connectTikTok}
                        disabled={busy || connecting}
                        className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-60"
                      >
                        {connecting && <Icon name="progress_activity" className="animate-spin text-sm" />}
                        {lost ? 'Kết nối lại' : 'Kết nối TikTok'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {chosen.some((p) => p.value === 'tiktok') && tiktok && !tiktokLost && (
            <p className="text-xs text-on-surface-variant">TikTok: mở app TikTok, vào Hộp thư để hoàn tất đăng bài.</p>
          )}
          {unassigned.length > 0 && (
            <p className="text-xs text-amber-700">
              Chưa có tài khoản {unassigned.map((p) => p.label).join(', ')}: bài sẽ chờ tới khi A51 gắn tài khoản cho bạn.
            </p>
          )}
          <p className="text-xs text-on-surface-variant">Sau khi đăng, bài bị khoá: không sửa hoặc xoá được tới khi đăng xong.</p>
          {error && <FormAlert>{error}</FormAlert>}
        </div>

        <div className="border-t border-surface-container p-3">
          <SubmitButton
            type="button"
            loading={busy}
            loadingText="Đang gửi..."
            disabled={busy || !chosen.length || blocked.length > 0}
            onClick={() => onConfirm(chosen.map((p) => p.value))}
          >
            <Icon name="send" className="text-lg" />
            {chosen.length ? `Đăng lên ${chosen.map((p) => p.label).join(', ')}` : 'Chọn nền tảng để đăng'}
          </SubmitButton>
        </div>
      </div>
    </div>
  );
}

// Kiểu dữ liệu kéo thả để đổi thứ tự ảnh (bỏ qua file kéo từ máy vào)
const MOVE_MIME = 'application/x-a51-post-image';

const STRIP_BTN =
  'flex h-8 items-center justify-center gap-1 rounded-lg border border-outline-variant/50 text-[11px] font-bold text-on-surface-variant disabled:opacity-40';

/**
 * Ảnh của bài: ảnh đầu là ảnh bìa. editable: cho xoá ảnh, thêm ảnh từ A51 và đổi thứ tự
 * (nút trái / phải / đặt làm bìa, máy tính kéo thả được). onMove(from, to): chuyển ảnh ở vị trí from sang to.
 */
function ImageStrip({ images, editable, onRemove, onAdd, onMove }) {
  const [viewing, setViewing] = useState(null);
  // Vị trí đang kéo tới, null = không kéo
  const [dropIndex, setDropIndex] = useState(null);
  const sortable = editable && images.length > 1;

  const dragProps = (i) =>
    sortable
      ? {
          draggable: true,
          onDragStart: (e) => {
            e.dataTransfer.setData(MOVE_MIME, String(i));
            e.dataTransfer.effectAllowed = 'move';
          },
          onDragOver: (e) => {
            if (![...e.dataTransfer.types].includes(MOVE_MIME)) return;
            e.preventDefault();
            if (dropIndex !== i) setDropIndex(i);
          },
          onDrop: (e) => {
            e.preventDefault();
            setDropIndex(null);
            const from = Number(e.dataTransfer.getData(MOVE_MIME));
            if (Number.isInteger(from) && from !== i) onMove(from, i);
          },
          onDragEnd: () => setDropIndex(null),
        }
      : {};

  return (
    <section className="space-y-2">
      <ImageViewer src={viewing} alt="Ảnh bài đăng" onClose={() => setViewing(null)} />
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-on-surface">Ảnh</h2>
        <span className="text-xs text-outline">
          {images.length}/{PHOTO_MAX_COUNT} · ảnh đầu làm ảnh bìa
        </span>
      </div>
      {sortable && (
        <p className="hidden text-xs text-on-surface-variant lg:block">Kéo thả ảnh để đổi thứ tự.</p>
      )}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => {
          const busy = isImageBusy(img);
          const failed = img.status === IMAGE_STATUS.FAILED;
          return (
            <li key={img.key} className="space-y-1.5" {...dragProps(i)}>
              <div
                className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-container ${
                  dropIndex === i ? 'ring-2 ring-primary-container ring-offset-2' : ''
                } ${sortable ? 'lg:cursor-grab' : ''}`}
              >
                {img.url ? (
                  <button
                    type="button"
                    onClick={() => setViewing(img.url)}
                    aria-label={`Xem ảnh ${i + 1}`}
                    className="size-full cursor-zoom-in"
                  >
                    <CoverImage src={img.thumbUrl ?? img.url} alt="" className="size-full" />
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
              </div>
              {sortable && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onMove(i, i - 1)}
                    disabled={i === 0}
                    aria-label={`Đưa ảnh ${i + 1} lên trước`}
                    title="Lên trước"
                    className={`${STRIP_BTN} w-8 shrink-0 hover:border-primary-container hover:text-primary`}
                  >
                    <Icon name="chevron_left" className="text-base" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(i, i + 1)}
                    disabled={i === images.length - 1}
                    aria-label={`Đưa ảnh ${i + 1} ra sau`}
                    title="Ra sau"
                    className={`${STRIP_BTN} w-8 shrink-0 hover:border-primary-container hover:text-primary`}
                  >
                    <Icon name="chevron_right" className="text-base" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(i, 0)}
                    disabled={i === 0}
                    aria-label={`Đặt ảnh ${i + 1} làm ảnh bìa`}
                    title="Đặt làm ảnh bìa"
                    className={`${STRIP_BTN} w-8 shrink-0 hover:border-primary-container hover:text-primary`}
                  >
                    <Icon name="star" className="text-base" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(img.key)}
                    aria-label={`Bỏ ảnh ${i + 1} khỏi bài`}
                    title="Bỏ khỏi bài"
                    className={`${STRIP_BTN} min-w-0 flex-1 hover:border-error hover:text-error`}
                  >
                    <Icon name="delete" className="text-sm" />
                    <span className="truncate">Bỏ</span>
                  </button>
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

/** Đang chuẩn bị: ảnh đã có, A51 đang viết sẵn tiêu đề / nội dung (chỉ khi bật AI viết nội dung). */
function GeneratingPanel({ post }) {
  return (
    <section className="space-y-5 p-4 lg:mx-auto lg:w-full lg:max-w-[640px] lg:py-10">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <Icon name="auto_awesome" className="animate-pulse text-3xl" />
        </span>
        <div>
          <h2 className="text-base font-bold text-on-surface">Đang chuẩn bị bài đăng</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Bạn có thể rời trang này. Xong, bài chuyển sang <b>Chờ gửi</b> để bạn xem lại và đăng bài.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {post.images.map((t) =>
          t.url ? (
            <CoverImage key={t.key} src={t.thumbUrl ?? t.url} alt="" className="aspect-[3/4] w-full rounded-xl opacity-70" />
          ) : (
            <Skeleton key={t.key} className="aspect-[3/4]" />
          ),
        )}
      </div>
      <Link
        to="/posts"
        className="flex h-11 items-center justify-center gap-1 rounded-xl border border-outline-variant/60 text-sm font-bold text-on-surface hover:bg-surface-container"
      >
        <Icon name="list" className="text-lg" />
        Về danh sách bài đăng
      </Link>
    </section>
  );
}

/** Chờ đăng / Đang đăng / Đã đăng: chỉ xem, không sửa, không xoá. Trạng thái từng nền tảng ở đầu cột phải. */
function PostPreview({ post }) {
  return (
    <div className="flex flex-col gap-6 p-4 lg:mx-auto lg:grid lg:w-full lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8 lg:py-6">
      <ImageStrip images={post.images} />
      <section className="space-y-4">
        {post.status === POST_STATUS.QUEUED ? (
          <div className="space-y-1 rounded-xl bg-primary-fixed/40 px-3 py-2 text-xs text-primary">
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="schedule" className="text-base" />
              Bài đang chờ đến lượt đăng.
            </p>
            <p>Bạn có thể rời trang này. Bài đã khoá, không sửa hoặc xoá được trong lúc đăng.</p>
          </div>
        ) : post.status === POST_STATUS.PUBLISHING ? (
          <p className="flex items-center gap-2 rounded-xl bg-primary-fixed/40 px-3 py-2 text-xs font-semibold text-primary">
            <Icon name="progress_activity" className="animate-spin text-base" />
            Đang đăng bài...
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <Icon name="check_circle" fill className="text-base" />
            Đã đăng xong
            {post.publishedAt ? ` lúc ${new Date(post.publishedAt).toLocaleString('vi-VN')}` : ''}
          </p>
        )}
        <PlatformStatusList platforms={post.platforms} />
        <div>
          <p className="text-xs font-semibold text-outline">Tiêu đề</p>
          <p className="text-sm font-bold text-on-surface">{post.title || '—'}</p>
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
      </section>
    </div>
  );
}

/**
 * Chờ gửi: ảnh đã xong, người dùng xem lại (tiêu đề, nội dung không bắt buộc) rồi bấm "Đăng bài": popup chọn
 * TikTok / Facebook / Instagram (một, vài hoặc cả 3), xác nhận mới tạo job. TikTok: lưu nháp; Facebook / Instagram: đăng thẳng.
 * onRefresh: tải lại bài (sau khi đăng lỗi, để hiện last_error).
 */
function ReviewForm({ post, onRefresh }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Quay về từ màn hình kết nối TikTok: lấy lại chỉnh sửa chưa đăng
  const [form, setForm] = useState(() => takeDraft(post.id) ?? pickEdit(post));
  // Tài khoản admin đã gắn: popup báo nền tảng nào chưa có tài khoản (lỗi tải: coi như chưa có)
  const accountsQuery = useQuery({ queryKey: ['social', 'accounts'], queryFn: getAccounts, staleTime: 60_000 });
  const done = publishedPlatforms(post);
  const [choosing, setChoosing] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(null); // 'publish' | 'delete'
  const [adding, setAdding] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ['social', 'posts'] });
      navigate('/posts', { replace: true });
    });
  };

  // Giới hạn riêng từng nền tảng kiểm tra trong popup chọn nền tảng
  const validate = () => {
    const e = {};
    if (!form.images.length) e.images = 'Bài đăng cần ít nhất một ảnh.';
    else if (form.images.length > PHOTO_MAX_COUNT) e.images = `Bài đăng tối đa ${PHOTO_MAX_COUNT} ảnh.`;
    if (form.hashtags.length > HASHTAG_MAX) e.hashtags = `Tối đa ${HASHTAG_MAX} hashtag.`;
    if (captionLength(form.content, form.hashtags) > PHOTO_DESCRIPTION_MAX)
      e.content = `Nội dung và hashtag cộng lại tối đa ${PHOTO_DESCRIPTION_MAX} ký tự.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev) => {
    ev.preventDefault();
    setFormError(null);
    // Nút đăng luôn bấm được: chưa đủ điều kiện thì báo lý do thay vì khoá nút
    if (imagesNotReady) {
      setFormError('Còn ảnh chưa xong hoặc bị lỗi: hãy bỏ ảnh đó khỏi bài trước khi đăng.');
      return;
    }
    if (!validate()) return;
    setChoosing(true);
  };

  // Đã chọn nền tảng trong popup: lưu chỉnh sửa + tạo 1 job / nền tảng
  const publish = (platforms) =>
    run('publish', async () => {
      try {
        await publishPost(post.id, { ...form, platforms });
      } catch (err) {
        setErrors(formErrorsFrom(err?.errors));
        // Mất kết nối TikTok: tải lại tài khoản để popup hiện nút "Kết nối lại"
        if (err?.code === 'TIKTOK_NOT_CONNECTED') queryClient.invalidateQueries({ queryKey: ['social', 'accounts'] });
        // Đăng lỗi: backend vẫn lưu chỉnh sửa và đặt last_error
        onRefresh();
        throw err;
      }
      queryClient.invalidateQueries({ queryKey: ['social', 'posts'] });
      navigate('/posts', { replace: true });
    });

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
        thumbUrl: p.thumbUrl,
        errorMessage: null,
        creativeSlug: p.creativeSlug,
        creativeTitle: p.creativeTitle,
        price: 0,
      })),
    ]);
    setAdding(false);
  };

  const moveImage = (from, to) => {
    if (to < 0 || to >= form.images.length || to === from) return;
    const next = [...form.images];
    next.splice(to, 0, ...next.splice(from, 1));
    set('images')(next);
  };

  const imagesNotReady = form.images.some((i) => i.status !== IMAGE_STATUS.COMPLETED);

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-6 p-4 lg:mx-auto lg:grid lg:w-full lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8 lg:py-6"
    >
      {choosing && (
        <PublishDialog
          post={post}
          accounts={accountsQuery.data ?? []}
          imageCount={form.images.length}
          captionLen={captionLength(form.content, form.hashtags)}
          busy={busy === 'publish'}
          error={formError}
          onConfirm={publish}
          onConnectTikTok={() => {
            saveDraft(post.id, form);
            return authorizeTikTok(`/posts/${post.id}`);
          }}
          onClose={() => {
            setChoosing(false);
            setFormError(null);
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
        {post.platforms.length > 0 && <PlatformStatusList platforms={post.platforms} showErrors />}
        <ImageStrip
          images={form.images}
          editable
          onRemove={(key) => set('images')(form.images.filter((i) => i.key !== key))}
          onAdd={() => setAdding(true)}
          onMove={moveImage}
        />
        {errors.images && <p className="text-xs text-error">{errors.images}</p>}
      </div>

      <div className="space-y-6">
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-on-surface">Nội dung</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">Không bắt buộc.</p>
          </div>
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
              hint="Hashtag được thêm vào cuối nội dung. Nhấn Enter hoặc dấu phẩy để thêm."
            />
            {errors.hashtags && <p className="mt-1 text-xs text-error">{errors.hashtags}</p>}
          </div>
        </section>

        <p className="flex items-start gap-2 rounded-xl bg-surface-container px-3 py-2 text-xs leading-relaxed text-on-surface-variant">
          <Icon name="info" className="text-base" />
          <span>
            Bấm <b>Đăng bài</b> để chọn đăng lên TikTok, Facebook, Instagram hoặc cả 3. TikTok: đã kết nối TikTok của bạn thì
            bài vào hộp thư TikTok, chưa thì lưu nháp. Sau khi đăng, bài bị khoá: không sửa hoặc xoá được tới khi đăng xong.
          </span>
        </p>

        {formError && !choosing && <FormAlert>{formError}</FormAlert>}
        {imagesNotReady && !formError && (
          <p className="text-xs text-amber-700">Còn ảnh chưa xong hoặc bị lỗi: hãy bỏ ảnh đó khỏi bài trước khi đăng.</p>
        )}

        <div className="space-y-2">
          <SubmitButton loading={busy === 'publish'} loadingText="Đang gửi..." disabled={!!busy}>
            <Icon name="send" className="text-lg" />
            {done.length ? 'Đăng lại' : 'Đăng bài'}
          </SubmitButton>
          {/* Đã đăng lên nền tảng nào đó: không xoá được trên A51 */}
          {!done.length && (
            <button
              type="button"
              onClick={remove}
              disabled={!!busy}
              className="flex h-11 w-full items-center justify-center gap-1 rounded-xl text-sm font-bold text-error hover:bg-error-container/40 disabled:opacity-60"
            >
              <Icon name="delete" className="text-lg" />
              Xoá bài đăng
            </button>
          )}
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

/** /posts/:id: xem lại bài rồi đăng lên TikTok (lưu nháp) / Facebook / Instagram. */
export default function SocialPostPage() {
  useSeo({ title: 'Bài đăng', noindex: true });
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/posts', { replace: true }));

  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('photo');

  const load = useCallback(() => {
    setError(null);
    getPost(id).then(setPost, setError);
  }, [id]);
  useEffect(load, [load]);

  // Đang chuẩn bị / chờ đăng / đang đăng: tự cập nhật tới khi xong
  const polling = needsPolling(post);
  useEffect(() => {
    if (!polling) return undefined;
    const timer = setInterval(() => getPost(id).then(setPost, () => {}), POLL_INTERVAL);
    return () => {
      clearInterval(timer);
      // Xong: danh sách bài đổi trạng thái
      queryClient.invalidateQueries({ queryKey: ['social', 'posts'] });
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
        <h1 className="flex-1 truncate text-base font-bold text-on-surface">Bài đăng</h1>
        {post && (
          <span className="mr-2">
            <PostStatusBadge status={post.status} />
          </span>
        )}
      </header>

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
