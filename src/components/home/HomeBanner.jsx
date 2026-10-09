import { Link } from 'react-router-dom';
import CoverImage from '../common/CoverImage';
import { useBanners } from '../../hooks/queries';

/** Banner ảnh do admin quản lý: bấm mở link, nhiều banner thì vuốt ngang. Không có banner thì ẩn. */
export default function HomeBanner() {
  const { data: banners } = useBanners();
  if (!banners?.length) return null;

  const single = banners.length === 1;

  return (
    <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {banners.map((b) => {
        const image = (
          <CoverImage src={b.imageUrl} alt={b.title || 'Banner'} className="aspect-[2/1] w-full rounded-2xl" />
        );
        const className = `block shrink-0 snap-center overflow-hidden rounded-2xl shadow-md transition-transform active:scale-[0.99] ${
          single ? 'w-full' : 'w-[88%]'
        }`;

        // Đường dẫn trong app mở bằng router, link ngoài mở tab mới
        return b.linkUrl.startsWith('/') ? (
          <Link key={b.id} to={b.linkUrl} className={className}>
            {image}
          </Link>
        ) : (
          <a key={b.id} href={b.linkUrl} target="_blank" rel="noopener noreferrer" className={className}>
            {image}
          </a>
        );
      })}
    </div>
  );
}
