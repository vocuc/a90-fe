import { useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { BatchStatusBadge } from '../components/batch/BatchStatus';
import { BATCH_STATUS, deleteBatch, listBatches } from '../api/batches';

const PAGE_SIZE = 20;
const POLL_INTERVAL = 5000;

const formatTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

function BatchCard({ batch }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const generating = batch.status === BATCH_STATUS.GENERATING;

  const remove = async () => {
    if (!window.confirm(`Xoá lô #${batch.id}? Ảnh vẫn còn trong lịch sử tạo ảnh, bài TikTok đã tạo không đổi.`)) return;
    setDeleting(true);
    try {
      await deleteBatch(batch.id);
      await queryClient.invalidateQueries({ queryKey: ['batches'] });
    } catch (err) {
      window.alert(err?.message || 'Không xoá được lô, vui lòng thử lại.');
      setDeleting(false);
    }
  };

  return (
    // Cả thẻ bấm được để mở lô (lớp after của Link phủ thẻ), nút xoá nằm trên lớp đó
    <div className="relative flex gap-3 rounded-2xl border border-outline-variant/40 p-3 transition-colors hover:bg-surface-container-low">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-container">
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
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/batches/${batch.id}`} className="text-sm font-bold text-on-surface after:absolute after:inset-0 after:rounded-2xl">
            Lô #{batch.id}
          </Link>
          <span className="shrink-0">
            <BatchStatusBadge batch={batch} />
          </span>
        </div>
        <p className="text-xs text-on-surface-variant">{formatTime(batch.createdAt)}</p>
        <p className="flex flex-wrap gap-x-3 pr-8 text-xs text-on-surface-variant">
          <span>{batch.imageCount} ảnh</span>
          {batch.failedCount > 0 && <span className="text-error">{batch.failedCount} ảnh lỗi</span>}
          {batch.postCount > 0 && <span className="text-primary">Đã tạo {batch.postCount} bài TikTok</span>}
        </p>
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

/** /batches: danh sách lô ảnh (note/tach-lo-anh-dang-tiktok.txt). */
export default function BatchesPage() {
  useSeo({ title: 'Tạo ảnh theo lô', noindex: true });
  const navigate = useNavigate();
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
        <span className="mr-2">{createButton}</span>
      </header>

      <section className="space-y-3 p-4 lg:py-6">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !batches ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : !batches.length ? (
          <EmptyState icon="burst_mode" message="Chưa có lô ảnh nào. Chọn nhiều mẫu AI Creative để tạo ảnh một lần.">
            <div className="mt-2">{createButton}</div>
          </EmptyState>
        ) : (
          <>
            <ul className="grid gap-3 lg:grid-cols-2">
              {batches.map((b) => (
                <li key={b.id}>
                  <BatchCard batch={b} />
                </li>
              ))}
            </ul>
            {hasNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="mx-auto flex h-9 items-center gap-1 rounded-lg px-4 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-60"
              >
                {isFetchingNextPage && <Icon name="progress_activity" className="animate-spin text-base" />}
                Xem thêm lô ảnh
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
