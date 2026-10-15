import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import ImageViewer from '../components/common/ImageViewer';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SubmitButton, TextArea, TextField } from '../components/common/Form';
import HashtagInput from '../components/template/HashtagInput';
import A51ImagePicker from '../components/tiktok/A51ImagePicker';
import { PostStatusBadge } from '../components/tiktok/PostStatus';
import {
  HASHTAG_MAX,
  IMAGE_STATUS,
  PHOTO_DESCRIPTION_MAX,
  PHOTO_MAX_COUNT,
  PHOTO_TITLE_MAX,
  POST_STATUS,
  deletePost,
  getPost,
  isImageBusy,
  isPostLocked,
  publishPost,
} from '../api/tiktok';

// Đang chuẩn bị / chờ đăng / đang đăng: hỏi lại mỗi 3 giây
const POLL_INTERVAL = 3000;
const needsPolling = (post) => !!post && (post.status === POST_STATUS.GENERATING || isPostLocked(post));

const EDIT_FIELDS = ['images', 'title', 'content', 'hashtags'];
const pickEdit = (post) => Object.fromEntries(EDIT_FIELDS.map((k) => [k, post[k]]));

// Nội dung gửi TikTok = content + "\n" + dòng hashtag, tổng không quá 4000 ký tự
const captionLength = (content, hashtags) =>
  content.length + (hashtags.length ? 1 + hashtags.map((t) => `#${t}`).join(' ').length : 0);

// Lỗi theo trường của API gửi bài (snake_case, images.N) -> trường của form
const FIELD_FROM_API = { title: 'title', content: 'content', hashtags: 'hashtags', images: 'images' };
const formErrorsFrom = (errors) =>
  Object.entries(errors ?? {}).reduce((acc, [field, msg]) => {
    const key = FIELD_FROM_API[field.split('.')[0]];
    if (key && !acc[key]) acc[key] = msg;
    return acc;
  }, {});

/** Ảnh của bài: ảnh đầu là ảnh bìa. editable: cho xoá ảnh và thêm ảnh từ A51. */
function ImageStrip({ images, editable, onRemove, onAdd }) {
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
          const busy = isImageBusy(img);
          const failed = img.status === IMAGE_STATUS.FAILED;
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
              {editable && images.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(img.key)}
                  className="flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-outline-variant/50 text-[11px] font-bold text-on-surface-variant hover:border-error hover:text-error"
                >
                  <Icon name="delete" className="text-sm" />
                  Bỏ khỏi bài
                </button>
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
            Bạn có thể rời trang này. Xong, bài chuyển sang <b>Chờ gửi</b> để bạn xem lại và đăng TikTok.
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
        to="/tiktok"
        className="flex h-11 items-center justify-center gap-1 rounded-xl border border-outline-variant/60 text-sm font-bold text-on-surface hover:bg-surface-container"
      >
        <Icon name="list" className="text-lg" />
        Về danh sách bài đăng
      </Link>
    </section>
  );
}

/** Chờ đăng / Đang đăng / Đã lưu nháp TikTok: chỉ xem, không sửa, không xoá. */
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
            Đang lưu bài vào nháp TikTok...
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <Icon name="check_circle" fill className="text-base" />
            Đã lưu nháp TikTok
            {post.publishedAt ? ` lúc ${new Date(post.publishedAt).toLocaleString('vi-VN')}` : ''}
          </p>
        )}
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
 * Chờ gửi: ảnh đã xong, người dùng xem lại (tiêu đề, nội dung không bắt buộc) rồi bấm đăng: A51 lưu bài vào nháp TikTok.
 * onRefresh: tải lại bài (sau khi đăng lỗi, để hiện last_error).
 */
function ReviewForm({ post, onRefresh }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => pickEdit(post));
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
      queryClient.invalidateQueries({ queryKey: ['tiktok', 'posts'] });
      navigate('/tiktok', { replace: true });
    });
  };

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
    run('publish', async () => {
      try {
        await publishPost(post.id, form);
      } catch (err) {
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
        thumbUrl: p.thumbUrl,
        errorMessage: null,
        creativeSlug: p.creativeSlug,
        creativeTitle: p.creativeTitle,
        price: 0,
      })),
    ]);
    setAdding(false);
  };

  const imagesNotReady = form.images.some((i) => i.status !== IMAGE_STATUS.COMPLETED);

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-6 p-4 lg:mx-auto lg:grid lg:w-full lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8 lg:py-6"
    >
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
        <ImageStrip
          images={form.images}
          editable
          onRemove={(key) => set('images')(form.images.filter((i) => i.key !== key))}
          onAdd={() => setAdding(true)}
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
            A51 sẽ lưu bài vào <b>nháp TikTok</b>. Sau khi bấm đăng, bài bị khoá: không sửa hoặc xoá được tới khi đăng xong.
          </span>
        </p>

        {formError && <FormAlert>{formError}</FormAlert>}
        {imagesNotReady && !formError && (
          <p className="text-xs text-amber-700">Còn ảnh chưa xong hoặc bị lỗi: hãy bỏ ảnh đó khỏi bài trước khi đăng.</p>
        )}

        <div className="space-y-2">
          <SubmitButton
            loading={busy === 'publish'}
            loadingText="Đang gửi..."
            disabled={!!busy}
          >
            <Icon name="send" className="text-lg" />
            Đăng TikTok
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

/** /tiktok/post/:id: xem lại bài rồi đăng (lưu nháp) lên TikTok. */
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

  // Đang chuẩn bị / chờ đăng / đang đăng: tự cập nhật tới khi xong
  const polling = needsPolling(post);
  useEffect(() => {
    if (!polling) return undefined;
    const timer = setInterval(() => getPost(id).then(setPost, () => {}), POLL_INTERVAL);
    return () => {
      clearInterval(timer);
      // Xong: danh sách bài đổi trạng thái
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
