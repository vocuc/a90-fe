import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { FormAlert, TextArea } from '../common/Form';
import { useConfirm } from '../common/ConfirmDialog';
import {
  CHANNEL_KEYS,
  cancelPlanItem,
  decidePlan,
  deletePlan,
  getPlan,
  getPlanJob,
  isPlanJobRunning,
  listPlans,
  startPlanJob,
} from '../../api/channels';
import Section, { TopicBadge, formatDateTime } from './Section';

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
        {/* Bài lô ảnh sản phẩm (unboxing): chưa có ảnh, duyệt kỳ mới tạo lô tự động cho sản phẩm */}
        {item.product_batch && (
          <div className="flex h-16 w-12 flex-col items-center justify-center rounded-lg bg-surface-container text-center text-[9px] font-semibold text-on-surface-variant">
            <Icon name="photo_library" className="text-lg text-primary" />
            Lô ảnh
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
          {formatDateTime(item.scheduled_at)} · {item.sample_name} · {item.format === 'video' ? 'Video' : item.outfit
            ? `Tạo lô phối đồ ${item.outfit.count} ảnh khi duyệt`
            : item.product_batch
              ? `Tạo lô ảnh "${item.product_batch.product_name ?? `sản phẩm #${item.product_batch.product_id}`}" khi duyệt`
              : `${item.images.length} ảnh`}
        </p>
        {item.topic && <TopicBadge name={item.topic} />}
        <p className="line-clamp-2 text-sm font-semibold text-on-surface">{item.hook}</p>
        {item.title && <p className="truncate text-xs text-on-surface-variant">{item.title}</p>}
        {item.outfit?.tags?.length > 0 && (
          <p className="truncate text-[11px] text-on-surface-variant">Tìm outfit theo: {item.outfit.tags.map((t) => `#${t}`).join(' ')}</p>
        )}
        {item.outfit?.labels?.length > 0 && (
          <p className="line-clamp-2 text-[11px] text-on-surface-variant">Nhãn ảnh: {item.outfit.labels.join(' · ')}</p>
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

// Lượt lập kế hoạch đang chạy: tải lại mỗi 15 giây để thấy kết quả
const POLL_MS = 15_000;

/** Lập kế hoạch mới: ghi chú (không bắt buộc) -> việc cho worker điều phối chạy AI lập kỳ. */
function NewPlanDialog({ channelId, noteMax, onClose }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const mutation = useMutation({
    mutationFn: () => startPlanJob(channelId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.planJob(channelId) });
      onClose();
    },
  });

  return (
    <Dialog
      title="Lập kế hoạch mới"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container">
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            <Icon name={mutation.isPending ? 'progress_activity' : 'auto_awesome'} className={`text-lg ${mutation.isPending ? 'animate-spin' : ''}`} />
            Bắt đầu lập
          </button>
        </>
      }
    >
      <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
        <Icon name="info" className="text-base" />
        <span>
          AI lập kỳ mới theo cấu hình kênh (số ngày, số bài / ngày, khung giờ), tuyến nội dung, chủ đề đang bật và sản phẩm đã gắn
          tag; làm luôn các bài đang đánh dấu &quot;Làm lại&quot;. Kênh còn thiếu chân dung / tuyến / template chữ thì AI soạn
          trước (có thể cần bạn duyệt rồi bấm lại). Thường mất 10-30 phút.
        </span>
      </p>
      <TextArea
        label="Ghi chú cho AI (không bắt buộc)"
        value={note}
        maxLength={noteMax ?? 500}
        onChange={(e) => setNote(e.target.value)}
        placeholder="VD: tuần này đẩy giày đi tiệc cuối năm, hook vui hơn"
      />
      {mutation.error && <FormAlert>{mutation.error.message}</FormAlert>}
    </Dialog>
  );
}

/** Xoá hẳn kỳ đã huỷ (bài đã đăng của kỳ vẫn giữ). */
function DeletePlanButton({ channelId, plan }) {
  const queryClient = useQueryClient();
  const { confirm, alert } = useConfirm();
  const remove = useMutation({
    mutationFn: () => deletePlan(channelId, plan.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: CHANNEL_KEYS.plan(channelId, plan.id) });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plans(channelId) });
    },
    onError: (err) => alert(err?.message || 'Không xoá được kỳ, vui lòng thử lại.'),
  });

  return (
    <button
      type="button"
      disabled={remove.isPending}
      aria-label="Xoá kỳ đã huỷ"
      title="Xoá kỳ"
      onClick={async () => {
        if (await confirm('Xoá hẳn kỳ đã huỷ này? Không khôi phục được (bài đã đăng vẫn giữ).', { confirmLabel: 'Xoá kỳ', danger: true })) remove.mutate();
      }}
      className="flex size-7 items-center justify-center rounded-lg text-error hover:bg-error-container/40 disabled:opacity-50"
    >
      <Icon name={remove.isPending ? 'progress_activity' : 'delete'} className={`text-lg ${remove.isPending ? 'animate-spin' : ''}`} />
    </button>
  );
}

/** Trạng thái + báo cáo của lượt lập kế hoạch gần nhất. */
function PlanJobStatus({ job, planExists, onOpenPlan }) {
  if (!job) return null;
  const running = isPlanJobRunning(job);
  const box = running
    ? 'bg-sky-50 text-sky-900'
    : job.status === 'completed'
      ? 'bg-emerald-50 text-emerald-900'
      : 'bg-error-container/60 text-on-error-container';
  const head = {
    queued: 'Đang chờ worker nhận việc lập kế hoạch...',
    processing: 'AI đang lập kế hoạch (thường 10-30 phút)...',
    completed: `Lượt lập kế hoạch lúc ${formatDateTime(job.finished_at)} đã xong.`,
    failed: `Lập kế hoạch lỗi: ${job.error_message || 'worker không lập được'}. Bấm Lập kế hoạch mới để thử lại.`,
  }[job.status];

  return (
    <div className={`space-y-1.5 rounded-xl px-3 py-2 text-xs ${box}`}>
      <p className="flex items-center gap-2 font-semibold">
        <Icon name={running ? 'progress_activity' : job.status === 'completed' ? 'check_circle' : 'error'} className={`text-base ${running ? 'animate-spin' : ''}`} />
        <span className="flex-1">{head}</span>
        {job.status === 'completed' && job.result?.plan_id && planExists && (
          <button type="button" onClick={() => onOpenPlan(job.result.plan_id)} className="shrink-0 font-bold underline">
            Xem kỳ
          </button>
        )}
      </p>
      {job.note && <p className="opacity-80">Ghi chú: {job.note}</p>}
      {job.status === 'completed' && job.result?.summary && <p className="whitespace-pre-line leading-relaxed">{job.result.summary}</p>}
    </div>
  );
}

/** Tab Kế hoạch: nút "Lập kế hoạch mới" (việc cho worker điều phối chạy AI /lap-ke-hoach) + các kỳ đã lập; kỳ chờ duyệt
 *  thì chủ shop duyệt / huỷ / bỏ bài. Kỳ đã huỷ tách sang tab con "Đã huỷ" (?view=cancelled). */
export default function PlansTab({ channel }) {
  const queryClient = useQueryClient();
  const { data, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.plans(channel.id), queryFn: () => listPlans(channel.id) });
  const { data: planJob } = useQuery({
    queryKey: CHANNEL_KEYS.planJob(channel.id),
    queryFn: () => getPlanJob(channel.id),
    refetchInterval: (q) => (isPlanJobRunning(q.state.data?.job) ? POLL_MS : false),
  });
  const [openId, setOpenId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'cancelled' ? 'cancelled' : 'active';
  const job = planJob?.job;
  const running = isPlanJobRunning(job);
  // Lượt vừa chạy xong -> tải lại danh sách kỳ + lịch
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plans(channel.id) });
      queryClient.invalidateQueries({ queryKey: ['creator', 'channels', String(channel.id), 'calendar'] });
    }
    wasRunning.current = running;
  }, [running, channel.id, queryClient]);

  const hasDraft = data?.some((p) => p.status === 'draft');
  const disabledReason = !planJob?.plan_worker
    ? 'Shop chưa được gắn worker điều phối'
    : running
      ? 'Đang có lượt lập kế hoạch chưa xong'
      : hasDraft
        ? 'Kỳ trước đang chờ duyệt: duyệt hoặc huỷ kỳ đó trước'
        : null;
  const header = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-on-surface-variant">AI lập kỳ đăng bài theo cấu hình kênh; kỳ mới chờ bạn duyệt (trừ khi bật tự duyệt).</p>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          disabled={!planJob || !!disabledReason}
          title={disabledReason ?? undefined}
          className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary disabled:opacity-50"
        >
          <Icon name="auto_awesome" className="text-base" />
          Lập kế hoạch mới
        </button>
      </div>
      {planJob && !planJob.plan_worker && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Shop chưa được gắn worker điều phối nên chưa lập kế hoạch tự động được. Liên hệ đội A51 để gắn.
        </p>
      )}
      {planJob?.plan_worker && hasDraft && !running && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Kỳ trước đang chờ duyệt: duyệt hoặc huỷ kỳ đó rồi mới lập kỳ mới.</p>
      )}
      <PlanJobStatus
        job={job}
        planExists={!!data?.some((p) => p.id === job?.result?.plan_id)}
        onOpenPlan={(id) => {
          const next = new URLSearchParams(params);
          next.delete('view');
          setParams(next, { replace: true });
          setOpenId(id);
        }}
      />
      {newOpen && <NewPlanDialog channelId={channel.id} noteMax={planJob?.note_max} onClose={() => setNewOpen(false)} />}
    </div>
  );

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-32 w-full" />;
  if (!data.length) {
    return (
      <div className="space-y-3">
        {header}
        <EmptyState icon="event_note" message="Chưa có kỳ kế hoạch nào. Bấm Lập kế hoạch mới để AI lập kỳ đầu tiên." />
      </div>
    );
  }

  const cancelledPlans = data.filter((p) => p.status === 'cancelled');
  const activePlans = data.filter((p) => p.status !== 'cancelled');
  const plans = view === 'cancelled' ? cancelledPlans : activePlans;
  const current = plans.some((p) => p.id === openId) ? openId : (plans.find((p) => p.status === 'draft')?.id ?? plans[0]?.id);

  const setView = (v) => {
    const next = new URLSearchParams(params);
    if (v === 'cancelled') next.set('view', 'cancelled');
    else next.delete('view');
    setParams(next, { replace: true });
  };
  const views = [
    { key: 'active', label: 'Đang dùng', count: activePlans.length },
    { key: 'cancelled', label: 'Đã huỷ', count: cancelledPlans.length },
  ];

  return (
    <div className="space-y-3">
      {header}
      <div className="flex gap-1" role="tablist" aria-label="Lọc kỳ kế hoạch">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              view === v.key ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {v.label} ({v.count})
          </button>
        ))}
      </div>
      {!plans.length && (
        <EmptyState
          icon="event_note"
          message={view === 'cancelled' ? 'Chưa có kỳ nào bị huỷ.' : 'Không có kỳ đang dùng. Bấm Lập kế hoạch mới để AI lập kỳ mới.'}
        />
      )}
      {plans.map((p) => (
        <Section
          key={p.id}
          title={`Kỳ ${new Date(p.start_date).toLocaleDateString('vi-VN')} · ${p.days} ngày`}
          subtitle={`${p.total_items} bài`}
          action={
            <div className="flex shrink-0 items-center gap-1">
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${PLAN_STATUS[p.status]?.className}`}>{PLAN_STATUS[p.status]?.label ?? p.status}</span>
              {p.status === 'cancelled' && <DeletePlanButton channelId={channel.id} plan={p} />}
            </div>
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
