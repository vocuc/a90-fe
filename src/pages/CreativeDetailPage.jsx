import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/common/Avatar';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import ImageViewer from '../components/common/ImageViewer';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { useAuth } from '../context/AuthContext';
import { useCreative, useMe } from '../hooks/queries';
import useSeo, { SITE_NAME, seoAbsUrl } from '../hooks/useSeo';
import { formatCount, formatVnd, formatRating } from '../utils/format';

export default function CreativeDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: c, isLoading, error, refetch } = useCreative(slug);
  const { data: me } = useMe();
  const [viewing, setViewing] = useState(null); // ảnh đang xem toàn màn hình

  const notEnoughCredits = me && c && me.credits < c.price;
  const images = c?.images?.length ? c.images : [c?.imageUrl];
  // Chưa đăng nhập: đăng nhập xong quay lại đúng trang chi tiết này (không phải /create)
  const actionLink = isAuthenticated
    ? `/create?creative=${encodeURIComponent(c?.id ?? slug)}`
    : `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;

  useSeo({
    title: c?.title ?? 'AI Creative',
    description:
      c?.description ||
      (c && `Tạo ảnh "${c.title}" bằng AI trên ${SITE_NAME}${c.category ? ` - danh mục ${c.category.name}` : ''}. Chỉ ${formatVnd(c.price)} mỗi ảnh.`),
    image: images[0],
    type: 'product',
    canonical: `/creatives/${encodeURIComponent(slug)}`,
    noindex: Boolean(error),
    // Dữ liệu có cấu trúc schema.org cho Google hiển thị giá / đánh giá
    jsonLd: c && {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: c.title,
      description: c.description || undefined,
      image: images.filter(Boolean).map(seoAbsUrl),
      category: c.category?.name,
      brand: c.author ? { '@type': 'Brand', name: c.author.name } : undefined,
      offers: {
        '@type': 'Offer',
        price: c.price,
        priceCurrency: 'VND',
        availability: 'https://schema.org/InStock',
        url: seoAbsUrl(`/creatives/${encodeURIComponent(slug)}`),
      },
      aggregateRating:
        c.rating != null && c.ratingCount > 0
          ? { '@type': 'AggregateRating', ratingValue: c.rating, ratingCount: c.ratingCount }
          : undefined,
    },
  });

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          // Mở thẳng link (không có lịch sử trong app) thì về trang chủ thay vì thoát khỏi app
          onClick={() => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1))}
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
        // Desktop: ảnh xếp lưới bên trái, thông tin + nút tạo ảnh dính bên phải
        <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8 lg:px-4 lg:py-6">
          {/* Ảnh giữ tỉ lệ gốc (cao tự động); khung trống khi thiếu/lỗi ảnh vẫn là hình vuông */}
          <div
            className={`no-scrollbar flex items-start snap-x snap-mandatory gap-3 overflow-x-auto p-4 lg:grid lg:overflow-visible lg:p-0 ${
              images.length > 1 ? 'lg:grid-cols-2' : ''
            }`}
          >
            {images.map((src, i) => (
              <button
                key={src ?? i}
                type="button"
                disabled={!src}
                onClick={() => setViewing({ src, alt: `${c.title} - ảnh ${i + 1}` })}
                aria-label={`Phóng to ảnh ${i + 1}`}
                className={`shrink-0 snap-center lg:w-full ${images.length > 1 ? 'w-[88%]' : 'w-full'}`}
              >
                <CoverImage
                  src={src}
                  alt={`${c.title} - ảnh ${i + 1}`}
                  className="block h-auto w-full rounded-2xl [&:not(img)]:aspect-square"
                />
              </button>
            ))}
          </div>
          <ImageViewer src={viewing?.src} alt={viewing?.alt} onClose={() => setViewing(null)} />
          <div className="space-y-4 px-4 pb-32 lg:sticky lg:top-[132px] lg:self-start lg:px-0 lg:pb-0">
            <div>
              {c.category && <span className="text-xs font-semibold text-primary">{c.category.name}</span>}
              <h2 className="text-xl font-extrabold text-on-surface">{c.title}</h2>
              <p className="mt-1 text-lg font-bold text-primary">
                {formatVnd(c.price)}<span className="text-sm font-medium text-on-surface-variant"> / ảnh</span>
              </p>
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
              <Link
                to={`/creators/${encodeURIComponent(c.author.username)}`}
                state={{ creator: c.author }}
                className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3 transition-colors hover:bg-surface-container"
              >
                <Avatar src={c.author.avatarUrl} name={c.author.name} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-on-surface-variant">Nhà sáng tạo</p>
                  <p className="flex items-center gap-1 text-sm font-bold text-on-surface">
                    <span className="truncate">{c.author.name}</span>
                    {c.author.verified && <Icon name="verified" fill className="text-sm text-secondary" />}
                  </p>
                </div>
                <Icon name="chevron_right" className="text-outline" />
              </Link>
            )}

            {c.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-on-surface-variant">{c.description}</p>
            )}

            {/* Mobile: thanh cố định dưới đáy màn hình. Desktop: nằm cuối cột thông tin */}
            <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[640px] border-t border-surface-container bg-surface-container-lowest p-4 lg:static lg:z-auto lg:max-w-none lg:border-0 lg:bg-transparent lg:p-0">
              {notEnoughCredits && (
                <p className="mb-2 text-center text-xs text-error">
                  Bạn cần {formatVnd(c.price)} cho mỗi ảnh, số dư hiện còn {formatVnd(me.credits)}.
                </p>
              )}
              <Link
                to={actionLink}
                state={isAuthenticated ? { fromDetail: true } : undefined}
                aria-disabled={notEnoughCredits}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-on-primary transition-colors ${
                  notEnoughCredits ? 'pointer-events-none bg-outline' : 'bg-primary-container hover:bg-primary'
                }`}
              >
                <Icon name={isAuthenticated ? 'bolt' : 'login'} />
                {isAuthenticated ? 'Tạo ảnh sử dụng mẫu này' : 'Đăng nhập để sử dụng'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
