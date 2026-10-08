import { Link } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { useCategories } from '../hooks/queries';

export default function CategoriesPage() {
  const { data: categories, isLoading, error, refetch } = useCategories();

  return (
    <>
      <header className="sticky top-[60px] z-30 border-b border-surface-container bg-surface-container-lowest/90 px-4 py-3 backdrop-blur-md">
        <h1 className="text-lg font-bold text-on-surface">Danh mục</h1>
        <p className="text-xs text-on-surface-variant">Chọn danh mục để xem các AI Creative phù hợp</p>
      </header>

      <section className="p-4">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState icon="category" message="Chưa có danh mục nào." />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/explore?category=${c.slug}`}
                title={c.name}
                className="group flex aspect-square min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-2 transition-all hover:border-primary-container active:scale-[0.98]"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-surface-container text-primary shadow-sm transition-colors group-hover:bg-primary-container group-hover:text-on-primary">
                  <Icon name={c.icon} className="text-[24px]" />
                </span>
                <span className="line-clamp-2 w-full text-center text-xs font-semibold leading-tight text-on-surface">
                  {c.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
