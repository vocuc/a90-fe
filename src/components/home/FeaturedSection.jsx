import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import FeaturedCreativeCard from '../creative/FeaturedCreativeCard';
import { useCreatives } from '../../hooks/queries';

// Backend chưa có cờ "nổi bật" -> lấy các Creative được dùng nhiều nhất
export default function FeaturedSection() {
  const { data, isLoading, error, refetch } = useCreatives({ sort: 'popular', limit: 3 });

  return (
    <section className="px-4 py-4">
      <div className="mb-3.5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">AI Creative nổi bật</h2>
          <p className="text-xs text-on-surface-variant">Được nhiều người sử dụng nhất</p>
        </div>
        <Link to="/explore?sort=popular" className="flex items-center text-xs font-bold text-primary hover:underline">
          Xem thêm <Icon name="chevron_right" className="ml-0.5 text-sm" />
        </Link>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-72 !rounded-2xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState icon="auto_awesome" message="Chưa có AI Creative nào được đăng." />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {data.items.map((c) => (
            <FeaturedCreativeCard key={c.id} creative={c} />
          ))}
        </div>
      )}
    </section>
  );
}
