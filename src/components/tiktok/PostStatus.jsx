import Icon from '../common/Icon';
import { POST_STATUS } from '../../api/tiktok';

export const POST_STATUS_INFO = {
  [POST_STATUS.GENERATING]: {
    label: 'Đang tạo ảnh',
    icon: 'progress_activity',
    spin: true,
    className: 'bg-sky-50 text-sky-700',
  },
  [POST_STATUS.PENDING_REVIEW]: { label: 'Chờ đăng', icon: 'edit_note', className: 'bg-amber-50 text-amber-700' },
  [POST_STATUS.PUBLISHING]: {
    label: 'Đang đăng',
    icon: 'progress_activity',
    spin: true,
    className: 'bg-primary-fixed/60 text-primary',
  },
  [POST_STATUS.PUBLISHED]: { label: 'Đã đăng', icon: 'check_circle', fill: true, className: 'bg-emerald-50 text-emerald-700' },
};

export function PostStatusBadge({ status }) {
  const s = POST_STATUS_INFO[status] ?? POST_STATUS_INFO[POST_STATUS.PENDING_REVIEW];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${s.className}`}
    >
      <Icon name={s.icon} fill={s.fill} className={`text-sm ${s.spin ? 'animate-spin' : ''}`} />
      {s.label}
    </span>
  );
}
