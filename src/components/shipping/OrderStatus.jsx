import Icon from '../common/Icon';
import { ORDER_STATUS } from '../../api/shipping';

const STATUS = {
  [ORDER_STATUS.READING]: { label: 'Đang đọc ảnh', icon: 'document_scanner', cls: 'bg-sky-50 text-sky-800' },
  [ORDER_STATUS.DRAFT]: { label: 'Nháp', icon: 'edit_note', cls: 'bg-amber-50 text-amber-800' },
  [ORDER_STATUS.SUBMITTED]: { label: 'Đã gửi GHN', icon: 'local_shipping', cls: 'bg-emerald-50 text-emerald-800' },
  [ORDER_STATUS.FAILED]: { label: 'GHN từ chối', icon: 'error', cls: 'bg-error-container/60 text-on-error-container' },
};

export function OrderStatusBadge({ status }) {
  const s = STATUS[status] ?? { label: status, icon: 'help', cls: 'bg-surface-container text-on-surface-variant' };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>
      <Icon name={s.icon} className="text-sm" />
      {s.label}
    </span>
  );
}
