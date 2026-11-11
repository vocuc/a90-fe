import Icon from '../common/Icon';
import { ORDER_STATUS } from '../../api/shipping';

const STATUS = {
  [ORDER_STATUS.READING]: { label: 'Đang đọc ảnh', icon: 'document_scanner', cls: 'bg-sky-50 text-sky-800' },
  [ORDER_STATUS.DRAFT]: { label: 'Nháp', icon: 'edit_note', cls: 'bg-amber-50 text-amber-800' },
  [ORDER_STATUS.SUBMITTED]: { label: 'Đã gửi GHN', icon: 'local_shipping', cls: 'bg-emerald-50 text-emerald-800' },
  [ORDER_STATUS.FAILED]: { label: 'GHN từ chối', icon: 'error', cls: 'bg-error-container/60 text-on-error-container' },
};

// Bảng mã: https://developer.ghn.vn/en/docs/master-data/order-status.md
// Mỗi trạng thái hiển thị một màu; các mã GHN cùng chữ thì dùng chung màu. Đơn gặp vấn đề có thêm icon error.
const PICKING = { label: 'Đang lấy hàng', cls: 'bg-sky-100 text-sky-800' };
const DELIVERING = { label: 'Đang giao', cls: 'bg-teal-100 text-teal-800' };
const WAITING_RETURN = { label: 'Chờ hoàn hàng', icon: 'error', cls: 'bg-yellow-100 text-yellow-800' };
const RETURNING = { label: 'Đang hoàn hàng', icon: 'error', cls: 'bg-amber-200 text-amber-900' };

const GHN_STATUS = {
  ready_to_pick: { label: 'Chờ lấy hàng', cls: 'bg-slate-200 text-slate-800' },
  picking: PICKING,
  money_collect_picking: PICKING,
  picked: { label: 'Đã lấy hàng', cls: 'bg-cyan-100 text-cyan-800' },
  storing: { label: 'Đang ở kho GHN', cls: 'bg-indigo-100 text-indigo-800' },
  sorting: { label: 'Đang phân loại', cls: 'bg-violet-100 text-violet-800' },
  transporting: { label: 'Đang luân chuyển', cls: 'bg-blue-100 text-blue-800' },
  delivering: DELIVERING,
  money_collect_delivering: DELIVERING,
  delivered: { label: 'Đã giao', cls: 'bg-green-600 text-white' },
  delivery_fail: { label: 'Giao thất bại', icon: 'error', cls: 'bg-orange-100 text-orange-800' },
  waiting_to_return: WAITING_RETURN,
  return: WAITING_RETURN,
  return_transporting: RETURNING,
  return_sorting: RETURNING,
  returning: RETURNING,
  return_fail: { label: 'Hoàn thất bại', icon: 'error', cls: 'bg-rose-100 text-rose-800' },
  returned: { label: 'Đã hoàn hàng', icon: 'error', cls: 'bg-purple-100 text-purple-800' },
  cancel: { label: 'Đã huỷ', icon: 'error', cls: 'bg-stone-300 text-stone-800' },
  exception: { label: 'Đơn ngoại lệ', icon: 'error', cls: 'bg-fuchsia-100 text-fuchsia-800' },
  lost: { label: 'Thất lạc', icon: 'error', cls: 'bg-red-600 text-white' },
  damage: { label: 'Hư hỏng', icon: 'error', cls: 'bg-pink-100 text-pink-800' },
  scrap: { label: 'Đã tiêu huỷ', icon: 'error', cls: 'bg-zinc-700 text-white' },
};

/** ghnStatus: trạng thái vận chuyển bên GHN, có thì hiện thay cho "Đã gửi GHN". */
export function OrderStatusBadge({ status, ghnStatus }) {
  const base = STATUS[status] ?? { label: status, icon: 'help', cls: 'bg-surface-container text-on-surface-variant' };
  // Mã GHN chưa có trong bảng thì vẫn hiện nguyên mã, giữ màu "Đã gửi GHN"
  const ghn = status === ORDER_STATUS.SUBMITTED && ghnStatus ? (GHN_STATUS[ghnStatus] ?? { label: ghnStatus }) : null;
  const s = { ...base, ...ghn };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>
      <Icon name={s.icon} className="text-sm" />
      {s.label}
    </span>
  );
}
