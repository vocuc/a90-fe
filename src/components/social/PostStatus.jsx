import Icon from '../common/Icon';
import { PLATFORM_STATUS, POST_STATUS, platformInfo } from '../../api/social';

export const POST_STATUS_INFO = {
  [POST_STATUS.GENERATING]: {
    label: 'Đang chuẩn bị',
    icon: 'progress_activity',
    spin: true,
    className: 'bg-sky-50 text-sky-700',
  },
  [POST_STATUS.PENDING_REVIEW]: { label: 'Chờ gửi', icon: 'edit_note', className: 'bg-amber-50 text-amber-700' },
  [POST_STATUS.QUEUED]: { label: 'Chờ đăng', icon: 'schedule', className: 'bg-primary-fixed/40 text-primary' },
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

const PLATFORM_STATUS_INFO = {
  [PLATFORM_STATUS.QUEUED]: { label: 'Chờ đăng', icon: 'schedule', className: 'border-primary-fixed bg-primary-fixed/20 text-primary' },
  [PLATFORM_STATUS.PUBLISHING]: {
    label: 'Đang đăng',
    icon: 'progress_activity',
    spin: true,
    className: 'border-primary-fixed bg-primary-fixed/40 text-primary',
  },
  [PLATFORM_STATUS.PUBLISHED]: { icon: 'check_circle', fill: true, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  [PLATFORM_STATUS.FAILED]: { label: 'Lỗi', icon: 'error', className: 'border-error/30 bg-error-container/40 text-on-error-container' },
};

/** Trạng thái bài trên từng nền tảng đã chọn: "TikTok · Đã lưu nháp", "Facebook · Lỗi"... */
export function PlatformStatusList({ platforms, className = '' }) {
  if (!platforms?.length) return null;
  return (
    <ul className={`flex flex-wrap gap-1 ${className}`}>
      {platforms.map((p) => {
        const info = platformInfo(p.platform);
        const s = PLATFORM_STATUS_INFO[p.status] ?? PLATFORM_STATUS_INFO[PLATFORM_STATUS.QUEUED];
        const label = p.status === PLATFORM_STATUS.PUBLISHED ? info.doneLabel : s.label;
        const chip = (
          <>
            <Icon name={s.icon} fill={s.fill} className={`text-sm ${s.spin ? 'animate-spin' : ''}`} />
            <span className="font-bold">{info.label}</span>
            <span>· {label}</span>
          </>
        );
        const chipClass = `inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${s.className}`;
        return (
          <li key={p.platform}>
            {p.postUrl ? (
              <a
                href={p.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`${chipClass} hover:underline`}
              >
                {chip}
                <Icon name="open_in_new" className="text-xs" />
              </a>
            ) : (
              <span className={chipClass} title={p.error ?? undefined}>
                {chip}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
