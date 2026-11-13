import { useState } from 'react';
import Icon from '../common/Icon';
import { useConfirm } from '../common/ConfirmDialog';
import { PLAN_IMAGES_FAILED, POST_STATUS, redoPlanPost } from '../../api/social';
import { formatSchedule } from './VideoPostDialogs';

/** Nhãn nhỏ "Kế hoạch" cho bài do skill kế hoạch nội dung tạo. */
export function PlanBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded bg-violet-100 px-1 text-[11px] font-bold text-violet-700 ${className}`}>
      <Icon name="event_note" className="text-xs" />
      Kế hoạch
    </span>
  );
}

// Làm lại được: chỉ khi đang chờ duyệt (đã duyệt thì bỏ duyệt trước)
export const canRedoPlan = (post) => !!post.plan && post.status === POST_STATUS.AWAITING_APPROVAL;

// Bỏ duyệt được: đã duyệt (chờ gửi) và chưa bấm đăng lần nào
export const canUnapprovePlan = (post) => !!post.plan && post.status === POST_STATUS.PENDING_REVIEW && !post.platforms.length;

// Hủy đăng được: đã bấm đăng nhưng worker chưa nhận (chờ đăng, mọi nền tảng đều đang chờ)
export const canCancelQueuedPlan = (post) =>
  !!post.plan && post.status === POST_STATUS.QUEUED && post.platforms.length > 0 && post.platforms.every((p) => p.status === 'queued');

/**
 * Kịch bản của bài kế hoạch: bối cảnh, sản phẩm, giờ đăng theo kế hoạch, ý chính, câu lệnh từng ảnh.
 * onRedone(post): có thì hiện nút "Làm lại" (khi canRedoPlan).
 */
export default function PlanScript({ post, onRedone }) {
  const { confirm, alert } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const { plan } = post;
  if (!plan) return null;

  const imagesFailed = post.lastError?.code === PLAN_IMAGES_FAILED;
  const showRedo = onRedone && canRedoPlan(post);

  const redo = async () => {
    const ok = await confirm('Bỏ ảnh và nội dung hiện tại, tạo lại toàn bộ ảnh theo đúng kịch bản này? (miễn phí)', {
      confirmLabel: 'Làm lại',
    });
    if (!ok) return;
    setBusy(true);
    try {
      onRedone(await redoPlanPost(post.id));
    } catch (e) {
      await alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PlanBadge />
        {plan.context && (
          <span className="text-on-surface-variant">
            Bối cảnh <b className="text-on-surface">{plan.context.name}</b>
          </span>
        )}
        {plan.product && (
          <span className="text-on-surface-variant">
            · Sản phẩm <b className="text-on-surface">{plan.product.name}</b>
          </span>
        )}
        {post.scheduledAt && (
          <span className="text-on-surface-variant">
            · Giờ đăng dự kiến <b className="text-on-surface">{formatSchedule(post.scheduledAt)}</b>
          </span>
        )}
      </div>

      {imagesFailed && (
        <p className="flex items-start gap-2 rounded-xl bg-error-container/60 px-3 py-2 text-on-error-container">
          <Icon name="error" className="text-base" />
          <span>{post.lastError.message}</span>
        </p>
      )}

      {plan.idea && (
        <p className="text-on-surface">
          <span className="font-semibold text-on-surface-variant">Ý chính: </span>
          {plan.idea}
        </p>
      )}

      {!!plan.items.length && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1 font-semibold text-violet-700 hover:underline"
          >
            <Icon name={open ? 'expand_less' : 'expand_more'} className="text-base" />
            Câu lệnh từng ảnh ({plan.items.length})
          </button>
          {open && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-on-surface-variant">
              {plan.items.map((item, i) => (
                <li key={i} className="whitespace-pre-line">
                  {item}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {showRedo && (
        <button
          type="button"
          onClick={redo}
          disabled={busy}
          className="flex h-9 items-center gap-1 rounded-lg border border-violet-300 bg-white px-3 font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
        >
          <Icon name={busy ? 'progress_activity' : 'refresh'} className={`text-base ${busy ? 'animate-spin' : ''}`} />
          Làm lại theo kịch bản
        </button>
      )}
    </section>
  );
}
