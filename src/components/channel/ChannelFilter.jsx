import { useQuery } from '@tanstack/react-query';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import { CHANNEL_KEYS, listChannels } from '../../api/channels';
import { useCreatorProfile } from '../../hooks/creatorQueries';
import { SelectField } from '../common/Form';

/**
 * Ô "Tạo cho kênh" ở form tạo lô / ảnh: lưu kênh vào ảnh (generations.channel_id) để lọc Lịch sử tạo ảnh theo kênh.
 * value: '' = không theo kênh. Tài khoản chưa có kênh (hoặc chưa có cửa hàng) thì không hiện.
 */
export function ChannelSelect({ value, onChange, hint, className = '' }) {
  const { hasProfile } = useCreatorProfile();
  const { data } = useQuery({ queryKey: CHANNEL_KEYS.all, queryFn: listChannels, enabled: hasProfile });
  const channels = data?.items ?? [];
  if (!channels.length) return null;
  return (
    <div className={className}>
      <SelectField
        label="Tạo cho kênh"
        value={channels.some((c) => String(c.id) === value) ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        hint={hint ?? 'Ảnh được ghi là của kênh này, lọc được ở Lịch sử tạo ảnh.'}
      >
        <option value="">Không theo kênh</option>
        {channels.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.name}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

/** Giá trị lọc đặc biệt (ngoài id kênh): khớp tham số channel của GET /creator/creatives. */
export const CHANNEL_FILTER = { SHARED: 'shared', NONE: 'none' };

/** Đọc ?channel= hợp lệ (id kênh | shared | none), sai / không có -> '' (tất cả). */
export const readChannelFilter = (params) => {
  const v = params.get('channel') ?? '';
  return /^(\d+|shared|none)$/.test(v) ? v : '';
};

/**
 * Hàng nút lọc theo kênh: Tất cả | từng kênh | (Dùng chung khi withShared) | (noneLabel khi withNone).
 * value: '' = tất cả, id kênh (chuỗi), 'shared', 'none'. Shop chưa có kênh nào thì không hiện.
 */
export default function ChannelFilter({ value, onChange, withShared = true, withNone = false, noneLabel = 'Chưa vào nhóm', className = '' }) {
  const scrollRef = useHorizontalScroll();
  // Kênh cần hồ sơ người bán (403 khi chưa có): tài khoản chỉ mua ảnh thì không tải, không hiện
  const { hasProfile } = useCreatorProfile();
  const { data } = useQuery({ queryKey: CHANNEL_KEYS.all, queryFn: listChannels, enabled: hasProfile });
  const channels = data?.items ?? [];
  if (!channels.length) return null;

  const options = [
    { value: '', label: 'Tất cả kênh' },
    ...channels.map((c) => ({ value: String(c.id), label: c.name })),
    ...(withShared ? [{ value: CHANNEL_FILTER.SHARED, label: 'Dùng chung' }] : []),
    ...(withNone ? [{ value: CHANNEL_FILTER.NONE, label: noneLabel }] : []),
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
