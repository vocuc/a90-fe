import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { FormAlert } from '../common/Form';
import { getChannelPost, setRedo, updateOverlays } from '../../api/channels';
import { TopicBadge } from './Section';

/**
 * Bài do lệnh lập kế hoạch tạo, ở trang /posts/:id (tab Lịch đăng của kênh gộp vào /posts, 2026-11-25):
 * - useChannelPost: dữ liệu kênh của bài (dạng bài, chủ đề, hook, chữ trên ảnh, cờ làm lại) + sửa chữ / làm lại.
 * - ChannelPostHeader: thẻ gọn đầu trang (kênh, dạng bài, chủ đề, hook, "Làm lại bài này").
 * - OverlayField: ô "Chữ trên ảnh" dưới từng ảnh trong lưới ảnh của trang; OverlaySaveBar: nút lưu chữ.
 */
const EDITABLE = ['generating', 'pending_review', 'queued'];
const REBUILD_CODES = ['CONTENT_FAILED', 'CONTENT_WORKER_REQUIRED', 'OVERLAY_FAILED'];
export const channelPostKey = (id) => ['creator', 'channel-posts', String(id)];

export function useChannelPost(post, onChanged) {
  const queryClient = useQueryClient();
  const postId = post?.channel ? post.id : null;
  const { data, error } = useQuery({
    queryKey: channelPostKey(postId),
    queryFn: () => getChannelPost(postId),
    enabled: !!postId,
    // Đang chờ ảnh / chèn chữ: tự tải lại để thấy ảnh xong
    refetchInterval: (q) =>
      q.state.data?.status === 'generating' || q.state.data?.images.some((i) => i.overlay_status === 'pending') ? 10000 : false,
  });
  const [texts, setTexts] = useState({});
  useEffect(() => {
    if (data) setTexts(Object.fromEntries(data.images.map((i) => [i.id, i.overlay_text ?? ''])));
  }, [data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: channelPostKey(postId) });
    onChanged?.();
  };
  const saveText = useMutation({
    mutationFn: () =>
      updateOverlays(data.id, data.images.map((i) => ({ image_id: i.id, text: texts[i.id] || null, text_template_id: i.text_template_id }))),
    onSuccess: refresh,
  });
  const redo = useMutation({ mutationFn: (on) => setRedo(data.id, on), onSuccess: refresh });

  if (!postId) return null;
  const editable = !!data && EDITABLE.includes(data.status);
  const byId = Object.fromEntries((data?.images ?? []).map((i) => [i.id, i]));
  return {
    data,
    error,
    editable,
    // Chữ trên ảnh chỉ có ở bài ảnh
    textEditable: editable && data.type === 'photo',
    overlay: (imageId) => byId[imageId] ?? null,
    text: (imageId) => texts[imageId] ?? '',
    setText: (imageId, value) => setTexts((t) => ({ ...t, [imageId]: value })),
    changed: !!data && data.images.some((i) => (texts[i.id] ?? '') !== (i.overlay_text ?? '')),
    canRebuild: REBUILD_CODES.includes(data?.last_error?.code),
    saveText,
    redo,
  };
}

/** Thẻ đầu trang của bài kênh: kênh, dạng bài, chủ đề, hook + "Làm lại bài này". */
export function ChannelPostHeader({ channel }) {
  const { data, error, editable, redo } = channel;
  if (error) return <FormAlert>{error.message}</FormAlert>;
  if (!data) return <div className="h-20 animate-pulse rounded-2xl bg-surface-container" />;
  const waiting = !!data.redo_requested_at;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-on-surface-variant">
          <Icon name="smart_display" className="text-sm text-primary" />
          <Link to={`/channels/${data.channel.id}?tab=plans`} className="font-bold text-primary hover:underline">
            {data.channel.name}
          </Link>
          {data.sample_name && <span>· {data.sample_name}</span>}
          <TopicBadge name={data.topic} />
          {waiting && <span className="rounded bg-sky-50 px-1.5 py-0.5 font-semibold text-sky-700">Chờ AI làm lại</span>}
        </p>
        {data.hook && <p className="text-sm font-bold text-on-surface">{data.hook}</p>}
        {redo.error && <p className="text-xs text-error">{redo.error.message}</p>}
      </div>
      {editable && (
        <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
          <button
            type="button"
            onClick={() => redo.mutate(!waiting)}
            disabled={redo.isPending}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-primary-container/50 px-3 text-xs font-bold text-primary hover:bg-primary-fixed/40 disabled:opacity-50"
          >
            <Icon name={redo.isPending ? 'progress_activity' : 'autorenew'} className={`text-base ${redo.isPending ? 'animate-spin' : ''}`} />
            {waiting ? 'Bỏ yêu cầu làm lại' : 'Làm lại bài này'}
          </button>
          {!waiting && <p className="max-w-[260px] text-[10px] text-on-surface-variant sm:text-right">AI làm lại nội dung + ảnh, giữ giờ đăng.</p>}
        </div>
      )}
    </section>
  );
}

/** Dưới từng ảnh: chữ trên ảnh (sửa được khi bài chưa được worker nhận) + trạng thái chèn chữ. */
export function OverlayField({ channel, imageId }) {
  const overlay = channel?.overlay(imageId);
  if (!overlay) return null;
  const failed = overlay.overlay_status === 'failed';
  const status = overlay.overlay_status === 'pending' ? 'Đang chèn chữ...' : failed ? 'Chèn chữ lỗi' : null;
  if (!channel.textEditable) {
    return overlay.overlay_text || status ? (
      <p className="text-[11px] text-on-surface-variant">
        {overlay.overlay_text}
        {status && <span className={failed ? ' text-error' : ''}> {status}</span>}
      </p>
    ) : null;
  }
  return (
    <div className="space-y-0.5">
      <textarea
        value={channel.text(imageId)}
        onChange={(e) => channel.setText(imageId, e.target.value)}
        maxLength={150}
        rows={2}
        placeholder="Chữ trên ảnh"
        aria-label="Chữ trên ảnh"
        className="w-full resize-none rounded-lg border-outline-variant/40 bg-surface-container-low px-2 py-1 text-[11px] text-on-surface focus:border-primary-container focus:ring-primary-container/20"
      />
      {status && <p className={`text-[10px] ${failed ? 'text-error' : 'text-on-surface-variant'}`}>{status}</p>}
    </div>
  );
}

/** Nút lưu chữ trên ảnh (worker dựng lại ảnh có chữ): hiện khi đã sửa chữ hoặc lần chèn chữ trước lỗi. */
export function OverlaySaveBar({ channel }) {
  if (!channel?.textEditable || (!channel.changed && !channel.canRebuild)) return null;
  const { saveText } = channel;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-fixed/30 px-3 py-2">
      <span className="flex-1 text-xs text-on-surface">
        {channel.changed ? 'Đã sửa chữ trên ảnh.' : 'Chèn chữ lần trước bị lỗi.'} Worker sẽ dựng lại ảnh có chữ.
      </span>
      {saveText.error && <span className="w-full text-xs text-error">{saveText.error.message}</span>}
      <button
        type="button"
        onClick={() => saveText.mutate()}
        disabled={saveText.isPending}
        className="h-8 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary disabled:opacity-50"
      >
        {saveText.isPending ? 'Đang lưu...' : channel.changed ? 'Lưu chữ, dựng lại ảnh' : 'Dựng lại'}
      </button>
    </div>
  );
}
