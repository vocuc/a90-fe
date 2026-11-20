import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../common/Icon';
import { useConfirm } from '../common/ConfirmDialog';
import SuccessDialog from '../common/SuccessDialog';
import { FormAlert, SelectField, SubmitButton, TextArea, TextField } from '../common/Form';
import HashtagInput from '../template/HashtagInput';
import { hashtagSlug } from '../../utils/hashtag';
import { CHANNEL_KEYS, deleteChannel, listChannelWorkers, updateChannel } from '../../api/channels';
import Section, { Switch } from './Section';

const digits = (v, len = 4) => v.replace(/\D/g, '').slice(0, len);

const toForm = (c) => ({
  name: c.name,
  workerId: c.worker ? String(c.worker.id) : '',
  planDays: String(c.planDays),
  postsPerDay: String(c.postsPerDay),
  timeSlots: c.timeSlots.length ? c.timeSlots : [{ start: '11:00', end: '13:00' }],
  videoPercent: String(c.videoPercent),
  autoApproveLineup: c.autoApproveLineup,
  autoApproveTemplates: c.autoApproveTemplates,
  autoApprovePlan: c.autoApprovePlan,
  titleMax: String(c.titleMax),
  contentMax: String(c.contentMax),
  requirements: c.requirements,
  hashtags: c.hashtags,
});

/** Tab Cấu hình: kế hoạch, khung giờ, công tắc tự duyệt, cài đặt AI viết nội dung + kho hashtag, worker, xoá kênh. */
export default function SettingsTab({ channel }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm, alert } = useConfirm();
  const [form, setForm] = useState(() => toForm(channel));
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(toForm(channel)), [channel]);
  const { data: workers } = useQuery({ queryKey: CHANNEL_KEYS.workers, queryFn: listChannelWorkers });
  const workerOptions = (workers ?? []).filter((w) => !w.channelId || w.channelId === channel.id);
  const limits = channel.limits;

  const mutation = useMutation({
    mutationFn: (values) => updateChannel(channel.id, values),
    onSuccess: (c) => {
      queryClient.setQueryData(CHANNEL_KEYS.detail(channel.id), c);
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.workers });
      setSaved(true);
    },
  });
  const errors = mutation.error?.errors ?? {};
  const change = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
    mutation.reset();
  };
  const setSlot = (i, patch) => change({ timeSlots: form.timeSlots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const taken = new Set(form.hashtags.map(hashtagSlug));
  const fromProducts = channel.productHashtags.filter((t) => !taken.has(hashtagSlug(t)));

  const submit = (e) => {
    e.preventDefault();
    mutation.mutate({
      name: form.name,
      ...(form.workerId ? { workerId: Number(form.workerId) } : {}),
      planDays: Number(form.planDays),
      postsPerDay: Number(form.postsPerDay),
      timeSlots: form.timeSlots,
      videoPercent: Number(form.videoPercent || 0),
      autoApproveLineup: form.autoApproveLineup,
      autoApproveTemplates: form.autoApproveTemplates,
      autoApprovePlan: form.autoApprovePlan,
      titleMax: Number(form.titleMax),
      contentMax: Number(form.contentMax),
      requirements: form.requirements,
      hashtags: form.hashtags,
    });
  };

  const remove = async () => {
    if (!(await confirm(`Xoá kênh "${channel.name}"? Kế hoạch, tuyến nội dung, template chữ của kênh cũng bị xoá.`, { confirmLabel: 'Xoá kênh', danger: true }))) return;
    try {
      await deleteChannel(channel.id);
      await queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all });
      navigate('/channels');
    } catch (err) {
      alert(err?.message || 'Không xoá được kênh.');
    }
  };

  return (
    <form className="grid items-start gap-4 lg:grid-cols-2" onSubmit={submit}>
      <Section title="Kênh">
        <TextField label="Tên kênh" icon="badge" value={form.name} maxLength={100} onChange={(e) => change({ name: e.target.value })} error={errors.name} />
        <SelectField label="Worker đăng bài" value={form.workerId} onChange={(e) => change({ workerId: e.target.value })} error={errors.worker_id}
          hint="Đổi worker: bài chưa đăng của kênh chuyển sang worker mới.">
          {!form.workerId && <option value="">Chọn worker</option>}
          {workerOptions.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </SelectField>
      </Section>

      <Section title="Kế hoạch" subtitle="Đội A51 lập kế hoạch theo cấu hình này.">
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Số ngày / kỳ" inputMode="numeric" value={form.planDays} onChange={(e) => change({ planDays: digits(e.target.value, 2) })}
            error={errors.plan_days} hint={`1-${limits.plan_days}`} />
          <TextField label="Số bài / ngày" inputMode="numeric" value={form.postsPerDay} onChange={(e) => change({ postsPerDay: digits(e.target.value, 2) })}
            error={errors.posts_per_day} hint={`1-${limits.posts_per_day}`} />
          <TextField label="% bài video" inputMode="numeric" value={form.videoPercent} onChange={(e) => change({ videoPercent: digits(e.target.value, 3) })}
            error={errors.video_percent} hint="0-100" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-on-surface">Khung giờ đăng (số bài chia đều vào các khung, giờ ngẫu nhiên trong khung)</p>
          {form.timeSlots.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="time" value={slot.start} onChange={(e) => setSlot(i, { start: e.target.value })} aria-label={`Khung ${i + 1} bắt đầu`}
                className="rounded-xl border-outline-variant/40 bg-surface-container-low text-sm" />
              <span className="text-xs text-outline">đến</span>
              <input type="time" value={slot.end} onChange={(e) => setSlot(i, { end: e.target.value })} aria-label={`Khung ${i + 1} kết thúc`}
                className="rounded-xl border-outline-variant/40 bg-surface-container-low text-sm" />
              {form.timeSlots.length > 1 && (
                <button type="button" aria-label="Xoá khung giờ" onClick={() => change({ timeSlots: form.timeSlots.filter((_, j) => j !== i) })}
                  className="flex size-8 items-center justify-center rounded-lg text-error hover:bg-error-container/40">
                  <Icon name="close" className="text-lg" />
                </button>
              )}
            </div>
          ))}
          {form.timeSlots.length < limits.time_slots && (
            <button type="button" onClick={() => change({ timeSlots: [...form.timeSlots, { start: '19:00', end: '22:00' }] })}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
              <Icon name="add" className="text-base" />
              Thêm khung giờ
            </button>
          )}
          {(errors.time_slots || Object.keys(errors).some((k) => k.startsWith('time_slots.'))) && (
            <p className="text-xs text-error">{errors.time_slots ?? 'Giờ dạng HH:MM.'}</p>
          )}
        </div>
      </Section>

      <Section title="Duyệt tự động" subtitle="Bật thì nội dung đội A51 soạn được dùng ngay, không chờ bạn duyệt.">
        <Switch checked={form.autoApproveLineup} onChange={(v) => change({ autoApproveLineup: v })} label="Tuyến nội dung" hint="Bài viết mẫu nào dùng và tỉ lệ." />
        <Switch checked={form.autoApproveTemplates} onChange={(v) => change({ autoApproveTemplates: v })} label="Template chữ" hint="Kiểu chữ chèn lên ảnh." />
        <Switch checked={form.autoApprovePlan} onChange={(v) => change({ autoApprovePlan: v })} label="Kế hoạch" hint="Kỳ kế hoạch mới tự thành bài đăng theo lịch." />
      </Section>

      <Section title="AI viết nội dung" subtitle="Dùng khi lập kế hoạch và khi bạn bật AI viết nội dung lúc tạo bài tay.">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Tiêu đề tối đa" inputMode="numeric" value={form.titleMax} onChange={(e) => change({ titleMax: digits(e.target.value) })}
            error={errors.title_max} hint={`${limits.title_max.min}-${limits.title_max.max} ký tự`} />
          <TextField label="Nội dung tối đa" inputMode="numeric" value={form.contentMax} onChange={(e) => change({ contentMax: digits(e.target.value) })}
            error={errors.content_max} hint={`${limits.content_max.min}-${limits.content_max.max} ký tự`} />
        </div>
        <TextArea label="Yêu cầu" value={form.requirements} maxLength={limits.requirements} onChange={(e) => change({ requirements: e.target.value })}
          error={errors.requirements} placeholder={'Viết luôn giọng văn, cách xưng hô vào đây. Ví dụ:\n- Luôn gọi người xem là các nàng\n- Không dùng icon cuối tiêu đề'}
          hint="AI luôn làm theo trong mọi bài." />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-on-surface">Kho hashtag (AI chọn tối đa {limits.ai_hashtags} hashtag trong kho)</p>
          <HashtagInput value={form.hashtags} onChange={(next) => change({ hashtags: next })} max={limits.hashtags} error={errors.hashtags}
            hint="Nhấn Enter hoặc dấu phẩy để thêm. Để trống thì bài không có hashtag." />
          {fromProducts.length > 0 && (
            <button type="button" onClick={() => change({ hashtags: [...form.hashtags, ...fromProducts].slice(0, limits.hashtags) })}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
              <Icon name="playlist_add" className="text-base" />
              Lấy {fromProducts.length} hashtag từ sản phẩm
            </button>
          )}
        </div>
      </Section>

      <div className="space-y-3 lg:col-span-2 lg:mx-auto lg:w-full lg:max-w-md">
      {mutation.error && !mutation.error.errors && <FormAlert>{mutation.error.message}</FormAlert>}
      {saved && <SuccessDialog title="Đã lưu cấu hình" message={`Cấu hình kênh "${channel.name}" đã được cập nhật.`} onClose={() => setSaved(false)} />}
      <SubmitButton loading={mutation.isPending} loadingText="Đang lưu...">
        Lưu cấu hình
      </SubmitButton>

      <button type="button" onClick={remove} className="flex w-full items-center justify-center gap-1 py-2 text-xs font-bold text-error hover:underline">
        <Icon name="delete" className="text-base" />
        Xoá kênh
      </button>
      </div>
    </form>
  );
}
