import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { useDownloadOutput, useGenerationHistory } from '../hooks/generationQueries';
import { formatVnd } from '../utils/format';

// Khớp GenerationStatus của backend
const STATUS = {
  queued: { label: 'Đang chờ', className: 'bg-surface-container text-on-surface-variant' },
  processing: { label: 'Đang tạo', className: 'bg-primary-fixed text-on-primary-fixed-variant' },
  completed: { label: 'Hoàn tất', className: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' },
  failed: { label: 'Thất bại', className: 'bg-error-container text-error' },
  cancelled: { label: 'Đã huỷ', className: 'bg-surface-container text-on-surface-variant' },
};

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

function OrderCard({ order }) {
  const download = useDownloadOutput();
  const status = STATUS[order.status] ?? { label: order.status, className: 'bg-surface-container text-on-surface-variant' };
  const images = (order.outputs ?? []).filter((o) => o.status === 'completed' && o.image_url);

  const [first, ...rest] = images;
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Tải lần lượt từng ảnh để trình duyệt không chặn nhiều lượt tải cùng lúc
  const downloadAll = async () => {
    setDownloadingAll(true);
    try {
      for (const o of images) await download.mutateAsync({ generationId: order.id, outputId: o.id });
    } catch {
      // Lỗi đã nằm trong download.error
    } finally {
      setDownloadingAll(false);
    }
  };

  const thumb = (o, className) => (
    <button
      key={o.id}
      type="button"
      onClick={() => download.mutate({ generationId: order.id, outputId: o.id })}
      aria-label={`Tải ảnh ${o.position}`}
      className={`group relative aspect-square overflow-hidden rounded-lg ${className}`}
    >
      <CoverImage src={o.image_url} alt={`Ảnh ${o.position}`} className="size-full" />
      <span className="absolute inset-0 flex items-center justify-center bg-inverse-surface/40 text-on-primary opacity-0 transition-opacity group-hover:opacity-100">
        <Icon name="download" className="text-lg" />
      </span>
    </button>
  );

  return (
    <article className="flex gap-3 rounded-2xl border border-outline-variant/40 p-3">
      {/* Ảnh bên trái: ảnh đầu to, các ảnh còn lại xếp lưới nhỏ bên dưới */}
      <div className="w-24 shrink-0 space-y-1.5">
        {first ? (
          thumb(first, 'w-full')
        ) : (
          <CoverImage src={null} alt="" className="aspect-square w-full rounded-lg" />
        )}
        {rest.length > 0 && <div className="grid grid-cols-3 gap-1">{rest.map((o) => thumb(o, 'w-full !rounded-md'))}</div>}
      </div>

      {/* Thông tin bên phải */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start gap-2">
          {order.creative ? (
            <Link
              to={`/creatives/${encodeURIComponent(order.creative.slug)}`}
              className="line-clamp-2 flex-1 text-sm font-bold text-on-surface hover:text-primary"
            >
              {order.creative.title}
            </Link>
          ) : (
            <p className="flex-1 text-sm font-bold text-on-surface">Mẫu đã bị gỡ</p>
          )}
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${status.className}`}>{status.label}</span>
        </div>
        <p className="text-xs text-on-surface-variant">
          #{order.id} · {formatDateTime(order.created_at)}
        </p>
        <p className="text-xs text-on-surface-variant">
          {order.quantity} ảnh × {formatVnd(order.price_per_image)} · {order.aspect_ratio}
        </p>
        {order.failed_count > 0 && <p className="text-xs text-error">{order.failed_count} ảnh lỗi (đã hoàn tiền)</p>}
        {download.error && <p className="text-xs text-error">{download.error.message}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p className="text-sm font-bold text-primary">{formatVnd(order.total_charged)}</p>
          {images.length > 0 && (
            <button
              type="button"
              onClick={downloadAll}
              disabled={downloadingAll}
              className="flex h-6 items-center gap-0.5 rounded-md bg-primary-container px-2 text-[11px] font-bold text-on-primary transition-all hover:bg-primary active:scale-[0.98] disabled:opacity-50"
            >
              <Icon name={downloadingAll ? 'progress_activity' : 'download'} className={`text-xs ${downloadingAll ? 'animate-spin' : ''}`} />
              Tải về{images.length > 1 ? ` (${images.length})` : ''}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/** /account/history: các lần tạo ảnh đã mua, mới nhất trước. */
export default function PurchaseHistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useGenerationHistory();
  const orders = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          // Mở thẳng link thì về trang tài khoản thay vì thoát khỏi app
          onClick={() => (location.key === 'default' ? navigate('/account', { replace: true }) : navigate(-1))}
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </button>
        <h1 className="text-base font-bold text-on-surface">Lịch sử mua hàng</h1>
      </header>

      <div className="space-y-3 p-4">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32 w-full !rounded-2xl" />)
        ) : orders.length === 0 ? (
          <EmptyState icon="receipt_long" message="Bạn chưa mua lượt tạo ảnh nào.">
            <Link to="/explore" className="text-sm font-bold text-primary">
              Khám phá mẫu
            </Link>
          </EmptyState>
        ) : (
          <>
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
            {hasNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="h-11 w-full rounded-xl border border-outline-variant text-sm font-bold text-primary transition-colors hover:bg-surface-container-low disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Đang tải...' : 'Xem thêm'}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
