import Icon from '../common/Icon';
import { DRIVER, PLATFORM_STATUS, POST_STATUS, doneLabelOf, platformInfo } from '../../api/social';

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

/**
 * Trạng thái bài trên từng nền tảng đã chọn: "TikTok · Đã lưu nháp", "TikTok · Đã gửi vào hộp thư", "Facebook · Lỗi"...
 * TikTok gửi vào nhiều tài khoản: mỗi tài khoản một chip "TikTok @shopa · Đã gửi vào hộp thư".
 * showErrors: hiện thêm lỗi cụ thể khi gửi TikTok qua API (hết lượt, mất kết nối...); lỗi worker chỉ là thông báo chung.
 */
export function PlatformStatusList({ platforms, className = '', showErrors = false }) {
  if (!platforms?.length) return null;
  const items = platforms.flatMap((p) =>
    p.accounts?.length
      ? p.accounts.map((a) => ({
          ...p,
          key: `${p.platform}-${a.accountId ?? a.name}`,
          account: a.name,
          status: a.status,
          driver: DRIVER.API,
          error: a.error,
          postUrl: null,
        }))
      : [{ ...p, key: p.platform, account: null }],
  );
  const apiErrors = showErrors
    ? items.filter((p) => p.status === PLATFORM_STATUS.FAILED && p.driver === DRIVER.API && p.error)
    : [];
  const list = (
    <ul className={`flex flex-wrap gap-1 ${className}`}>
      {items.map((p) => {
        const info = platformInfo(p.platform);
        const s = PLATFORM_STATUS_INFO[p.status] ?? PLATFORM_STATUS_INFO[PLATFORM_STATUS.QUEUED];
        const label = p.status === PLATFORM_STATUS.PUBLISHED ? doneLabelOf(p.platform, p.driver) : s.label;
        const chip = (
          <>
            <Icon name={s.icon} fill={s.fill} className={`text-sm ${s.spin ? 'animate-spin' : ''}`} />
            <span className="font-bold">{info.label}</span>
            {p.account && <span className="max-w-[10rem] truncate font-semibold">{p.account}</span>}
            <span>· {label}</span>
          </>
        );
        const chipClass = `inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${s.className}`;
        return (
          <li key={p.key}>
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
  if (!apiErrors.length) return list;
  return (
    <div className="space-y-1">
      {list}
      {apiErrors.map((p) => (
        <p key={p.key} className="text-xs text-error">
          {platformInfo(p.platform).label}
          {p.account ? ` ${p.account}` : ''}: {p.error}
        </p>
      ))}
    </div>
  );
}
