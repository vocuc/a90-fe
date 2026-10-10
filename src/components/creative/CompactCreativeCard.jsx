import { Link } from 'react-router-dom';
import Avatar from '../common/Avatar';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { formatCount, formatVnd, formatRating } from '../../utils/format';

// Thẻ nửa chiều rộng (2 thẻ một hàng), cao bằng thẻ cùng hàng.
// naturalCover: ảnh bìa giữ tỉ lệ gốc, không cắt (khung trống khi thiếu ảnh vẫn vuông)
export default function FeaturedCreativeCard({ creative, naturalCover = false }) {
  const { id, title, imageUrl, rating, price, author, usageCount, category } = creative;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md">
      <Link
        to={`/creatives/${id}`}
        className={`relative block w-full overflow-hidden bg-surface-container ${naturalCover ? '' : 'aspect-square'}`}
      >
        <CoverImage
          src={imageUrl}
          alt={title}
          className={`w-full transition-transform duration-500 hover:scale-105 ${
            naturalCover ? 'block h-auto [&:not(img)]:aspect-square' : 'h-full'
          }`}
        />
        <div className="absolute left-2 top-2 flex items-center gap-0.5 rounded-full bg-inverse-surface/80 px-2 py-0.5 text-[10px] font-bold text-on-primary backdrop-blur-md">
          <Icon name="star" fill className="text-[11px] text-amber-400" />
          {formatRating(rating)}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-2.5">
        <h3 className="mb-1.5 line-clamp-2 text-xs font-bold text-on-surface">
          <Link to={`/creatives/${id}`}>{title}</Link>
        </h3>
        {author && (
          <div className="mb-1 flex min-w-0 items-center gap-1.5">
            <Avatar src={author.avatarUrl} name={author.name} className="size-4 shrink-0" />
            <span className="truncate text-[11px] font-medium text-on-surface-variant">{author.name}</span>
            {author.verified && <Icon name="verified" fill className="shrink-0 text-xs text-secondary" />}
          </div>
        )}
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-outline">
          <span className="flex shrink-0 items-center gap-0.5">
            {formatCount(usageCount)} lượt tải
          </span>
          {category && (
            <span className="flex min-w-0 items-center gap-0.5" title={category.name}>
              <Icon name="sell" className="shrink-0 text-xs text-secondary" />
              <span className="truncate">{category.name}</span>
            </span>
          )}
        </div>
        {/* Giá và nút luôn nằm đáy thẻ */}
        <div className="mt-auto pt-2.5">
          <div className="space-y-2 border-t border-surface-container pt-2.5">
            <p className="text-xs font-bold text-primary">{formatVnd(price)}</p>
            <Link
              to={`/creatives/${id}`}
              className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-primary-container text-xs font-bold text-on-primary transition-colors hover:bg-primary"
            >
              <Icon name="bolt" className="text-sm" />
              Chọn mẫu này
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
