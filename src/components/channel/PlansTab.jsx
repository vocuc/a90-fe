import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { FormAlert } from '../common/Form';
import { useConfirm } from '../common/ConfirmDialog';
import { CHANNEL_KEYS, cancelPlanItem, decidePlan, getPlan, listPlans } from '../../api/channels';
import Section, { formatDateTime } from './Section';

const PLAN_STATUS = {
  draft: { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Đã huỷ', className: 'bg-surface-container text-on-surface-variant' },
};

function PlanItem({ channelId, planId, item, canCancel }) {
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => cancelPlanItem(channelId, planId, item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plan(channelId, planId) }),
  });
  const cancelled = item.status === 'cancelled';

  return (
    <li className={`flex gap-3 rounded-xl border border-outline-variant/40 p-2 ${cancelled ? 'opacity-50' : ''}`}>
      <div className="flex shrink-0 gap-1">
        {/* Bài lô phối đồ (vd lookbook): chưa có ảnh, duyệt kỳ mới tạo lô */}
        {item.outfit && (
          <div className="flex h-16 w-12 flex-col items-center justify-center rounded-lg bg-surface-container text-center text-[9px] font-semibold text-on-surface-variant">
            <Icon name="checkroom" className="text-lg text-primary" />
            Lô phối đồ
          </div>
        )}
        {item.images.slice(0, 3).map((img) => (
          <div key={img.ref} className="relative h-16 w-12 overflow-hidden rounded-lg bg-surface-container">
            {img.thumb_url && <img src={img.thumb_url} alt="" className="size-full object-cover" loading="lazy" />}
            {img.text && <Icon name="text_fields" className="absolute right-0.5 top-0.5 rounded bg-black/50 text-xs text-white" />}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[11px] text-on-surface-variant">
          {formatDateTime(item.scheduled_at)} · {item.sample_name} · {item.format === 'video' ? 'Video' : item.outfit ? `Tạo lô phối đồ ${item.outfit.count} ảnh khi duyệt` : `${item.images.length} ảnh`}
        </p>
        <p className="line-clamp-2 text-sm font-semibold text-on-surface">{item.hook}</p>
        {item.title && <p className="truncate text-xs text-on-surface-variant">{item.title}</p>}
        {item.outfit?.tags?.length > 0 && (
          <p className="truncate text-[11px] text-on-surface-variant">Tìm outfit theo: {item.outfit.tags.map((t) => `#${t}`).join(' ')}</p>
        )}
        {item.hashtags.length > 0 && <p className="truncate text-[11px] text-primary">{item.hashtags.map((h) => `#${h}`).join(' ')}</p>}
      </div>
      {canCancel && !cancelled && (
        <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending} aria-label="Huỷ bài này"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-error hover:bg-error-container/40">
          <Icon name="close" className="text-lg" />
        </button>
      )}
    </li>
  );
}

function PlanDetail({ channelId, planId }) {
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const { data: plan, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.plan(channelId, planId), queryFn: () => getPlan(channelId, planId) });
  const decide = useMutation({
    mutationFn: (approve) => decidePlan(channelId, planId, approve),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plans(channelId) });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plan(channelId, planId) });
      queryClient.invalidateQueries({ queryKey: ['creator', 'channels', String(channelId), 'calendar'] });
    },
  });

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!plan) return <Skeleton className="h-32 w-full" />;
  const open = plan.status === 'draft' || plan.status === 'approved';

  return (
    <div className="space-y-3">
      {plan.warnings.length > 0 && (
        <ul className="list-inside list-disc rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          {plan.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      <ul className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
        {plan.items.map((item) => (
          <PlanItem key={item.id} channelId={channelId} planId={planId} item={item} canCancel={open} />
        ))}
      </ul>
      {decide.error && <FormAlert>{decide.error.message}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        {plan.status === 'draft' && (
          <button type="button" onClick={() => decide.mutate(true)} disabled={decide.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
            Duyệt kỳ, đưa vào lịch đăng
          </button>
        )}
        {open && (
          <button
            type="button"
            disabled={decide.isPending}
            onClick={async () => {
              if (await confirm('Huỷ cả kỳ? Bài chưa đăng của kỳ bị xoá khỏi lịch.', { confirmLabel: 'Huỷ kỳ', danger: true })) decide.mutate(false);
            }}
            className="rounded-lg px-4 py-2 text-xs font-bold text-error hover:bg-error-container/40"
          >
            Huỷ kỳ
          </button>
        )}
      </div>
    </div>
  );
}

/** Tab Kế hoạch: các kỳ đội A51 lập bằng lệnh /lap-ke-hoach; kỳ chờ duyệt thì chủ shop duyệt / huỷ / bỏ bài. */
export default function PlansTab({ channel }) {
  const { data, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.plans(channel.id), queryFn: () => listPlans(channel.id) });
  const [openId, setOpenId] = useState(null);

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-32 w-full" />;
  if (!data.length) {
    return <EmptyState icon="event_note" message="Chưa có kỳ kế hoạch nào. Kế hoạch do đội A51 lập theo cấu hình của kênh." />;
  }
  const current = openId ?? data.find((p) => p.status === 'draft')?.id ?? data[0].id;

  return (
    <div className="space-y-3">
      {data.map((p) => (
        <Section
          key={p.id}
          title={`Kỳ ${new Date(p.start_date).toLocaleDateString('vi-VN')} · ${p.days} ngày`}
          subtitle={`${p.total_items} bài`}
          action={
            <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${PLAN_STATUS[p.status]?.className}`}>{PLAN_STATUS[p.status]?.label ?? p.status}</span>
          }
        >
          {current === p.id ? (
            <PlanDetail channelId={channel.id} planId={p.id} />
          ) : (
            <button type="button" onClick={() => setOpenId(p.id)} className="text-xs font-bold text-primary hover:underline">
              Xem các bài
            </button>
          )}
        </Section>
      ))}
    </div>
  );
}
