import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Icon from '../common/Icon';
import { useConfirm } from '../common/ConfirmDialog';
import { cancelPost } from '../../api/social';
import { POSTS_KEY } from './VideoPostDialogs';

/**
 * "Hủy bỏ" bài đang chuẩn bị: dừng tạo ảnh / AI viết nội dung và xoá bài (hoàn Credit phần chưa làm).
 * onCancelled(): sau khi hủy xong. Bài đã qua bước chuẩn bị (409): báo lỗi rồi gọi onStale() để tải lại.
 * Đặt được trong <Link> / hàng bảng có onClick: tự chặn click lan ra ngoài.
 */
export default function CancelPostButton({ post, onCancelled, onStale, className = '', compact = false }) {
  const queryClient = useQueryClient();
  const { confirm, alert } = useConfirm();
  const [busy, setBusy] = useState(false);

  const cancel = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm(
      post.plan
        ? 'Hủy bài kế hoạch này? Ảnh đang chờ tạo sẽ dừng và bài bị xoá; lần lập kế hoạch sau sẽ lập bù giờ này.'
        : 'Hủy bài đăng này? Phần đang chuẩn bị sẽ dừng, Credit chưa dùng được hoàn và bài bị xoá.',
      { confirmLabel: 'Hủy bài', cancelLabel: 'Không', danger: true },
    );
    if (!ok) return;
    setBusy(true);
    try {
      await cancelPost(post.id);
      queryClient.invalidateQueries({ queryKey: POSTS_KEY });
      onCancelled?.();
    } catch (err) {
      await alert(err?.message || 'Không hủy được, vui lòng thử lại.');
      if (err?.status === 409) {
        queryClient.invalidateQueries({ queryKey: POSTS_KEY });
        onStale?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={cancel}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-lg font-bold text-error hover:bg-error-container/40 disabled:opacity-60 ${
        compact ? 'h-8 px-3 text-xs' : 'h-11 rounded-xl border border-error/30 px-4 text-sm'
      } ${className}`}
    >
      <Icon name={busy ? 'progress_activity' : 'cancel'} className={`${compact ? 'text-base' : 'text-lg'} ${busy ? 'animate-spin' : ''}`} />
      Hủy bỏ
    </button>
  );
}
