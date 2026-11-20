import { useEffect, useState } from 'react';
import Icon from '../common/Icon';
import TextOverlayPreview from './TextOverlayPreview';

/** Số đếm giả cho thanh hành động (chỉ để xem bố cục, bài chưa đăng nên chưa có số thật). */
const PLACEHOLDER_COUNTS = { like: '0', comment: '0', save: '0', share: '0' };

function RailButton({ icon, label, fill = true }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon name={icon} fill={fill} className="text-[30px] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
      <span className="text-[11px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{label}</span>
    </div>
  );
}

function NavItem({ icon, label, active }) {
  return (
    <div className={`flex flex-1 flex-col items-center gap-0.5 ${active ? 'text-white' : 'text-white/60'}`}>
      <Icon name={icon} fill={active} className="text-[22px]" />
      <span className="text-[9px] font-semibold">{label}</span>
    </div>
  );
}

/**
 * Xem trước bài ảnh theo bố cục màn hình TikTok (chế độ ảnh): ảnh vuốt ngang + chấm trang, thanh hành động bên phải,
 * tên kênh + tiêu đề + hashtag phía dưới, thanh điều hướng đáy. Ảnh đã chèn chữ thì dùng ảnh thật; chưa chèn thì vẽ chữ
 * bằng CSS theo template chữ (templates: id -> style).
 * Chỉ là bản mô phỏng bố cục (biểu tượng chung, không dùng logo / tài nguyên của TikTok).
 */
export default function TikTokPreview({ post, channelName, templates = {}, onEdit }) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setIndex(0);
    setExpanded(false);
  }, [post?.id]);

  if (!post) {
    return (
      <div className="flex aspect-[9/19.5] w-full items-center justify-center rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-950 p-6 text-center text-xs text-white/60">
        Bấm vào 1 bài bên trái để xem trước
      </div>
    );
  }

  const images = post.images;
  const total = images.length;
  const image = images[Math.min(index, total - 1)];
  const go = (d) => setIndex((i) => Math.max(0, Math.min(total - 1, i + d)));
  const handle = `@${(channelName || 'kenh').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '')}`;
  const caption = [post.title, (post.hashtags ?? []).map((h) => `#${h}`).join(' ')].filter(Boolean).join(' ');
  const time = new Date(post.scheduled_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

  return (
    <div className="space-y-3">
      {/* Khung điện thoại */}
      <div
        className="relative mx-auto aspect-[9/19.5] w-full max-w-[340px] overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 bg-black shadow-2xl"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(-1);
          if (e.key === 'ArrowRight') go(1);
        }}
        aria-label="Xem trước bài trên TikTok"
      >
        {/* Thanh trạng thái */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-2 text-[11px] font-semibold text-white">
          <span>{new Date(post.scheduled_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="flex items-center gap-1">
            <Icon name="signal_cellular_alt" className="text-sm" />
            <Icon name="wifi" className="text-sm" />
            <Icon name="battery_full" className="text-sm" />
          </span>
        </div>

        {/* Thanh trên: Đang Follow / Dành cho bạn */}
        <div className="absolute inset-x-0 top-7 z-20 flex items-center justify-center gap-4 px-4 text-[15px] font-semibold">
          <Icon name="live_tv" className="absolute left-4 text-xl text-white" />
          <span className="text-white/60">Đang Follow</span>
          <span className="relative text-white">
            Dành cho bạn
            <span className="absolute -bottom-1.5 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full bg-white" />
          </span>
          <Icon name="search" className="absolute right-4 text-2xl text-white" />
        </div>

        {/* Ảnh (chế độ ảnh: ảnh nằm giữa nền đen, không cắt) */}
        <div className="absolute inset-0 bottom-[52px] flex items-center justify-center">
          {image?.overlay_url ? (
            <img src={image.overlay_url} alt={`Ảnh ${index + 1}`} className="max-h-full w-full object-contain" />
          ) : image?.overlay_text && templates[image.text_template_id] ? (
            <TextOverlayPreview image={image.thumb_url} text={image.overlay_text} style={templates[image.text_template_id]} className="w-full rounded-none" />
          ) : (
            <img src={image?.thumb_url} alt={`Ảnh ${index + 1}`} className="max-h-full w-full object-contain" />
          )}
          {/* Vùng bấm trái / phải để chuyển ảnh */}
          {index > 0 && <button type="button" onClick={() => go(-1)} aria-label="Ảnh trước" className="absolute inset-y-0 left-0 w-1/4" />}
          {index < total - 1 && <button type="button" onClick={() => go(1)} aria-label="Ảnh sau" className="absolute inset-y-0 right-14 w-1/4" />}
        </div>

        {/* Thanh hành động bên phải */}
        <div className="absolute bottom-[120px] right-2 z-20 flex flex-col items-center gap-4">
          <div className="relative mb-2">
            <span className="flex size-11 items-center justify-center rounded-full border-2 border-white bg-neutral-700 text-sm font-bold text-white">
              {(channelName || 'K').trim().charAt(0).toUpperCase()}
            </span>
            <span className="absolute -bottom-2 left-1/2 flex size-5 -translate-x-1/2 items-center justify-center rounded-full bg-[#FE2C55] text-white">
              <Icon name="add" className="text-sm" />
            </span>
          </div>
          <RailButton icon="favorite" label={PLACEHOLDER_COUNTS.like} />
          <RailButton icon="chat_bubble" label={PLACEHOLDER_COUNTS.comment} />
          <RailButton icon="bookmark" label={PLACEHOLDER_COUNTS.save} />
          <RailButton icon="reply" label={PLACEHOLDER_COUNTS.share} />
          <span className="mt-1 flex size-10 animate-[spin_6s_linear_infinite] items-center justify-center rounded-full border-[6px] border-neutral-800 bg-neutral-600">
            <Icon name="music_note" className="text-sm text-white" />
          </span>
        </div>

        {/* Chú thích phía dưới */}
        <div className="absolute inset-x-0 bottom-[52px] z-10 space-y-1.5 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-3 pr-16 pt-10 text-white">
          {total > 1 && (
            <div className="flex items-center gap-1 pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ảnh ${i + 1}`}
                  className={`h-1 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-1 bg-white/50'}`}
                />
              ))}
            </div>
          )}
          <p className="text-[15px] font-bold">{handle}</p>
          {caption && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className={`block w-full text-left text-[13px] leading-snug ${expanded ? '' : 'line-clamp-2'}`}>
              {post.title && <span>{post.title} </span>}
              {(post.hashtags ?? []).map((h) => (
                <span key={h} className="font-semibold">
                  #{h}{' '}
                </span>
              ))}
            </button>
          )}
          <p className="flex items-center gap-1 text-[12px]">
            <Icon name="music_note" className="text-sm" />
            <span className="truncate">Âm thanh gốc - {handle.slice(1)}</span>
          </p>
        </div>

        {/* Thanh điều hướng đáy */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex h-[52px] items-center border-t border-white/10 bg-black px-1">
          <NavItem icon="home" label="Trang chủ" active />
          <NavItem icon="group" label="Bạn bè" />
          <div className="flex flex-1 justify-center">
            <span className="flex h-7 w-11 items-center justify-center rounded-lg bg-white shadow-[-3px_0_0_#25F4EE,3px_0_0_#FE2C55]">
              <Icon name="add" className="text-xl text-black" />
            </span>
          </div>
          <NavItem icon="inbox" label="Hộp thư" />
          <NavItem icon="person" label="Hồ sơ" />
        </div>
      </div>

      {/* Thông tin dưới khung */}
      <div className="mx-auto max-w-[340px] space-y-1 text-center">
        <p className="text-xs text-on-surface-variant">
          Đăng lúc {time} · Ảnh {index + 1}/{total}
          {post.type === 'video' && ' · Bài video (worker dựng video từ các ảnh này)'}
        </p>
        {post.hook && <p className="text-xs font-semibold text-on-surface">Hook: {post.hook}</p>}
        {images.some((i) => i.overlay_text && !i.overlay_url) && (
          <p className="text-[11px] text-amber-700">Chữ trên ảnh đang là bản xem trước, worker chưa chèn vào ảnh thật.</p>
        )}
        {onEdit && (
          <button type="button" onClick={onEdit} className="mt-1 inline-flex items-center gap-1 rounded-lg border border-outline-variant/60 px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container">
            <Icon name="edit" className="text-sm" />
            Sửa chữ / làm lại
          </button>
        )}
      </div>
    </div>
  );
}
