import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { TextField } from '../common/Form';
import { useConfirm } from '../common/ConfirmDialog';
import TagPicker from '../product/TagPicker';
import { tagChips } from '../../api/productTags';
import { CHANNEL_KEYS, TOPIC_STATUS, getTopics, listPostSamples, updateTopic } from '../../api/channels';
import Section from './Section';

const NAME_MAX = 80;

const formatDate = (ymd) => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '');

/** Sửa tên + bộ lọc tag sản phẩm của chủ đề (sửa -> nguồn "Shop sửa"). */
function TopicDialog({ channelId, topic, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(topic.name);
  const [tags, setTags] = useState(topic.tags ?? {});
  const mutation = useMutation({
    mutationFn: () => updateTopic(channelId, topic.id, { name: name.trim(), tags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.topics(channelId) });
      onClose();
    },
  });
  const error = mutation.error && (mutation.error.errors?.name || mutation.error.errors?.tags || mutation.error.message);

  return (
    <Dialog
      title="Sửa chủ đề"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container">
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            <Icon name={mutation.isPending ? 'progress_activity' : 'save'} className={`text-lg ${mutation.isPending ? 'animate-spin' : ''}`} />
            Lưu chủ đề
          </button>
        </>
      }
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
      {error && (
        <p role="alert" className="rounded-xl bg-error-container/60 px-3 py-2 text-xs text-on-error-container">
          {error}
        </p>
      )}
    </Dialog>
  );
}

/**
 * Tab Chủ đề: chủ đề của kênh do AI tạo khi lập kế hoạch, dùng chung mọi loại bài (cùng chủ đề + cùng loại bài không
 * lặp trong 14 ngày). Chủ shop sửa tên / tag, tạm tắt. Sau này thống kê view theo chủ đề.
 */
export default function TopicsTab({ channel }) {
  const queryClient = useQueryClient();
  const { alert } = useConfirm();
  const [editing, setEditing] = useState(null);
  const { data: topics, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.topics(channel.id), queryFn: () => getTopics(channel.id) });
  const { data: samples } = useQuery({ queryKey: CHANNEL_KEYS.samples, queryFn: listPostSamples, staleTime: 5 * 60_000 });
  const sampleName = (key) => samples?.items.find((s) => s.key === key)?.name ?? key;
  const toggle = useMutation({
    mutationFn: (t) => updateTopic(channel.id, t.id, { status: t.status === TOPIC_STATUS.ACTIVE ? TOPIC_STATUS.PAUSED : TOPIC_STATUS.ACTIVE }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.topics(channel.id) }),
    onError: (err) => alert(err?.message || 'Không đổi được trạng thái chủ đề, vui lòng thử lại.'),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Section
        title="Chủ đề"
        subtitle="Đội A51 tự tạo chủ đề khi lập kế hoạch (VD: Đi chúc Tết, Đi làm cả ngày). Hook của bài viết theo chủ đề; cùng chủ đề và cùng loại bài không lặp trong 14 ngày. Tạm tắt chủ đề để không dùng nữa."
      >
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !topics ? (
          <Skeleton className="h-24 w-full" />
        ) : !topics.length ? (
          <EmptyState icon="tag" message="Chưa có chủ đề. Chủ đề được tạo khi đội A51 lập kế hoạch cho kênh." />
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
                          {t.source === 'ai' ? 'AI tạo' : 'Shop sửa'}
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
                        onClick={() => setEditing(t)}
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
      {editing && <TopicDialog channelId={channel.id} topic={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
