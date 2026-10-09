import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import CategoryStrip from '../components/home/CategoryStrip';
import CompactCreativeCard from '../components/creative/CompactCreativeCard';
import { useCreatives } from '../hooks/queries';
import useHorizontalScroll from '../hooks/useHorizontalScroll';

// Khớp tham số sort của GET /creatives
const SORTS = [
  { value: 'popular', label: 'Phổ biến' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price_asc', label: 'Giá thấp' },
  { value: 'price_desc', label: 'Giá cao' },
];
const SORT_VALUES = SORTS.map((s) => s.value);
const PAGE_SIZE = 20;

export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  // Link cũ có thể mang sort không còn hỗ trợ (vd. rating) -> về mặc định
  const sort = SORT_VALUES.includes(params.get('sort')) ? params.get('sort') : 'popular';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [input, setInput] = useState(q);
  const sortScrollRef = useHorizontalScroll();

  // Đổi bộ lọc thì quay về trang 1
  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: key !== 'page' });
    if (key === 'page') window.scrollTo({ top: 0 });
  };

  // Đồng bộ ô tìm kiếm -> URL sau 400ms ngừng gõ
  useEffect(() => {
    if (input.trim() === q) return;
    const t = setTimeout(() => update('q', input.trim()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const { data, isLoading, isFetching, error, refetch } = useCreatives({
    q: q || undefined,
    category: category || undefined,
    sort,
    page,
    limit: PAGE_SIZE,
  });

  return (
    <>
      <header className="sticky top-[60px] z-30 border-b border-surface-container bg-surface-container-lowest/90 px-4 py-3 backdrop-blur-md">
        <h1 className="mb-3 text-lg font-bold text-on-surface">Sản phẩm</h1>
        <div className="flex w-full items-center rounded-xl border border-outline-variant/40 bg-surface-container-low px-3.5 py-1.5 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20">
          <Icon name="search" className="mr-2 text-[22px] text-outline" />
          <input
            type="search"
            maxLength={100}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tìm kiếm AI Creative..."
            aria-label="Tìm kiếm AI Creative"
            className="w-full border-none bg-transparent p-0 text-sm font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-0"
          />
          {isFetching && <Icon name="progress_activity" className="animate-spin text-lg text-outline" />}
        </div>
      </header>

      <CategoryStrip active={category} onSelect={(slug) => update('category', slug)} />

      <div ref={sortScrollRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => update('sort', s.value)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              sort === s.value
                ? 'border-primary-container bg-primary-container text-on-primary'
                : 'border-outline-variant/40 text-on-surface-variant hover:border-primary-container'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <section className="px-4 pb-4">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4]" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState message="Không tìm thấy AI Creative phù hợp." />
        ) : (
          <>
            <p className="mb-2 text-xs text-on-surface-variant">{data.total} kết quả</p>
            <div className="grid grid-cols-2 gap-3">
              {data.items.map((c) => (
                <CompactCreativeCard key={c.id} creative={c} />
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
