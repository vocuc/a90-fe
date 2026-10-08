import { Link, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/common/Avatar';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { useCreative, useMe } from '../hooks/queries';
import { formatCount, formatCredit, formatRating } from '../utils/format';

export default function CreativeDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: c, isLoading, error, refetch } = useCreative(slug);
  const { data: me } = useMe();

  const notEnoughCredits = me && c && me.credits < c.price;
  const images = c?.images?.length ? c.images : [c?.imageUrl];

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </button>
        <h1 className="line-clamp-1 text-base font-bold text-on-surface">{c?.title ?? 'AI Creative'}</h1>
      </header>

      {error ? (
        <div className="p-4">
          <ErrorState
            error={error.status === 404 ? new Error('AI Creative không tồn tại hoặc đã bị gỡ.') : error}
            onRetry={error.status === 404 ? undefined : refetch}
          />
        </div>
      ) : isLoading ? (
        <div className="space-y-3 p-4">
          <Skeleton className="aspect-square w-full !rounded-2xl" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <>
          <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto p-4">
            {images.map((src, i) => (
              <CoverImage
                key={src ?? i}
                src={src}
                alt={`${c.title} - ảnh ${i + 1}`}
                className={`aspect-square shrink-0 snap-center rounded-2xl ${images.length > 1 ? 'w-[88%]' : 'w-full'}`}
              />
            ))}
          </div>
          <div className="space-y-4 px-4 pb-32">
            <div>
              {c.category && <span className="text-xs font-semibold text-primary">{c.category.name}</span>}
              <h2 className="text-xl font-extrabold text-on-surface">{c.title}</h2>
              <div className="mt-1 flex items-center gap-3 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <Icon name="star" fill className="text-sm text-amber-400" />
                  {c.rating == null ? 'Chưa có đánh giá' : `${formatRating(c.rating)} (${c.ratingCount})`}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="local_fire_department" className="text-sm" />
                  {formatCount(c.usageCount)} lượt dùng
                </span>
              </div>
            </div>

            {c.author && (
              <div className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3">
                <Avatar src={c.author.avatarUrl} name={c.author.name} className="size-9" />
                <div>
                  <p className="text-xs text-on-surface-variant">Nhà sáng tạo</p>
                  <p className="flex items-center gap-1 text-sm font-bold text-on-surface">
                    {c.author.name}
                    {c.author.verified && <Icon name="verified" fill className="text-sm text-secondary" />}
                  </p>
                </div>
              </div>
            )}

            {c.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-on-surface-variant">{c.description}</p>
            )}

            {c.options?.max_outputs && (
              <p className="flex items-center gap-1 text-xs font-medium text-on-surface-variant">
                <Icon name="photo_library" className="text-sm text-secondary" />
                Tạo tối đa {c.options.max_outputs} ảnh mỗi lần
              </p>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md border-t border-surface-container bg-surface-container-lowest p-4">
            {notEnoughCredits && (
              <p className="mb-2 text-center text-xs text-error">
                Bạn cần {formatCredit(c.price)} credit cho mỗi ảnh, hiện còn {formatCredit(me.credits)}.
              </p>
            )}
            <Link
              to={`/create?creative=${encodeURIComponent(c.id)}`}
              aria-disabled={notEnoughCredits}
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-on-primary transition-colors ${
                notEnoughCredits ? 'pointer-events-none bg-outline' : 'bg-primary-container hover:bg-primary'
              }`}
            >
              <Icon name="bolt" />
              Sử dụng · {formatCredit(c.price)} Credit/ảnh
            </Link>
          </div>
        </>
      )}
    </>
  );
}
