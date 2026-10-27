import useSeo from '../hooks/useSeo';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/common/Icon';
import ImageViewer from '../components/common/ImageViewer';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { thumbOf, useDownloadOutput, useGenerationHistory } from '../hooks/generationQueries';
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

// Mỗi ảnh đã tạo là một thẻ (giống thẻ ở Khám phá). Đơn chưa có ảnh (đang tạo, lỗi, huỷ) hiện một thẻ trạng thái.
function ImageCard({ order, output, onView }) {
  const download = useDownloadOutput();
  const [broken, setBroken] = useState(false);
  const status = STATUS[order.status] ?? { label: order.status, className: 'bg-surface-container text-on-surface-variant' };
  // Ảnh tải lỗi (link hết hạn, file mất...) thì ẩn thẻ
  if (output && broken) return null;

  const title = order.creative ? (
    <Link to={`/creatives/${encodeURIComponent(order.creative.slug)}`} className="hover:text-primary">
      {order.creative.title}
    </Link>
  ) : (
    'Mẫu đã bị gỡ'
  );

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md">
      {output ? (
        <button
          type="button"
          onClick={() => onView(output)}
          aria-label={`Xem ảnh ${output.position}`}
          className="group relative block w-full cursor-zoom-in overflow-hidden bg-surface-container"
        >
          <img
            src={thumbOf(output)}
            alt={`Ảnh ${output.position}`}
            loading="lazy"
            onError={() => setBroken(true)}
            className="block h-auto w-full transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-inverse-surface/40 text-on-primary opacity-0 transition-opacity group-hover:opacity-100">
            <Icon name="zoom_in" className="text-2xl" />
          </span>
        </button>
      ) : (
        <div className="relative flex aspect-square w-full flex-col items-center justify-center gap-2 bg-surface-container text-on-surface-variant">
          <Icon
            name={order.status === 'queued' || order.status === 'processing' ? 'progress_activity' : 'image_not_supported'}
            className={`text-3xl ${order.status === 'processing' ? 'animate-spin' : ''}`}
          />
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.className}`}>{status.label}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col p-2.5">
        <h3 className="mb-1 truncate text-xs font-bold text-on-surface">{title}</h3>
        <p className="text-[11px] text-outline">
          #{order.id} · {formatDateTime(order.created_at)}
        </p>
        {!output && order.failed_count > 0 && <p className="text-[11px] text-error">{order.failed_count} ảnh lỗi (đã hoàn tiền)</p>}
        {download.error && <p className="text-[11px] text-error">{download.error.message}</p>}
        <div className="mt-auto pt-2.5">
          <div className="space-y-2 border-t border-surface-container pt-2.5">
            <p className="text-xs font-bold text-primary">{formatVnd(output ? order.price_per_image : order.total_charged)}</p>
            {output && (
              <button
                type="button"
                onClick={() => download.mutate({ generationId: order.id, outputId: output.id })}
                disabled={download.isPending}
                className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-primary-container text-xs font-bold text-on-primary transition-colors hover:bg-primary disabled:opacity-50"
              >
                <Icon name={download.isPending ? 'progress_activity' : 'download'} className={`text-sm ${download.isPending ? 'animate-spin' : ''}`} />
                Tải về
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

const imagesOf = (order) => (order.outputs ?? []).filter((o) => o.status === 'completed' && o.image_url);

/** /account/history: các lần tạo ảnh đã mua, mới nhất trước. */
export default function PurchaseHistoryPage() {
  useSeo({ title: 'Lịch sử mua', noindex: true });
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useGenerationHistory();
  const orders = data?.pages.flatMap((p) => p.items) ?? [];
  const [viewing, setViewing] = useState(null);
  // Trải phẳng: mỗi ảnh một thẻ, đơn chưa có ảnh giữ một thẻ trạng thái
  const cards = orders.flatMap((order) => {
    const images = imagesOf(order);
    return images.length ? images.map((output) => ({ key: `${order.id}-${output.id}`, order, output })) : [{ key: `${order.id}`, order }];
  });

  // Cuộn tới cuối danh sách thì tải thêm
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && fetchNextPage(), { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
        <h1 className="text-base font-bold text-on-surface lg:text-lg">Lịch sử mua hàng</h1>
      </header>

      <ImageViewer src={viewing?.image_url} alt={`Ảnh ${viewing?.position}`} onClose={() => setViewing(null)} />
      <div className="p-4">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-[3/4] !rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState icon="receipt_long" message="Bạn chưa mua lượt tạo ảnh nào.">
            <Link to="/explore" className="text-sm font-bold text-primary">
              Khám phá mẫu
            </Link>
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
              {cards.map((c) => (
                <ImageCard key={c.key} order={c.order} output={c.output} onView={setViewing} />
              ))}
            </div>
            {isFetchingNextPage && (
              <div className="mt-3 grid grid-cols-2 gap-3 lg:mt-4 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
                {Array.from({ length: 2 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] !rounded-2xl" />
                ))}
              </div>
            )}
            {hasNextPage && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
          </>
        )}
      </div>
    </>
  );
}
