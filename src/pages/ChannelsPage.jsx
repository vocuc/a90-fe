import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import Dialog from '../components/common/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SelectField, SubmitButton, TextField } from '../components/common/Form';
import { useCreatorProfile } from '../hooks/creatorQueries';
import { CHANNEL_KEYS, MISSING_LABELS, createChannel, listChannelWorkers, listChannels } from '../api/channels';

function CreateChannelDialog({ onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workers, isLoading } = useQuery({ queryKey: CHANNEL_KEYS.workers, queryFn: listChannelWorkers });
  const free = (workers ?? []).filter((w) => !w.channelId);
  const [name, setName] = useState('');
  const [workerId, setWorkerId] = useState('');
  const mutation = useMutation({
    mutationFn: createChannel,
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.workers });
      navigate(`/channels/${channel.id}?tab=settings`);
    },
  });
  const errors = mutation.error?.errors ?? {};

  return (
    <Dialog title="Thêm kênh TikTok" subtitle="Mỗi kênh đăng qua 1 worker riêng" onClose={onClose}>
      <form
        className="space-y-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ name, workerId });
        }}
      >
        <TextField label="Tên kênh" icon="badge" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="vd: Giày nữ Gen Z" />
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : free.length ? (
          <SelectField label="Worker đăng bài" value={workerId} onChange={(e) => setWorkerId(e.target.value)} error={errors.worker_id}>
            <option value="">Chọn worker</option>
            {free.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </SelectField>
        ) : (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            Không còn worker đăng bài nào trống. Mỗi kênh cần 1 worker riêng, liên hệ A51 để được cấp thêm worker.
          </p>
        )}
        {mutation.error && !mutation.error.errors && <FormAlert>{mutation.error.message}</FormAlert>}
        <SubmitButton loading={mutation.isPending} loadingText="Đang tạo..." disabled={!name.trim() || !workerId}>
          Tạo kênh
        </SubmitButton>
      </form>
    </Dialog>
  );
}

function ChannelCard({ channel }) {
  return (
    <Link
      to={`/channels/${channel.id}`}
      className="flex items-start gap-3 rounded-2xl border border-outline-variant/40 p-3 transition-colors hover:bg-surface-container-low"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
        <Icon name="smart_display" className="text-xl" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
          <span className="truncate">{channel.name}</span>
          {/* ID kênh: dùng cho lệnh /lap-ke-hoach <id> */}
          <span className="shrink-0 rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">ID: {channel.id}</span>
        </p>
        <p className="text-xs text-on-surface-variant">
          {channel.worker ? `Worker: ${channel.worker.name}` : 'Chưa có worker'} · {channel.upcomingPosts} bài sắp đăng
        </p>
        {channel.missing.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {channel.missing.map((m) => (
              <li key={m} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                {MISSING_LABELS[m] ?? m}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Icon name="chevron_right" className="text-outline" />
    </Link>
  );
}

/** /channels: các kênh TikTok của shop (note/xay-kenh-tiktok/dac-ta-giai-doan-1.txt mục 8). */
export default function ChannelsPage() {
  useSeo({ title: 'Kênh TikTok', noindex: true });
  const { hasProfile, meLoaded } = useCreatorProfile();
  const [creating, setCreating] = useState(false);
  const { data, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.all, queryFn: listChannels, enabled: hasProfile });
  const full = data && data.items.length >= data.max;

  const addButton = (
    <button
      type="button"
      onClick={() => setCreating(true)}
      disabled={full}
      title={full ? `Tối đa ${data?.max} kênh` : undefined}
      className="flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary disabled:opacity-50"
    >
      <Icon name="add" className="text-base" />
      Thêm kênh
    </button>
  );

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <Link to="/tools" aria-label="Quay lại" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
          <Icon name="arrow_back" />
        </Link>
        <h1 className="flex-1 text-base font-bold text-on-surface">Kênh TikTok</h1>
        {hasProfile && <span className="mr-2">{addButton}</span>}
      </header>

      <section className="space-y-3 p-4 lg:py-6">
        <p className="text-xs text-on-surface-variant">
          Mỗi kênh là 1 tài khoản TikTok, có chân dung khách hàng, kế hoạch nội dung và cài đặt AI viết nội dung riêng. Kế hoạch do đội A51 lập, bạn
          xem và duyệt ở trang kênh.
        </p>
        {!meLoaded ? (
          <Skeleton className="h-20 w-full" />
        ) : !hasProfile ? (
          <EmptyState icon="storefront" message="Bạn cần tạo cửa hàng trước khi tạo kênh.">
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          </EmptyState>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !data ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : !data.items.length ? (
          <EmptyState icon="smart_display" message="Chưa có kênh nào. Mọi bài đăng đều cần thuộc 1 kênh.">
            <div className="mt-2">{addButton}</div>
          </EmptyState>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.items.map((c) => (
              <li key={c.id}>
                <ChannelCard channel={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {creating && <CreateChannelDialog onClose={() => setCreating(false)} />}
    </>
  );
}
