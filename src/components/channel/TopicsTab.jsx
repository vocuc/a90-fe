import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { TextArea, TextField } from '../common/Form';
import { useConfirm } from '../common/ConfirmDialog';
import {
  CHANNEL_KEYS,
  OTHER_TOPIC_CATEGORY,
  TOPIC_STATUS,
  createTopic,
  createTopicCategory,
  deleteTopic,
  deleteTopicCategory,
  getTopics,
  isTopicJobRunning,
  listPostSamples,
  orderTopicCategories,
  startTopicJob,
  updateTopic,
  updateTopicCategory,
} from '../../api/channels';
import Section, { formatDateTime } from './Section';

const NAME_MAX = 80;
// Ghi chú chủ đề (topic.note) / ghi chú lượt tự động
const TOPIC_NOTE_MAX = 1000;
const NOTE_MAX = 500;
// Lượt tự động đang chạy: tải lại mỗi 10 giây để thấy kết quả
const POLL_MS = 10_000;

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

/**
 * Thêm (topic = null, xây dựng thủ công) hoặc sửa chủ đề: tên + nhóm + ghi chú (không bắt buộc). Sửa -> nguồn "Shop sửa".
 * Thêm mới để nhóm "Tự đoán": backend đoán nhóm theo tên ("Tết" -> Sự kiện).
 */
function TopicDialog({ channelId, topic, categories, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(topic?.name ?? '');
  // '' = tự đoán (chỉ khi thêm), null = "Khác", số = id nhóm
  const [category, setCategory] = useState(topic ? topic.category_id ?? null : '');
  const [note, setNote] = useState(topic?.note ?? '');
  const values = () => ({ name: name.trim(), note, ...(category !== '' ? { category_id: category } : {}) });
  const mutation = useMutation({
    mutationFn: () => (topic ? updateTopic(channelId, topic.id, values()) : createTopic(channelId, values())),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.topics(channelId) });
      onClose();
    },
  });
  const error =
    mutation.error && (mutation.error.errors?.name || mutation.error.errors?.category_id || mutation.error.errors?.note || mutation.error.message);

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
        <p className="mb-1.5 text-xs font-semibold text-on-surface">Nhóm</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            ...(topic ? [] : [{ id: '', name: 'Tự đoán' }]),
            ...(categories ?? []),
            { id: null, name: OTHER_TOPIC_CATEGORY },
          ].map((c) => (
            <button
              key={c.id ?? 'other'}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`h-8 rounded-full border px-3 text-xs font-semibold ${
                category === c.id
                  ? 'border-primary-container bg-primary-container text-on-primary'
                  : 'border-outline-variant/60 text-on-surface-variant hover:border-primary-container hover:text-primary'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <TextArea
        label="Ghi chú (không bắt buộc)"
        value={note}
        maxLength={TOPIC_NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        placeholder="VD: Khách đi chúc Tết nhà nội ngoại, cần sang mà vẫn đi cả ngày được. Ưu tiên cao gót vừa, màu đỏ / kem; tránh kiểu quá cá tính."
        hint="AI lập kế hoạch đọc ghi chú để chọn sản phẩm và viết hook. Bỏ trống: AI tự do sáng tạo theo tên chủ đề."
      />
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
        <Icon name="info" className="shrink-0 text-base" />
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

const HOOK_STATUS = {
  draft: 'Chờ duyệt kỳ',
  generating: 'Đang chuẩn bị',
  pending_review: 'Chờ duyệt',
  queued: 'Chờ đăng',
  publishing: 'Đang đăng',
  published: 'Đã đăng',
  failed: 'Lỗi',
};

// Backend trả tối đa ChannelTopicService::HOOKS_PER_TOPIC hook gần nhất mỗi chủ đề
const HOOKS_MAX = 50;

/** Chủ đề -> [{ key, name, topics }] theo thứ tự nhóm của kênh, cuối là "Khác" (chưa xếp nhóm); nhóm rỗng không hiện. */
const groupTopics = (topics, categories = []) => {
  const known = new Set(categories.map((c) => c.id));
  return [
    ...categories.map((c) => ({ key: c.id, name: c.name, topics: topics.filter((t) => t.category_id === c.id) })),
    { key: 'other', name: OTHER_TOPIC_CATEGORY, topics: topics.filter((t) => !known.has(t.category_id)) },
  ].filter((g) => g.topics.length);
};

/**
 * Quản lý nhóm chủ đề của kênh: thêm, đổi tên (Enter / rời ô), lên / xuống, xoá (chủ đề của nhóm về "Khác").
 * "Khác" là nhóm sẵn cho chủ đề chưa xếp nhóm, không sửa được.
 */
function CategoryDialog({ channelId, categories, onClose }) {
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const [names, setNames] = useState(() => Object.fromEntries(categories.map((c) => [c.id, c.name])));
  const [adding, setAdding] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.topics(channelId) });
  const add = useMutation({ mutationFn: () => createTopicCategory(channelId, adding.trim()), onSuccess: () => { setAdding(''); refresh(); } });
  const rename = useMutation({ mutationFn: ({ id, name }) => updateTopicCategory(channelId, id, name), onSuccess: refresh });
  const order = useMutation({ mutationFn: (ids) => orderTopicCategories(channelId, ids), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id) => deleteTopicCategory(channelId, id), onSuccess: refresh });
  const move = (i, step) => {
    const ids = categories.map((c) => c.id);
    [ids[i], ids[i + step]] = [ids[i + step], ids[i]];
    order.mutate(ids);
  };
  const saveName = (c) => {
    const name = (names[c.id] ?? '').trim();
    if (name && name !== c.name) rename.mutate({ id: c.id, name });
    else setNames((n) => ({ ...n, [c.id]: c.name }));
  };
  const askRemove = async (c) => {
    const message = c.topics
      ? `Xoá nhóm "${c.name}"? ${c.topics} chủ đề trong nhóm chuyển về "${OTHER_TOPIC_CATEGORY}".`
      : `Xoá nhóm "${c.name}"?`;
    if (await confirm(message, { confirmLabel: 'Xoá', danger: true })) remove.mutate(c.id);
  };
  const error = [add, rename, order, remove].map((m) => m.error).find(Boolean);
  const busy = add.isPending || rename.isPending || order.isPending || remove.isPending;

  return (
    <Dialog
      title="Nhóm chủ đề"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary">
          Xong
        </button>
      }
    >
      <p className="text-xs text-on-surface-variant">
        Tab Chủ đề hiện chủ đề theo nhóm, theo thứ tự dưới đây. Chủ đề chưa xếp nhóm nằm ở "{OTHER_TOPIC_CATEGORY}".
      </p>
      <ul className="space-y-1.5">
        {categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1">
            <input
              value={names[c.id] ?? c.name}
              maxLength={40}
              aria-label={`Tên nhóm ${c.name}`}
              onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))}
              onBlur={() => saveName(c)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="h-9 min-w-0 flex-1 rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 text-sm text-on-surface focus:border-primary-container focus:outline-none"
            />
            <span className="w-14 shrink-0 text-right text-[11px] text-on-surface-variant">{c.topics} chủ đề</span>
            <button type="button" onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label={`Đưa nhóm ${c.name} lên`} className={`${iconButton} text-on-surface-variant`}>
              <Icon name="arrow_upward" className="text-lg" />
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={busy || i === categories.length - 1}
              aria-label={`Đưa nhóm ${c.name} xuống`}
              className={`${iconButton} text-on-surface-variant`}
            >
              <Icon name="arrow_downward" className="text-lg" />
            </button>
            <button type="button" onClick={() => askRemove(c)} disabled={busy} aria-label={`Xoá nhóm ${c.name}`} className={`${iconButton} text-error hover:bg-error-container/40`}>
              <Icon name="delete" className="text-lg" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (adding.trim()) add.mutate();
        }}
      >
        <input
          value={adding}
          maxLength={40}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="Tên nhóm mới, VD: Mùa hè"
          className="h-9 min-w-0 flex-1 rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 text-sm text-on-surface focus:border-primary-container focus:outline-none"
        />
        <button
          type="submit"
          disabled={!adding.trim() || busy}
          className="flex h-9 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary disabled:opacity-50"
        >
          <Icon name="add" className="text-base" />
          Thêm nhóm
        </button>
      </form>
      <ErrorBox>{error && (error.errors?.name || error.errors?.ids || error.message)}</ErrorBox>
    </Dialog>
  );
}

const iconButton = 'flex size-8 items-center justify-center rounded-lg hover:bg-surface-container disabled:opacity-50';

/** Nút sửa / tạm tắt (bật lại) / xoá của 1 chủ đề (thẻ chủ đề và trang chi tiết). */
function TopicActions({ topic, onEdit, onToggle, onRemove, toggling, removing }) {
  const paused = topic.status !== TOPIC_STATUS.ACTIVE;
  return (
    <>
      <button type="button" onClick={onEdit} aria-label={`Sửa chủ đề ${topic.name}`} title="Sửa" className={`${iconButton} text-on-surface-variant`}>
        <Icon name="edit" className="text-lg" />
      </button>
      <button
        type="button"
        onClick={onToggle}
        disabled={toggling}
        aria-label={paused ? `Bật lại chủ đề ${topic.name}` : `Tạm tắt chủ đề ${topic.name}`}
        title={paused ? 'Bật lại' : 'Tạm tắt'}
        className={`${iconButton} text-on-surface-variant`}
      >
        <Icon name={paused ? 'play_circle' : 'pause_circle'} className="text-lg" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={!!removing}
        aria-label={`Xoá chủ đề ${topic.name}`}
        title="Xoá"
        className={`${iconButton} text-error hover:bg-error-container/40`}
      >
        <Icon name={removing ? 'progress_activity' : 'delete'} className={`text-lg ${removing ? 'animate-spin' : ''}`} />
      </button>
    </>
  );
}

/** Tên + nhãn nguồn / tạm tắt của chủ đề. */
function TopicTitle({ topic, large = false }) {
  const paused = topic.status !== TOPIC_STATUS.ACTIVE;
  return (
    <p className={`flex flex-wrap items-center gap-1.5 font-bold text-on-surface ${large ? 'text-base' : 'text-sm'}`}>
      <span className={paused ? 'text-on-surface-variant line-through' : ''}>{topic.name}</span>
      <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
        {topic.source === 'ai' ? 'AI tạo' : 'Shop tạo / sửa'}
      </span>
      {paused && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Tạm tắt</span>}
    </p>
  );
}

/**
 * Trang chi tiết chủ đề (?tab=topics&topic={id}, mở từ "Xem N hook đã tạo" trên thẻ): tên, ghi chú, sửa / tạm tắt / xoá và
 * toàn bộ hook đã viết theo chủ đề (bài đăng + bài kế hoạch chờ duyệt, mới trước, tối đa HOOKS_MAX hook gần nhất).
 */
function TopicDetail({ topic, sampleName, onBack, actions }) {
  const hooks = topic.hooks ?? [];
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
        <Icon name="arrow_back" className="text-base" />
        Tất cả chủ đề
      </button>
      <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <TopicTitle topic={topic} large />
          </div>
          <div className="flex shrink-0 gap-1">{actions}</div>
        </div>
        <div>
          <p className="mb-0.5 text-[11px] font-semibold text-on-surface-variant">Ghi chú cho AI lập kế hoạch</p>
          {topic.note ? (
            <p className="whitespace-pre-line text-sm text-on-surface">{topic.note}</p>
          ) : (
            <p className="text-xs italic text-outline">Chưa có ghi chú, AI tự do sáng tạo</p>
          )}
        </div>
      </section>
      <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
        <div>
          <h2 className="text-base font-bold text-on-surface">Hook đã tạo ({hooks.length})</h2>
          <p className="text-xs text-on-surface-variant">
            Hook của bài đăng và bài kế hoạch chờ duyệt theo chủ đề này, mới trước
            {hooks.length >= HOOKS_MAX ? ` (hiện ${HOOKS_MAX} hook gần nhất)` : ''}.
          </p>
        </div>
        {!hooks.length ? (
          <EmptyState icon="short_text" message="Chưa có hook nào theo chủ đề này." />
        ) : (
          <ul className="divide-y divide-outline-variant/30">
            {hooks.map((h, i) => (
              <li key={`${h.at}-${i}`} className="py-2">
                <p className="text-sm font-semibold text-on-surface">{h.hook}</p>
                <p className="text-[11px] text-on-surface-variant">
                  {[sampleName(h.sample_key), h.at && formatDateTime(h.at), HOOK_STATUS[h.kind === 'draft' ? 'draft' : h.status] ?? h.status]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
 * Chủ shop sửa tên / tag, tạm tắt, xoá (kể cả chủ đề đã có bài: các bài đó thành "Không chủ đề").
 * "Xem N hook đã tạo" mở trang chi tiết chủ đề (?topic={id}, TopicDetail). Sau này thống kê view theo chủ đề.
 */
export default function TopicsTab({ channel }) {
  const queryClient = useQueryClient();
  const { alert, confirm } = useConfirm();
  // null | { topic } (sửa) | { topic: null } (thêm thủ công)
  const [editing, setEditing] = useState(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  // ?topic={id}: đang xem trang chi tiết chủ đề
  const [params, setParams] = useSearchParams();
  const topicId = params.get('topic');
  const openTopic = (id) => setParams({ tab: 'topics', topic: String(id) });
  const closeTopic = () => setParams({ tab: 'topics' });
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
  const remove = useMutation({
    mutationFn: (t) => deleteTopic(channel.id, t.id),
    // Bài kế hoạch / lịch đăng của chủ đề đổi sang "Không chủ đề": tải lại mọi dữ liệu của kênh
    onSuccess: (_, t) => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.detail(channel.id) });
      // Xoá ở trang chi tiết thì về danh sách
      if (topicId === String(t.id)) closeTopic();
    },
    onError: (err) => alert(err?.message || 'Không xoá được chủ đề, vui lòng thử lại.'),
  });
  const askRemove = async (t) => {
    const count = Object.values(t.posts ?? {}).reduce((sum, n) => sum + n, 0);
    const message = count
      ? `Xoá chủ đề "${t.name}"? ${count} bài đã dùng chủ đề này vẫn giữ nguyên nhưng sẽ thành "Không chủ đề".`
      : `Xoá chủ đề "${t.name}"?`;
    if (await confirm(message, { confirmLabel: 'Xoá', danger: true })) remove.mutate(t);
  };
  const topics = data?.topics;
  const running = isTopicJobRunning(data?.job);
  const actionsFor = (t) => (
    <TopicActions
      topic={t}
      onEdit={() => setEditing({ topic: t })}
      onToggle={() => toggle.mutate(t)}
      onRemove={() => askRemove(t)}
      toggling={toggle.isPending}
      removing={remove.isPending && remove.variables?.id === t.id}
    />
  );
  const dialogs = (
    <>
      {editing && <TopicDialog channelId={channel.id} topic={editing.topic} categories={data?.categories} onClose={() => setEditing(null)} />}
      {autoOpen && <AutoBuildDialog channelId={channel.id} limits={data?.count} onClose={() => setAutoOpen(false)} />}
      {categoriesOpen && data && (
        <CategoryDialog channelId={channel.id} categories={data.categories ?? []} onClose={() => setCategoriesOpen(false)} />
      )}
    </>
  );

  if (topicId) {
    const current = topics?.find((t) => String(t.id) === topicId);
    return (
      <>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !topics ? (
          <Skeleton className="h-40 w-full" />
        ) : current ? (
          <TopicDetail topic={current} sampleName={sampleName} onBack={closeTopic} actions={actionsFor(current)} />
        ) : (
          <EmptyState icon="tag" message="Chủ đề không còn (đã bị xoá).">
            <button type="button" onClick={closeTopic} className="text-sm font-bold text-primary hover:underline">
              Về danh sách chủ đề
            </button>
          </EmptyState>
        )}
        {dialogs}
      </>
    );
  }

  const actions = data && (
    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
      <button
        type="button"
        onClick={() => setCategoriesOpen(true)}
        className="flex h-8 items-center gap-1 rounded-lg border border-outline-variant/60 px-3 text-xs font-bold text-on-surface hover:border-primary-container hover:text-primary"
      >
        <Icon name="folder" className="text-base" />
        Nhóm
      </button>
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
    <div className="space-y-4">
      <Section
        title="Chủ đề"
        subtitle="Kế hoạch đăng bài chỉ chọn trong các chủ đề ở đây (hook viết theo chủ đề; cùng chủ đề và cùng loại bài không lặp trong 14 ngày). Xây dựng tự động bằng AI hoặc thêm thủ công; tạm tắt hoặc xoá chủ đề để không dùng nữa."
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
          // Chủ đề theo nhóm (Sự kiện, Đi làm, Du lịch...; backend xếp theo thứ tự nhóm), nhóm rỗng không hiện
          <div className="space-y-4">
            {groupTopics(topics, data.categories).map((group) => (
              <section key={group.key}>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-on-surface">
                  {group.name}
                  <span className="text-xs font-normal text-on-surface-variant">({group.topics.length})</span>
                </h3>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {group.topics.map((t) => {
                  const paused = t.status !== TOPIC_STATUS.ACTIVE;
                  return (
                    <li
                      key={t.id}
                      className={`flex flex-col rounded-xl border border-outline-variant/40 p-3 ${paused ? 'bg-surface-container-low' : ''}`}
                    >
                      <TopicTitle topic={t} />
                      {/* Ghi chú + hook rộng hết thẻ */}
                      <div className="mb-2 mt-1 flex-1 space-y-1">
                        {t.note ? (
                          <p className="line-clamp-3 whitespace-pre-line text-xs text-on-surface" title={t.note}>{t.note}</p>
                        ) : (
                          <p className="text-[11px] italic text-outline">Chưa có ghi chú, AI tự do sáng tạo</p>
                        )}
                        {t.hooks?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openTopic(t.id)}
                            className="flex items-center gap-0.5 text-[11px] font-bold text-primary hover:underline"
                          >
                            Xem {t.hooks.length} hook đã tạo
                            <Icon name="chevron_right" className="text-base" />
                          </button>
                        )}
                      </div>
                      {/* Thanh công cụ ở đáy thẻ (phần nội dung flex-1: thẻ cùng hàng cao bằng nhau nên các thanh thẳng hàng) */}
                      <div className="flex justify-end gap-1 border-t border-outline-variant/30 pt-2">
                        {actionsFor(t)}
                      </div>
                    </li>
                  );
                })}
              </ul>
              </section>
            ))}
          </div>
        )}
      </Section>
      {dialogs}
    </div>
  );
}
