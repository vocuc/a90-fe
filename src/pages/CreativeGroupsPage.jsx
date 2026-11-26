import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import GroupCard from '../components/product/GroupCard';
import GroupFormDialog from '../components/product/GroupFormDialog';
import { CREATOR_KEYS, useCreatorProfile } from '../hooks/creatorQueries';
import { AUTO_KEYS, listGroups } from '../api/autoBatch';
import ChannelFilter, { CHANNEL_FILTER, readChannelFilter } from '../components/channel/ChannelFilter';

/** Lọc nhóm theo kênh ở client: '' = tất cả, 'shared' = dùng chung, id = chỉ nhóm riêng của kênh đó. */
const matchChannel = (group, channel) =>
  !channel || (channel === CHANNEL_FILTER.SHARED ? !group.channel : String(group.channel?.id ?? '') === channel);

/**
 * /seller/creative-groups: nhóm creative cho tạo lô tự động (note/auto-tao-lo.txt). Nhóm tạo trước chạy trước.
 * ?edit={id}: mở sẵn form sửa nhóm đó (nút sửa ở tab Creative của trang kênh).
 * ?channel=: lọc theo kênh (id | shared); đang lọc 1 kênh thì "Tạo nhóm" chọn sẵn kênh đó.
 */
export default function CreativeGroupsPage() {
  useSeo({ title: 'Nhóm creative', noindex: true });
  const queryClient = useQueryClient();
  const { hasProfile, meLoaded } = useCreatorProfile();
  // null: đóng, {}: tạo mới, { group }: sửa
  const [editing, setEditingState] = useState(null);
  const [params, setParams] = useSearchParams();
  const channel = readChannelFilter(params);
  const setChannel = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('channel', value);
    else next.delete('channel');
    setParams(next, { replace: true });
  };

  const { data: groups, error, refetch } = useQuery({ queryKey: AUTO_KEYS.groups, queryFn: () => listGroups(), enabled: hasProfile });

  // ?edit={id}: tải xong nhóm thì mở form sửa; đóng form thì bỏ tham số
  const editId = params.get('edit');
  const linked = editId && !editing ? groups?.find((g) => String(g.id) === editId) : null;
  if (linked) setEditingState({ group: linked });
  const setEditing = (value) => {
    setEditingState(value);
    if (!value && editId) {
      const next = new URLSearchParams(params);
      next.delete('edit');
      setParams(next, { replace: true });
    }
  };
  const shown = groups?.filter((g) => matchChannel(g, channel)) ?? [];

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
          to={hasProfile ? '/seller/creatives' : '/tools'}
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
        ) : !hasProfile ? (
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
              <Icon name="info" className="shrink-0 text-base" />
              Mỗi lô tự động = 1 sản phẩm x các creative Đang bán của 1 nhóm, mỗi creative 1 ảnh. Nhóm tạo trước chạy trước.
              Một creative chỉ ở một nhóm. Nhóm "Dùng chung" dùng cho mọi kênh, nhóm chọn kênh chỉ dùng cho kênh đó.
            </p>
            <ChannelFilter value={channel === CHANNEL_FILTER.NONE ? '' : channel} onChange={setChannel} />
            {!shown.length ? (
              <EmptyState icon="workspaces" message={groups.length ? 'Không có nhóm nào khớp bộ lọc kênh này.' : 'Chưa có nhóm creative nào.'}>
                {hasProfile && <div className="mt-2">{addButton}</div>}
              </EmptyState>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {shown.map((g, i) => (
                  <li key={g.id}>
                    <GroupCard group={g} index={i} onEdit={() => setEditing({ group: g })} onDeleted={reload} />
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
          defaultChannelId={/^\d+$/.test(channel) ? channel : ''}
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
