import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import CompactCreativeCard from '../components/creative/CompactCreativeCard';
import { SOCIAL_NETWORKS } from '../components/store/ShopInfoForm';
import { useCreatorPage, useInfiniteCreatorCreatives } from '../hooks/queries';
import useSeo from '../hooks/useSeo';
import { formatCount, formatRating } from '../utils/format';

const SORTS = [
  { value: 'popular', label: 'Phổ biến' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price_asc', label: 'Giá thấp' },
  { value: 'price_desc', label: 'Giá cao' },
];
const PAGE_SIZE = 20;

const formatJoined = (date) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : `Tham gia tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
};

// Hiện link gọn: bỏ https:// và dấu / cuối
const shortUrl = (url) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

function ProfileSkeleton() {
  return (
    <div className="px-4 pt-4">
      <Skeleton className="aspect-[3/1] w-full rounded-2xl" />
      <Skeleton className="-mt-8 ml-4 size-20 rounded-full" />
      <Skeleton className="mt-3 h-5 w-40" />
      <Skeleton className="mt-2 h-4 w-24" />
      <Skeleton className="mt-4 h-16 w-full" />
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2.5">
      <span className="text-sm font-bold text-on-surface">{value}</span>
      <span className="text-[11px] text-on-surface-variant">{label}</span>
    </div>
  );
}

function ProfileHeader({ profile }) {
  const [expanded, setExpanded] = useState(false);
  const links = SOCIAL_NETWORKS.filter(({ key }) => profile.socialLinks?.[key]);
  const joined = profile.joinedAt && formatJoined(profile.joinedAt);
  const longDescription = (profile.description?.length ?? 0) > 140;

  return (
    <div className="px-4 pt-4">
      <div className="relative">
        <div className="aspect-[3/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary-container via-primary to-secondary">
          {profile.coverUrl && <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="absolute -bottom-8 left-4 size-20 overflow-hidden rounded-full border-4 border-surface-container-lowest bg-surface-container shadow-md">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">
              {profile.name?.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="flex items-center gap-1 text-lg font-extrabold text-on-surface">
          {profile.name}
          {profile.verified && <Icon name="verified" fill className="text-lg text-secondary" />}
        </h2>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-on-surface-variant">
          <span>@{profile.username}</span>
          {joined && (
            <>
              <span aria-hidden="true">·</span>
              <span>{joined}</span>
            </>
          )}
        </p>

        {profile.description && (
          <div className="mt-3">
            <p
              className={`whitespace-pre-line text-sm leading-relaxed text-on-surface-variant ${
                longDescription && !expanded ? 'line-clamp-3' : ''
              }`}
            >
              {profile.description}
            </p>
            {longDescription && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-xs font-bold text-primary hover:underline"
              >
                {expanded ? 'Thu gọn' : 'Xem thêm'}
              </button>
            )}
          </div>
        )}

        {(profile.website || links.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex max-w-full items-center gap-1 rounded-full border border-outline-variant/40 px-3 py-1 text-xs font-semibold text-on-surface hover:border-primary-container"
              >
                <Icon name="language" className="text-sm text-primary" />
                <span className="truncate">{shortUrl(profile.website)}</span>
              </a>
            )}
            {links.map(({ key, label }) => (
              <a
                key={key}
                href={profile.socialLinks[key]}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex items-center gap-1 rounded-full border border-outline-variant/40 px-3 py-1 text-xs font-semibold text-on-surface hover:border-primary-container"
              >
                <Icon name="link" className="text-sm text-primary" />
                {label}
              </a>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 divide-x divide-surface-container rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
          <Stat value={formatCount(profile.creativeCount)} label="Creative" />
          <Stat value={formatCount(profile.usageCount)} label="Lượt dùng" />
          <Stat
            value={
              <span className="flex items-center gap-0.5">
                <Icon name="star" fill className="text-sm text-amber-400" />
                {formatRating(profile.ratingCount > 0 ? profile.ratingAvg : null)}
              </span>
            }
            label={profile.ratingCount > 0 ? `${formatCount(profile.ratingCount)} đánh giá` : 'Đánh giá'}
          />
          <Stat value={formatCount(profile.followersCount)} label="Theo dõi" />
        </div>
      </div>
    </div>
  );
}

function CreatorCreatives({ username }) {
  const [sort, setSort] = useState('popular');
  const { data, isLoading, isPlaceholderData, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteCreatorCreatives(username, { sort, limit: PAGE_SIZE });
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

  return (
    <section className="px-4 py-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-bold text-on-surface">AI Creative đang bán</h2>
        {data && <span className="text-xs text-on-surface-variant">{data.pages[0].total} sản phẩm</span>}
      </div>

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setSort(s.value)}
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

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="inventory_2" message="Nhà sáng tạo này chưa có AI Creative nào đang bán." />
      ) : (
        <>
          <div className={`grid grid-cols-2 gap-3 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
            {items.map((c) => (
              <CompactCreativeCard key={c.id} creative={c} naturalCover hideAuthor />
            ))}
          </div>
          {isFetchingNextPage && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4]" />
              ))}
            </div>
          )}
          {hasNextPage && !isPlaceholderData && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
        </>
      )}
    </section>
  );
}

export default function CreatorPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { data: profile, isLoading, error, refetch } = useCreatorPage(username);

  useSeo({
    title: profile ? `${profile.name} (@${profile.username})` : 'Nhà sáng tạo',
    description: profile
      ? profile.description?.slice(0, 160) ||
        `Các mẫu AI Creative của ${profile.name} trên A51. Chọn mẫu và tạo ảnh sản phẩm bằng AI chỉ trong vài giây.`
      : undefined,
    canonical: `/creators/${encodeURIComponent(username)}`,
  });

  // Vào thẳng bằng link thì không có trang trước để quay lại
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/explore'));

  return (
    <>
      <header className="sticky top-[60px] z-30 border-b border-surface-container bg-surface-container-lowest/90 backdrop-blur-md">
        <div className="flex items-center gap-2 px-2 py-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Quay lại"
            className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
          >
            <Icon name="arrow_back" />
          </button>
          <h1 className="flex-1 truncate text-base font-bold text-on-surface">{profile?.name ?? 'Nhà sáng tạo'}</h1>
        </div>
      </header>

      {isLoading ? (
        <ProfileSkeleton />
      ) : error?.status === 404 ? (
        <EmptyState icon="person_off" message="Không tìm thấy nhà sáng tạo này.">
          <Link to="/explore" className="mt-2 text-sm font-bold text-primary hover:underline">
            Khám phá AI Creative khác
          </Link>
        </EmptyState>
      ) : error ? (
        <div className="p-4">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      ) : (
        <>
          <ProfileHeader profile={profile} />
          <CreatorCreatives username={profile.username} />
        </>
      )}
    </>
  );
}
