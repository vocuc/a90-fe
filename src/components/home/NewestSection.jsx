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
          <div className="grid grid-cols-2 gap-3">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)
              : items.map((c) => <CompactCreativeCard key={c.id} creative={c} naturalCover />)}
          </div>
          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-3 h-11 w-full rounded-xl border border-outline-variant text-sm font-bold text-primary transition-colors hover:bg-surface-container-low disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Đang tải...' : 'Xem thêm'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
