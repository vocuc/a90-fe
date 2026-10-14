import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import CategoryStrip from '../components/home/CategoryStrip';
import HashtagStrip from '../components/home/HashtagStrip';
import CompactCreativeCard from '../components/creative/CompactCreativeCard';
import { useCategories, useHashtags, useInfiniteCreatives } from '../hooks/queries';
import useSeo from '../hooks/useSeo';
import useHorizontalScroll from '../hooks/useHorizontalScroll';
import { hashtagSlug } from '../utils/hashtag';

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
  const hashtag = params.get('hashtag') ?? '';
  // Link cũ có thể mang sort không còn hỗ trợ (vd. rating) -> về mặc định
  const sort = SORT_VALUES.includes(params.get('sort')) ? params.get('sort') : 'popular';

  // Ô tìm kiếm mặc định lọc theo hashtag; q (tìm theo tên mẫu) chỉ dùng khi chọn "Tìm theo tên mẫu" hoặc link cũ
  const [input, setInput] = useState(q || hashtag);
  const sortScrollRef = useHorizontalScroll();

  // Đổi bộ lọc thì danh sách tải lại từ đầu. changes: { key: value }, value rỗng -> bỏ lọc
  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    next.delete('page');
    setParams(next, { replace: true });
  };

  const applyHashtag = (slug) => {
    if (slug !== hashtag || q) update({ hashtag: slug, q: '' });
  };

  // Đồng bộ ô tìm kiếm -> lọc hashtag sau 400ms ngừng gõ ("Chân dung", "#chandung" -> chandung)
  useEffect(() => {
    if (q && input.trim() === q) return undefined;
    const t = setTimeout(() => applyHashtag(hashtagSlug(input)), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // Gợi ý hashtag theo chữ đang gõ (chờ 250ms ngừng gõ)
  const [focused, setFocused] = useState(false);
  const [suggestQ, setSuggestQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSuggestQ(hashtagSlug(input)), 250);
    return () => clearTimeout(t);
  }, [input]);
  const { data: suggestData } = useHashtags(suggestQ, { limit: 6, enabled: focused && !!suggestQ });
  const suggestions = focused && suggestQ && hashtagSlug(input) === suggestQ ? (suggestData ?? []) : [];
  // Dòng cuối của gợi ý: tìm theo tên mẫu
  const titleTerm = input.trim().replace(/^#+/, '');
  const showDropdown = focused && !!titleTerm;
  const optionCount = suggestions.length + (titleTerm ? 1 : 0);
  const [activeOption, setActiveOption] = useState(-1);
  useEffect(() => setActiveOption(-1), [suggestQ]);

  const selectHashtag = (h) => {
    setInput(h.name);
    setFocused(false);
    applyHashtag(h.slug);
  };

  const searchTitle = () => {
    setInput(titleTerm);
    setFocused(false);
    update({ q: titleTerm, hashtag: '' });
  };

  // Bỏ hết bộ lọc (từ khoá, hashtag, danh mục), giữ cách sắp xếp
  const hasFilter = Boolean(q || hashtag || category || input.trim());
  const clearFilters = () => {
    setInput('');
    setFocused(false);
    update({ q: '', hashtag: '', category: '' });
  };

  const onSearchKeyDown = (e) => {
    if (showDropdown && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setActiveOption((i) => (e.key === 'ArrowDown' ? (i + 1) % optionCount : i <= 0 ? optionCount - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (suggestions[activeOption]) selectHashtag(suggestions[activeOption]);
      else if (titleTerm && activeOption === suggestions.length) searchTitle();
      else {
        setFocused(false);
        applyHashtag(hashtagSlug(input));
      }
    } else if (e.key === 'Escape') {
      setFocused(false);
    }
  };

  const {
    data,
    isLoading,
    isFetching,
    isPlaceholderData,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteCreatives({
    q: q || undefined,
    category: category || undefined,
    hashtag: hashtag || undefined,
    sort,
    limit: PAGE_SIZE,
  });
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  // Cuộn gần tới cuối danh sách thì tự tải trang tiếp, hết trang thì thôi
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

  // Mỗi danh mục là một trang riêng cho SEO; kết quả tìm kiếm thì không index
  const { data: categories } = useCategories();
  const categoryName = categories?.find((c) => c.slug === category)?.name;
  // Tên hiển thị của hashtag đang lọc (giữ hoa/thường, dấu) lấy từ chính kết quả
  const hashtagName = hashtag
    ? (items.flatMap((c) => c.hashtags ?? []).find((h) => h.slug === hashtag)?.name ?? hashtag)
    : '';
  useSeo({
    title: q
      ? `Tìm kiếm "${q}"`
      : categoryName
        ? `AI Creative ${categoryName}`
        : hashtag
          ? `#${hashtagName} - AI Creative`
          : 'Khám phá AI Creative',
    description: categoryName
      ? `Mẫu AI Creative danh mục ${categoryName} trên A51. Chọn mẫu và tạo ảnh sản phẩm chuyên nghiệp bằng AI chỉ trong vài giây.`
      : hashtag
        ? `Mẫu AI Creative gắn hashtag #${hashtagName} trên A51. Chọn mẫu và tạo ảnh sản phẩm chuyên nghiệp bằng AI chỉ trong vài giây.`
        : 'Khám phá các mẫu AI Creative phổ biến và mới nhất trên A51. Tạo ảnh sản phẩm, ảnh quảng cáo chuyên nghiệp bằng AI chỉ trong vài giây.',
    canonical: category
      ? `/explore?category=${encodeURIComponent(category)}`
      : hashtag
        ? `/explore?hashtag=${encodeURIComponent(hashtag)}`
        : '/explore',
    // Tìm theo từ khoá hoặc lọc chồng danh mục + hashtag thì không index
    noindex: Boolean(q) || Boolean(category && hashtag),
  });

  return (
    <>
      <header className="sticky top-[60px] z-30 border-b border-surface-container bg-surface-container-lowest/90 px-4 py-3 backdrop-blur-md">
        <h1 className="mb-3 text-lg font-bold text-on-surface">Khám phá</h1>
        <div className="flex items-center gap-2 lg:max-w-xl">
          <div className="relative min-w-0 flex-1">
            <div className="flex w-full items-center rounded-xl border border-outline-variant/40 bg-surface-container-low px-3.5 py-1.5 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20">
              <Icon name={q ? 'search' : 'tag'} className="mr-2 text-[22px] text-outline" />
              <input
                type="search"
                maxLength={100}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setFocused(true);
                }}
                onKeyDown={onSearchKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Tìm theo hashtag, ví dụ: chandung"
                aria-label="Tìm AI Creative theo hashtag"
                role="combobox"
                aria-expanded={showDropdown}
                aria-controls="explore-search-options"
                className="w-full border-none bg-transparent p-0 text-sm font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-0"
              />
              {isFetching && !isFetchingNextPage && <Icon name="progress_activity" className="animate-spin text-lg text-outline" />}
            </div>
            {showDropdown && (
              <ul
                id="explore-search-options"
                role="listbox"
                className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest py-1 shadow-lg"
              >
                {suggestions.length > 0 && (
                  <li className="px-3.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-outline">Hashtag</li>
                )}
                {suggestions.map((h, i) => (
                  <li key={h.slug} role="option" aria-selected={i === activeOption}>
                    <button
                      type="button"
                      // Giữ focus ở ô tìm kiếm tới khi click xong
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectHashtag(h)}
                      onMouseEnter={() => setActiveOption(i)}
                      className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm ${
                        i === activeOption ? 'bg-surface-container' : ''
                      }`}
                    >
                      <Icon name="tag" className="text-lg text-primary" />
                      <span className="flex-1 truncate font-medium text-on-surface">{h.name}</span>
                      <span className="shrink-0 text-[11px] text-outline">{h.count} Creative</span>
                    </button>
                  </li>
                ))}
                <li role="option" aria-selected={activeOption === suggestions.length}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={searchTitle}
                    onMouseEnter={() => setActiveOption(suggestions.length)}
                    className={`flex w-full items-center gap-2 border-t border-surface-container px-3.5 py-2 text-left text-sm ${
                      activeOption === suggestions.length ? 'bg-surface-container' : ''
                    }`}
                  >
                    <Icon name="search" className="text-lg text-outline" />
                    <span className="flex-1 truncate text-on-surface-variant">
                      Tìm theo tên mẫu “<span className="font-semibold text-on-surface">{titleTerm}</span>”
                    </span>
                  </button>
                </li>
              </ul>
            )}
          </div>
          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex h-[38px] shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-primary-container px-3 text-xs font-bold text-on-primary shadow-sm transition-colors hover:bg-primary"
            >
              <Icon name="filter_alt_off" className="text-lg" />
              Xoá bộ lọc
            </button>
          )}
        </div>
      </header>

      <CategoryStrip active={category} onSelect={(slug) => update({ category: slug })} />

      <HashtagStrip
        active={hashtag}
        activeName={hashtagName}
        onSelect={(slug, name) => {
          setInput(slug ? name : '');
          update({ hashtag: slug, q: '' });
        }}
      />

      <div ref={sortScrollRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => update({ sort: s.value })}
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState message={hashtag ? `Chưa có AI Creative nào gắn #${hashtagName}.` : 'Không tìm thấy AI Creative phù hợp.'}>
            {hashtag && titleTerm && (
              <button type="button" onClick={searchTitle} className="text-sm font-semibold text-primary hover:underline">
                Tìm “{titleTerm}” theo tên mẫu
              </button>
            )}
            {hasFilter && (
              <button type="button" onClick={clearFilters} className="text-sm font-semibold text-primary hover:underline">
                Xoá bộ lọc
              </button>
            )}
          </EmptyState>
        ) : (
          <>
            <p className="mb-2 text-xs text-on-surface-variant">{data.pages[0].total} kết quả</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
              {items.map((c) => (
                <CompactCreativeCard key={c.id} creative={c} naturalCover />
              ))}
            </div>
            {isFetchingNextPage && (
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4]" />
                ))}
              </div>
            )}
            {hasNextPage && !isPlaceholderData && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
          </>
        )}
      </section>
    </>
  );
}
