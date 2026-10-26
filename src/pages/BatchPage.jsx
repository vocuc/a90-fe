import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import useIdempotencyKey from '../hooks/useIdempotencyKey';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import ImageViewer from '../components/common/ImageViewer';
import ActionBar from '../components/common/ActionBar';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert } from '../components/common/Form';
import { BatchStatusBadge } from '../components/batch/BatchStatus';
import EditInputsDialog from '../components/batch/EditInputsDialog';
import CropImageDialog from '../components/batch/CropImageDialog';
import {
  BATCH_SOURCE,
  UPLOAD_IMAGE_MAX_MB,
  UPLOAD_IMAGE_TYPES,
  deleteBatchImage,
  getBatch,
  regenerateBatchImage,
  uploadBatchImage,
} from '../api/batches';
import { IMAGE_STATUS, PHOTO_MAX_COUNT, createPostFromImages, isImageBusy, newIdempotencyKey } from '../api/social';
import { formatVnd } from '../utils/format';

const POLL_INTERVAL = 3000;

/**
 * Một ảnh của lô. Chế độ thường: xem, sửa nguyên liệu, tạo lại, xoá. Chế độ chọn ảnh để tạo bài đăng:
 * bấm vào ảnh để chọn / bỏ chọn (chỉ ảnh đã xong), số thứ tự chọn = thứ tự trong bài.
 */
function BatchImage({ img, index, busy, selecting, order, canSelect, onToggle, onView, onEdit, onRegenerate, onUpload, onRemove }) {
  const failed = img.status === IMAGE_STATUS.FAILED;
  const completed = img.status === IMAGE_STATUS.COMPLETED;
  const picked = order >= 0;
  // Tạo lại / sửa nguyên liệu: biết được mẫu đã tạo ra ảnh
  const canRegenerate = !!img.creativeSlug;

  const content = img.url ? (
    <CoverImage src={img.thumbUrl ?? img.url} alt="" className="size-full" />
  ) : failed && !busy ? (
    <span className="flex size-full flex-col items-center justify-center gap-1 bg-error-container/40 p-2 text-center text-on-error-container">
      <Icon name="broken_image" className="text-2xl" />
      <span className="text-[11px] font-semibold leading-tight">{img.errorMessage || 'Tạo ảnh thất bại.'}</span>
    </span>
  ) : null;

  return (
    <li className="space-y-1.5">
      <div
        className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-container ${
          selecting && picked ? 'ring-2 ring-primary-container ring-offset-2' : ''
        }`}
      >
        {selecting ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={!completed || (!picked && !canSelect)}
            aria-pressed={picked}
            aria-label={`Chọn ảnh ${index + 1}`}
            className={`size-full ${!completed ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            {content}
          </button>
        ) : img.url ? (
          <button type="button" onClick={onView} aria-label={`Xem ảnh ${index + 1}`} className="size-full cursor-zoom-in">
            {content}
          </button>
        ) : (
          content
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">
          {index + 1}
        </span>
        {busy && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-white">
            <Icon name="progress_activity" className="animate-spin text-2xl" />
            <span className="text-[11px] font-semibold">Đang tạo ảnh...</span>
          </span>
        )}
        {selecting && completed && (
          <span
            className={`pointer-events-none absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
              picked ? 'border-primary-container bg-primary-container text-on-primary' : 'border-white bg-black/20'
            }`}
          >
            {picked && order + 1}
          </span>
        )}
        {!selecting && canRegenerate && !busy && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Sửa nguyên liệu ảnh ${index + 1}`}
            title="Sửa nguyên liệu"
            className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <Icon name="edit" className="text-sm" />
          </button>
        )}
      </div>
      {/* Tạo lại, tải lên và xoá nằm dưới ảnh, không che ảnh */}
      {!selecting && (
        <div className="flex gap-1">
          {canRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={busy}
              className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-outline-variant/50 text-[11px] font-bold text-primary hover:bg-surface-container disabled:opacity-50"
            >
              <Icon name="refresh" className="text-sm" />
              Tạo lại
            </button>
          )}
          <button
            type="button"
            onClick={onUpload}
            disabled={busy}
            title="Tải ảnh từ máy thay cho ảnh này"
            className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-outline-variant/50 text-[11px] font-bold text-primary hover:bg-surface-container disabled:opacity-50"
          >
            <Icon name="upload" className="text-sm" />
            Tải lên
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              aria-label={`Xoá ảnh ${index + 1}`}
              title="Xoá ảnh khỏi lô"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-outline-variant/50 text-on-surface-variant hover:border-error hover:text-error disabled:opacity-50"
            >
              <Icon name="delete" className="text-base" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * /batches/:id: ảnh của lô (tạo lại, sửa nguyên liệu, xoá từng ảnh) và nút "Tạo bài đăng":
 * chọn ảnh (mặc định chọn hết ảnh đã xong, tối đa 35) rồi tạo bài, sang trang bài để điền nội dung và gửi.
 * Đăng được nhiều lần, mỗi lần một bài mới; lô và bài độc lập.
 */
export default function BatchPage() {
  const { id } = useParams();
  useSeo({ title: `Lô ảnh #${id}`, noindex: true });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/batches', { replace: true }));

  const [requesting, setRequesting] = useState([]);
  const [viewing, setViewing] = useState(null); // ảnh đang xem
  const [editing, setEditing] = useState(null);
  const [cropping, setCropping] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'post' | id ảnh đang xoá
  // null: chế độ thường; mảng: đang chọn ảnh để tạo bài đăng (theo thứ tự chọn)
  const [selected, setSelected] = useState(null);
  const postKey = useIdempotencyKey();
  // Khoá chống trừ tiền 2 lần khi bấm "Tạo lại" lại do lỗi mạng, theo id ảnh
  const regenerateKeys = useRef({});

  const {
    data: batch,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: ['batches', id],
    queryFn: () => getBatch(id),
    // Còn ảnh đang tạo: hỏi lại tới khi xong
    refetchInterval: (q) => (q.state.data?.images.some(isImageBusy) ? POLL_INTERVAL : false),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['batches'] });
    // Ảnh lỗi được hoàn tiền / tạo lại bị trừ tiền -> tải lại số dư
    queryClient.invalidateQueries({ queryKey: ['me'] });
  };

  const isBusy = (img) => isImageBusy(img) || requesting.includes(img.id);
  const completed = batch?.images.filter((i) => i.status === IMAGE_STATUS.COMPLETED) ?? [];
  const generating = batch?.images.some(isImageBusy) ?? false;

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
    setError(null);
    try {
      const fresh = await regenerateBatchImage(batch.id, img, keys[img.id], edit);
      delete keys[img.id];
      queryClient.setQueryData(['batches', id], (b) => b && { ...b, images: b.images.map((i) => (i.id === img.id ? fresh : i)) });
      refresh();
    } catch (err) {
      // Máy chủ đã trả lỗi (không phải lỗi mạng): chưa bị trừ tiền, lần sau dùng khoá mới
      if (err?.status) delete keys[img.id];
      setError(err?.message || 'Không tạo lại được ảnh, vui lòng thử lại.');
    } finally {
      setRequesting((ids) => ids.filter((x) => x !== img.id));
    }
  };

  // "Tải lên": một ô chọn file dùng chung, nhớ ảnh đang thay rồi mở hộp chọn file
  const uploadRef = useRef(null);
  const uploadTarget = useRef(null);
  const pickUpload = (img) => {
    uploadTarget.current = img;
    uploadRef.current?.click();
  };
  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const img = uploadTarget.current;
    if (!file || !img) return;
    if (!UPLOAD_IMAGE_TYPES.includes(file.type) || file.size > UPLOAD_IMAGE_MAX_MB * 1024 * 1024) {
      setError(`Chỉ nhận ảnh JPG, PNG, WebP, tối đa ${UPLOAD_IMAGE_MAX_MB}MB.`);
      return;
    }
    setBusy(img.id);
    setError(null);
    try {
      const fresh = await uploadBatchImage(batch.id, img, file);
      queryClient.setQueryData(['batches', id], (b) => b && { ...b, images: b.images.map((i) => (i.id === img.id ? fresh : i)) });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    } catch (err) {
      setError(err?.message || 'Không tải ảnh lên được, vui lòng thử lại.');
    } finally {
      setBusy(null);
    }
  };

  const removeImage = async (img) => {
    if (!window.confirm('Xoá ảnh này khỏi lô? Ảnh vẫn còn trong lịch sử tạo ảnh, bài đăng đã tạo không đổi.')) return;
    setBusy(img.id);
    setError(null);
    try {
      await deleteBatchImage(batch.id, img);
      queryClient.setQueryData(['batches', id], (b) => b && { ...b, images: b.images.filter((i) => i.id !== img.id) });
      refresh();
    } catch (err) {
      setError(err?.message || 'Không xoá được ảnh, vui lòng thử lại.');
    } finally {
      setBusy(null);
    }
  };

  // "Tạo bài đăng": chọn sẵn các ảnh đã xong theo thứ tự trong lô, tối đa 35
  const startSelecting = () => {
    setError(null);
    setSelected(completed.slice(0, PHOTO_MAX_COUNT));
  };
  const toggleSelect = (img) =>
    setSelected((prev) =>
      prev.some((s) => s.id === img.id)
        ? prev.filter((s) => s.id !== img.id)
        : prev.length < PHOTO_MAX_COUNT
          ? [...prev, img]
          : prev,
    );

  const createPost = async () => {
    setBusy('post');
    setError(null);
    try {
      const post = await createPostFromImages(selected, postKey.key.current, batch.id);
      postKey.renew();
      queryClient.invalidateQueries({ queryKey: ['social', 'posts'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      navigate(`/posts/${post.id}`);
    } catch (err) {
      postKey.renewAfter(err);
      setError(err?.message || 'Không tạo được bài đăng, vui lòng thử lại.');
      setBusy(null);
    }
  };

  const selecting = selected !== null;

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={selecting ? () => setSelected(null) : goBack}
          aria-label={selecting ? 'Huỷ chọn ảnh' : 'Quay lại'}
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name={selecting ? 'close' : 'arrow_back'} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-on-surface">{selecting ? 'Chọn ảnh cho bài đăng' : `Lô ảnh #${id}`}</h1>
          {/* Lô tạo tự động (note/auto-tao-lo.txt): sản phẩm · nhóm đã dùng */}
          {!selecting && batch?.source === BATCH_SOURCE.AUTO && (
            <p className="truncate text-[11px] text-on-surface-variant">
              Tự động
              {[batch.product && (batch.product.name || `Sản phẩm #${batch.product.id}`), batch.group?.name]
                .filter(Boolean)
                .map((s) => ` · ${s}`)
                .join('')}
            </p>
          )}
        </div>
        {batch && !selecting && (
          <span className="mr-2">
            <BatchStatusBadge batch={batch} />
          </span>
        )}
      </header>

      <ImageViewer
        src={viewing?.url}
        alt="Ảnh trong lô"
        onClose={() => setViewing(null)}
        actions={
          viewing &&
          !isBusy(viewing) && (
            <button
              type="button"
              onClick={() => {
                setCropping(viewing);
                setViewing(null);
              }}
              className="flex h-10 items-center gap-1 rounded-full bg-black/50 px-4 text-sm font-bold text-white transition-colors hover:bg-black/70"
            >
              <Icon name="crop" className="text-xl" />
              Cắt ảnh
            </button>
          )
        }
      />
      {cropping && (
        <CropImageDialog
          batchId={batch.id}
          image={cropping}
          onClose={() => setCropping(null)}
          onSaved={(fresh) => {
            queryClient.setQueryData(['batches', id], (b) => b && { ...b, images: b.images.map((i) => (i.id === fresh.id ? fresh : i)) });
            queryClient.invalidateQueries({ queryKey: ['batches'] });
            setCropping(null);
          }}
        />
      )}
      {editing && (
        <EditInputsDialog
          batchId={batch.id}
          image={editing}
          onClose={() => setEditing(null)}
          onSubmit={(edit) => {
            regenerate(editing, edit);
            setEditing(null);
          }}
        />
      )}

      {loadError ? (
        <div className="p-4">
          <ErrorState error={loadError} onRetry={loadError.status === 404 ? undefined : refetch} />
        </div>
      ) : !batch ? (
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      ) : (
        <>
          <section className="space-y-3 p-4 lg:py-6">
            {selecting ? (
              <p className="text-xs text-on-surface-variant">
                Bấm vào ảnh để chọn / bỏ chọn. Tối đa {PHOTO_MAX_COUNT} ảnh, ảnh chọn đầu tiên làm ảnh bìa. Chỉ chọn được ảnh đã
                tạo xong.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                <span>
                  <b className="text-on-surface">{batch.images.length}</b> ảnh
                </span>
                {batch.failedCount > 0 && <span className="text-error">{batch.failedCount} ảnh lỗi (đã hoàn tiền)</span>}
                {batch.postCount > 0 && (
                  <Link to="/posts" className="font-semibold text-primary hover:underline">
                    Đã tạo {batch.postCount} bài đăng
                  </Link>
                )}
                {generating && <span>Bạn có thể rời trang này, ảnh vẫn được tạo tiếp.</span>}
              </div>
            )}

            {!selecting && error && <FormAlert>{error}</FormAlert>}

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {batch.images.map((img, i) => (
                <BatchImage
                  key={img.id}
                  img={img}
                  index={i}
                  busy={isBusy(img) || busy === img.id}
                  selecting={selecting}
                  order={selecting ? selected.findIndex((s) => s.id === img.id) : -1}
                  canSelect={selecting && selected.length < PHOTO_MAX_COUNT}
                  onToggle={() => toggleSelect(img)}
                  onView={() => setViewing(img)}
                  onEdit={() => setEditing(img)}
                  onRegenerate={() => regenerate(img)}
                  onUpload={() => pickUpload(img)}
                  // Lô luôn còn ít nhất 1 ảnh; muốn bỏ hết thì xoá cả lô
                  onRemove={batch.images.length > 1 ? () => removeImage(img) : null}
                />
              ))}
            </ul>
            <input ref={uploadRef} type="file" accept={UPLOAD_IMAGE_TYPES.join(',')} className="hidden" onChange={uploadImage} />
          </section>

          {selecting ? (
            <ActionBar
              summary={
                <>
                  Đã chọn <b className="text-on-surface">{selected.length}</b>/{PHOTO_MAX_COUNT} ảnh
                </>
              }
              error={error}
              disabled={!selected.length}
              loading={busy === 'post'}
              onSubmit={createPost}
              label="Tạo bài đăng"
              icon="post_add"
              secondary={
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-11 shrink-0 items-center rounded-xl px-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
                >
                  Huỷ
                </button>
              }
            />
          ) : (
            <ActionBar
              summary={
                completed.length ? (
                  <>
                    <b className="text-on-surface">{completed.length}</b> ảnh đã xong, sẵn sàng đăng
                  </>
                ) : (
                  'Chưa có ảnh nào tạo xong'
                )
              }
              disabled={!completed.length}
              onSubmit={startSelecting}
              label="Tạo bài đăng"
              icon="send"
            />
          )}
        </>
      )}
    </>
  );
}
