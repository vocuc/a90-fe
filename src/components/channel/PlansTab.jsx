import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { FormAlert, TextArea, TextField } from '../common/Form';
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
  reschedulePlan,
  resetPlanTimes,
  startPlanJob,
} from '../../api/channels';
import Section, { TopicBadge, formatDateTime } from './Section';

const PLAN_STATUS = {
  draft: { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Đã huỷ', className: 'bg-surface-container text-on-surface-variant' },
};

// Ngày dạng YYYY-MM-DD theo giờ máy (input type=date, API dời lịch)
const ymd = (d) => new Date(d).toLocaleDateString('sv-SE');
const dmy = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN');
const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

/** Tiêu đề kỳ: "Ngày 22/11/2026" (kỳ 1 ngày) hoặc "Ngày 22/11/2026 – 24/11/2026". */
const planTitle = (p) =>
  p.days > 1 ? `Ngày ${dmy(p.start_date)} – ${dmy(addDays(p.start_date, p.days - 1))}` : `Ngày ${dmy(p.start_date)}`;

const EDITABLE_POST = ['generating', 'pending_review', 'queued'];
/** Bài còn dời được: chưa huỷ và worker chưa nhận đăng / chưa đăng. */
const canMove = (item) => item.status !== 'cancelled' && (!item.post_status || EDITABLE_POST.includes(item.post_status));
const timeOf = (iso) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * Dời lịch (người dùng chốt 2026-11-22), giữ nguyên giờ đăng: dời toàn bộ kỳ (mọi bài lệch cùng số ngày) hoặc chọn bài
 * dời sang 1 ngày. Bài worker đã nhận đăng / đã đăng không dời được.
 */
function RescheduleDialog({ channelId, plan, onClose }) {
  const queryClient = useQueryClient();
  const items = plan.items.filter((i) => i.status !== 'cancelled');
  const movable = items.filter(canMove);
  const locked = items.length - movable.length;
  const [mode, setMode] = useState(locked ? 'pick' : 'all');
  const [date, setDate] = useState(addDays(plan.start_date, 1));
  const [picked, setPicked] = useState(() => new Set());
  const delta = date ? Math.round((new Date(`${date}T00:00:00`) - new Date(`${plan.start_date}T00:00:00`)) / 86_400_000) : 0;
  const target = (item) => {
    const day = mode === 'all' ? addDays(ymd(item.scheduled_at), delta) : date;
    return `${timeOf(item.scheduled_at)} ${dmy(day)}`;
  };
  const mutation = useMutation({
    mutationFn: () => reschedulePlan(channelId, plan.id, date, mode === 'all' ? null : [...picked]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plans(channelId) });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plan(channelId, plan.id) });
      queryClient.invalidateQueries({ queryKey: ['creator', 'channels', String(channelId), 'calendar'] });
      onClose();
    },
  });
  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const shown = mode === 'all' ? items : movable;
  const disabled = !date || mutation.isPending || (mode === 'all' ? delta === 0 || locked > 0 : picked.size === 0);

  return (
    <Dialog
      title="Dời lịch đăng"
      subtitle={`${planTitle(plan)} · giữ nguyên giờ đăng`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container">
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={disabled}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            <Icon name={mutation.isPending ? 'progress_activity' : 'event_repeat'} className={`text-lg ${mutation.isPending ? 'animate-spin' : ''}`} />
            {mode === 'all' ? 'Dời toàn bộ' : `Dời ${picked.size} bài`}
          </button>
        </>
      }
    >
      <div className="flex gap-1" role="tablist" aria-label="Cách dời lịch">
        {[
          { key: 'all', label: 'Dời toàn bộ' },
          { key: 'pick', label: 'Chọn bài' },
        ].map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mode === m.key}
            onClick={() => setMode(m.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              mode === m.key ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <TextField
        label={mode === 'all' ? (plan.days > 1 ? 'Ngày đầu kỳ mới' : 'Dời sang ngày') : 'Dời các bài đã chọn sang ngày'}
        icon="event"
        type="date"
        min={ymd(new Date())}
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      {mode === 'all' && locked > 0 && (
        <FormAlert>
          Kỳ có {locked} bài worker đã nhận đăng / đã đăng nên không dời toàn bộ được. Chuyển sang &quot;Chọn bài&quot; để dời các bài còn lại.
        </FormAlert>
      )}
      {mode === 'all' && date && delta === 0 && <p className="text-xs text-on-surface-variant">Chọn ngày khác ngày hiện tại của kỳ.</p>}
      {mode === 'pick' && (
        <div className="flex items-center justify-between gap-2 text-xs text-on-surface-variant">
          <span>
            Đã chọn {picked.size}/{movable.length} bài{locked ? ` · ${locked} bài worker đã nhận, không dời được` : ''}
          </span>
          <button
            type="button"
            onClick={() => setPicked(picked.size === movable.length ? new Set() : new Set(movable.map((i) => i.id)))}
            className="shrink-0 font-bold text-primary hover:underline"
          >
            {picked.size === movable.length ? 'Bỏ chọn hết' : 'Chọn hết'}
          </button>
        </div>
      )}
      <ul className="space-y-1.5">
        {shown.map((item) => {
          const on = mode === 'all' || picked.has(item.id);
          const Row = mode === 'pick' ? 'label' : 'div';
          return (
            <li key={item.id}>
              <Row
                className={`flex items-center gap-2 rounded-xl border p-2 text-xs ${on ? 'border-primary-container/60' : 'border-outline-variant/40'} ${
                  mode === 'pick' ? 'cursor-pointer' : ''
                }`}
              >
                {mode === 'pick' && <input type="checkbox" checked={picked.has(item.id)} onChange={() => toggle(item.id)} className="size-4 accent-primary" />}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 font-semibold text-on-surface">{item.hook}</span>
                  <span className="text-on-surface-variant">
                    {formatDateTime(item.scheduled_at)}
                    {on && date && (
                      <>
                        {' → '}
                        <b className="text-primary">{target(item)}</b>
                      </>
                    )}
                  </span>
                </span>
              </Row>
            </li>
          );
        })}
      </ul>
      {mutation.error && <FormAlert>{mutation.error.message}</FormAlert>}
    </Dialog>
  );
}

function PlanItem({ channelId, planId, item, canCancel }) {
  const queryClient = useQueryClient();
  const { confirm, alert } = useConfirm();
  // Nút X: xoá hẳn bài khỏi kỳ (kèm bài đăng chưa được worker nhận); giờ đăng đó thành thiếu bài -> "Tạo bổ sung"
  const cancel = useMutation({
    mutationFn: () => cancelPlanItem(channelId, planId, item.id),
    onError: (err) => alert(err?.message || 'Không xoá được bài, vui lòng thử lại.'),
    // Tải lại cả danh sách kỳ (số bài, số giờ thiếu bài của nút "Tạo bổ sung") + lịch
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plans(channelId) });
      queryClient.invalidateQueries({ queryKey: ['creator', 'channels', String(channelId), 'calendar'] });
    },
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
        <TopicBadge name={item.topic} />
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
        <button
          type="button"
          onClick={async () => {
            if (await confirm('Xoá bài này khỏi kỳ? Bài đăng của bài (nếu có) cũng bị xoá.', { confirmLabel: 'Xoá bài', danger: true })) cancel.mutate();
          }}
          disabled={cancel.isPending}
          aria-label="Xoá bài này"
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
  const [moving, setMoving] = useState(false);
  const [resetNote, setResetNote] = useState('');
  const { data: plan, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.plan(channelId, planId), queryFn: () => getPlan(channelId, planId) });
  const decide = useMutation({
    mutationFn: (approve) => decidePlan(channelId, planId, approve),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plans(channelId) });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plan(channelId, planId) });
      queryClient.invalidateQueries({ queryKey: ['creator', 'channels', String(channelId), 'calendar'] });
    },
  });
  // Làm mới giờ đăng theo khung giờ hiện tại (sau khi đổi khung giờ ở Cấu hình), giữ ngày
  const resetTimes = useMutation({
    mutationFn: () => resetPlanTimes(channelId, planId),
    onMutate: () => setResetNote(''),
    onSuccess: ({ moved, skipped }) => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plans(channelId) });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.plan(channelId, planId) });
      queryClient.invalidateQueries({ queryKey: ['creator', 'channels', String(channelId), 'calendar'] });
      setResetNote(
        (moved ? `Đã đổi giờ ${moved} bài theo khung giờ hiện tại.` : 'Không có bài nào cần đổi giờ.') +
          (skipped ? ` ${skipped} bài hôm nay giữ giờ cũ vì đã hết khung giờ trong ngày.` : ''),
      );
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
        {/* Kỳ chưa huỷ: bài đã huỷ (nút X bản cũ) coi như đã xoá, không hiện */}
        {plan.items.filter((item) => !open || item.status !== 'cancelled').map((item) => (
          <PlanItem key={item.id} channelId={channelId} planId={planId} item={item} canCancel={open} />
        ))}
      </ul>
      {decide.error && <FormAlert>{decide.error.message}</FormAlert>}
      {resetTimes.error && <FormAlert>{resetTimes.error.message}</FormAlert>}
      {resetNote && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{resetNote}</p>}
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
            onClick={() => setMoving(true)}
            className="flex items-center gap-1 rounded-lg border border-outline-variant/60 px-4 py-2 text-xs font-bold text-on-surface hover:border-primary-container hover:text-primary"
          >
            <Icon name="event_repeat" className="text-base" />
            Dời lịch
          </button>
        )}
        {open && (
          <button
            type="button"
            disabled={resetTimes.isPending}
            onClick={async () => {
              if (
                await confirm(
                  'Làm mới giờ đăng các bài của kỳ theo khung giờ hiện tại ở Cấu hình? Bài giữ nguyên ngày, chỉ đổi giờ; bài worker đã nhận / đã đăng không đổi.',
                  { confirmLabel: 'Làm mới giờ đăng' },
                )
              )
                resetTimes.mutate();
            }}
            className="flex items-center gap-1 rounded-lg border border-outline-variant/60 px-4 py-2 text-xs font-bold text-on-surface hover:border-primary-container hover:text-primary disabled:opacity-50"
          >
            <Icon name={resetTimes.isPending ? 'progress_activity' : 'schedule'} className={`text-base ${resetTimes.isPending ? 'animate-spin' : ''}`} />
            Làm mới giờ đăng
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
      {moving && <RescheduleDialog channelId={channelId} plan={plan} onClose={() => setMoving(false)} />}
    </div>
  );
}

// Lượt lập kế hoạch đang chạy: tải lại mỗi 15 giây để thấy kết quả
const POLL_MS = 15_000;

/**
 * Lập kế hoạch mới, hoặc "Tạo bổ sung" cho 1 kỳ (fillPlan: kỳ đó, worker xem từng ngày của kỳ, slot nào chưa có bài thì
 * soạn bổ sung): ghi chú (không bắt buộc) -> việc cho worker điều phối chạy AI.
 */
function NewPlanDialog({ channelId, noteMax, fillPlan = null, onClose }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const mutation = useMutation({
    mutationFn: () => startPlanJob(channelId, note, fillPlan?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.planJob(channelId) });
      onClose();
    },
  });

  return (
    <Dialog
      title={fillPlan ? 'Tạo bổ sung cho kỳ' : 'Lập kế hoạch mới'}
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
            {fillPlan ? 'Bắt đầu bổ sung' : 'Bắt đầu lập'}
          </button>
        </>
      }
    >
      <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
        <Icon name="info" className="text-base" />
        {fillPlan ? (
          <span>
            AI xem lại từng ngày của kỳ, giờ đăng nào chưa có bài (chưa lập, bài đã huỷ hoặc bài đăng đã bị xoá) thì soạn bài bổ
            sung, cùng tuyến nội dung và chủ đề với kỳ (tính theo cấu hình kênh hiện tại).{' '}
            {fillPlan.missing_slots ? `Hiện kỳ thiếu ${fillPlan.missing_slots} bài. ` : ''}
            {fillPlan.status === 'approved' ? 'Kỳ đã duyệt: bài bổ sung vào lịch đăng luôn.' : 'Kỳ chờ duyệt: bài bổ sung chờ bạn duyệt cùng kỳ.'}
          </span>
        ) : (
          <span>
            AI lập kỳ mới theo cấu hình kênh (số ngày, số bài / ngày, khung giờ), tuyến nội dung, chủ đề đang bật và sản phẩm đã
            gắn tag; làm luôn các bài đang đánh dấu &quot;Làm lại&quot;. Kênh còn thiếu chân dung / tuyến / template chữ thì AI
            soạn trước (có thể cần bạn duyệt rồi bấm lại). Thường mất 10-30 phút.
          </span>
        )}
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

/** Trạng thái lượt lập kế hoạch gần nhất: chỉ hiện khi đang chạy hoặc lỗi (xong thì ẩn, kỳ mới đã ở danh sách bên dưới). */
function PlanJobStatus({ job, planExists, onOpenPlan }) {
  // superseded: việc "Tạo bổ sung" của kỳ đã huỷ, không còn giao worker
  if (!job || job.status === 'completed' || job.status === 'superseded') return null;
  const running = isPlanJobRunning(job);
  const box = running
    ? 'bg-sky-50 text-sky-900'
    : job.status === 'completed'
      ? 'bg-emerald-50 text-emerald-900'
      : 'bg-error-container/60 text-on-error-container';
  const what = job.fill_plan_id ? 'tạo bổ sung kỳ' : job.redo ? 'làm lại bài' : 'lập kế hoạch';
  const head = {
    queued: `Đang chờ worker nhận việc ${what}...`,
    processing: `AI đang ${what} (thường 10-30 phút)...`,
    completed: `Lượt ${what} lúc ${formatDateTime(job.finished_at)} đã xong.`,
    failed: `${job.fill_plan_id ? 'Tạo bổ sung' : 'Lập kế hoạch'} lỗi: ${job.error_message || 'worker không làm được'}. Bấm lại để thử lại.`,
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
  // Kỳ đang mở hộp "Tạo bổ sung"
  const [fillPlan, setFillPlan] = useState(null);
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
      {fillPlan && <NewPlanDialog channelId={channel.id} noteMax={planJob?.note_max} fillPlan={fillPlan} onClose={() => setFillPlan(null)} />}
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
          title={planTitle(p)}
          subtitle={`${p.total_items} bài`}
          action={
            <div className="flex shrink-0 items-center gap-1">
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${PLAN_STATUS[p.status]?.className}`}>{PLAN_STATUS[p.status]?.label ?? p.status}</span>
              {p.status === 'cancelled' && <DeletePlanButton channelId={channel.id} plan={p} />}
              {(p.status === 'draft' || p.status === 'approved') && (
                <button
                  type="button"
                  // Luôn bấm được (người dùng chốt 2026-11-21): không được thì hộp thoại báo lý do (kỳ đủ bài, đang có lượt chạy...)
                  onClick={() => setFillPlan(p)}
                  title={p.missing_slots ? `Còn ${p.missing_slots} giờ đăng chưa có bài` : 'Bổ sung bài cho giờ đăng còn thiếu của kỳ'}
                  className="flex h-7 items-center gap-1 rounded-lg border border-outline-variant/60 px-2 text-[11px] font-bold text-on-surface hover:border-primary-container hover:text-primary"
                >
                  <Icon name="playlist_add" className="text-base" />
                  Tạo bổ sung{p.missing_slots ? ` (${p.missing_slots})` : ''}
                </button>
              )}
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
