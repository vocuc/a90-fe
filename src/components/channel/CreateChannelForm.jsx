import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../common/Feedback';
import { FormAlert, SelectField, SubmitButton, TextField } from '../common/Form';
import { CHANNEL_KEYS, createChannel, listChannelWorkers } from '../../api/channels';

/** Thiết lập kênh TikTok của tài khoản (mỗi tài khoản A51 có đúng 1 kênh): tên kênh + worker đăng bài. */
export default function CreateChannelForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workers, isLoading } = useQuery({ queryKey: CHANNEL_KEYS.workers, queryFn: listChannelWorkers });
  const free = (workers ?? []).filter((w) => !w.channelId);
  const [name, setName] = useState('');
  const [workerId, setWorkerId] = useState('');
  const mutation = useMutation({
    mutationFn: createChannel,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.workers });
      navigate('/seller/channel?tab=settings', { replace: true });
    },
  });
  const errors = mutation.error?.errors ?? {};

  return (
    <form
      className="mx-auto max-w-md space-y-4 rounded-2xl border border-outline-variant/40 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ name, workerId });
      }}
    >
      <div>
        <h2 className="text-sm font-bold text-on-surface">Thiết lập kênh TikTok</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          Mỗi tài khoản A51 ứng với 1 kênh TikTok, đăng bài qua 1 worker. Kênh có chân dung khách hàng, kế hoạch nội dung và cài đặt AI viết
          nội dung riêng; kế hoạch do đội A51 lập, bạn xem và duyệt tại đây.
        </p>
      </div>
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
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Chưa có worker đăng bài nào trống, liên hệ A51 để được cấp worker.</p>
      )}
      {mutation.error && !mutation.error.errors && <FormAlert>{mutation.error.message}</FormAlert>}
      <SubmitButton loading={mutation.isPending} loadingText="Đang tạo..." disabled={!name.trim() || !workerId}>
        Tạo kênh
      </SubmitButton>
    </form>
  );
}
