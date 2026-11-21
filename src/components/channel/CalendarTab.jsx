import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../common/Icon';
import Dialog from '../common/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { FormAlert, TextField } from '../common/Form';
import { PostStatusBadge } from '../social/PostStatus';
import { CHANNEL_KEYS, getCalendar, getTextTemplates, setRedo, updateOverlays } from '../../api/channels';
import TikTokPreview from './TikTokPreview';
import { TopicBadge, formatDateTime, formatDay } from './Section';

const EDITABLE = ['generating', 'pending_review', 'queued'];
const toDate = (d) => d.toISOString().slice(0, 10);

function PostDialog({ channelId, channelName, templates, post, onClose, showPreview }) {
  const queryClient = useQueryClient();
  const [texts, setTexts] = useState(() => Object.fromEntries(post.images.map((i) => [i.id, i.overlay_text ?? ''])));
  const editable = EDITABLE.includes(post.status);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['creator', 'channels', String(channelId), 'calendar'] });
  const saveText = useMutation({
    mutationFn: () => updateOverlays(post.id, post.images.map((i) => ({ image_id: i.id, text: texts[i.id] || null, text_template_id: i.text_template_id }))),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  const redo = useMutation({
    mutationFn: (on) => setRedo(post.id, on),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  const error = saveText.error || redo.error;
  const changed = post.images.some((i) => (texts[i.id] || '') !== (i.overlay_text ?? ''));

  return (
    <Dialog title={post.sample_name ?? 'Bài đăng'} subtitle={formatDateTime(post.scheduled_at)} onClose={onClose}>
      <div className="space-y-4 p-4">
        {showPreview && <TikTokPreview post={post} channelName={channelName} templates={templates} />}
        <div className="flex items-center gap-2">
          <PostStatusBadge status={post.status} />
          {post.redo_requested_at && <span className="rounded bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">Chờ AI làm lại</span>}
          {post.post_url && (
            <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary hover:underline">
              Xem trên TikTok
            </a>
          )}
        </div>
        {post.last_error && <FormAlert>{post.last_error.message}</FormAlert>}
        {post.topic && <TopicBadge name={post.topic} />}
        {post.hook && <p className="text-sm font-semibold text-on-surface">Hook: {post.hook}</p>}
        {post.title && <p className="text-sm text-on-surface">{post.title}</p>}
        {post.hashtags.length > 0 && <p className="text-xs text-primary">{post.hashtags.map((h) => `#${h}`).join(' ')}</p>}

        <ul className="space-y-3">
          {post.images.map((img, idx) => (
            <li key={img.id} className="flex gap-3">
              <img src={img.overlay_url || img.thumb_url} alt={`Ảnh ${idx + 1}`} className="h-28 w-20 shrink-0 rounded-lg bg-surface-container object-cover" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] text-on-surface-variant">
                  Ảnh {idx + 1}
                  {img.overlay_status === 'pending' && ' · đang chèn chữ'}
                  {img.overlay_status === 'failed' && ' · chèn chữ lỗi'}
                </p>
                {post.type === 'photo' && editable ? (
                  <TextField label="Chữ trên ảnh" value={texts[img.id]} maxLength={150} onChange={(e) => setTexts((t) => ({ ...t, [img.id]: e.target.value }))} />
                ) : (
                  img.overlay_text && <p className="text-xs text-on-surface">{img.overlay_text}</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {error && <FormAlert>{error.message}</FormAlert>}
        {editable && (
          <div className="flex flex-wrap gap-2">
            {changed && (
              <button type="button" onClick={() => saveText.mutate()} disabled={saveText.isPending}
                className="rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50">
                Lưu chữ, dựng lại ảnh
              </button>
            )}
            {['CONTENT_FAILED', 'CONTENT_WORKER_REQUIRED', 'OVERLAY_FAILED'].includes(post.last_error?.code) && !changed && (
              <button type="button" onClick={() => saveText.mutate()} disabled={saveText.isPending}
                className="rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50">
                Dựng lại
              </button>
            )}
            <button type="button" onClick={() => redo.mutate(!post.redo_requested_at)} disabled={redo.isPending}
              className="rounded-lg border border-outline-variant/60 px-3 py-2 text-xs font-bold text-on-surface">
              {post.redo_requested_at ? 'Bỏ yêu cầu làm lại' : 'Làm lại bài này'}
            </button>
          </div>
        )}
        {editable && !post.redo_requested_at && (
          <p className="text-[11px] text-on-surface-variant">"Làm lại": bài tạm dừng, AI làm lại nội dung ngay (worker điều phối nhận việc trong ít phút), giữ giờ đăng.</p>
        )}
      </div>
    </Dialog>
  );
}

/** Tab Lịch đăng: bài của kênh theo ngày (14 ngày từ hôm nay, lùi / tiến từng 14 ngày). */
export default function CalendarTab({ channel, previewSlot }) {
  const [offset, setOffset] = useState(0);
  // Desktop: bấm bài -> xem trước bên phải; điện thoại: bấm bài -> mở popup (có xem trước ở đầu)
  const [previewId, setPreviewId] = useState(null);
  const [selected, setSelected] = useState(null);
  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
  const { data: tpl } = useQuery({ queryKey: CHANNEL_KEYS.templates(channel.id), queryFn: () => getTextTemplates(channel.id) });
  const templates = useMemo(() => Object.fromEntries((tpl?.items ?? []).map((t) => [t.id, t.style])), [tpl]);
  const { from, to } = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + offset * 14);
    const end = new Date(start);
    end.setDate(end.getDate() + 13);
    return { from: toDate(start), to: toDate(end) };
  }, [offset]);
  const { data, error, refetch } = useQuery({
    queryKey: CHANNEL_KEYS.calendar(channel.id, from, to),
    queryFn: () => getCalendar(channel.id, from, to),
    // Bài đang chèn chữ: tự tải lại để thấy ảnh xong
    refetchInterval: (q) => (q.state.data?.some((p) => p.status === 'generating') ? 10000 : false),
  });
  const days = useMemo(() => {
    const groups = new Map();
    (data ?? []).forEach((p) => {
      const key = p.scheduled_at.slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), p]);
    });
    return [...groups.entries()];
  }, [data]);
  const current = selected ? data?.find((p) => p.id === selected) : null;
  // Mặc định xem trước bài sắp đăng gần nhất
  const preview = data?.find((p) => p.id === previewId) ?? data?.find((p) => new Date(p.scheduled_at) >= new Date()) ?? data?.[0] ?? null;

  return (
    <>
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="14 ngày trước" className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-container">
          <Icon name="chevron_left" />
        </button>
        <p className="flex-1 text-center text-xs font-semibold text-on-surface">
          {new Date(from).toLocaleDateString('vi-VN')} - {new Date(to).toLocaleDateString('vi-VN')}
        </p>
        <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="14 ngày sau" className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-container">
          <Icon name="chevron_right" />
        </button>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data ? (
        <Skeleton className="h-40 w-full" />
      ) : !days.length ? (
        <EmptyState icon="calendar_month" message="Không có bài nào trong khoảng này." />
      ) : (
        <div className="grid gap-4 2xl:grid-cols-2">
        {days.map(([day, posts]) => (
          <div key={day} className="space-y-2">
            <p className="text-xs font-bold capitalize text-on-surface-variant">{formatDay(day)}</p>
            <ul className="space-y-2">
              {posts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => (isDesktop() ? setPreviewId(p.id) : setSelected(p.id))}
                    className={`flex w-full gap-3 rounded-xl border p-2 text-left hover:bg-surface-container-low ${
                      preview?.id === p.id ? 'lg:border-primary-container lg:bg-primary-fixed/20' : 'border-outline-variant/40'
                    }`}
                  >
                    <img src={p.images[0]?.overlay_url || p.images[0]?.thumb_url} alt="" className="h-16 w-12 shrink-0 rounded-lg bg-surface-container object-cover" loading="lazy" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-[11px] text-on-surface-variant">
                        {new Date(p.scheduled_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        {p.sample_name && ` · ${p.sample_name}`} · {p.type === 'video' ? 'Video' : `${p.images.length} ảnh`}
                      </p>
                      {p.topic && <TopicBadge name={p.topic} />}
                      <p className="line-clamp-2 text-sm font-semibold text-on-surface">{p.hook || p.title || 'Bài đăng'}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <PostStatusBadge status={p.status} />
                      {p.redo_requested_at && <span className="text-[10px] font-semibold text-sky-700">Chờ làm lại</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        </div>
      )}
      {current && (
        <PostDialog channelId={channel.id} channelName={channel.name} templates={templates} post={current} showPreview={!isDesktop()} onClose={() => setSelected(null)} />
      )}
    </div>
    {/* Xem trước kiểu TikTok: vẽ vào cột phải của trang (ChannelPage), ghim + vừa chiều cao màn hình */}
    {previewSlot &&
      createPortal(
        <TikTokPreview fitScreen post={preview} channelName={channel.name} templates={templates} onEdit={preview ? () => setSelected(preview.id) : undefined} />,
        previewSlot,
      )}
    </>
  );
}
