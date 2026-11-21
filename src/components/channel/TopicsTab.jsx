import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { TextArea, TextField } from '../common/Form';
import { useConfirm } from '../common/ConfirmDialog';
import TagPicker from '../product/TagPicker';
import { tagChips } from '../../api/productTags';
import {
  CHANNEL_KEYS,
  TOPIC_STATUS,
  createTopic,
  getTopics,
  isTopicJobRunning,
  listPostSamples,
  startTopicJob,
  updateTopic,
} from '../../api/channels';
import Section, { formatDateTime } from './Section';

const NAME_MAX = 80;
const NOTE_MAX = 500;
// Lượt tự động đang chạy: tải lại mỗi 10 giây để thấy kết quả
const POLL_MS = 10_000;

const formatDate = (ymd) => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '');

const footerButtons = (onClose, onSubmit, pending, disabled, label) => (
  <>
    <button type="button" onClick={onClose} className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container">
      Huỷ
    </button>
    <button
      type="button"
      onClick={onSubmit}
      disabled={pending || disabled}
      className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
    >
      <Icon name={pending ? 'progress_activity' : 'save'} className={`text-lg ${pending ? 'animate-spin' : ''}`} />
      {label}
    </button>
  </>
);

const ErrorBox = ({ children }) =>
  children ? (
    <p role="alert" className="rounded-xl bg-error-container/60 px-3 py-2 text-xs text-on-error-container">
      {children}
    </p>
  ) : null;

/** Thêm (topic = null, xây dựng thủ công) hoặc sửa chủ đề: tên + bộ lọc tag sản phẩm. Sửa -> nguồn "Shop sửa". */
function TopicDialog({ channelId, topic, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(topic?.name ?? '');
  const [tags, setTags] = useState(topic?.tags ?? {});
  const mutation = useMutation({
    mutationFn: () => (topic ? updateTopic(channelId, topic.id, { name: name.trim(), tags }) : createTopic(channelId, { name: name.trim(), tags })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.topics(channelId) });
      onClose();
    },
  });
  const error = mutation.error && (mutation.error.errors?.name || mutation.error.errors?.tags || mutation.error.message);

  return (
    <Dialog
      title={topic ? 'Sửa chủ đề' : 'Xây dựng chủ đề thủ công'}
      onClose={onClose}
      footer={footerButtons(onClose, () => mutation.mutate(), mutation.isPending, !name.trim(), topic ? 'Lưu chủ đề' : 'Thêm chủ đề')}
    >
      <TextField
        label="Tên chủ đề"
        value={name}
        maxLength={NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        placeholder="VD: Đi chúc Tết"
        hint="Chủ đề cụ thể (dịp + tình huống). Mọi loại bài đều dùng chung chủ đề này."
      />
      <div>
        <p className="mb-1 text-xs font-semibold text-on-surface">Tìm sản phẩm theo tag</p>
        <p className="mb-2 text-[11px] text-on-surface-variant">
          Bài cần sản phẩm (VD Top N) chọn sản phẩm có tag khớp: trong 1 nhóm chỉ cần khớp 1 giá trị, các nhóm đều phải khớp. Bỏ
          trống nhóm = không lọc theo nhóm đó.
        </p>
        <TagPicker value={tags} onChange={setTags} filter />
      </div>
      <ErrorBox>{error}</ErrorBox>
    </Dialog>
  );
}

/** Xây dựng chủ đề tự động: số chủ đề + ghi chú -> việc cho worker lập chủ đề (skill Claude /lap-chu-de). */
function AutoBuildDialog({ channelId, limits, onClose }) {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(limits?.default ?? 10);
  const [note, setNote] = useState('');
  const mutation = useMutation({
    mutationFn: () => startTopicJob(channelId, { count, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.topics(channelId) });
      onClose();
    },
  });
  const min = limits?.min ?? 1;
  const max = limits?.max ?? 30;
  const valid = Number(count) >= min && Number(count) <= max;

  return (
    <Dialog
      title="Xây dựng chủ đề tự động"
      onClose={onClose}
      footer={footerButtons(onClose, () => mutation.mutate(), mutation.isPending, !valid, 'Bắt đầu')}
    >
      <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
        <Icon name="info" className="text-base" />
        <span>
          Worker lập chủ đề dùng AI đọc chân dung khách hàng, ngày lễ sắp tới, sản phẩm đã gắn tag và chủ đề đang có để đề xuất
          chủ đề mới. Chủ đề trùng tên được bỏ qua. Thường mất vài phút.
        </span>
      </p>
      <TextField
        label={`Số chủ đề (${min} - ${max})`}
        type="number"
        min={min}
        max={max}
        value={count}
        onChange={(e) => setCount(e.target.value)}
        error={!valid ? `Nhập từ ${min} đến ${max}.` : undefined}
      />
      <TextArea
        label="Ghi chú cho AI (không bắt buộc)"
        value={note}
        maxLength={NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        placeholder="VD: tập trung Tết và đi làm, tránh chủ đề đi biển"
      />
      <ErrorBox>{mutation.error?.errors?.count || mutation.error?.message}</ErrorBox>
    </Dialog>
  );
}

/** Trạng thái lượt xây dựng tự động gần nhất. */
function JobStatus({ job }) {
  if (!job) return null;
  const running = isTopicJobRunning(job);
  const box = running
    ? 'bg-sky-50 text-sky-900'
    : job.status === 'completed'
      ? 'bg-emerald-50 text-emerald-900'
      : 'bg-error-container/60 text-on-error-container';
  const text = {
    queued: `Đang chờ worker lập chủ đề nhận việc (${job.count} chủ đề)...`,
    processing: `AI đang lập ${job.count} chủ đề...`,
    completed: `Lượt tự động lúc ${formatDateTime(job.finished_at)}: thêm ${job.result?.created ?? 0} chủ đề${
      job.result?.skipped ? `, bỏ qua ${job.result.skipped} chủ đề trùng` : ''
    }${job.result?.errors ? `, ${job.result.errors} chủ đề sai` : ''}.`,
    failed: `Lượt tự động lỗi: ${job.error_message || 'worker không lập được chủ đề'}. Bấm xây dựng lại.`,
  }[job.status];

  return (
    <p className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${box}`}>
      <Icon name={running ? 'progress_activity' : job.status === 'completed' ? 'check_circle' : 'error'} className={`text-base ${running ? 'animate-spin' : ''}`} />
      {text}
    </p>
  );
}

/**
 * Tab Chủ đề: chủ đề của kênh, dùng chung mọi loại bài (cùng chủ đề + cùng loại bài không lặp trong 14 ngày). Chủ đề có
 * từ "Xây dựng tự động" (worker lập chủ đề) hoặc "Xây dựng thủ công"; lệnh lập kế hoạch chỉ chọn chủ đề có sẵn.
 * Chủ shop sửa tên / tag, tạm tắt. Sau này thống kê view theo chủ đề.
 */
export default function TopicsTab({ channel }) {
  const queryClient = useQueryClient();
  const { alert } = useConfirm();
  // null | { topic } (sửa) | { topic: null } (thêm thủ công)
  const [editing, setEditing] = useState(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const { data, error, refetch } = useQuery({
    queryKey: CHANNEL_KEYS.topics(channel.id),
    queryFn: () => getTopics(channel.id),
    refetchInterval: (q) => (isTopicJobRunning(q.state.data?.job) ? POLL_MS : false),
  });
  const { data: samples } = useQuery({ queryKey: CHANNEL_KEYS.samples, queryFn: listPostSamples, staleTime: 5 * 60_000 });
  const sampleName = (key) => samples?.items.find((s) => s.key === key)?.name ?? key;
  const toggle = useMutation({
    mutationFn: (t) => updateTopic(channel.id, t.id, { status: t.status === TOPIC_STATUS.ACTIVE ? TOPIC_STATUS.PAUSED : TOPIC_STATUS.ACTIVE }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.topics(channel.id) }),
    onError: (err) => alert(err?.message || 'Không đổi được trạng thái chủ đề, vui lòng thử lại.'),
  });
  const topics = data?.topics;
  const running = isTopicJobRunning(data?.job);

  const actions = data && (
    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
      <button
        type="button"
        onClick={() => setEditing({ topic: null })}
        className="flex h-8 items-center gap-1 rounded-lg border border-outline-variant/60 px-3 text-xs font-bold text-on-surface hover:border-primary-container hover:text-primary"
      >
        <Icon name="edit_note" className="text-base" />
        Thủ công
      </button>
      <button
        type="button"
        onClick={() => setAutoOpen(true)}
        disabled={running || !data.topic_worker}
        title={!data.topic_worker ? 'Shop chưa được gắn worker lập chủ đề' : running ? 'Đang có lượt chưa xong' : undefined}
        className="flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary disabled:opacity-50"
      >
        <Icon name="auto_awesome" className="text-base" />
        Tự động
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Section
        title="Chủ đề"
        subtitle="Kế hoạch đăng bài chỉ chọn trong các chủ đề ở đây (hook viết theo chủ đề; cùng chủ đề và cùng loại bài không lặp trong 14 ngày). Xây dựng tự động bằng AI hoặc thêm thủ công; tạm tắt chủ đề để không dùng nữa."
        action={actions}
      >
        {data && !data.topic_worker && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Shop chưa được gắn worker lập chủ đề nên chưa xây dựng tự động được. Liên hệ đội A51 để gắn, hoặc thêm chủ đề thủ công.
          </p>
        )}
        {data?.job && <JobStatus job={data.job} />}
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !topics ? (
          <Skeleton className="h-24 w-full" />
        ) : !topics.length ? (
          <EmptyState icon="tag" message="Chưa có chủ đề. Bấm Tự động để AI xây dựng, hoặc Thủ công để tự thêm." />
        ) : (
          <ul className="space-y-2">
            {topics.map((t) => {
              const paused = t.status !== TOPIC_STATUS.ACTIVE;
              const chips = tagChips(t.tags);
              const used = Object.entries(t.posts ?? {});
              return (
                <li key={t.id} className={`rounded-xl border border-outline-variant/40 p-3 ${paused ? 'bg-surface-container-low' : ''}`}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-on-surface">
                        <span className={paused ? 'text-on-surface-variant line-through' : ''}>{t.name}</span>
                        <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
                          {t.source === 'ai' ? 'AI tạo' : 'Shop tạo / sửa'}
                        </span>
                        {paused && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Tạm tắt</span>}
                      </p>
                      {chips.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {chips.map((c) => (
                            <span key={`${c.field}-${c.value}`} className="rounded bg-surface-container px-1.5 py-0.5 text-[11px] text-on-surface-variant">
                              {c.label}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-on-surface-variant">
                        {used.length
                          ? used.map(([key, n]) => `${sampleName(key)}: ${n} bài (gần nhất ${formatDate(t.last_used?.[key])})`).join(' · ')
                          : 'Chưa có bài'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing({ topic: t })}
                        aria-label={`Sửa chủ đề ${t.name}`}
                        className="flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
                      >
                        <Icon name="edit" className="text-lg" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle.mutate(t)}
                        disabled={toggle.isPending}
                        aria-label={paused ? `Bật lại chủ đề ${t.name}` : `Tạm tắt chủ đề ${t.name}`}
                        title={paused ? 'Bật lại' : 'Tạm tắt'}
                        className="flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
                      >
                        <Icon name={paused ? 'play_circle' : 'pause_circle'} className="text-lg" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      {editing && <TopicDialog channelId={channel.id} topic={editing.topic} onClose={() => setEditing(null)} />}
      {autoOpen && <AutoBuildDialog channelId={channel.id} limits={data?.count} onClose={() => setAutoOpen(false)} />}
    </div>
  );
}
