import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import GroupFormDialog from '../components/product/GroupFormDialog';
import { CREATOR_KEYS, useCreatorProfile } from '../hooks/creatorQueries';
import { AUTO_KEYS, deleteGroup, listGroups } from '../api/autoBatch';
import { useConfirm } from '../components/common/ConfirmDialog';

// Tạo lô tự động chỉ dùng creative Đang bán, không bị ẩn
const isRunnable = (c) => c.status === 'published' && !c.isHidden;

/** shopName: nhóm của shop chủ (nhân viên chỉ xem, không sửa / xoá). */
function GroupCard({ group, index, shopName, onEdit, onDeleted }) {
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
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface">{group.name}</p>
          <p className={`text-xs ${runnable ? 'text-on-surface-variant' : 'text-error'}`}>
            {group.creatives.length} creative · {runnable ? `${runnable} đang bán dùng được` : 'Không có creative Đang bán, nhóm bị bỏ qua'}
          </p>
          {!group.isOwner && (
            <p className="flex items-center gap-1 text-xs text-on-surface-variant">
              <Icon name="storefront" className="text-sm" />
              <span className="truncate">Của shop {shopName}</span>
            </p>
          )}
        </div>
        {group.isOwner && (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Sửa nhóm ${group.name}`}
              className="flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
            >
              <Icon name="edit" className="text-lg" />
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              aria-label={`Xoá nhóm ${group.name}`}
              className="flex size-8 items-center justify-center rounded-lg text-error hover:bg-error-container/40 disabled:opacity-50"
            >
              <Icon name={deleting ? 'progress_activity' : 'delete'} className={`text-lg ${deleting ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}
      </div>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {group.creatives.map((c) => (
          <li key={c.id} className={`w-20 shrink-0 ${isRunnable(c) ? '' : 'opacity-50'}`} title={isRunnable(c) ? c.title : `${c.title} (không Đang bán, bị bỏ qua)`}>
            <CoverImage src={c.coverUrl} alt="" className="aspect-square w-full rounded-lg" />
            <p className="mt-1 line-clamp-2 text-[11px] text-on-surface">{c.title}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * /seller/creative-groups: nhóm creative cho tạo lô tự động (note/auto-tao-lo.txt). Nhóm tạo trước chạy trước.
 * Nhân viên của shop (note/chia-se-tai-nguyen.txt) xem nhóm của shop chủ, không tạo / sửa / xoá.
 */
export default function CreativeGroupsPage() {
  useSeo({ title: 'Nhóm creative', noindex: true });
  const queryClient = useQueryClient();
  const { hasProfile, staffOf, meLoaded } = useCreatorProfile();
  // null: đóng, {}: tạo mới, { group }: sửa
  const [editing, setEditing] = useState(null);

  const { data: groups, error, refetch } = useQuery({ queryKey: AUTO_KEYS.groups, queryFn: listGroups, enabled: hasProfile || !!staffOf });

  // Nhóm đổi -> tải lại nhóm và danh sách creative (thẻ creative hiện tên nhóm)
  const reload = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: AUTO_KEYS.groups }),
      queryClient.invalidateQueries({ queryKey: CREATOR_KEYS.creatives }),
    ]);

  const addButton = (
    <button
      type="button"
      onClick={() => setEditing({})}
      className="flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary"
    >
      <Icon name="add" className="text-base" />
      Tạo nhóm
    </button>
  );

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <Link
          to={hasProfile ? '/seller/creatives' : '/account'}
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </Link>
        <h1 className="flex-1 text-base font-bold text-on-surface">Nhóm creative</h1>
        {hasProfile && <span className="mr-2">{addButton}</span>}
      </header>

      <section className="space-y-3 p-4 lg:py-6">
        {!meLoaded ? (
          <Skeleton className="h-24 w-full" />
        ) : !hasProfile && !staffOf ? (
          <EmptyState icon="storefront" message="Bạn cần tạo cửa hàng trước khi tạo nhóm creative.">
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          </EmptyState>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !groups ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : (
          <>
            <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
              <Icon name="info" className="text-base" />
              Mỗi lô tự động = 1 sản phẩm x các creative Đang bán của 1 nhóm, mỗi creative 1 ảnh. Nhóm tạo trước chạy trước.
              Một creative chỉ ở một nhóm.
              {staffOf && ` Đây là nhóm của shop ${staffOf.shopName}, bạn chỉ dùng để tạo lô, không sửa được.`}
            </p>
            {!groups.length ? (
              <EmptyState icon="workspaces" message={staffOf ? 'Shop chưa có nhóm creative nào.' : 'Chưa có nhóm creative nào.'}>
                {hasProfile && <div className="mt-2">{addButton}</div>}
              </EmptyState>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {groups.map((g, i) => (
                  <li key={g.id}>
                    <GroupCard group={g} index={i} shopName={staffOf?.shopName} onEdit={() => setEditing({ group: g })} onDeleted={reload} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {editing && (
        <GroupFormDialog
          group={editing.group}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
