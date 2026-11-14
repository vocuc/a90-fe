import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';
import CoverImage from '../common/CoverImage';
import { FormAlert, TextField } from '../common/Form';
import AiContentSwitch, { useAiContentToggle } from '../social/AiContentSwitch';
import { POSTS_KEY, PlatformChecks, WorkerSelect, formatSchedule, fromLocalInput, toLocalInput } from '../social/VideoPostDialogs';
import { PHOTO_MAX_COUNT, newIdempotencyKey, scheduleBatchPosts } from '../../api/social';

/** Giờ đăng dải đều (xem trước, backend chia lại y hệt): bài đầu lúc bắt đầu, bài cuối lúc kết thúc. */
const spreadTimes = (start, end, count) => {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (count <= 1 || Number.isNaN(b)) return [new Date(a).toISOString()];
  const step = (b - a) / (count - 1);
  return Array.from({ length: count }, (_, i) => new Date(a + Math.round(step * i)).toISOString());
};

const roundUpMinutes = (ms, minutes) => {
  const unit = minutes * 60_000;
  return Math.ceil(ms / unit) * unit;
};

const FIELD_KEYS = ['worker_id', 'platforms', 'start_at', 'end_at'];
const firstMessage = (v) => (Array.isArray(v) ? v[0] : v);

/**
 * "Lập lịch đăng bài" cho nhiều lô: gửi danh sách lô lên backend, backend đưa vào queue tạo dần (mỗi lô 1 bài, giờ đăng
 * dải đều trong khung giờ, giao 1 worker). Popup đóng ngay, không bắt người dùng chờ.
 * batches: lô đã chọn theo thứ tự chọn (lô đầu đăng sớm nhất). onQueued({ queued }) khi backend đã nhận.
 */
export default function ScheduleBatchesDialog({ batches, onClose, onQueued }) {
  const queryClient = useQueryClient();
  const ai = useAiContentToggle();
  const [form, setForm] = useState(() => {
    const start = roundUpMinutes(Date.now() + 10 * 60_000, 5);
    return {
      workerId: '',
      platforms: ['tiktok'],
      start: toLocalInput(start),
      end: toLocalInput(start + 4 * 3600_000),
    };
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  // Giữ khoá khi bấm lại do lỗi mạng (backend không tạo trùng), đổi khi sửa form
  const [idemKey, setIdemKey] = useState(newIdempotencyKey);

  const set =
    (field, errorKey = field) =>
    (e) => {
      setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));
      setErrors((er) => ({ ...er, [errorKey]: undefined }));
      setIdemKey(newIdempotencyKey());
    };

  const validate = () => {
    const er = {};
    if (!form.workerId) er.worker_id = 'Chọn worker đăng bài.';
    if (!form.platforms.length) er.platforms = 'Chọn ít nhất một nền tảng.';
    if (!form.start) er.start_at = 'Chọn giờ bắt đầu.';
    else if (new Date(form.start).getTime() < Date.now() - 60_000) er.start_at = 'Giờ bắt đầu đã qua.';
    if (!form.end) er.end_at = 'Chọn giờ kết thúc.';
    else if (form.start && new Date(form.end) < new Date(form.start)) er.end_at = 'Giờ kết thúc phải sau giờ bắt đầu.';
    return er;
  };

  const submit = async () => {
    const er = validate();
    setErrors(er);
    setFormError(null);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const result = await scheduleBatchPosts(
        {
          batchIds: batches.map((b) => b.id),
          workerId: Number(form.workerId),
          platforms: form.platforms,
          startAt: fromLocalInput(form.start),
          endAt: fromLocalInput(form.end),
          aiContent: ai.on,
        },
        idemKey,
      );
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
      onQueued(result);
    } catch (err) {
      const entries = Object.entries(err?.errors ?? {}).map(([k, v]) => [k.split('.')[0], firstMessage(v)]);
      const fields = Object.fromEntries(entries.filter(([k]) => FIELD_KEYS.includes(k)));
      const other = entries.find(([k]) => !FIELD_KEYS.includes(k));
      setErrors(fields);
      if (other) setFormError(other[1]);
      else if (!Object.keys(fields).length) setFormError(err?.message || 'Không lập lịch được, vui lòng thử lại.');
      setSaving(false);
    }
  };

  const preview = form.start ? spreadTimes(fromLocalInput(form.start), form.end ? fromLocalInput(form.end) : NaN, batches.length) : [];

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="h-10 rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
      >
        Huỷ
      </button>
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
      >
        <Icon name={saving ? 'progress_activity' : 'schedule_send'} className={`text-lg ${saving ? 'animate-spin' : ''}`} />
        {saving ? 'Đang gửi...' : `Lập lịch ${batches.length} bài`}
      </button>
    </>
  );

  return (
    <Dialog
      title="Lập lịch đăng bài"
      subtitle={`${batches.length} lô → ${batches.length} bài, giờ đăng dải đều trong khung giờ`}
      onClose={saving ? () => {} : onClose}
      footer={footer}
    >
      <WorkerSelect label="Worker đăng bài" value={form.workerId} onChange={set('workerId', 'worker_id')} error={errors.worker_id} />
      <PlatformChecks value={form.platforms} onChange={set('platforms')} error={errors.platforms} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Từ" icon="schedule" type="datetime-local" value={form.start} onChange={set('start', 'start_at')} error={errors.start_at} />
        <TextField label="Đến" icon="schedule" type="datetime-local" value={form.end} onChange={set('end', 'end_at')} error={errors.end_at} />
      </div>
      <AiContentSwitch toggle={ai} />
      <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
        <Icon name="info" className="text-base" />
        Mỗi lô thành một bài gồm các ảnh đã tạo xong (tối đa {PHOTO_MAX_COUNT} ảnh). Bài đầu đăng lúc bắt đầu, bài cuối lúc kết thúc, các bài
        còn lại cách đều nhau. Hệ thống tạo bài dần ở nền, bạn không cần chờ.
      </p>
      {formError && <FormAlert>{formError}</FormAlert>}
      <ul className="divide-y divide-surface-container rounded-xl border border-outline-variant/40">
        {batches.map((b, i) => (
          <li key={b.id} className="flex items-center gap-3 p-2">
            <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-surface-container">
              <CoverImage src={b.coverUrl} alt="" className="size-full" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold text-on-surface">Lô #{b.id}</span>
            <span className="shrink-0 text-xs text-on-surface-variant">{preview[i] ? formatSchedule(preview[i]) : '—'}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
