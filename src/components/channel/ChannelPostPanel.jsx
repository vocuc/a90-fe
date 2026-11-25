import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Icon from "../common/Icon";
import { Skeleton } from "../common/Feedback";
import { FormAlert, TextField } from "../common/Form";
import { getChannelPost, setRedo, updateOverlays } from "../../api/channels";
import { TopicBadge } from "./Section";

const EDITABLE = ["generating", "pending_review", "queued"];
const REBUILD_CODES = [
  "CONTENT_FAILED",
  "CONTENT_WORKER_REQUIRED",
  "OVERLAY_FAILED",
];
export const channelPostKey = (id) => ["creator", "channel-posts", String(id)];

/**
 * Khối "Nội dung kênh" ở trang /posts/:id cho bài do lệnh lập kế hoạch tạo (tab Lịch đăng của kênh gộp vào /posts,
 * 2026-11-25): dạng bài, chủ đề, hook, sửa chữ trên ảnh (worker dựng lại), "Làm lại bài này".
 */
export default function ChannelPostPanel({ postId, onChanged }) {
  const queryClient = useQueryClient();
  const { data: post, error } = useQuery({
    queryKey: channelPostKey(postId),
    queryFn: () => getChannelPost(postId),
    // Đang chèn chữ / chờ ảnh: tự tải lại để thấy ảnh xong
    refetchInterval: (q) =>
      q.state.data?.status === "generating" ||
      q.state.data?.images.some((i) => i.overlay_status === "pending")
        ? 10000
        : false,
  });
  const [texts, setTexts] = useState({});
  useEffect(() => {
    if (post)
      setTexts(
        Object.fromEntries(
          post.images.map((i) => [i.id, i.overlay_text ?? ""]),
        ),
      );
  }, [post]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: channelPostKey(postId) });
    onChanged?.();
  };
  const saveText = useMutation({
    mutationFn: () =>
      updateOverlays(
        post.id,
        post.images.map((i) => ({
          image_id: i.id,
          text: texts[i.id] || null,
          text_template_id: i.text_template_id,
        })),
      ),
    onSuccess: refresh,
  });
  const redo = useMutation({
    mutationFn: (on) => setRedo(post.id, on),
    onSuccess: refresh,
  });

  if (error) return <FormAlert>{error.message}</FormAlert>;
  if (!post) return <Skeleton className="h-40 w-full" />;

  const editable = EDITABLE.includes(post.status);
  const changed = post.images.some(
    (i) => (texts[i.id] ?? "") !== (i.overlay_text ?? ""),
  );
  const actionError = saveText.error || redo.error;

  return (
    <section className="space-y-4 rounded-2xl border border-outline-variant/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-sm font-bold text-on-surface">
          Nội dung kênh{" "}
          <Link
            to={`/channels/${post.channel.id}?tab=plans`}
            className="text-primary hover:underline"
          >
            {post.channel.name}
          </Link>
        </h2>
        {post.redo_requested_at && (
          <span className="rounded bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
            Chờ AI làm lại
          </span>
        )}
      </div>
      <div className="space-y-3">
        <p className="text-[11px] text-on-surface-variant">
          {post.sample_name ?? "Bài đăng"}
        </p>
        {(post.topic || post.sample_key) && <TopicBadge name={post.topic} />}
        {post.hook && (
          <p className="text-sm font-semibold text-on-surface">
            Hook: {post.hook}
          </p>
        )}

        <ul className="space-y-3">
          {post.images.map((img, idx) => (
            <li key={img.id} className="flex gap-3">
              <img
                src={img.overlay_url || img.thumb_url}
                alt={`Ảnh ${idx + 1}`}
                className="h-28 w-20 shrink-0 rounded-lg bg-surface-container object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] text-on-surface-variant">
                  Ảnh {idx + 1}
                  {img.overlay_status === "pending" && " · đang chèn chữ"}
                  {img.overlay_status === "failed" && " · chèn chữ lỗi"}
                </p>
                {post.type === "photo" && editable ? (
                  <TextField
                    label="Chữ trên ảnh"
                    value={texts[img.id] ?? ""}
                    maxLength={150}
                    onChange={(e) =>
                      setTexts((t) => ({ ...t, [img.id]: e.target.value }))
                    }
                  />
                ) : (
                  img.overlay_text && (
                    <p className="text-xs text-on-surface">
                      {img.overlay_text}
                    </p>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>

        {actionError && <FormAlert>{actionError.message}</FormAlert>}
        {editable && (
          <div className="flex flex-wrap gap-2">
            {(changed || REBUILD_CODES.includes(post.last_error?.code)) && (
              <button
                type="button"
                onClick={() => saveText.mutate()}
                disabled={saveText.isPending}
                className="rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
              >
                {changed ? "Lưu chữ, dựng lại ảnh" : "Dựng lại"}
              </button>
            )}
            <button
              type="button"
              onClick={() => redo.mutate(!post.redo_requested_at)}
              disabled={redo.isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/60 px-3 py-2 text-xs font-bold text-on-surface disabled:opacity-50"
            >
              <Icon name="autorenew" className="text-sm" />
              {post.redo_requested_at
                ? "Bỏ yêu cầu làm lại"
                : "Làm lại bài này"}
            </button>
          </div>
        )}
        {editable && !post.redo_requested_at && (
          <p className="text-[11px] text-on-surface-variant">
            "Làm lại": bài tạm dừng, AI làm lại nội dung ngay (worker điều phối
            nhận việc trong ít phút), giữ giờ đăng.
          </p>
        )}
      </div>
    </section>
  );
}
