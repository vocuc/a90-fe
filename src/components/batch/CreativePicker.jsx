import { useEffect, useState } from 'react';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import CategoryStrip from '../home/CategoryStrip';
import HashtagStrip from '../home/HashtagStrip';
import { useInfiniteCreatives } from '../../hooks/queries';
import { formatVnd } from '../../utils/format';
import { hashtagSlug } from '../../utils/hashtag';

/**
 * Chọn mẫu AI Creative: tìm theo tên / ngành hàng / hashtag, chọn một hoặc nhiều mẫu (mỗi mẫu một lần).
 * max: số mẫu tối đa, bỏ trống = không giới hạn. hint: dòng gợi ý khi chưa chọn mẫu nào.
 */
export default function CreativePicker({ picked, onToggle, max = Infinity, hint = 'Chọn một hoặc nhiều mẫu.' }) {
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
  } = useInfiniteCreatives({ q: q || undefined, category: category || undefined, hashtag: hashtag.slug || undefined, limit: 20 });
  const creatives = data?.pages.flatMap((p) => p.items) ?? [];

  const isPicked = (c) => picked.some((p) => p.id === c.id);
  const full = picked.length >= max;

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
                  <span className="block truncate text-xs font-semibold text-on-surface">{c.title}</span>
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
        <h2 className="text-sm font-bold text-on-surface">Chọn mẫu AI Creative</h2>
        <div className="flex items-center gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl bg-surface-container-low px-3 focus-within:ring-2 focus-within:ring-primary-container/30">
            <Icon name={input.trim().startsWith('#') ? 'tag' : 'search'} className="mr-2 text-[22px] text-outline" />
            <input
              type="search"
              maxLength={100}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tìm theo tên mẫu hoặc #hashtag"
              aria-label="Tìm AI Creative theo tên hoặc hashtag"
              className="w-full border-none bg-transparent p-0 text-sm font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-0"
            />
            {isFetching && !isFetchingNextPage && <Icon name="progress_activity" className="animate-spin text-lg text-outline" />}
          </div>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5]" />
            ))}
          </div>
        ) : !creatives.length ? (
          <EmptyState message="Không tìm thấy mẫu phù hợp." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {creatives.map((c) => {
                const on = isPicked(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onToggle(c)}
                    disabled={!on && full}
                    aria-pressed={on}
                    className={`flex flex-col overflow-hidden rounded-2xl border text-left transition-all disabled:opacity-40 ${
                      on
                        ? 'border-primary-container ring-2 ring-primary-container'
                        : 'border-outline-variant/40 hover:border-primary-container'
                    }`}
                  >
                    <span className="relative block aspect-square w-full bg-surface-container">
                      <CoverImage src={c.imageUrl} alt={c.title} className="size-full" />
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
                        {c.price > 0 ? `${formatVnd(c.price)}/ảnh` : 'Miễn phí'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {hasNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="mx-auto flex h-9 items-center gap-1 rounded-lg px-4 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-60"
              >
                {isFetchingNextPage && <Icon name="progress_activity" className="animate-spin text-base" />}
                Xem thêm mẫu
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
