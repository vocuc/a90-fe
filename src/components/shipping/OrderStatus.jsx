import Icon from '../common/Icon';
import { ORDER_STATUS } from '../../api/shipping';

const STATUS = {
  [ORDER_STATUS.READING]: { label: 'Đang đọc ảnh', icon: 'document_scanner', cls: 'bg-sky-50 text-sky-800' },
  [ORDER_STATUS.DRAFT]: { label: 'Nháp', icon: 'edit_note', cls: 'bg-amber-50 text-amber-800' },
  [ORDER_STATUS.SUBMITTED]: { label: 'Đã gửi GHN', icon: 'local_shipping', cls: 'bg-emerald-50 text-emerald-800' },
  [ORDER_STATUS.FAILED]: { label: 'GHN từ chối', icon: 'error', cls: 'bg-error-container/60 text-on-error-container' },
};

// Bảng mã: https://developer.ghn.vn/en/docs/master-data/order-status.md
const GHN_STATUS = {
  ready_to_pick: 'Chờ lấy hàng',
  picking: 'Đang lấy hàng',
  money_collect_picking: 'Đang lấy hàng',
  picked: 'Đã lấy hàng',
  storing: 'Đang ở kho GHN',
  sorting: 'Đang phân loại',
  transporting: 'Đang luân chuyển',
  delivering: 'Đang giao',
  money_collect_delivering: 'Đang giao',
  delivered: 'Đã giao',
  delivery_fail: 'Giao thất bại',
  waiting_to_return: 'Chờ hoàn hàng',
  return: 'Chờ hoàn hàng',
  return_transporting: 'Đang hoàn hàng',
  return_sorting: 'Đang hoàn hàng',
  returning: 'Đang hoàn hàng',
  return_fail: 'Hoàn thất bại',
  returned: 'Đã hoàn hàng',
  cancel: 'Đã huỷ',
  exception: 'Đơn ngoại lệ',
  lost: 'Thất lạc',
  damage: 'Hư hỏng',
  scrap: 'Đã tiêu huỷ',
};

// Đơn không còn đi đúng hướng giao cho khách: không tô xanh như đơn bình thường
const GHN_PROBLEM = new Set([
  'delivery_fail',
  'waiting_to_return',
  'return',
  'return_transporting',
  'return_sorting',
  'returning',
  'return_fail',
  'returned',
  'cancel',
  'exception',
  'lost',
  'damage',
  'scrap',
]);

const PROBLEM_STYLE = { icon: 'error', cls: STATUS[ORDER_STATUS.FAILED].cls };

/** ghnStatus: trạng thái vận chuyển bên GHN, có thì hiện thay cho "Đã gửi GHN". */
export function OrderStatusBadge({ status, ghnStatus }) {
  const base = STATUS[status] ?? { label: status, icon: 'help', cls: 'bg-surface-container text-on-surface-variant' };
  const fromGhn = status === ORDER_STATUS.SUBMITTED && ghnStatus;
  const s = {
    ...base,
    ...(fromGhn && GHN_PROBLEM.has(ghnStatus) ? PROBLEM_STYLE : null),
    label: fromGhn ? (GHN_STATUS[ghnStatus] ?? ghnStatus) : base.label,
  };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>
      <Icon name={s.icon} className="text-sm" />
      {s.label}
    </span>
  );
}
