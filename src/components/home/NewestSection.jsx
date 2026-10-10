import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { ErrorState, Skeleton } from '../common/Feedback';
import CompactCreativeCard from '../creative/CompactCreativeCard';
import { useInfiniteCreatives } from '../../hooks/queries';

export default function NewestSection() {
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteCreatives({
    sort: 'newest',
    limit: 10,
  });
  const items = data?.pages.flatMap((p) => p.items) ?? [];

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

  // Chưa có Creative nào thì mục "nổi bật" phía trên đã báo, không lặp lại
  if (!isLoading && !error && items.length === 0) return null;

  return (
    <section className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Mới ra mắt</h2>
          <p className="text-xs text-on-surface-variant">AI Creative vừa được đăng lên sàn</p>
        </div>
        <Link
          to="/explore?sort=newest"
          className="flex items-center gap-0.5 rounded bg-error-container px-2 py-0.5 text-xs font-semibold text-error"
        >
          <Icon name="new_releases" className="text-xs" /> Mới
        </Link>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)
              : items.map((c) => <CompactCreativeCard key={c.id} creative={c} naturalCover />)}
          </div>
          {isFetchingNextPage && (
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4]" />
              ))}
            </div>
          )}
          {hasNextPage && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
        </>
      )}
    </section>
  );
}
