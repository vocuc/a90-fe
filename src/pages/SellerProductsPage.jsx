import { useEffect, useRef, useState } from 'react';
import useSeo from '../hooks/useSeo';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import CoverImage from '../components/common/CoverImage';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { PAUSABLE, PUBLISHABLE, STATUS_BADGE, VISIBILITY_BADGE } from '../components/creative/creativeStatus';
import { useCreatorCreatives, useCreatorProfile, usePauseCreative, usePublishCreative } from '../hooks/creatorQueries';
import useHorizontalScroll from '../hooks/useHorizontalScroll';
import { formatCount, formatVnd } from '../utils/format';
import { hashtagSlug } from '../utils/hashtag';

// Khớp tham số status của GET /creator/creatives ('' = tất cả)
const TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'published', label: 'Đang bán' },
  { value: 'draft', label: 'Nháp' },
  { value: 'paused', label: 'Tạm dừng' },
];
const TAB_VALUES = TABS.map((t) => t.value);

const PAUSE_REASON = {
  manual: 'Bạn đã tạm dừng',
  no_valid_api_key: 'Không còn API key AI hoạt động',
};

const PAGE_SIZE = 20;

function ProductCard({ creative }) {
  const publish = usePublishCreative();
  const pause = usePauseCreative();
  const { id, title, cover_url, price_per_image, status, pause_reason, is_hidden, is_public, usage_count, group, hashtags } = creative;
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  const visibility = VISIBILITY_BADGE[is_public ? 'public' : 'private'];
  const canPublish = PUBLISHABLE.includes(status);
  // Mỗi trạng thái chỉ có một nút: đăng bán (nháp/tạm dừng) hoặc tạm dừng (đang bán)
  const action = canPublish ? publish : pause;
  const error = action.error;
  const reasons = error?.context?.reasons;
  const run = () => {
    if (!canPublish && !window.confirm('Tạm dừng bán? Người mua sẽ không tạo ảnh được với Creative này tới khi đăng bán lại.')) return;
    action.mutate(id);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
      <Link
        to={`/seller/creatives/${id}/edit`}
        aria-label={`Sửa ${title}`}
        className="flex flex-1 flex-col transition-colors hover:bg-surface-container-low"
      >
        <div className="relative aspect-square w-full bg-surface-container">
          <CoverImage src={cover_url} alt={title} className="h-full w-full" />
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
            <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${visibility.cls}`}>
              <Icon name={visibility.icon} className="text-[12px]" />
              {visibility.label}
            </span>
            {is_hidden && (
              <span className="rounded-full bg-error-container px-2 py-0.5 text-[10px] font-bold text-on-error-container">
                Bị ẩn
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-2.5">
          <h3 className="mb-1 line-clamp-2 text-xs font-bold text-on-surface">{title}</h3>
          <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
            {group && (
              <p className="flex min-w-0 items-center gap-0.5">
                <Icon name="workspaces" className="shrink-0 text-[12px]" />
                <span className="truncate">{group.name}</span>
              </p>
            )}
            <p className="ml-auto shrink-0">{formatCount(usage_count)} lượt tải về</p>
          </div>
          {hashtags?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {hashtags.map((h) => (
                <span
                  key={h.slug}
                  className="max-w-full truncate rounded-full bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                >
                  #{h.name}
                </span>
              ))}
            </div>
          )}
          {status === 'paused' && pause_reason && (
            <p className="mt-0.5 text-[11px] text-error">{PAUSE_REASON[pause_reason] ?? pause_reason}</p>
          )}
          {/* pt-2 ở lớp ngoài: luôn chừa khoảng cách với hashtag / dòng phía trên dù thẻ đã đầy (mt-auto = 0) */}
          <div className="mt-auto pt-2">
            <p className="border-t border-surface-container pt-2 text-xs font-bold text-primary">
              {formatVnd(price_per_image)}
            </p>
          </div>
        </div>
      </Link>

      {(canPublish || PAUSABLE.includes(status)) && (
        <div className="space-y-2 px-2.5 pb-2.5">
          <button
            type="button"
            onClick={run}
            disabled={action.isPending}
            className={`flex h-8 w-full items-center justify-center gap-1 rounded-lg px-3 text-xs font-bold disabled:opacity-50 ${
              canPublish
                ? 'bg-primary-container text-on-primary hover:bg-primary'
                : 'border border-outline-variant/50 text-on-surface hover:border-error hover:text-error'
            }`}
          >
            <Icon
              name={action.isPending ? 'progress_activity' : canPublish ? 'rocket_launch' : 'pause_circle'}
              className={`text-sm ${action.isPending ? 'animate-spin' : ''}`}
            />
            {!canPublish ? 'Tạm dừng' : status === 'paused' ? 'Đăng bán lại' : 'Đăng bán'}
          </button>
          {error && (
            <div role="alert" className="rounded-lg bg-error-container/60 px-2.5 py-2 text-[11px] text-on-error-container">
              <p className="flex items-start gap-1 font-semibold">
                <Icon name="error" className="text-sm" />
                {error.message}
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
  useSeo({ title: 'Creative của tôi', noindex: true });
  const [params, setParams] = useSearchParams();
  const status = TAB_VALUES.includes(params.get('status')) ? params.get('status') : '';
  const hashtag = params.get('hashtag') ?? '';
  const tabScrollRef = useHorizontalScroll();

  // Ô tìm kiếm lọc theo hashtag ("Chân dung", "#chandung" -> chandung), gõ xong 400ms mới lọc
  const [input, setInput] = useState(hashtag);
  useEffect(() => {
    const t = setTimeout(() => {
      const slug = hashtagSlug(input);
      if (slug === hashtag) return;
      const next = new URLSearchParams(params);
      if (slug) next.set('hashtag', slug);
      else next.delete('hashtag');
      setParams(next, { replace: true });
    }, 400);
    return () => clearTimeout(t);
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  // GET /creator/creatives cần profile người bán (403 khi chưa có)
  const { hasProfile, meLoaded } = useCreatorProfile();
  const { data, isLoading, isFetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCreatorCreatives({ status: status || undefined, hashtag: hashtag || undefined, limit: PAGE_SIZE }, hasProfile);
  const pageItems = data?.pages.flatMap((p) => p.items) ?? [];
  // Lọc thêm ở client phòng khi backend chưa hỗ trợ tham số hashtag
  const items = hashtag ? pageItems.filter((c) => c.hashtags?.some((h) => h.slug === hashtag)) : pageItems;
  const backendFiltered = items.length === pageItems.length;

  // Cuộn gần tới cuối danh sách thì tự tải trang tiếp, hết trang thì thôi
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && fetchNextPage(), {
      rootMargin: '300px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const setStatus = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('status', value);
    else next.delete('status');
    setParams(next, { replace: true });
  };

  return (
    <>
      <header className="sticky top-[60px] z-30 border-b border-surface-container bg-surface-container-lowest/90 backdrop-blur-md">
        <div className="flex items-center gap-2 px-2 py-2">
          <Link to="/account" aria-label="Quay lại" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
            <Icon name="arrow_back" />
          </Link>
          <h1 className="flex-1 text-base font-bold text-on-surface">Quản lý Creative</h1>
          {isFetching && !isLoading && !isFetchingNextPage && <Icon name="progress_activity" className="animate-spin text-lg text-outline" />}
          {hasProfile && (
            <Link
              to="/seller/creative-groups"
              className="flex h-8 items-center gap-1 rounded-lg border border-outline-variant/50 px-3 text-xs font-bold text-on-surface hover:border-primary-container"
            >
              <Icon name="workspaces" className="text-base" />
              Nhóm creative
            </Link>
          )}
          {hasProfile && (
            <Link
              to="/seller/creatives/new"
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
                onClick={() => setStatus(t.value)}
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
        {hasProfile && (
          <div className="px-4 pb-3">
            <div className="flex h-10 items-center rounded-xl bg-surface-container-low px-3 focus-within:ring-2 focus-within:ring-primary-container/30">
              <Icon name="tag" className="mr-2 text-[20px] text-outline" />
              <input
                type="search"
                maxLength={100}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tìm theo hashtag, ví dụ: chandung"
                aria-label="Tìm Creative theo hashtag"
                className="w-full border-none bg-transparent p-0 text-sm font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-0"
              />
              {input && (
                <button
                  type="button"
                  onClick={() => setInput('')}
                  aria-label="Xoá tìm kiếm"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-outline hover:bg-surface-container"
                >
                  <Icon name="close" className="text-lg" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <section className="p-4">
        {!meLoaded ? (
          <Skeleton className="h-24 w-full" />
        ) : !hasProfile ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Icon name="storefront" className="text-4xl text-outline" />
            <p className="text-sm text-on-surface-variant">Bạn cần tạo cửa hàng trước khi quản lý Creative.</p>
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4]" />
            ))}
          </div>
        ) : items.length === 0 && !hasNextPage ? (
          <EmptyState
            icon="inventory_2"
            message={
              hashtag
                ? `Không có AI Creative nào gắn #${input.replace(/^#+/, '').trim() || hashtag}.`
                : status
                  ? 'Không có AI Creative nào ở trạng thái này.'
                  : 'Bạn chưa tạo AI Creative nào.'
            }
          >
            {!status && !hashtag && (
              <Link
                to="/seller/creatives/new"
                className="mt-2 flex h-10 items-center gap-1 rounded-xl bg-primary-container px-4 text-sm font-bold text-on-primary hover:bg-primary"
              >
                <Icon name="add" className="text-lg" />
                Tạo Creative
              </Link>
            )}
          </EmptyState>
        ) : (
          <>
            <p className="mb-2 text-xs text-on-surface-variant">
              {backendFiltered ? data.pages[0].total : `${items.length}${hasNextPage ? '+' : ''}`} AI Creative
            </p>
            {/* 2 Creative mỗi hàng (desktop 4–5), thẻ cùng hàng cao bằng nhau */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
              {items.map((c) => (
                <ProductCard key={c.id} creative={c} />
              ))}
            </div>
            {isFetchingNextPage && (
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4]" />
                ))}
              </div>
            )}
            {hasNextPage && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
          </>
        )}
      </section>
    </>
  );
}
