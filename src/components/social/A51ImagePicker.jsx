import { Link } from 'react-router-dom';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { thumbOf, useGenerationHistory } from '../../hooks/generationQueries';

const GRID = 'grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6';

/**
 * Chọn ảnh đã tạo trên A51 (lịch sử tạo ảnh, chỉ ảnh hoàn tất).
 * selected: [{ key, generationId, outputId, url, thumbUrl, creativeSlug, creativeTitle }] theo thứ tự chọn.
 * exclude: key (`${generationId}_${outputId}`) của ảnh đã có trong bài, không cho chọn lại.
 */
export default function A51ImagePicker({ selected, onChange, max, exclude = [] }) {
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useGenerationHistory(20);

  const images = (data?.pages ?? [])
    .flatMap((p) => p.items)
    .flatMap((g) =>
      (g.outputs ?? [])
        .filter((o) => o.status === 'completed' && o.image_url)
        .map((o) => ({
          key: `${g.id}_${o.id}`,
          generationId: g.id,
          outputId: o.id,
          url: o.image_url,
          thumbUrl: thumbOf(o),
          creativeSlug: g.creative?.slug ?? null,
          creativeTitle: g.creative?.title ?? null,
        })),
    )
    .filter((img) => !exclude.includes(img.key));

  const order = (key) => selected.findIndex((s) => s.key === key);
  const full = selected.length >= max;
  const toggle = (img) => {
    if (order(img.key) >= 0) onChange(selected.filter((s) => s.key !== img.key));
    else if (!full) onChange([...selected, img]);
  };

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading) {
    return (
      <div className={GRID}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    );
  }
  if (!images.length) {
    return (
      <EmptyState icon="photo_library" message="Bạn chưa có ảnh nào trên A51.">
        <Link to="/posts/new?source=new" replace className="text-sm font-bold text-primary hover:underline">
          Tạo ảnh mới
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <div className={GRID}>
        {images.map((img) => {
          const n = order(img.key);
          const picked = n >= 0;
          return (
            <button
              key={img.key}
              type="button"
              onClick={() => toggle(img)}
              disabled={!picked && full}
              aria-pressed={picked}
              aria-label={img.creativeTitle ?? 'Ảnh'}
              className={`relative aspect-square overflow-hidden rounded-xl transition-all disabled:opacity-40 ${
                picked ? 'ring-[3px] ring-primary-container ring-offset-2' : 'hover:opacity-90'
              }`}
            >
              <CoverImage src={img.thumbUrl} alt="" className="size-full" />
              <span
                className={`absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  picked ? 'border-primary-container bg-primary-container text-on-primary' : 'border-white bg-black/20'
                }`}
              >
                {picked && n + 1}
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
          Tải thêm ảnh
        </button>
      )}
    </div>
  );
}
