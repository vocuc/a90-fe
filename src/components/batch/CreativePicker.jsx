import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import CategoryStrip from '../home/CategoryStrip';
import HashtagStrip from '../home/HashtagStrip';
import { STATUS_BADGE, VISIBILITY_BADGE } from '../creative/creativeStatus';
import { useInfiniteCreatives, useMe } from '../../hooks/queries';
import { useCreatorCreatives } from '../../hooks/creatorQueries';
import { mapOwnCreative } from '../../api/services';
import { formatVnd } from '../../utils/format';
import { hashtagSlug } from '../../utils/hashtag';

// Chỉ mẫu đã đăng bán mới tạo ảnh được
const usable = (c) => !c.own || c.status === 'published';

const VISIBILITY_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'private', label: 'Riêng tư' },
  { value: 'public', label: 'Công khai' },
];

function VisibilityBadge({ creative, className = '' }) {
  const v = VISIBILITY_BADGE[creative.isPublic ? 'public' : 'private'];
  return (
    <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${v.cls} ${className}`}>
      <Icon name={v.icon} className="text-[12px]" />
      {v.label}
    </span>
  );
}

/** Lưới thẻ mẫu (chọn / bỏ chọn), cuộn tới cuối thì tự tải thêm; dùng chung cho Kho mẫu và Mẫu của tôi. */
function CreativeGrid({ creatives, isPicked, full, onToggle, hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage, loadingLabel }) {
  // Cuộn gần tới cuối lưới thì tự tải trang tiếp, hết trang thì thôi
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage || isPlaceholderData) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && fetchNextPage(), {
      rootMargin: '300px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {creatives.map((c) => {
          const on = isPicked(c);
          const ok = usable(c);
          const status = c.own && !ok ? (STATUS_BADGE[c.status] ?? STATUS_BADGE.draft) : null;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c)}
              disabled={!on && (full || !ok)}
              aria-pressed={on}
              className={`flex flex-col overflow-hidden rounded-2xl border text-left transition-all disabled:opacity-40 ${
                on ? 'border-primary-container ring-2 ring-primary-container' : 'border-outline-variant/40 hover:border-primary-container'
              }`}
            >
              <span className="relative block aspect-square w-full bg-surface-container">
                <CoverImage src={c.imageUrl} alt={c.title} className="size-full" />
                {c.own && (
                  <span className="absolute left-2 top-2 flex flex-wrap gap-1">
                    <VisibilityBadge creative={c} />
                    {status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`}>{status.label}</span>}
                  </span>
                )}
                <span
                  className={`absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border-2 ${
                    on ? 'border-primary-container bg-primary-container text-on-primary' : 'border-white bg-black/20'
                  }`}
                >
                  {on && <Icon name="check" className="text-sm" />}
                </span>
              </span>
              <span className="block p-2">
                <span className="block truncate text-xs font-bold text-on-surface">{c.title}</span>
                <span className="block text-[11px] font-semibold text-primary">
                  {status ? (
                    <span className="font-normal text-outline">Đăng bán để dùng</span>
                  ) : c.price > 0 ? (
                    `${formatVnd(c.price)}/ảnh`
                  ) : (
                    'Miễn phí'
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {hasNextPage && !isPlaceholderData && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
      {isFetchingNextPage && (
        <p className="flex items-center justify-center gap-1 text-sm text-on-surface-variant">
          <Icon name="progress_activity" className="animate-spin text-base" />
          {loadingLabel}
        </p>
      )}
    </>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="aspect-[4/5]" />
      ))}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder, label, icon = 'search', busy }) {
  return (
    <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl bg-surface-container-low px-3 focus-within:ring-2 focus-within:ring-primary-container/30">
      <Icon name={icon} className="mr-2 text-[22px] text-outline" />
      <input
        type="search"
        maxLength={100}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full border-none bg-transparent p-0 text-sm font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-0"
      />
      {busy && <Icon name="progress_activity" className="animate-spin text-lg text-outline" />}
    </div>
  );
}

/** Tab Kho mẫu: mẫu công khai trên marketplace, tìm theo tên / ngành hàng / hashtag. */
function MarketplaceTab(props) {
  // Bộ lọc mẫu: tên mẫu (q), ngành hàng (category), hashtag. Gõ "#abc" vào ô tìm kiếm = lọc hashtag abc
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [hashtag, setHashtag] = useState({ slug: '', name: '' });

  // Gõ xong 300ms mới tìm
  useEffect(() => {
    const t = setTimeout(() => {
      const text = input.trim();
      if (text.startsWith('#')) {
        const slug = hashtagSlug(text);
        setQ('');
        setHashtag(slug ? { slug, name: text.replace(/^#+/, '') } : { slug: '', name: '' });
      } else {
        setQ(text);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const pickHashtag = (slug, name) => {
    setHashtag({ slug, name: slug ? name : '' });
    // Đang gõ #hashtag trong ô tìm kiếm thì đồng bộ theo dải hashtag
    if (input.trim().startsWith('#')) setInput(slug ? `#${name}` : '');
  };

  const hasFilter = Boolean(input.trim() || category || hashtag.slug);
  const clearFilters = () => {
    setInput('');
    setQ('');
    setCategory('');
    setHashtag({ slug: '', name: '' });
  };

  const {
    data,
    isLoading,
    isFetching,
    error: listError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPlaceholderData,
  } = useInfiniteCreatives({ q: q || undefined, category: category || undefined, hashtag: hashtag.slug || undefined, limit: 20 });
  const creatives = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <div className="flex items-center gap-2">
        <SearchBox
          value={input}
          onChange={setInput}
          icon={input.trim().startsWith('#') ? 'tag' : 'search'}
          placeholder="Tìm theo tên mẫu hoặc #hashtag"
          label="Tìm AI Creative theo tên hoặc hashtag"
          busy={isFetching && !isFetchingNextPage}
        />
        {hasFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-xs font-bold text-primary hover:bg-surface-container"
          >
            <Icon name="filter_alt_off" className="text-lg" />
            Xoá lọc
          </button>
        )}
      </div>

      {/* Dải ngành hàng và hashtag có sẵn lề ngang 16px: kéo ra sát mép để cuộn hết chiều rộng */}
      <div className="-mx-4">
        <p className="px-4 pt-1 text-xs font-semibold text-on-surface-variant">Ngành hàng</p>
        <div className="-mt-2">
          <CategoryStrip active={category} onSelect={setCategory} />
        </div>
        <p className="px-4 pb-2 text-xs font-semibold text-on-surface-variant">Hashtag phổ biến</p>
        <HashtagStrip active={hashtag.slug} activeName={hashtag.name} onSelect={pickHashtag} />
      </div>

      {listError ? (
        <ErrorState error={listError} onRetry={refetch} />
      ) : isLoading ? (
        <GridSkeleton />
      ) : !creatives.length ? (
        <EmptyState message="Không tìm thấy mẫu phù hợp." />
      ) : (
        <CreativeGrid
          {...props}
          creatives={creatives}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isPlaceholderData={isPlaceholderData}
          fetchNextPage={fetchNextPage}
          loadingLabel="Đang tải thêm mẫu..."
        />
      )}
    </>
  );
}

/** Tab Mẫu của tôi: Creative của chính creator (GET /creator/creatives), gồm cả mẫu riêng tư không có trên marketplace. */
function MineTab(props) {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [visibility, setVisibility] = useState('');

  // Gõ xong 300ms mới tìm
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isLoading, isFetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useCreatorCreatives(
    { q: q || undefined, visibility: visibility || undefined, limit: 20 },
    true,
  );
  const creatives = useMemo(() => data?.pages.flatMap((p) => p.items.map(mapOwnCreative)) ?? [], [data]);
  const hasFilter = Boolean(q || visibility);

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading && !hasFilter) return <GridSkeleton />;
  if (!creatives.length && !hasFilter && !isFetching)
    return (
      <EmptyState icon="palette" message="Bạn chưa có mẫu AI Creative nào.">
        <Link to="/seller/creatives/new" className="mt-2 inline-block text-sm font-bold text-primary">
          Tạo mẫu đầu tiên
        </Link>
      </EmptyState>
    );

  return (
    <>
      <SearchBox
        value={input}
        onChange={setInput}
        placeholder="Tìm trong mẫu của bạn"
        label="Tìm trong mẫu của bạn theo tên"
        busy={isFetching && !isFetchingNextPage}
      />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {VISIBILITY_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setVisibility(f.value)}
            aria-pressed={visibility === f.value}
            className={`flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-bold transition-colors ${
              visibility === f.value
                ? 'border-primary-container bg-primary-container text-on-primary'
                : 'border-outline-variant/60 text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {f.value && <Icon name={VISIBILITY_BADGE[f.value].icon} className="text-sm" />}
            {f.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <GridSkeleton />
      ) : !creatives.length ? (
        <EmptyState message="Không có mẫu phù hợp." />
      ) : (
        <CreativeGrid
          {...props}
          creatives={creatives}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          loadingLabel="Đang tải thêm mẫu của tôi..."
        />
      )}
      {creatives.length > 0 && !hasNextPage && (
        <p className="text-center text-[11px] text-outline">Mẫu nháp hoặc tạm dừng cần đăng bán để tạo ảnh.</p>
      )}
    </>
  );
}

/**
 * Chọn mẫu AI Creative: tab Kho mẫu (marketplace) và Mẫu của tôi (chỉ creator, gồm mẫu riêng tư), chọn một hoặc nhiều
 * mẫu (mỗi mẫu một lần, trộn được hai tab). Tab đang mở lưu ở ?src=mine.
 * max: số mẫu tối đa, bỏ trống = không giới hạn. hint: dòng gợi ý khi chưa chọn mẫu nào.
 */
export default function CreativePicker({ picked, onToggle, max = Infinity, hint = 'Chọn một hoặc nhiều mẫu.' }) {
  const { data: me } = useMe();
  const isCreator = !!me?.creatorProfile;
  const [params, setParams] = useSearchParams();
  const tab = isCreator && params.get('src') === 'mine' ? 'mine' : 'market';
  const setTab = (t) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (t === 'mine') next.set('src', 'mine');
        else next.delete('src');
        return next;
      },
      { replace: true },
    );

  const isPicked = (c) => picked.some((p) => p.id === c.id);
  const full = picked.length >= max;
  const gridProps = { isPicked, full, onToggle };
  const mineCount = picked.filter((c) => c.own).length;

  return (
    <div className="p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8 lg:py-6">
      {/* Phải (desktop) / trên (mobile): các mẫu đã chọn */}
      <aside className="space-y-2 lg:order-2 lg:sticky lg:top-[136px]">
        <h2 className="flex items-center justify-between text-sm font-bold text-on-surface">
          Mẫu đã chọn
          <span className="text-xs font-normal text-outline">
            {picked.length}
            {Number.isFinite(max) ? `/${max}` : ''}
          </span>
        </h2>
        {picked.length ? (
          <ul className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {picked.map((c) => (
              <li key={c.id} className="flex w-48 shrink-0 items-center gap-2 rounded-xl border border-outline-variant/40 p-1.5 lg:w-auto">
                <CoverImage src={c.imageUrl} alt="" className="size-10 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-xs font-semibold text-on-surface">
                    <span className="truncate">{c.title}</span>
                    {c.own && !c.isPublic && (
                      <>
                        <Icon name="lock" className="shrink-0 text-[13px] text-outline" />
                        <span className="sr-only">Riêng tư</span>
                      </>
                    )}
                  </span>
                  <span className="block text-[11px] text-outline">{c.price > 0 ? formatVnd(c.price) : 'Miễn phí'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onToggle(c)}
                  aria-label={`Bỏ chọn ${c.title}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-outline hover:bg-surface-container"
                >
                  <Icon name="close" className="text-base" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-on-surface-variant">{hint}</p>
        )}
      </aside>

      {/* Trái (desktop) / dưới (mobile): tìm và chọn mẫu */}
      <section className="mt-6 space-y-3 lg:order-1 lg:mt-0">
        {isCreator ? (
          <div role="tablist" aria-label="Nguồn mẫu" className="flex gap-1 rounded-xl bg-surface-container-low p-1">
            {[
              { value: 'market', label: 'Kho mẫu', icon: 'storefront' },
              { value: 'mine', label: 'Mẫu của tôi', icon: 'lock' },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-lg text-sm font-bold transition-colors ${
                  tab === t.value ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Icon name={t.icon} className="text-lg" />
                {t.label}
                {t.value === 'mine' && mineCount > 0 && (
                  <span className="rounded-full bg-primary-container px-1.5 text-[10px] text-on-primary">{mineCount}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <h2 className="text-sm font-bold text-on-surface">Chọn mẫu AI Creative</h2>
        )}
        {tab === 'mine' ? <MineTab {...gridProps} /> : <MarketplaceTab {...gridProps} />}
      </section>
    </div>
  );
}
