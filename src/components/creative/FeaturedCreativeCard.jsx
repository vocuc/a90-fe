import { Link } from 'react-router-dom';
import Avatar from '../common/Avatar';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { formatCount, formatCredit, formatRating } from '../../utils/format';

export default function FeaturedCreativeCard({ creative }) {
  const { id, title, imageUrl, rating, price, author, usageCount, category } = creative;

  return (
    <article className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md">
      <Link to={`/creatives/${id}`} className="relative block aspect-[16/10] w-full overflow-hidden bg-surface-container">
        <CoverImage src={imageUrl} alt={title} className="h-full w-full transition-transform duration-500 hover:scale-105" />
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-inverse-surface/80 px-2.5 py-1 text-[11px] font-bold text-on-primary backdrop-blur-md">
          <Icon name="star" fill className="text-xs text-amber-400" />
          {formatRating(rating)}
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-surface-container-lowest/90 px-2.5 py-1 text-xs font-bold text-primary shadow-sm backdrop-blur-md">
          {formatCredit(price)} Credit
        </div>
      </Link>
      <div className="p-3.5">
        <h3 className="mb-1.5 text-sm font-bold text-on-surface">
          <Link to={`/creatives/${id}`}>{title}</Link>
        </h3>
        <div className="flex items-center justify-between border-b border-surface-container pb-3">
          {author ? (
            <div className="flex items-center gap-2">
              <Avatar src={author.avatarUrl} name={author.name} />
              <span className="text-xs font-medium text-on-surface-variant">{author.name}</span>
              {author.verified && <Icon name="verified" fill className="text-sm text-secondary" />}
            </div>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1 text-[11px] text-outline">
            <Icon name="local_fire_department" className="text-xs" />
            {formatCount(usageCount)} lượt dùng
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-3">
          <div className="flex min-w-0 items-center gap-1 text-xs font-medium text-on-surface-variant">
            {category && (
              <>
                <Icon name="sell" className="shrink-0 text-sm text-secondary" />
                <span className="truncate" title={category.name}>
                  {category.name}
                </span>
              </>
            )}
          </div>
          <Link
            to={`/creatives/${id}`}
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary-container px-4 text-xs font-bold text-on-primary transition-colors hover:bg-primary"
          >
            <Icon name="bolt" className="text-sm" />
            Sử dụng
          </Link>
        </div>
      </div>
    </article>
  );
}
