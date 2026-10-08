import { Link } from 'react-router-dom';
import CoverImage from '../common/CoverImage';
import { formatCount, formatCredit, formatRating } from '../../utils/format';

export default function CompactCreativeCard({ creative }) {
  const { id, title, imageUrl, rating, price, usageCount, category } = creative;

  return (
    <Link
      to={`/creatives/${id}`}
      className="flex flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest"
    >
      <div className="relative aspect-square w-full bg-surface-container">
        <CoverImage src={imageUrl} alt={title} className="h-full w-full" />
        {category && (
          <span
            title={category.name}
            className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-surface-container-lowest/90 px-2 py-0.5 text-[10px] font-bold text-primary"
          >
            {category.name}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between p-2.5">
        <div>
          <h4 className="mb-1 line-clamp-1 text-xs font-bold text-on-surface">{title}</h4>
          <p className="text-[11px] text-on-surface-variant">
            {rating == null ? 'Mới' : `${formatRating(rating)} ★`} • {formatCount(usageCount)} lượt
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-surface-container pt-2">
          <span className="text-xs font-bold text-primary">{formatCredit(price)} Credit</span>
          <span className="text-xs font-semibold text-primary">Chọn</span>
        </div>
      </div>
    </Link>
  );
}
