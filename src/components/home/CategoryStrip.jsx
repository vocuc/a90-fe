import { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { ErrorState, Skeleton } from '../common/Feedback';
import { useCategories } from '../../hooks/queries';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';

/**
 * Danh sách danh mục cuộn ngang.
 * - Không truyền `onSelect`: mỗi danh mục là link sang /explore?category=slug
 * - Có `onSelect`: dùng làm bộ lọc, `active` là slug đang chọn
 * - Có `rows`: hiện dạng lưới 4 cột gồm `rows` hàng, ô cuối là nút "Xem thêm" sang /categories
 */
const GRID_COLS = 4;

export default function CategoryStrip({ title, active, onSelect, rows }) {
  const { data: categories, isLoading, error, refetch } = useCategories();
  const scrollRef = useHorizontalScroll();
  const stripRef = useRef(null);
  const setStripRef = useCallback(
    (node) => {
      stripRef.current = node;
      scrollRef(node);
    },
    [scrollRef],
  );
  // Lần đầu (vừa chuyển trang sang) nhảy ngay, các lần chọn sau thì cuộn mượt
  const centeredOnce = useRef(false);

  // Chế độ lưới chừa 1 ô cuối cho nút "Xem thêm"
  const limit = rows ? rows * GRID_COLS - 1 : Infinity;
  const visible = categories?.slice(0, limit);

  // Đưa danh mục đang chọn về giữa dải (chỉ cuộn ngang trong dải, không cuộn trang)
  useEffect(() => {
    const el = stripRef.current;
    if (rows || !el || !active || !categories) return;
    const item = el.querySelector(`[data-slug="${CSS.escape(active)}"]`);
    if (!item) return;
    el.scrollTo({
      left: item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2,
      behavior: centeredOnce.current ? 'smooth' : 'auto',
    });
    centeredOnce.current = true;
  }, [active, categories, rows]);

  return (
    <section className="pb-2 pt-4">
      {title && (
        <div className="mb-3 flex items-center justify-between px-4">
          <h2 className="text-base font-bold text-on-surface">{title}</h2>
          {categories && (
            <Link to="/categories" className="text-xs font-semibold text-primary hover:underline">
              Tất cả ({categories.length})
            </Link>
          )}
        </div>
      )}

      {error ? (
        <div className="px-4">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      ) : (
        <div
          ref={rows ? undefined : setStripRef}
          className={rows ? 'grid grid-cols-4 gap-2.5 px-4 pb-2' : 'no-scrollbar relative flex gap-2.5 overflow-x-auto px-4 pb-2'}
        >
          {isLoading
            ? Array.from({ length: rows ? limit + 1 : 5 }).map((_, i) => (
                <Skeleton key={i} className={`h-[76px] shrink-0 ${rows ? 'w-full' : 'w-[76px]'}`} />
              ))
            : visible.map((c) => {
                const isActive = active === c.slug;
                const content = (
                  <>
                    <div
                      className={`mb-1.5 flex size-10 items-center justify-center rounded-full shadow-sm transition-colors ${
                        isActive
                          ? 'bg-primary-container text-on-primary'
                          : 'bg-surface-container text-primary group-hover:bg-primary-container group-hover:text-on-primary'
                      }`}
                    >
                      <Icon name={c.icon} className="text-[20px]" />
                    </div>
                    {/* Tên dài bị cắt thành "…", tên đầy đủ nằm ở title của ô */}
                    <span className="block w-full truncate text-center text-xs font-semibold text-on-surface">
                      {c.name}
                    </span>
                  </>
                );
                const cls = `group flex ${rows ? 'w-full min-w-0' : 'w-[76px]'} shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-2.5 transition-all ${
                  isActive
                    ? 'border-primary-container bg-surface-container'
                    : 'border-outline-variant/30 bg-surface-container-low hover:border-primary-container'
                }`;
                return onSelect ? (
                  <button
                    key={c.id}
                    type="button"
                    data-slug={c.slug}
                    title={c.name}
                    aria-pressed={isActive}
                    className={cls}
                    onClick={() => onSelect(isActive ? '' : c.slug)}
                  >
                    {content}
                  </button>
                ) : (
                  <Link key={c.id} to={`/explore?category=${c.slug}`} data-slug={c.slug} title={c.name} className={cls}>
                    {content}
                  </Link>
                );
              })}
          {rows && !isLoading && (
            <Link
              to="/categories"
              className="group flex w-full min-w-0 flex-col items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-low px-2 py-2.5 transition-all hover:border-primary-container"
            >
              <div className="mb-1.5 flex size-10 items-center justify-center rounded-full bg-surface-container text-primary shadow-sm transition-colors group-hover:bg-primary-container group-hover:text-on-primary">
                <Icon name="more_horiz" className="text-[20px]" />
              </div>
              <span className="block w-full truncate text-center text-xs font-semibold text-primary">Xem thêm</span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
