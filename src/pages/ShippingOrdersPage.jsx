import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import CoverImage from '../components/common/CoverImage';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { OrderStatusBadge } from '../components/shipping/OrderStatus';
import { formatVnd } from '../utils/format';
import { ORDER_STATUS, listOrders } from '../api/shipping';

const PAGE_SIZE = 20;

const FILTERS = [
  { value: undefined, label: 'Tất cả' },
  { value: ORDER_STATUS.DRAFT, label: 'Nháp' },
  { value: ORDER_STATUS.SUBMITTED, label: 'Đã gửi' },
  { value: ORDER_STATUS.FAILED, label: 'Lỗi' },
];

const formatTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

const receiver = (o) => [o.toName, o.toPhone].filter(Boolean).join(' · ') || 'Chưa có người nhận';
const address = (o) => [o.toAddress, o.toWardName, o.toDistrictName, o.toProvinceName].filter(Boolean).join(', ');

/** /shipping-orders: danh sách đơn GHN tạo từ ảnh (nháp / đã gửi / lỗi), mã đơn GHN, phí ship. */
export default function ShippingOrdersPage() {
  useSeo({ title: 'Đơn GHN', noindex: true });
  const navigate = useNavigate();
  const [status, setStatus] = useState(undefined);
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/tools'));

  const { data, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['shipping', 'orders', 'list', status ?? 'all'],
    queryFn: ({ pageParam }) => listOrders({ page: pageParam, limit: PAGE_SIZE, status }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
  });
  const orders = data ? data.pages.flatMap((p) => p.items) : null;

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
        <h1 className="flex-1 text-base font-bold text-on-surface">Đơn GHN</h1>
        <Link
          to="/shipping-orders/new"
          className="mr-2 flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary"
        >
          <Icon name="add" className="text-base" />
          Tạo đơn từ ảnh
        </Link>
      </header>

      <section className="space-y-3 p-4 lg:py-6">
        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={status === f.value}
              onClick={() => setStatus(f.value)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                status === f.value ? 'bg-primary text-on-primary' : 'bg-surface-container text-primary hover:bg-primary-fixed/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !orders ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : !orders.length ? (
          <EmptyState icon="local_shipping" message="Chưa có đơn nào.">
            <Link
              to="/shipping-orders/new"
              className="mt-2 flex h-10 items-center gap-1 rounded-xl bg-primary-container px-4 text-sm font-bold text-on-primary hover:bg-primary"
            >
              <Icon name="add_photo_alternate" className="text-lg" />
              Tạo đơn từ ảnh
            </Link>
          </EmptyState>
        ) : (
          <>
            <ul className="grid gap-3 lg:grid-cols-2">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    to={`/shipping-orders/${o.id}`}
                    className={`flex gap-3 rounded-2xl border p-3 transition-colors hover:bg-surface-container-low ${
                      o.status === ORDER_STATUS.SUBMITTED ? 'border-outline-variant/40' : 'border-amber-200'
                    }`}
                  >
                    <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-xl bg-surface-container">
                      <CoverImage src={o.images[0]?.url} alt="" className="size-full" />
                      {o.images.length > 1 && (
                        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
                          {o.images.length}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-bold text-on-surface">{receiver(o)}</p>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <p className="line-clamp-1 text-xs text-on-surface-variant">{address(o) || o.rawAddress || '—'}</p>
                      <p className="text-xs text-on-surface-variant">
                        Thu hộ <b className="text-on-surface">{formatVnd(o.codAmount)}</b>
                        {o.shippingFee != null && <> · Ship {formatVnd(o.shippingFee)}</>}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center gap-x-2 pt-1 text-[11px] text-outline">
                        <span>{o.code}</span>
                        {o.ghnOrderCode && <span className="font-semibold text-emerald-700">GHN: {o.ghnOrderCode}</span>}
                        <span>{formatTime(o.createdAt)}</span>
                      </div>
                    </div>
                  </Link>
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
                Xem thêm đơn
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
