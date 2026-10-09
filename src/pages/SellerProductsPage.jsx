import useSeo from '../hooks/useSeo';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import CoverImage from '../components/common/CoverImage';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { useCreatorCreatives, useCreatorProfile, usePublishCreative } from '../hooks/creatorQueries';
import useHorizontalScroll from '../hooks/useHorizontalScroll';
import { formatCount, formatVnd } from '../utils/format';

// Khớp tham số status của GET /creator/creatives ('' = tất cả)
const TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'published', label: 'Đang bán' },
  { value: 'draft', label: 'Nháp' },
  { value: 'paused', label: 'Tạm dừng' },
];
const TAB_VALUES = TABS.map((t) => t.value);

const STATUS_BADGE = {
  published: { label: 'Đang bán', cls: 'bg-primary-container text-on-primary' },
  draft: { label: 'Nháp', cls: 'bg-surface-container text-on-surface-variant' },
  paused: { label: 'Tạm dừng', cls: 'bg-error-container text-on-error-container' },
};

const PAUSE_REASON = {
  manual: 'Bạn đã tạm dừng',
  no_valid_api_key: 'Không còn API key AI hoạt động',
};

const PAGE_SIZE = 20;

// Chỉ đăng bán được Creative nháp hoặc tạm dừng (POST /creator/creatives/{id}/publish)
const PUBLISHABLE = ['draft', 'paused'];

function ProductCard({ creative }) {
  const publish = usePublishCreative();
  const { id, title, cover_url, price_per_image, status, pause_reason, is_hidden, usage_count } = creative;
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  const reasons = publish.error?.context?.reasons;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
      <Link
        to={`/seller/products/${id}/edit`}
        aria-label={`Sửa ${title}`}
        className="flex flex-1 flex-col transition-colors hover:bg-surface-container-low"
      >
        <div className="relative aspect-square w-full bg-surface-container">
          <CoverImage src={cover_url} alt={title} className="h-full w-full" />
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
            {is_hidden && (
              <span className="rounded-full bg-error-container px-2 py-0.5 text-[10px] font-bold text-on-error-container">
                Bị ẩn
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-2.5">
          <h3 className="mb-1 line-clamp-2 text-xs font-bold text-on-surface">{title}</h3>
          <p className="text-[11px] text-on-surface-variant">{formatCount(usage_count)} lượt tải về</p>
          {status === 'paused' && pause_reason && (
            <p className="mt-0.5 text-[11px] text-error">{PAUSE_REASON[pause_reason] ?? pause_reason}</p>
          )}
          <p className="mt-auto border-t border-surface-container pt-2 text-xs font-bold text-primary">
            {formatVnd(price_per_image)}
          </p>
        </div>
      </Link>

      {PUBLISHABLE.includes(status) && (
        <div className="space-y-2 px-2.5 pb-2.5">
          <button
            type="button"
            onClick={() => publish.mutate(id)}
            disabled={publish.isPending}
            className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            <Icon
              name={publish.isPending ? 'progress_activity' : 'rocket_launch'}
              className={`text-sm ${publish.isPending ? 'animate-spin' : ''}`}
            />
            {status === 'paused' ? 'Đăng bán lại' : 'Đăng bán'}
          </button>
          {publish.error && (
            <div role="alert" className="rounded-lg bg-error-container/60 px-2.5 py-2 text-[11px] text-on-error-container">
              <p className="flex items-start gap-1 font-semibold">
                <Icon name="error" className="text-sm" />
                {publish.error.message}
              </p>
              {reasons?.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SellerProductsPage() {
  useSeo({ title: 'Sản phẩm của tôi', noindex: true });
  const [params, setParams] = useSearchParams();
  const status = TAB_VALUES.includes(params.get('status')) ? params.get('status') : '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const tabScrollRef = useHorizontalScroll();

  // GET /creator/creatives cần profile người bán (403 khi chưa có)
  const { hasProfile, meLoaded } = useCreatorProfile();
  const { data, isLoading, isFetching, error, refetch } = useCreatorCreatives(
    { status: status || undefined, page, limit: PAGE_SIZE },
    hasProfile,
  );

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: key !== 'page' });
    if (key === 'page') window.scrollTo({ top: 0 });
  };

  return (
    <>
      <header className="sticky top-[60px] z-30 border-b border-surface-container bg-surface-container-lowest/90 backdrop-blur-md">
        <div className="flex items-center gap-2 px-2 py-2">
          <Link to="/account" aria-label="Quay lại" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
            <Icon name="arrow_back" />
          </Link>
          <h1 className="flex-1 text-base font-bold text-on-surface">Quản lý sản phẩm</h1>
          {isFetching && !isLoading && <Icon name="progress_activity" className="animate-spin text-lg text-outline" />}
          {hasProfile && (
            <Link
              to="/seller/products/new"
              className="mr-2 flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary"
            >
              <Icon name="add" className="text-base" />
              Tạo mới
            </Link>
          )}
        </div>
        {hasProfile && (
          <div ref={tabScrollRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => update('status', t.value)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  status === t.value
                    ? 'border-primary-container bg-primary-container text-on-primary'
                    : 'border-outline-variant/40 text-on-surface-variant hover:border-primary-container'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <section className="p-4">
        {!meLoaded ? (
          <Skeleton className="h-24 w-full" />
        ) : !hasProfile ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Icon name="storefront" className="text-4xl text-outline" />
            <p className="text-sm text-on-surface-variant">Bạn cần tạo cửa hàng trước khi quản lý sản phẩm.</p>
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4]" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon="inventory_2"
            message={status ? 'Không có AI Creative nào ở trạng thái này.' : 'Bạn chưa tạo AI Creative nào.'}
          >
            {!status && (
              <Link
                to="/seller/products/new"
                className="mt-2 flex h-10 items-center gap-1 rounded-xl bg-primary-container px-4 text-sm font-bold text-on-primary hover:bg-primary"
              >
                <Icon name="add" className="text-lg" />
                Tạo sản phẩm
              </Link>
            )}
          </EmptyState>
        ) : (
          <>
            <p className="mb-2 text-xs text-on-surface-variant">{data.total} AI Creative</p>
            {/* 2 sản phẩm mỗi hàng, thẻ cùng hàng cao bằng nhau */}
            <div className="grid grid-cols-2 gap-3">
              {data.items.map((c) => (
                <ProductCard key={c.id} creative={c} />
              ))}
            </div>
            {data.lastPage > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => update('page', String(page - 1))}
                  className="flex h-9 items-center gap-1 rounded-lg border border-outline-variant/40 px-3 text-xs font-semibold text-on-surface disabled:opacity-40"
                >
                  <Icon name="chevron_left" className="text-base" /> Trước
                </button>
                <span className="text-xs text-on-surface-variant">
                  Trang {data.page}/{data.lastPage}
                </span>
                <button
                  type="button"
                  disabled={page >= data.lastPage}
                  onClick={() => update('page', String(page + 1))}
                  className="flex h-9 items-center gap-1 rounded-lg border border-outline-variant/40 px-3 text-xs font-semibold text-on-surface disabled:opacity-40"
                >
                  Sau <Icon name="chevron_right" className="text-base" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
