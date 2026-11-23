import { useState } from 'react';
import { Link } from 'react-router-dom';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { useConfirm } from '../common/ConfirmDialog';
import { deleteGroup } from '../../api/autoBatch';

// Tạo lô tự động chỉ dùng creative Đang bán, không bị ẩn
export const isRunnable = (c) => c.status === 'published' && !c.isHidden;

/**
 * Thẻ 1 nhóm creative (trang Nhóm creative, tab Creative của kênh): tên + nhãn Dùng chung / Kênh X, số creative dùng được,
 * sửa / xoá. index: số thứ tự hiện ở đầu thẻ (bỏ trống thì không hiện). editTo: nút sửa là link sang trang khác (thay cho
 * onEdit). Không có onDeleted thì không hiện nút xoá (tab Creative của kênh chỉ xem).
 */
export default function GroupCard({ group, index, onEdit, editTo, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const { confirm, alert } = useConfirm();
  const runnable = group.creatives.filter(isRunnable).length;

  const remove = async () => {
    if (!(await confirm(`Xoá nhóm "${group.name}"? Lô đã tạo từ nhóm này vẫn giữ nguyên.`, { confirmLabel: 'Xoá', danger: true }))) return;
    setDeleting(true);
    try {
      await deleteGroup(group.id);
      await onDeleted();
    } catch (err) {
      alert(err?.message || 'Không xoá được nhóm, vui lòng thử lại.');
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-outline-variant/40 p-3">
      <div className="flex items-start gap-2">
        {index != null && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
            {index + 1}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-bold text-on-surface">{group.name}</span>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                group.channel ? 'bg-primary-container/10 text-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {group.channel ? `Kênh ${group.channel.name}` : 'Dùng chung'}
            </span>
          </p>
          <p className={`text-xs ${runnable ? 'text-on-surface-variant' : 'text-error'}`}>
            {group.creatives.length} creative · {runnable ? `${runnable} đang bán dùng được` : 'Không có creative Đang bán, nhóm bị bỏ qua'}
          </p>
        </div>
        {editTo ? (
          <Link
            to={editTo}
            aria-label={`Sửa nhóm ${group.name}`}
            title="Sửa ở trang Nhóm creative"
            className="flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="edit" className="text-lg" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Sửa nhóm ${group.name}`}
            className="flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="edit" className="text-lg" />
          </button>
        )}
        {onDeleted && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            aria-label={`Xoá nhóm ${group.name}`}
            className="flex size-8 items-center justify-center rounded-lg text-error hover:bg-error-container/40 disabled:opacity-50"
          >
            <Icon name={deleting ? 'progress_activity' : 'delete'} className={`text-lg ${deleting ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {group.creatives.map((c) => (
          <li key={c.id} className={`w-20 shrink-0 ${isRunnable(c) ? '' : 'opacity-50'}`} title={isRunnable(c) ? c.title : `${c.title} (không Đang bán, bị bỏ qua)`}>
            <a href={`/seller/creatives/${c.id}/edit`} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80">
              <CoverImage src={c.coverUrl} alt="" className="aspect-square w-full rounded-lg" />
              <p className="mt-1 line-clamp-2 text-[11px] text-on-surface">{c.title}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
