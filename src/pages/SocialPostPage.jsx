import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import { useMe } from '../hooks/queries';
import { formatVnd } from '../utils/format';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import ImageViewer from '../components/common/ImageViewer';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SelectField, SubmitButton, TextArea, TextField } from '../components/common/Form';
import HashtagInput from '../components/template/HashtagInput';
import { hashtagSlug } from '../utils/hashtag';
import { readHashtagHistory, recordHashtags, suggestHashtags } from '../utils/hashtagHistory';
import A51ImagePicker from '../components/social/A51ImagePicker';
import { PlatformStatusList, PostStatusBadge } from '../components/social/PostStatus';
import PlanScript from '../components/social/PlanScript';
import CancelPostButton from '../components/social/CancelPostButton';
import {
  HASHTAG_MAX,
  IMAGE_STATUS,
  PHOTO_DESCRIPTION_MAX,
  PHOTO_MAX_COUNT,
  PHOTO_TITLE_MAX,
  PLAN_IMAGES_FAILED,
  PLATFORMS,
  PLATFORM_STATUS,
  POST_STATUS,
  POST_TYPE,
  deletePost,
  getPost,
  isImageBusy,
  isPostEditable,
  listVideoPostTemplates,
  publishPost,
  retryPost,
  rewritePostContent,
} from '../api/social';
import { useConfirm } from '../components/common/ConfirmDialog';
import { POSTS_KEY, formatSchedule, fromLocalInput, toLocalInput, useShopWorkers, workerLabel } from '../components/social/VideoPostDialogs';

// Đang chuẩn bị / đang đăng / chờ đăng đã tới giờ: hỏi lại mỗi 3 giây
const POLL_INTERVAL = 3000;
const needsPolling = (post) =>
  !!post &&
  (post.status === POST_STATUS.GENERATING ||
    post.status === POST_STATUS.PUBLISHING ||
    (post.status === POST_STATUS.QUEUED && new Date(post.scheduledAt ?? 0) <= new Date()));

// Nội dung gửi lên nền tảng = content + "\n" + dòng hashtag, tổng không quá descriptionMax của nền tảng
const captionLength = (content, hashtags) =>
  content.length + (hashtags.length ? 1 + hashtags.map((t) => `#${t}`).join(' ').length : 0);

// Lỗi theo trường của API đăng bài (snake_case, images.N) -> trường của form
const FIELD_FROM_API = {
  title: 'title',
  content: 'content',
  hashtags: 'hashtags',
  images: 'images',
  platforms: 'platforms',
  worker_id: 'worker',
  video_template_id: 'template',
  scheduled_at: 'scheduledAt',
};
const formErrorsFrom = (errors) =>
  Object.entries(errors ?? {}).reduce((acc, [field, msg]) => {
    const key = FIELD_FROM_API[field.split('.')[0]];
    if (key && !acc[key]) acc[key] = msg;
    return acc;
  }, {});

// Nền tảng đã đăng xong của bài: không đăng lại (tránh bài trùng)
const publishedPlatforms = (post) => post.platforms.filter((p) => p.status === PLATFORM_STATUS.PUBLISHED).map((p) => p.platform);

/*
 * Worker chọn trong phần soạn bài (note/gop-luong-dang-bai.txt): bài đã giao worker thì chọn sẵn worker đó, không thì worker
 * chọn lần trước (localStorage, lỗi / bị chặn thì bỏ qua), không có thì worker đăng bài đầu tiên của shop.
 */
const WORKER_PREF_KEY = 'a51_post_worker';
const readWorkerPref = () => {
  try {
    return localStorage.getItem(WORKER_PREF_KEY) ?? '';
  } catch {
    return '';
  }
};
const saveWorkerPref = (id) => {
  try {
    localStorage.setItem(WORKER_PREF_KEY, id);
  } catch {
    // bỏ qua
  }
};

function usePostWorker(post) {
  const query = useShopWorkers();
  const workers = query.data;
  // null: chưa chọn trên trang này
  const [picked, setPicked] = useState(null);
  const [pref] = useState(readWorkerPref);
  const exists = (id) => !!id && workers?.some((w) => String(w.id) === String(id));
  const fallback = workers?.[0];
  const workerId = [picked, post?.worker?.id, pref].find(exists) ?? (fallback ? fallback.id : '');
  const setWorkerId = (id) => {
    setPicked(id);
    saveWorkerPref(id);
  };
  return { workers, isLoading: query.isLoading, error: query.error, workerId: String(workerId), setWorkerId };
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
                    <Icon name="delete" className="text-base" />
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

/**
 * Đang chuẩn bị: ảnh đã có, AI đang viết sẵn tiêu đề / nội dung / hashtag (chỉ khi bật AI viết nội dung lúc tạo bài).
 * Bài kế hoạch: đang tạo ảnh theo kịch bản rồi AI viết nội dung.
 */
function GeneratingPanel({ post, onCancelled, onStale }) {
  const imagesBusy = post.images.some(isImageBusy);
  return (
    <section className="space-y-5 p-4 lg:mx-auto lg:w-full lg:max-w-[640px] lg:py-10">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <Icon name="auto_awesome" className="animate-pulse text-3xl" />
        </span>
        <div>
          <h2 className="text-base font-bold text-on-surface">
            {post.plan && imagesBusy ? 'Đang tạo ảnh theo kịch bản' : 'AI đang viết tiêu đề, nội dung, hashtag'}
          </h2>
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
      <div className="flex gap-2">
        <Link
          to="/posts"
          className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-outline-variant/60 text-sm font-bold text-on-surface hover:bg-surface-container"
        >
          <Icon name="list" className="text-lg" />
          Về danh sách bài đăng
        </Link>
        <CancelPostButton post={post} onCancelled={onCancelled} onStale={onStale} />
      </div>
      <PlanScript post={post} />
    </section>
  );
}

/** Template video của bài (tên, số ảnh, link video mẫu). */
function TemplateInfo({ template }) {
  if (!template?.name) return null;
  return (
    <p className="text-sm text-on-surface">
      <span className="text-xs font-semibold text-outline">Template: </span>
      {template.videoUrl ? (
        <a href={template.videoUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">
          {template.name}
        </a>
      ) : (
        <b>{template.name}</b>
      )}
      {template.imageCount ? ` · ${template.imageCount} ảnh` : ''}
    </p>
  );
}

/**
 * Đang đăng / Đã đăng: chỉ xem, không sửa, không xoá. Đang đăng mà worker im lặng: "Tạo lại" (có thể đăng trùng).
 * onChanged(post): sau khi tạo lại.
 */
function PostPreview({ post, onChanged }) {
  const queryClient = useQueryClient();
  const { confirm, alert } = useConfirm();
  const [busy, setBusy] = useState(false);

  const recreate = async () => {
    const ok = await confirm(
      'Worker đã nhận bài này. Nếu worker thực ra đã đăng xong nhưng chưa báo lại, tạo lại có thể làm bài bị đăng 2 lần. Vẫn tạo lại?',
      { confirmLabel: 'Tạo lại', danger: true },
    );
    if (!ok) return;
    setBusy(true);
    try {
      onChanged(await retryPost(post.id));
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
    } catch (err) {
      alert(err?.message || 'Không tạo lại được, vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:mx-auto lg:grid lg:w-full lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8 lg:py-6">
      <ImageStrip images={post.images} />
      <section className="space-y-4">
        <PlanScript post={post} />
        {post.status === POST_STATUS.PUBLISHING ? (
          <div className="space-y-2 rounded-xl bg-primary-fixed/40 px-3 py-2 text-xs text-primary">
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="progress_activity" className="animate-spin text-base" />
              Worker {post.worker?.name ? <b>{post.worker.name}</b> : ''} đang {post.type === POST_TYPE.VIDEO ? 'dựng video và đăng' : 'đăng'} bài...
            </p>
            <p>Nếu worker bị tắt và không báo lại, bấm Tạo lại để bài về chờ đăng.</p>
            <button
              type="button"
              onClick={recreate}
              disabled={busy}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-primary px-3 font-bold hover:bg-primary-fixed/40 disabled:opacity-50"
            >
              <Icon name={busy ? 'progress_activity' : 'replay'} className={`text-base ${busy ? 'animate-spin' : ''}`} />
              Tạo lại
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <Icon name="check_circle" fill className="text-base" />
            Đã đăng xong
            {post.publishedAt ? ` lúc ${new Date(post.publishedAt).toLocaleString('vi-VN')}` : ''}
          </p>
        )}
        <PlatformStatusList platforms={post.platforms} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-xs font-semibold text-outline">Worker</dt>
          <dd className="font-semibold text-on-surface">{post.worker?.name ?? '—'}</dd>
          <dt className="text-xs font-semibold text-outline">Giờ đăng</dt>
          <dd className="font-semibold text-on-surface">{formatSchedule(post.scheduledAt)}</dd>
        </dl>
        {post.type === POST_TYPE.VIDEO && <TemplateInfo template={post.video?.template} />}
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
 * Chọn nền tảng đăng (một hoặc nhiều). Nền tảng đã đăng xong: "Đã đăng", không chọn lại. limitError(p): lý do nền tảng
 * không nhận bài này (vượt số ảnh / ký tự), hiện đỏ khi đang chọn.
 */
function PlatformPicker({ value, onChange, done, limitError, error }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-bold text-on-surface">Đăng lên</h2>
        <p className="mt-0.5 text-xs text-on-surface-variant">Chọn một hoặc nhiều nền tảng.</p>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {PLATFORMS.map((p) => {
          const isDone = done.includes(p.value);
          const checked = isDone || value.includes(p.value);
          const limit = !isDone && checked && limitError(p);
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
                  disabled={isDone}
                  onChange={() => toggle(p.value)}
                />
                <Icon name={p.icon} className={`text-2xl ${checked ? 'text-primary' : 'text-outline'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-on-surface">{p.label}</span>
                  {(isDone || limit) && (
                    <span className={`block text-xs ${limit ? 'text-error' : 'text-emerald-700'}`}>
                      {isDone ? 'Đã đăng — không đăng lại' : limit}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-xs text-error">{error}</p>}
    </section>
  );
}

/**
 * Soạn và đăng bài (chờ gửi / chờ tới giờ), note/gop-luong-dang-bai.txt. Dùng chung cho bài ảnh và bài video (type: tab
 * đang chọn). Worker chọn ở ô đầu form. Bài video: chọn template; thiếu ảnh so với số ảnh template cần thì
 * yêu cầu thêm ảnh, thừa thì bỏ bớt. Chọn nền tảng, giờ đăng (mặc định bây giờ) rồi bấm Đăng bài: bài sang "Chờ đăng",
 * tới giờ worker nhận và đăng. Chuyển tab Ảnh / Video không mất chỉnh sửa.
 */
function PostEditor({ post, type, worker, onChanged }) {
  const { workerId } = worker;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const video = type === POST_TYPE.VIDEO;
  const done = publishedPlatforms(post);
  const [form, setForm] = useState(() => ({
    images: post.images,
    title: post.title,
    content: post.content,
    hashtags: post.hashtags,
    templateId: post.video?.template?.id ? String(post.video.template.id) : '',
    // Bài mới: mặc định TikTok
    platforms: (post.selectedPlatforms.length ? post.selectedPlatforms : ['tiktok']).filter((p) => !done.includes(p)),
    // Chờ tới giờ: giữ giờ đã hẹn; bài kế hoạch: giờ theo kế hoạch (đã qua thì bây giờ); còn lại: bây giờ
    scheduledAt: toLocalInput(
      post.status === POST_STATUS.QUEUED && post.scheduledAt
        ? post.scheduledAt
        : post.plan && post.scheduledAt
          ? Math.max(new Date(post.scheduledAt).getTime(), Date.now())
          : Date.now(),
    ),
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(null); // 'publish' | 'delete' | 'ai'
  const [adding, setAdding] = useState(false);
  const { data: me } = useMe();
  const ai = me?.socialAi;
  const { confirm } = useConfirm();
  // Hashtag đã nhập ở các bài trước (cookie), gợi ý dưới ô hashtag
  const [hashtagHistory, setHashtagHistory] = useState(readHashtagHistory);
  // Template video (cần hồ sơ người bán); chỉ tải khi mở tab Video
  const templates = useQuery({ queryKey: ['social', 'video-templates'], queryFn: listVideoPostTemplates, enabled: video, retry: false });

  const template = templates.data?.find((t) => String(t.id) === form.templateId) ?? null;
  const required = template?.imageCount ?? 0;
  const missing = video && template ? Math.max(0, required - form.images.length) : 0;
  const extra = video && template ? Math.max(0, form.images.length - required) : 0;
  const imagesNotReady = form.images.some((i) => i.status !== IMAGE_STATUS.COMPLETED);
  const captionLen = captionLength(form.content, form.hashtags);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError(null);
  };

  // Thêm hashtag: cộng lần dùng vào cookie (xoá thì không trừ)
  const setHashtags = (next) => {
    const added = next.filter((t) => !form.hashtags.some((x) => hashtagSlug(x) === hashtagSlug(t)));
    if (added.length) setHashtagHistory(recordHashtags(added));
    set('hashtags')(next);
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

  const remove = async () => {
    if (!(await confirm('Xoá bài đăng này? Ảnh vẫn còn trong lịch sử tạo ảnh.', { confirmLabel: 'Xoá', danger: true }))) return;
    run('delete', async () => {
      await deletePost(post.id);
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
      navigate('/posts', { replace: true });
    });
  };

  // "Viết lại bằng AI": điền nội dung AI viết vào form (chưa lưu), người dùng xem lại rồi tự đăng
  const rewrite = async () => {
    const hasContent = form.title.trim() || form.content.trim() || form.hashtags.length;
    if (hasContent && !(await confirm(`AI sẽ viết lại và thay tiêu đề, nội dung, hashtag hiện tại. Phí ${formatVnd(ai.price)}.`, { confirmLabel: 'Viết lại' }))) return;
    run('ai', async () => {
      const next = await rewritePostContent(post.id);
      setForm((f) => ({ ...f, title: next.title, content: next.content, hashtags: next.hashtags }));
      setErrors((e) => ({ ...e, title: undefined, content: undefined, hashtags: undefined }));
      queryClient.invalidateQueries({ queryKey: ['me'] });
    });
  };

  // Lý do nền tảng không nhận bài này (bài video không giới hạn số ảnh)
  const limitError = (p) =>
    !video && form.images.length > p.maxImages
      ? `Tối đa ${p.maxImages} ảnh (bài có ${form.images.length})`
      : captionLen > p.descriptionMax
        ? `Nội dung + hashtag tối đa ${p.descriptionMax} ký tự`
        : null;

  const validate = () => {
    const e = {};
    if (!workerId) e.worker = 'Chọn worker làm việc.';
    if (!form.images.length) e.images = 'Bài đăng cần ít nhất một ảnh.';
    else if (!video && form.images.length > PHOTO_MAX_COUNT) e.images = `Bài đăng tối đa ${PHOTO_MAX_COUNT} ảnh.`;
    if (video) {
      if (!template) e.template = 'Chọn video template.';
      else if (missing) e.images = `Template cần ${required} ảnh, bài mới có ${form.images.length}: thêm ${missing} ảnh nữa.`;
      else if (extra) e.images = `Template chỉ cần ${required} ảnh: bỏ bớt ${extra} ảnh.`;
    }
    if (form.hashtags.length > HASHTAG_MAX) e.hashtags = `Tối đa ${HASHTAG_MAX} hashtag.`;
    if (captionLen > PHOTO_DESCRIPTION_MAX) e.content = `Nội dung và hashtag cộng lại tối đa ${PHOTO_DESCRIPTION_MAX} ký tự.`;
    const chosen = PLATFORMS.filter((p) => form.platforms.includes(p.value));
    if (!chosen.length) e.platforms = 'Chọn ít nhất một nền tảng để đăng.';
    else if (chosen.some(limitError)) e.platforms = 'Có nền tảng không nhận được bài này, xem dòng đỏ ở trên.';
    if (!form.scheduledAt) e.scheduledAt = 'Chọn giờ đăng.';
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
    run('publish', async () => {
      try {
        await publishPost(post.id, {
          ...form,
          type,
          workerId: Number(workerId),
          templateId: form.templateId ? Number(form.templateId) : null,
          productId: post.video?.product?.id ?? null,
          scheduledAt: fromLocalInput(form.scheduledAt),
        });
      } catch (err) {
        setErrors(formErrorsFrom(err?.errors));
        throw err;
      }
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
      navigate('/posts', { replace: true });
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

  const queued = post.status === POST_STATUS.QUEUED;
  const submitLabel = queued ? 'Lưu thay đổi' : post.lastError ? 'Đăng lại' : 'Đăng bài';
  const addMax = video && template && missing ? missing : PHOTO_MAX_COUNT - form.images.length;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-6 p-4 lg:mx-auto lg:grid lg:w-full lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8 lg:py-6"
    >
      {adding && (
        <AddImagesDialog
          exclude={form.images.map((i) => i.key)}
          max={Math.max(1, addMax)}
          onAdd={addImages}
          onClose={() => setAdding(false)}
        />
      )}

      {/* Cột trái: danh sách ảnh */}
      <div className="space-y-4">
        {video && template && missing > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:flex-row sm:items-center">
            <p className="flex flex-1 items-start gap-2">
              <Icon name="add_photo_alternate" className="text-base" />
              <span>
                Template <b>{template.name}</b> cần <b>{required} ảnh</b>, bài mới có {form.images.length}. Thêm <b>{missing} ảnh</b> nữa để
                tạo video.
              </span>
            </p>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-amber-600 px-3 font-bold text-white hover:bg-amber-700"
            >
              <Icon name="add" className="text-base" />
              Thêm {missing} ảnh
            </button>
          </div>
        )}
        {video && template && extra > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
            <Icon name="info" className="text-base" />
            <span>
              Template chỉ cần <b>{required} ảnh</b>: bấm biểu tượng thùng rác ở {extra} ảnh không muốn dùng. Thứ tự ảnh là thứ tự trong video.
            </span>
          </p>
        )}
        <ImageStrip
          images={form.images}
          editable
          onRemove={(key) => set('images')(form.images.filter((i) => i.key !== key))}
          onAdd={() => setAdding(true)}
          onMove={moveImage}
        />
        {errors.images && <p className="text-xs text-error">{errors.images}</p>}
      </div>

      {/* Cột phải: worker, template, nội dung, nền tảng, giờ đăng, nút đăng */}
      <div className="space-y-6">
        <PlanScript post={post} onRedone={onChanged} />
        {post.lastError && post.lastError.code !== PLAN_IMAGES_FAILED && !formError && (
          <p className="flex items-start gap-2 rounded-xl bg-error-container/60 px-3 py-2 text-xs text-on-error-container">
            <Icon name="error" className="text-base" />
            <span>
              <b>Đăng lần trước không thành công.</b> {post.lastError.message}
            </span>
          </p>
        )}
        {queued && (
          <p className="flex items-start gap-2 rounded-xl bg-primary-fixed/40 px-3 py-2 text-xs text-primary">
            <Icon name="schedule" className="text-base" />
            <span>
              Bài đang chờ tới giờ đăng (<b>{formatSchedule(post.scheduledAt)}</b>)
              {post.worker ? (
                <>
                  , worker <b>{post.worker.name}</b> sẽ nhận
                </>
              ) : null}
              . Còn sửa / xoá được tới khi worker nhận bài.
            </span>
          </p>
        )}
        {post.platforms.length > 0 && <PlatformStatusList platforms={post.platforms} showErrors />}
        <section className="space-y-4">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-on-surface">Nội dung</h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">Không bắt buộc.</p>
            </div>
            {ai?.enabled && (
              <button
                type="button"
                onClick={rewrite}
                disabled={!!busy}
                title={`AI viết lại tiêu đề, nội dung, hashtag (${formatVnd(ai.price)})`}
                className="flex h-9 shrink-0 items-center gap-1 rounded-xl border border-primary-container/50 px-3 text-xs font-bold text-primary hover:bg-primary-fixed/40 disabled:opacity-60"
              >
                <Icon name={busy === 'ai' ? 'progress_activity' : 'auto_awesome'} className={`text-base ${busy === 'ai' ? 'animate-spin' : ''}`} />
                {busy === 'ai' ? 'AI đang viết...' : 'Viết lại bằng AI'}
              </button>
            )}
          </div>
          <SelectField
            label="Worker làm việc"
            value={workerId}
            onChange={(e) => {
              worker.setWorkerId(e.target.value);
              setErrors((er) => ({ ...er, worker: undefined }));
            }}
            disabled={worker.isLoading || !worker.workers?.length}
            error={errors.worker}
            hint={
              worker.error
                ? worker.error.status === 403
                  ? 'Cần mở cửa hàng (hồ sơ người bán) để giao bài cho worker.'
                  : 'Không tải được danh sách worker, tải lại trang để thử lại.'
                : !worker.isLoading && !worker.workers?.length
                  ? 'Shop chưa được gắn worker đăng bài nào, liên hệ A51 để được gắn.'
                  : 'Worker nhận bài khi tới giờ đăng và đăng lên các nền tảng đã chọn.'
            }
          >
            {worker.isLoading ? (
              <option value="">Đang tải worker...</option>
            ) : !worker.workers?.length ? (
              <option value="">Chưa có worker</option>
            ) : (
              worker.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {workerLabel(w)}
                </option>
              ))
            )}
          </SelectField>
          {video && (
            <section className="space-y-2">
              <SelectField
                label="Video template"
                value={form.templateId}
                onChange={(e) => set('templateId')(e.target.value)}
                error={errors.template}
                hint={
                  templates.error
                    ? 'Cần mở cửa hàng (hồ sơ người bán) để tạo bài video.'
                    : templates.data && !templates.data.length
                      ? 'Chưa có template nào đang bật và có số ảnh.'
                      : 'Worker dựng video theo template từ ảnh của bài, đúng thứ tự ảnh.'
                }
              >
                <option value="">{templates.isLoading ? 'Đang tải...' : 'Chọn template'}</option>
                {!template && post.video?.template?.name && form.templateId && (
                  <option value={form.templateId} disabled>
                    {post.video.template.name} (đã tắt / đã xoá)
                  </option>
                )}
                {(templates.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.imageCount} ảnh
                  </option>
                ))}
              </SelectField>
              {template?.videoUrl && (
                <a
                  href={template.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <Icon name="play_circle" className="text-base" />
                  Xem video mẫu
                </a>
              )}
            </section>
          )}
          <TextField
            label="Tiêu đề"
            icon="title"
            multiline
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
              onChange={setHashtags}
              lowercase
              quickPicks={(text) => suggestHashtags(hashtagHistory, text, form.hashtags)}
              remoteSuggest={false}
              hint="Hashtag được thêm vào cuối nội dung. Nhấn Enter hoặc dấu phẩy để thêm."
            />
            {errors.hashtags && <p className="mt-1 text-xs text-error">{errors.hashtags}</p>}
          </div>
        </section>

        <PlatformPicker value={form.platforms} onChange={set('platforms')} done={done} limitError={limitError} error={errors.platforms} />

        <TextField
          label="Giờ đăng"
          icon="schedule"
          type="datetime-local"
          value={form.scheduledAt}
          onChange={(e) => set('scheduledAt')(e.target.value)}
          error={errors.scheduledAt}
          hint="Mặc định là bây giờ. Tới giờ, worker nhận bài và đăng."
        />

        <p className="flex items-start gap-2 rounded-xl bg-surface-container px-3 py-2 text-xs leading-relaxed text-on-surface-variant">
          <Icon name="info" className="text-base" />
          <span>
            Bấm <b>{submitLabel}</b> để giao bài cho worker đã chọn. Tới giờ đăng, worker
            {video ? ' dựng video theo template rồi' : ''} đăng lên các nền tảng đã chọn bằng tài khoản trên máy worker. Worker nhận bài
            rồi thì không sửa hoặc xoá được.
          </span>
        </p>

        {formError && <FormAlert>{formError}</FormAlert>}
        {imagesNotReady && !formError && (
          <p className="text-xs text-amber-700">Còn ảnh chưa xong hoặc bị lỗi: hãy bỏ ảnh đó khỏi bài trước khi đăng.</p>
        )}

        <div className="space-y-2">
          <SubmitButton loading={busy === 'publish'} loadingText="Đang gửi..." disabled={!!busy}>
            <Icon name={video ? 'movie' : 'send'} className="text-lg" />
            {submitLabel}
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

const TYPE_TABS = [
  [POST_TYPE.PHOTO, 'photo_library', 'Ảnh'],
  [POST_TYPE.VIDEO, 'movie', 'Video'],
];

/**
 * /posts/:id (note/gop-luong-dang-bai.txt): bài ảnh và bài video dùng chung trang. Tab Ảnh / Video chọn loại bài;
 * soạn theo thứ tự worker -> template (video) -> tiêu đề / nội dung / hashtag, rồi ảnh, nền tảng, giờ đăng.
 */
export default function SocialPostPage() {
  useSeo({ title: 'Bài đăng', noindex: true });
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/posts', { replace: true }));

  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  // null: theo loại bài hiện tại
  const [mode, setMode] = useState(null);
  const worker = usePostWorker(post);

  const load = useCallback(() => {
    setError(null);
    getPost(id).then(setPost, setError);
  }, [id]);
  useEffect(load, [load]);

  // Đang chuẩn bị / đang đăng / chờ đăng đã tới giờ: tự cập nhật tới khi đổi trạng thái
  const polling = needsPolling(post);
  useEffect(() => {
    if (!polling) return undefined;
    const timer = setInterval(() => getPost(id).then(setPost, () => {}), POLL_INTERVAL);
    return () => {
      clearInterval(timer);
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
    };
  }, [polling, id, queryClient]);

  const type = mode ?? post?.type ?? POST_TYPE.PHOTO;
  const editable = post && isPostEditable(post);

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
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-on-surface">Bài đăng</h1>
        {post && (
          <span className="mr-2">
            <PostStatusBadge status={post.status} />
          </span>
        )}
      </header>

      {editable && (
        // Desktop: cùng lưới 2 cột với nội dung bên dưới, tab Ảnh / Video chỉ rộng bằng cột trái (ảnh)
        <div className="px-4 pt-4 lg:mx-auto lg:grid lg:w-full lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
          <div role="tablist" aria-label="Loại bài đăng" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container p-1">
            {TYPE_TABS.map(([value, icon, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={type === value}
                onClick={() => setMode(value)}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-colors ${
                  type === value ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Icon name={icon} className="text-lg" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error ? (
        <div className="p-4">
          <ErrorState error={error} onRetry={error.status === 404 ? undefined : load} />
        </div>
      ) : !post ? (
        <div className="space-y-4 p-4 lg:mx-auto lg:w-full lg:max-w-[1000px]">
          <Skeleton className="h-16" />
          <Skeleton className="h-48" />
        </div>
      ) : post.status === POST_STATUS.GENERATING ? (
        <GeneratingPanel post={post} onCancelled={() => navigate('/posts', { replace: true })} onStale={load} />
      ) : editable ? (
        <PostEditor
          key={`${post.id}-${post.status}`}
          post={post}
          type={type}
          worker={worker}
          onChanged={setPost}
        />
      ) : (
        <PostPreview post={post} onChanged={setPost} />
      )}
    </>
  );
}
