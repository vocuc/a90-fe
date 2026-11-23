import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import GroupCard from '../product/GroupCard';
import { AUTO_KEYS, listGroups } from '../../api/autoBatch';
import Section from './Section';

const GROUPS_PAGE = '/seller/creative-groups';

function GroupList({ groups, empty }) {
  if (!groups.length) return <EmptyState icon="workspaces" message={empty} />;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <li key={g.id}>
          <GroupCard group={g} editTo={`${GROUPS_PAGE}?edit=${g.id}`} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Tab Creative của kênh: CHỈ XEM các nhóm creative kênh dùng khi tạo lô tự động (bài unboxing của kế hoạch, "Tạo cho kênh"
 * ở trang tạo lô tự động) = nhóm riêng của kênh + nhóm dùng chung. Tạo / sửa / xoá ở trang Nhóm creative: nút sửa chuyển
 * sang /seller/creative-groups?edit={id} (mở sẵn form sửa), bấm creative mở trang sửa creative.
 */
export default function CreativesTab({ channel }) {
  const { data: groups, error, refetch } = useQuery({
    queryKey: [...AUTO_KEYS.groups, 'channel', String(channel.id)],
    queryFn: () => listGroups(channel.id),
  });
  const own = groups?.filter((g) => g.channel?.id === channel.id) ?? [];
  const shared = groups?.filter((g) => !g.channel) ?? [];

  const manage = (
    <Link
      to={GROUPS_PAGE}
      className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-outline-variant/60 px-3 text-xs font-bold text-on-surface hover:border-primary-container hover:text-primary"
    >
      <Icon name="open_in_new" className="text-base" />
      Quản lý nhóm
    </Link>
  );

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!groups) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <Section
        title="Nhóm riêng của kênh"
        subtitle="Chỉ dùng khi tạo lô cho kênh này. Mỗi lô tự động = 1 sản phẩm x các creative Đang bán của 1 nhóm."
        action={manage}
      >
        <GroupList groups={own} empty="Chưa có nhóm riêng. Tạo nhóm ở trang Nhóm creative và chọn kênh này." />
      </Section>
      <Section title="Nhóm dùng chung" subtitle="Dùng cho mọi kênh và khi tạo lô không theo kênh.">
        <GroupList groups={shared} empty="Chưa có nhóm dùng chung." />
      </Section>
    </div>
  );
}
