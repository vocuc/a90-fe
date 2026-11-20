import { useEffect, useState } from 'react';
import Icon from '../common/Icon';
import TextOverlayPreview from './TextOverlayPreview';

/**
 * Xem trước bài như khung "Preview" ở trang đăng bài của TikTok Studio trên web (mẫu chụp 2026-11-20 bằng Chrome của
 * worker TikTok): chọn Feed / Profile / Web phía trên; Feed = màn hình điện thoại (ảnh + số trang "1/2", thanh hành động
 * bên phải với số đếm "...", tên kênh + nhãn Photo, tiêu đề + hashtag, Original sound, thanh điều hướng đáy).
 * Ảnh đã chèn chữ thì dùng ảnh thật; chưa chèn thì vẽ chữ bằng CSS theo template chữ (templates: id -> style).
 * Biểu tượng chung (Material Symbols), không dùng logo / tài nguyên của TikTok.
 */

const shadow = 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]';

function Slide({ image, templates, className = '' }) {
  if (!image) return null;
  if (image.overlay_url) return <img src={image.overlay_url} alt="" className={`size-full object-contain ${className}`} />;
  if (image.overlay_text && templates[image.text_template_id]) {
    return <TextOverlayPreview image={image.thumb_url} text={image.overlay_text} style={templates[image.text_template_id]} className={`w-full rounded-none ${className}`} />;
  }
  return <img src={image.thumb_url} alt="" className={`size-full object-contain ${className}`} />;
}

function Avatar({ name, size = 'size-10', plus = false }) {
  return (
    <div className="relative">
      <span className={`flex ${size} items-center justify-center rounded-full border border-white bg-neutral-800 text-xs font-bold text-white`}>
        {(name || 'K').trim().charAt(0).toUpperCase()}
      </span>
      {plus && (
        <span className="absolute -bottom-1.5 left-1/2 flex size-4 -translate-x-1/2 items-center justify-center rounded-full bg-[#FE2C55] text-white">
          <Icon name="add" className="text-[12px] font-bold" />
        </span>
      )}
    </div>
  );
}

function Rail({ icon, mirror = false }) {
  return (
    <div className="flex flex-col items-center">
      <Icon name={icon} fill className={`text-[28px] text-white ${shadow} ${mirror ? '-scale-x-100' : ''}`} />
      <span className={`-mt-1 text-[10px] font-bold leading-none text-white ${shadow}`}>...</span>
    </div>
  );
}

function Caption({ post }) {
  const [open, setOpen] = useState(false);
  const tags = (post.hashtags ?? []).map((h) => `#${h}`).join(' ');
  if (!post.title && !tags && !post.content) return null;
  return (
    <button type="button" onClick={() => setOpen((v) => !v)} className={`block w-full text-left text-[12px] leading-snug text-white ${open ? '' : 'line-clamp-2'}`}>
      {post.title && <span className="font-semibold">{post.title} </span>}
      {post.content && <span>{post.content} </span>}
      {tags && <span className="font-semibold">{tags}</span>}
    </button>
  );
}

function FeedView({ post, name, templates, index, setIndex }) {
  const images = post.images;
  const total = images.length;
  const go = (d) => setIndex((i) => Math.max(0, Math.min(total - 1, i + d)));

  return (
    <div
      className="relative mx-auto flex aspect-[360/780] w-[var(--phone-w)] flex-col overflow-hidden rounded-[28px] bg-black text-white"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
    >
      {/* Thanh trạng thái */}
      <div className="flex items-center justify-between px-11 pt-5 text-[14px] font-semibold">
        <span>8:00</span>
        <span className="flex items-center gap-0.5">
          <Icon name="signal_cellular_alt" className="text-[16px]" />
          <Icon name="wifi" className="text-[16px]" />
          <Icon name="battery_full" className="rotate-90 text-[16px]" />
        </span>
      </div>
      {/* Đầu trang: LIVE | Following  For You | tìm kiếm */}
      <div className="relative flex items-center justify-center gap-4 px-4 pb-2 pt-4 text-[14px] font-semibold">
        <span className="absolute left-4 flex flex-col items-center leading-none">
          <Icon name="live_tv" className="text-[22px]" />
        </span>
        <span className="text-white/60">Following</span>
        <span className="relative">
          For You
          <span className="absolute -bottom-1.5 left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-white" />
        </span>
        <Icon name="search" className="absolute right-4 text-[24px]" />
      </div>

      {/* Ảnh */}
      <div className="relative flex min-h-0 flex-1 items-start justify-center">
        <Slide image={images[index]} templates={templates} className="object-top" />
        {total > 1 && (
          <span className="absolute right-3 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold">
            {index + 1}/{total}
          </span>
        )}
        {index > 0 && <button type="button" onClick={() => go(-1)} aria-label="Ảnh trước" className="absolute inset-y-0 left-0 w-1/3" />}
        {index < total - 1 && <button type="button" onClick={() => go(1)} aria-label="Ảnh sau" className="absolute inset-y-0 right-12 w-1/3" />}

        {/* Thanh hành động bên phải */}
        <div className="absolute bottom-3 right-2 flex flex-col items-center gap-3">
          <div className="mb-1">
            <Avatar name={name} plus />
          </div>
          <Rail icon="favorite" />
          <Rail icon="sms" />
          <Rail icon="bookmark" />
          <Rail icon="reply" mirror />
        </div>
      </div>

      {/* Chân: chấm trang, tên kênh, chú thích, âm thanh */}
      <div className="relative space-y-1 px-3 pb-2 pt-2">
        {total > 1 && (
          <div className="flex justify-center gap-1 pb-1">
            {images.map((img, i) => (
              <button key={img.id} type="button" onClick={() => setIndex(i)} aria-label={`Ảnh ${i + 1}`}
                className={`size-1 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 pr-12">
          <span className="truncate text-[14px] font-bold">{name}</span>
          <span className="flex shrink-0 items-center gap-0.5 rounded bg-white/20 px-1 py-px text-[10px] font-semibold">
            <Icon name="photo_library" className="text-[11px]" />
            Photo
          </span>
        </div>
        <div className="pr-12">
          <Caption post={post} />
        </div>
        <p className="flex items-center gap-1.5 pr-12 text-[12px]">
          <Icon name="music_note" className="text-[13px]" />
          <span className="truncate">Original sound - {name}</span>
        </p>
        <span className="absolute bottom-2 right-3 size-9 animate-[spin_5s_linear_infinite] rounded-full border-[6px] border-neutral-800 bg-gradient-to-br from-neutral-500 to-neutral-900" />
      </div>

      {/* Thanh điều hướng đáy */}
      <div className="flex items-center border-t border-white/10 px-2 pb-3 pt-1.5">
        {[
          ['home', 'Home', true],
          ['group', 'Friends'],
          null,
          ['chat', 'Inbox'],
          ['person', 'Me'],
        ].map((item, i) =>
          item ? (
            <div key={item[1]} className={`flex flex-1 flex-col items-center ${item[2] ? 'text-white' : 'text-white/70'}`}>
              <Icon name={item[0]} fill={item[2]} className="text-[22px]" />
              <span className="text-[9px] font-semibold">{item[1]}</span>
            </div>
          ) : (
            <div key={i} className="flex flex-1 justify-center">
              <span className="flex h-7 w-10 items-center justify-center rounded-lg bg-white shadow-[-2px_0_0_#25F4EE,2px_0_0_#FE2C55]">
                <Icon name="add" className="text-[20px] text-black" />
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/** Trang hồ sơ: bài này nằm ô đầu lưới (ảnh bìa = ảnh đầu), các ô sau là chỗ trống. */
function ProfileView({ post, name, handle, templates }) {
  return (
    <div className="mx-auto flex aspect-[360/780] w-[var(--phone-w)] flex-col overflow-hidden rounded-[28px] bg-white text-neutral-900">
      <div className="flex items-center justify-between px-11 pt-5 text-[14px] font-semibold">
        <span>8:00</span>
        <span className="flex items-center gap-0.5">
          <Icon name="signal_cellular_alt" className="text-[16px]" />
          <Icon name="wifi" className="text-[16px]" />
          <Icon name="battery_full" className="rotate-90 text-[16px]" />
        </span>
      </div>
      <p className="pt-3 text-center text-[15px] font-bold">{name}</p>
      <div className="flex flex-col items-center gap-2 pt-4">
        <span className="flex size-20 items-center justify-center rounded-full bg-neutral-200 text-2xl font-bold">{(name || 'K').charAt(0).toUpperCase()}</span>
        <p className="text-[13px] font-semibold">{handle}</p>
        <div className="flex gap-6 text-center text-[11px] text-neutral-500">
          {['Following', 'Followers', 'Likes'].map((l) => (
            <div key={l}>
              <p className="text-[15px] font-bold text-neutral-900">...</p>
              {l}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex border-b border-neutral-200 text-neutral-500">
        <span className="flex flex-1 justify-center border-b-2 border-neutral-900 pb-2 text-neutral-900">
          <Icon name="grid_view" className="text-[20px]" />
        </span>
        <span className="flex flex-1 justify-center pb-2"><Icon name="lock" className="text-[20px]" /></span>
        <span className="flex flex-1 justify-center pb-2"><Icon name="favorite" className="text-[20px]" /></span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-white">
        <div className="relative aspect-[3/4] overflow-hidden bg-neutral-900">
          <Slide image={post.images[0]} templates={templates} className="object-cover" />
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 text-[10px] font-semibold text-white">
            <Icon name="photo_library" className="text-[12px]" />
            {post.images.length}
          </span>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] bg-neutral-100" />
        ))}
      </div>
    </div>
  );
}

/** Xem trên trình duyệt máy tính: ảnh bên trái, tên kênh + chú thích bên phải. */
function WebView({ post, name, handle, templates, index, setIndex }) {
  const total = post.images.length;
  return (
    <div className="mx-auto flex w-[var(--phone-w)] overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-sm">
      <div className="relative w-[58%] bg-black" style={{ aspectRatio: '3 / 4' }}>
        <Slide image={post.images[index]} templates={templates} />
        {total > 1 && (
          <>
            <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} aria-label="Ảnh trước"
              className="absolute left-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/80">
              <Icon name="chevron_left" className="text-base" />
            </button>
            <button type="button" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))} aria-label="Ảnh sau"
              className="absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/80">
              <Icon name="chevron_right" className="text-base" />
            </button>
          </>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2 p-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold">{(name || 'K').charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-bold">{name}</p>
            <p className="truncate text-[10px] text-neutral-500">{handle}</p>
          </div>
        </div>
        <p className="line-clamp-6 text-[11px] leading-snug">
          {post.title} <span className="font-semibold">{(post.hashtags ?? []).map((h) => `#${h}`).join(' ')}</span>
        </p>
        <p className="flex items-center gap-1 text-[10px] text-neutral-500">
          <Icon name="music_note" className="text-[12px]" />
          <span className="truncate">Original sound - {name}</span>
        </p>
      </div>
    </div>
  );
}

const MODES = [
  ['feed', 'Feed'],
  ['profile', 'Profile'],
  ['web', 'Web'],
];

/**
 * fitScreen: thu nhỏ khung theo chiều cao màn hình (cột xem trước ghim bên phải trên desktop) để thấy trọn khung, nút
 * chọn chế độ và dòng thông tin mà không phải cuộn.
 */
export default function TikTokPreview({ post, channelName, templates = {}, onEdit, fitScreen = false }) {
  const [mode, setMode] = useState('feed');
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [post?.id]);

  const name = channelName || 'Kênh';
  const handle = `@${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '') || 'kenh'}`;

  const phoneWidth = fitScreen ? 'min(100%, 360px, calc((100vh - 230px) * 0.4615))' : 'min(100%, 360px)';

  return (
    <div className="space-y-2" style={{ '--phone-w': phoneWidth }}>
      {/* Feed / Profile / Web như TikTok Studio */}
      <div className="mx-auto flex w-[var(--phone-w)] rounded-lg bg-surface-container p-1">
        {MODES.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setMode(key)}
            className={`flex-1 rounded-md py-1 text-xs font-semibold ${mode === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-on-surface-variant'}`}>
            {label}
          </button>
        ))}
      </div>

      {!post ? (
        <div className="mx-auto flex aspect-[360/780] w-[var(--phone-w)] items-center justify-center rounded-[28px] bg-black p-6 text-center text-xs text-white/60">
          Bấm vào 1 bài bên trái để xem trước
        </div>
      ) : mode === 'feed' ? (
        <FeedView post={post} name={name} templates={templates} index={Math.min(index, post.images.length - 1)} setIndex={setIndex} />
      ) : mode === 'profile' ? (
        <ProfileView post={post} name={name} handle={handle} templates={templates} />
      ) : (
        <WebView post={post} name={name} handle={handle} templates={templates} index={Math.min(index, post.images.length - 1)} setIndex={setIndex} />
      )}

      {post && (
        <div className="mx-auto w-[var(--phone-w)] space-y-1 text-center">
          <p className="text-xs text-on-surface-variant">
            Đăng lúc {new Date(post.scheduled_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
            {post.type === 'video' && ' · Bài video (worker dựng video từ các ảnh này)'}
          </p>
          {post.hook && <p className="text-xs font-semibold text-on-surface">Hook: {post.hook}</p>}
          {post.images.some((i) => i.overlay_text && !i.overlay_url) && (
            <p className="text-[11px] text-amber-700">Chữ trên ảnh đang là bản xem trước, worker chưa chèn vào ảnh thật.</p>
          )}
          {onEdit && (
            <button type="button" onClick={onEdit} className="mt-1 inline-flex items-center gap-1 rounded-lg border border-outline-variant/60 px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container">
              <Icon name="edit" className="text-sm" />
              Sửa chữ / làm lại
            </button>
          )}
        </div>
      )}
    </div>
  );
}
