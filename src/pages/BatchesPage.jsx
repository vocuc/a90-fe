import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { BatchStatusBadge } from '../components/batch/BatchStatus';
import ImageViewer from '../components/common/ImageViewer';
import ActionBar from '../components/common/ActionBar';
import ScheduleBatchesDialog from '../components/batch/ScheduleBatchesDialog';
import { BATCH_SOURCE, BATCH_STATUS, bulkDeleteBatches, cancelBatch, deleteBatch, getBatch, listBatches } from '../api/batches';
import { IMAGE_STATUS, isImageBusy } from '../api/social';
import { AUTO_RESULT_KEY, AUTO_STOP } from '../api/autoBatch';
import { useConfirm } from '../components/common/ConfirmDialog';

const PAGE_SIZE = 20;
const POLL_INTERVAL = 5000;

const formatTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * selecting: chế độ chọn lô (lập lịch đăng bài / xoá nhiều lô), bấm thẻ để chọn / bỏ chọn; order: thứ tự chọn
 * (-1 = chưa chọn), showOrder: hiện số thứ tự (lập lịch: lô chọn trước đăng trước) thay vì dấu tích. Lô đang tạo ảnh không chọn được.
 */
function BatchCard({ batch, selecting = false, order = -1, showOrder = true, onToggle }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { confirm, alert } = useConfirm();
  const generating = batch.status === BATCH_STATUS.GENERATING;

  // Hủy ảnh chưa worker nào nhận, ảnh đang tạo dở / đã xong giữ nguyên
  const cancel = async () => {
    const ok = await confirm(
      `Hủy ${batch.queuedCount} ảnh đang chờ tạo của lô #${batch.id}? Tiền của các ảnh này được hoàn lại, ảnh đang tạo dở và ảnh đã xong vẫn giữ nguyên.`,
      { confirmLabel: 'Hủy ảnh', danger: true },
    );
    if (!ok) return;
    setCancelling(true);
    try {
      const { batch: fresh } = await cancelBatch(batch.id);
      queryClient.setQueryData(['batches', String(batch.id)], fresh);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['batches'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
    } catch (err) {
      alert(err?.message || 'Không hủy được ảnh, vui lòng thử lại.');
    } finally {
      setCancelling(false);
    }
  };

  const remove = async () => {
    if (!(await confirm(`Xoá lô #${batch.id}? Ảnh vẫn còn trong lịch sử tạo ảnh, bài đăng đã tạo không đổi.`, { confirmLabel: 'Xoá', danger: true }))) return;
    setDeleting(true);
    try {
      await deleteBatch(batch.id);
      await queryClient.invalidateQueries({ queryKey: ['batches'] });
    } catch (err) {
      alert(err?.message || 'Không xoá được lô, vui lòng thử lại.');
      setDeleting(false);
    }
  };

  return (
    // Cả thẻ bấm được để mở lô (lớp after của Link phủ thẻ), nút xoá nằm trên lớp đó
    <div
      className={`relative flex h-full flex-col gap-2 rounded-2xl border p-2 transition-colors hover:bg-surface-container-low ${
        selecting && order >= 0 ? 'border-primary-container ring-2 ring-primary-container' : 'border-outline-variant/40'
      }`}
    >
      {selecting && (
        // Lớp chọn phủ cả thẻ (trên link mở lô và các nút)
        <button
          type="button"
          onClick={onToggle}
          disabled={generating}
          aria-pressed={order >= 0}
          aria-label={`Chọn lô #${batch.id}`}
          title={generating ? 'Lô đang tạo ảnh, chờ xong rồi mới chọn được' : undefined}
          className="absolute inset-0 z-20 rounded-2xl disabled:cursor-not-allowed disabled:bg-surface-container-lowest/60"
        >
          {!generating && (
            <span
              className={`absolute right-3 top-3 flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold ${
                order >= 0 ? 'border-primary-container bg-primary-container text-on-primary' : 'border-white bg-black/30'
              }`}
            >
              {order >= 0 && (showOrder ? order + 1 : <Icon name="check" className="text-base" />)}
            </span>
          )}
        </button>
      )}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface-container">
        {generating && !batch.coverUrl ? (
          <span className="flex size-full animate-pulse items-center justify-center text-sky-600">
            <Icon name="auto_awesome" className="text-2xl" />
          </span>
        ) : (
          <CoverImage src={batch.coverUrl} alt="" className="size-full" />
        )}
        <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
          <Icon name="photo_library" className="text-xs" />
          {batch.imageCount}
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-1 px-1 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <Link to={`/batches/${batch.id}`} className="text-sm font-bold text-on-surface after:absolute after:inset-0 after:rounded-2xl">
            Lô #{batch.id}
          </Link>
          <span className="shrink-0">
            <BatchStatusBadge batch={batch} />
          </span>
        </div>
        {batch.source === BATCH_SOURCE.AUTO && (
          <p className="flex min-w-0 items-center gap-1 pr-8 text-xs text-on-surface-variant">
            <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">Tự động</span>
            <span className="truncate">
              {[batch.product && (batch.product.name || `Sản phẩm #${batch.product.id}`), batch.group?.name].filter(Boolean).join(' · ')}
            </span>
          </p>
        )}
        <p className="text-xs text-on-surface-variant">{formatTime(batch.createdAt)}</p>
        <p className="flex flex-wrap gap-x-3 pr-8 text-xs text-on-surface-variant">
          <span>{batch.imageCount} ảnh</span>
          {batch.failedCount > 0 && <span className="text-error">{batch.failedCount} ảnh lỗi</span>}
          {batch.postCount > 0 && <span className="text-primary">Đã tạo {batch.postCount} bài đăng</span>}
        </p>
        {batch.queuedCount > 0 && (
          // z-10: nằm trên lớp bấm mở lô của Link
          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            className="relative z-10 flex h-7 items-center gap-1 rounded-lg border border-error/40 px-2 text-xs font-bold text-error hover:bg-error-container/40 disabled:opacity-60"
          >
            <Icon name={cancelling ? 'progress_activity' : 'cancel'} className={`text-sm ${cancelling ? 'animate-spin' : ''}`} />
            Hủy {batch.queuedCount} ảnh đang chờ
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={deleting || generating}
        aria-label={`Xoá lô #${batch.id}`}
        title={generating ? 'Chờ ảnh tạo xong rồi mới xoá được lô' : 'Xoá lô'}
        className="absolute bottom-2 right-2 z-10 flex size-8 items-center justify-center rounded-lg text-error hover:bg-error-container/40 disabled:opacity-50"
      >
        <Icon name={deleting ? 'progress_activity' : 'delete'} className={`text-lg ${deleting ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}

const VIEW = { BATCHES: 'batches', IMAGES: 'images' };
const SELECT_MODE = { SCHEDULE: 'schedule', DELETE: 'delete' };

const VIEW_OPTIONS = [
  { value: VIEW.BATCHES, label: 'Lô', icon: 'burst_mode' },
  { value: VIEW.IMAGES, label: 'Ảnh', icon: 'grid_view' },
];

/**
 * Xem theo ảnh: gộp ảnh của các lô đã tải (API danh sách lô không kèm ảnh nên lấy chi tiết từng lô,
 * dùng chung cache ['batches', id] với trang lô). Lô đang tạo ảnh tự cập nhật.
 */
function BatchImagesGrid({ batches }) {
  const [viewing, setViewing] = useState(null);
  const results = useQueries({
    queries: batches.map((b) => ({
      queryKey: ['batches', String(b.id)],
      queryFn: () => getBatch(b.id),
      refetchInterval: (q) => ((q.state.data ?? b).status === BATCH_STATUS.GENERATING ? POLL_INTERVAL : false),
    })),
  });

  return (
    <>
      <ImageViewer src={viewing?.url} alt={viewing ? `Ảnh lô #${viewing.batchId}` : ''} onClose={() => setViewing(null)} />
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {batches.map((b, i) => {
          const { data: detail, isPending, error } = results[i];
          if (isPending) {
            return Array.from({ length: Math.min(b.imageCount || 1, 6) }).map((_, k) => (
              <li key={`${b.id}-sk-${k}`}>
                <Skeleton className="aspect-[3/4]" />
              </li>
            ));
          }
          if (error || !detail) return null;
          return detail.images.map((img) => {
            const busy = isImageBusy(img);
            const failed = img.status === IMAGE_STATUS.FAILED;
            return (
              <li key={`${b.id}-${img.id}`} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-container">
                {img.url ? (
                  <button
                    type="button"
                    onClick={() => setViewing({ url: img.url, batchId: b.id })}
                    aria-label={`Xem ảnh của lô #${b.id}`}
                    className="size-full cursor-zoom-in"
                  >
                    <CoverImage src={img.thumbUrl} alt="" className={`size-full ${img.disabled ? 'opacity-40 grayscale' : ''}`} />
                  </button>
                ) : failed && !busy ? (
                  <span className="flex size-full flex-col items-center justify-center gap-1 bg-error-container/40 p-2 text-center text-on-error-container">
                    <Icon name="broken_image" className="text-2xl" />
                    <span className="text-[11px] font-semibold leading-tight">{img.errorMessage || 'Tạo ảnh thất bại.'}</span>
                  </span>
                ) : null}
                {busy && (
                  <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-white">
                    <Icon name="progress_activity" className="animate-spin text-2xl" />
                    <span className="text-[11px] font-semibold">Đang tạo ảnh...</span>
                  </span>
                )}
                {img.disabled && !busy && (
                  <span className="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    <Icon name="visibility_off" className="text-xs" />
                    Đã tắt
                  </span>
                )}
                <Link
                  to={`/batches/${b.id}`}
                  title={`Mở lô #${b.id}`}
                  className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-black/80"
                >
                  Lô #{b.id}
                </Link>
              </li>
            );
          });
        })}
      </ul>
    </>
  );
}

/** /batches: danh sách lô ảnh (note/tach-lo-anh-dang-tiktok.txt). */
export default function BatchesPage() {
  useSeo({ title: 'Tạo ảnh theo lô', noindex: true });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Kết quả lần "Tạo tự động" vừa xong ở /batches/auto: { created, requested, stopped }; đọc một lần rồi xoá
  const [autoResult, setAutoResult] = useState(() => queryClient.getQueryData(AUTO_RESULT_KEY) ?? null);
  useEffect(() => {
    queryClient.removeQueries({ queryKey: AUTO_RESULT_KEY });
  }, [queryClient]);
  // Chế độ xem lưu trên URL (?view=images) để quay lại trang vẫn giữ
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === VIEW.IMAGES ? VIEW.IMAGES : VIEW.BATCHES;
  const setView = (v) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === VIEW.IMAGES) next.set('view', v);
        else next.delete('view');
        return next;
      },
      { replace: true },
    );
  // Chọn nhiều lô: SELECT_MODE.SCHEDULE (lập lịch đăng bài, lô chọn trước đăng trước) hoặc SELECT_MODE.DELETE (xoá nhiều lô)
  const { confirm, alert } = useConfirm();
  const [mode, setMode] = useState(null);
  const selecting = mode !== null;
  const [selected, setSelected] = useState([]);
  // Xoá: "Chọn tất cả" = mọi lô của tài khoản (kể cả lô chưa tải trang), gửi all = true
  const [allSelected, setAllSelected] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Thông báo sau khi lập lịch / xoá: { type: 'schedule', queued } | { type: 'delete', deleted, skipped }
  const [notice, setNotice] = useState(null);
  const toggleSelect = (b) => {
    setAllSelected(false);
    setSelected((list) => (list.some((x) => x.id === b.id) ? list.filter((x) => x.id !== b.id) : [...list, b]));
  };
  const startSelecting = (m) => {
    setMode(m);
    setSelected([]);
    setAllSelected(false);
    if (view !== VIEW.BATCHES) setView(VIEW.BATCHES);
  };
  const stopSelecting = () => {
    setMode(null);
    setSelected([]);
    setAllSelected(false);
  };
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/tools'));

  const { data, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['batches'],
    queryFn: ({ pageParam }) => listBatches({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
    // Còn lô đang tạo ảnh thì tự cập nhật mỗi 5 giây
    refetchInterval: (q) =>
      q.state.data?.pages.some((p) => p.items.some((b) => b.status === BATCH_STATUS.GENERATING)) ? POLL_INTERVAL : false,
  });
  const batches = data ? data.pages.flatMap((p) => p.items) : null;
  const totalBatches = data?.pages[0]?.total ?? 0;
  const selectable = (batches ?? []).filter((b) => b.status !== BATCH_STATUS.GENERATING);

  const toggleSelectAll = () => {
    if (allSelected) {
      setAllSelected(false);
      setSelected([]);
    } else {
      setAllSelected(true);
      setSelected(selectable);
    }
  };

  const removeSelected = async () => {
    const count = allSelected ? totalBatches : selected.length;
    const ok = await confirm(
      `Xoá ${allSelected ? `tất cả ${count}` : count} lô? Ảnh trong các lô vẫn còn nguyên trong Lịch sử tạo ảnh, bài đăng đã tạo không đổi. Lô đang tạo ảnh sẽ được giữ lại.`,
      { confirmLabel: 'Xoá', danger: true },
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const result = await bulkDeleteBatches(allSelected ? { all: true } : { batchIds: selected.map((b) => b.id) });
      await queryClient.invalidateQueries({ queryKey: ['batches'] });
      stopSelecting();
      setNotice({ type: 'delete', ...result });
    } catch (err) {
      alert(err?.message || 'Không xoá được lô, vui lòng thử lại.');
    } finally {
      setDeleting(false);
    }
  };

  const createButton = (
    <Link
      to="/batches/new"
      state={{ fromList: true }}
      className="flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary"
    >
      <Icon name="add" className="text-base" />
      Tạo lô ảnh
    </Link>
  );

  const autoButton = (
    <Link
      to="/batches/auto"
      state={{ fromList: true }}
      className="flex h-8 items-center gap-1 rounded-lg border border-primary-container px-3 text-xs font-bold text-primary hover:bg-primary-container/10"
    >
      <Icon name="auto_awesome" className="text-base" />
      Tạo tự động
    </Link>
  );

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
        <h1 className="flex-1 text-base font-bold text-on-surface">Lô ảnh</h1>
        <span className="mr-2 flex gap-2">
          {autoButton}
          {createButton}
        </span>
      </header>

      <section className="space-y-3 p-4 lg:py-6">
        {notice && (
          <div role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <Icon name={notice.type === 'schedule' ? 'schedule_send' : 'delete'} className="text-base" />
            {notice.type === 'schedule' ? (
              <p className="flex-1">
                Đã đưa {notice.queued} lô vào hàng đợi lập lịch. Hệ thống tạo bài dần ở nền, bài sẽ hiện ở{' '}
                <Link to="/posts" className="font-bold underline">
                  Bài đăng
                </Link>
                .
              </p>
            ) : (
              <p className="flex-1">
                Đã xoá {notice.deleted} lô.{notice.skipped > 0 && ` ${notice.skipped} lô đang tạo ảnh nên chưa xoá.`} Ảnh vẫn còn trong{' '}
                <Link to="/account/history" className="font-bold underline">
                  Lịch sử tạo ảnh
                </Link>
                .
              </p>
            )}
            <button type="button" onClick={() => setNotice(null)} aria-label="Đóng thông báo">
              <Icon name="close" className="text-base" />
            </button>
          </div>
        )}
        {autoResult && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
              autoResult.stopped ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            <Icon name={autoResult.stopped ? 'info' : 'check_circle'} className="text-base" />
            <p className="flex-1">
              Đã tạo tự động {autoResult.created}/{autoResult.requested} lô, ảnh đang được tạo.
              {autoResult.stopped === AUTO_STOP.NO_VALID_PAIR && ' Không đủ sản phẩm / nhóm creative khác nhau để ghép thêm lô.'}
            </p>
            <button type="button" onClick={() => setAutoResult(null)} aria-label="Đóng thông báo">
              <Icon name="close" className="text-base" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div role="tablist" aria-label="Chế độ xem" className="inline-flex rounded-lg bg-surface-container p-0.5">
            {VIEW_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="tab"
                aria-selected={view === o.value}
                disabled={selecting && o.value !== VIEW.BATCHES}
                onClick={() => setView(o.value)}
                className={`flex h-8 items-center gap-1 rounded-md px-3 text-xs font-bold transition-colors ${
                  view === o.value ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                } disabled:opacity-40`}
              >
                <Icon name={o.icon} className="text-base" />
                {o.label}
              </button>
            ))}
          </div>
          {!!batches?.length &&
            (selecting ? (
              <span className="flex gap-2">
                {mode === SELECT_MODE.DELETE && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex h-9 items-center gap-1 rounded-lg border border-outline-variant px-3 text-xs font-bold text-on-surface hover:bg-surface-container"
                  >
                    <Icon name={allSelected ? 'deselect' : 'select_all'} className="text-base" />
                    {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={stopSelecting}
                  className="flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                >
                  <Icon name="close" className="text-base" />
                  Huỷ chọn
                </button>
              </span>
            ) : (
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startSelecting(SELECT_MODE.DELETE)}
                  className="flex h-9 items-center gap-1 rounded-lg border border-error/40 px-3 text-xs font-bold text-error hover:bg-error-container/40"
                >
                  <Icon name="delete" className="text-base" />
                  Xoá lô
                </button>
                <button
                  type="button"
                  onClick={() => startSelecting(SELECT_MODE.SCHEDULE)}
                  className="flex h-9 items-center gap-1 rounded-lg border border-primary-container px-3 text-xs font-bold text-primary hover:bg-primary-container/10"
                >
                  <Icon name="schedule_send" className="text-base" />
                  Lập lịch đăng bài
                </button>
              </span>
            ))}
        </div>
        {selecting && (
          <p className="text-xs text-on-surface-variant">
            {mode === SELECT_MODE.SCHEDULE
              ? 'Chọn các lô cần đăng. Mỗi lô thành một bài, lô chọn trước đăng trước.'
              : 'Chọn các lô cần xoá. Ảnh trong lô vẫn được giữ nguyên trong Lịch sử tạo ảnh.'}
          </p>
        )}
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !batches ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4]" />
            ))}
          </div>
        ) : !batches.length ? (
          <EmptyState icon="burst_mode" message="Chưa có lô ảnh nào. Chọn nhiều mẫu AI Creative để tạo ảnh một lần.">
            <div className="mt-2">{createButton}</div>
          </EmptyState>
        ) : (
          <>
            {view === VIEW.IMAGES ? (
              <BatchImagesGrid batches={batches} />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {batches.map((b) => (
                  <li key={b.id}>
                    <BatchCard
                      batch={b}
                      selecting={selecting}
                      order={selected.findIndex((x) => x.id === b.id)}
                      showOrder={mode === SELECT_MODE.SCHEDULE}
                      onToggle={() => toggleSelect(b)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {hasNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="mx-auto flex h-9 items-center gap-1 rounded-lg px-4 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-60"
              >
                {isFetchingNextPage && <Icon name="progress_activity" className="animate-spin text-base" />}
                {view === VIEW.IMAGES ? 'Xem thêm ảnh' : 'Xem thêm lô ảnh'}
              </button>
            )}
          </>
        )}
      </section>

      {selecting && (
        <ActionBar
          summary={
            allSelected ? `Đã chọn tất cả ${totalBatches} lô` : selected.length ? `Đã chọn ${selected.length} lô` : 'Chưa chọn lô nào'
          }
          disabled={!selected.length && !allSelected}
          loading={deleting}
          loadingText="Đang xoá..."
          onSubmit={mode === SELECT_MODE.SCHEDULE ? () => setScheduling(true) : removeSelected}
          label={mode === SELECT_MODE.SCHEDULE ? 'Lập lịch' : `Xoá ${allSelected ? totalBatches : selected.length} lô`}
          icon={mode === SELECT_MODE.SCHEDULE ? 'schedule_send' : 'delete'}
          secondary={
            <button
              type="button"
              onClick={stopSelecting}
              className="h-11 rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
            >
              Huỷ
            </button>
          }
        />
      )}
      {scheduling && (
        <ScheduleBatchesDialog
          batches={selected}
          onClose={() => setScheduling(false)}
          onQueued={({ queued }) => {
            setScheduling(false);
            stopSelecting();
            setNotice({ type: 'schedule', queued });
          }}
        />
      )}
    </>
  );
}
