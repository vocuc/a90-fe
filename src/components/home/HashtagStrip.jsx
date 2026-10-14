import { useHashtags } from '../../hooks/queries';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';

/**
 * Dải hashtag phổ biến cuộn ngang, dùng làm bộ lọc ở trang Khám phá.
 * active: slug đang lọc (luôn hiện đầu dải dù không nằm trong nhóm phổ biến), onSelect(slug | '', name).
 */
export default function HashtagStrip({ active, activeName, onSelect }) {
  const { data } = useHashtags('', { limit: 20 });
  const scrollRef = useHorizontalScroll();

  const popular = data ?? [];
  const current = active && (popular.find((h) => h.slug === active) ?? { slug: active, name: activeName || active });
  const items = current ? [current, ...popular.filter((h) => h.slug !== active)] : popular;
  if (!items.length) return null;

  return (
    <div ref={scrollRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
      {items.map((h) => {
        const isActive = h.slug === active;
        return (
          <button
            key={h.slug}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(isActive ? '' : h.slug, h.name)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-primary hover:bg-primary-fixed/60'
            }`}
          >
            #{h.name}
          </button>
        );
      })}
    </div>
  );
}
