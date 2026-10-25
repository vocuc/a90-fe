import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import ImageViewer from '../components/common/ImageViewer';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { BatchStatusBadge } from '../components/batch/BatchStatus';
import { BATCH_SOURCE, BATCH_STATUS } from '../api/batches';
import { IMAGE_STATUS } from '../api/social';
import { STAFF_KEYS, getStaffBatch } from '../api/staff';

const POLL_INTERVAL = 5000;

/**
 * /seller/staff/batches/:id: chủ shop xem lô nhân viên tạo bằng tài nguyên shop (note/chia-se-tai-nguyen.txt).
 * Chỉ xem: không tạo lại / xoá / tạo bài đăng (kênh TikTok là của nhân viên).
 */
export default function StaffBatchPage() {
  const { id } = useParams();
  useSeo({ title: `Lô #${id} của nhân viên`, noindex: true });
  const navigate = useNavigate();
  const [viewing, setViewing] = useState(null);

  const { data: batch, error, refetch } = useQuery({
    queryKey: [...STAFF_KEYS.batches, 'detail', id],
    queryFn: () => getStaffBatch(id),
    refetchInterval: (query) => (query.state.data?.status === BATCH_STATUS.GENERATING ? POLL_INTERVAL : false),
  });
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/seller/staff', { replace: true }));

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
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-on-surface">
          Lô #{id}
          {batch?.user && <span className="font-normal text-on-surface-variant"> · {batch.user.name}</span>}
        </h1>
        {batch && (
          <span className="mr-2">
            <BatchStatusBadge batch={batch} />
          </span>
        )}
      </header>

      {error ? (
        <div className="p-4">
          <ErrorState error={error} onRetry={error.status === 404 ? undefined : refetch} />
        </div>
      ) : !batch ? (
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      ) : (
        <section className="space-y-3 p-4 lg:py-6">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
            {batch.user && (
              <span className="flex items-center gap-1">
                <Icon name="person" className="text-sm" />
                {batch.user.name} ({batch.user.email})
              </span>
            )}
            {batch.source === BATCH_SOURCE.AUTO && (
              <span className="flex min-w-0 items-center gap-1">
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">Tự động</span>
                {[batch.product && (batch.product.name || `Sản phẩm #${batch.product.id}`), batch.group?.name].filter(Boolean).join(' · ')}
              </span>
            )}
            <span>{batch.imageCount} ảnh</span>
            {batch.postCount > 0 && <span className="text-primary">Đã tạo {batch.postCount} bài đăng</span>}
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {batch.images.map((img, i) => (
              <li key={img.id} className="space-y-1.5">
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-container">
                  {img.url ? (
                    <button type="button" onClick={() => setViewing(img)} aria-label={`Xem ảnh ${i + 1}`} className="size-full cursor-zoom-in">
                      <CoverImage src={img.thumbUrl ?? img.url} alt="" className="size-full" />
                    </button>
                  ) : img.status === IMAGE_STATUS.FAILED ? (
                    <span className="flex size-full flex-col items-center justify-center gap-1 bg-error-container/40 p-2 text-center text-on-error-container">
                      <Icon name="broken_image" className="text-2xl" />
                      <span className="text-[11px] font-semibold leading-tight">{img.errorMessage || 'Tạo ảnh thất bại.'}</span>
                    </span>
                  ) : (
                    <span className="flex size-full animate-pulse items-center justify-center text-sky-600">
                      <Icon name="auto_awesome" className="text-2xl" />
                    </span>
                  )}
                </div>
                {img.title && <p className="truncate text-[11px] text-on-surface-variant">{img.title}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ImageViewer src={viewing?.url} alt="Ảnh trong lô" onClose={() => setViewing(null)} />
    </>
  );
}
