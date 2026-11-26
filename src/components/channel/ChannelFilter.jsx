import { useQuery } from '@tanstack/react-query';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import { CHANNEL_KEYS, listChannels } from '../../api/channels';

/** Giá trị lọc đặc biệt (ngoài id kênh): khớp tham số channel của GET /creator/creatives. */
export const CHANNEL_FILTER = { SHARED: 'shared', NONE: 'none' };

/** Đọc ?channel= hợp lệ (id kênh | shared | none), sai / không có -> '' (tất cả). */
export const readChannelFilter = (params) => {
  const v = params.get('channel') ?? '';
  return /^(\d+|shared|none)$/.test(v) ? v : '';
};

/**
 * Hàng nút lọc theo kênh: Tất cả | từng kênh | Dùng chung | (Chưa vào nhóm khi withNone).
 * value: '' = tất cả, id kênh (chuỗi), 'shared', 'none'. Shop chưa có kênh nào thì không hiện.
 */
export default function ChannelFilter({ value, onChange, withNone = false, className = '' }) {
  const scrollRef = useHorizontalScroll();
  const { data } = useQuery({ queryKey: CHANNEL_KEYS.all, queryFn: listChannels });
  const channels = data?.items ?? [];
  if (!channels.length) return null;

  const options = [
    { value: '', label: 'Tất cả kênh' },
    ...channels.map((c) => ({ value: String(c.id), label: c.name })),
    { value: CHANNEL_FILTER.SHARED, label: 'Dùng chung' },
    ...(withNone ? [{ value: CHANNEL_FILTER.NONE, label: 'Chưa vào nhóm' }] : []),
  ];

  return (
    <div ref={scrollRef} role="group" aria-label="Lọc theo kênh" className={`no-scrollbar flex items-center gap-2 overflow-x-auto ${className}`}>
      {options.map((o) => (
        <button
          key={o.value || 'all'}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            value === o.value
              ? 'border-secondary bg-secondary-fixed text-on-secondary-fixed'
              : 'border-outline-variant/40 text-on-surface-variant hover:border-primary-container'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
