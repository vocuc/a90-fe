import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import Icon from '../common/Icon';
import { Chip, PrimaryButton, SectionLabel, Slider, clamp, downloadCanvas, loadImageFile } from './toolUtils';
import { readJsonCookie, writeJsonCookie } from '../../utils/cookie';

const PRESETS = ['1:1', '4:3', '3:4', '3:2', '16:9', '9:16', '4:5'].map((label) => {
  const [w, h] = label.split(':').map(Number);
  return { key: label, w, h };
});
const MAX_ZOOM = 8;
const LOGO_MARGIN = 0.02; // khoảng cách logo tới mép khung (tỷ lệ theo chiều rộng khung)
const WM_ANGLE = -30; // góc nghiêng chữ chìm (độ)

// Cấu hình logo và chữ chìm lưu vào cookie để lần sau không phải chỉnh lại
const LOGO_COOKIE = 'tool_logo_opts';
const WM_COOKIE = 'tool_watermark';
const ORIGINAL = { key: 'orig' };
const DEFAULT_LOGO_OPTS = { size: 7, radius: 12, opacity: 80 };
const DEFAULT_WM = { text: '', size: 2.5, opacity: 33, gapX: 50, gapY: 37 };

const inputClass =
  'rounded-lg border-outline-variant/60 bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface focus:border-primary-container focus:ring-primary-container';

// Chữ chìm lặp chéo. Mọi kích thước tính theo % chiều rộng khung nên bản xem trước và ảnh xuất giống nhau.
function paintWatermark(g, w, h, wm) {
  const text = wm.text.trim();
  if (!text) return;
  const fs = (wm.size / 100) * w;
  const gx = (wm.gapX / 100) * w;
  const gy = (wm.gapY / 100) * w;
  g.save();
  g.globalAlpha = wm.opacity / 100;
  g.font = `700 ${fs}px system-ui,-apple-system,"Segoe UI",Arial,sans-serif`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.strokeStyle = 'rgba(0,0,0,.65)';
  g.lineWidth = Math.max(1, fs * 0.06);
  g.lineJoin = 'round';
  const stepX = Math.max(1, g.measureText(text).width + gx);
  const stepY = Math.max(1, fs + gy);
  const R = Math.hypot(w, h) / 2 + stepX; // bán kính phủ kín khung sau khi xoay
  g.translate(w / 2, h / 2);
  g.rotate((WM_ANGLE * Math.PI) / 180);
  let row = 0;
  for (let y = -R; y <= R; y += stepY, row++) {
    const off = ((row % 2) * stepX) / 2; // so le các hàng
    for (let x = -R - stepX + off; x <= R; x += stepX) {
      g.strokeText(text, x, y);
      g.fillText(text, x, y);
    }
  }
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export default function LogoTool() {
  const [photo, setPhoto] = useState(null); // { image, url, name }
  const [ratio, setRatio] = useState(ORIGINAL);
  const [custom, setCustom] = useState({ w: 5, h: 7 });
  const [outWidth, setOutWidth] = useState('');
  const [format, setFormat] = useState('image/jpeg');
  const [logo, setLogo] = useState(null); // { image, url }
  const [logoPos, setLogoPos] = useState({ x: 0.95, y: 0.95 }); // tâm logo, 0..1 so với khung
  const [logoOpts, setLogoOpts] = useState(() => readJsonCookie(LOGO_COOKIE, DEFAULT_LOGO_OPTS));
  const [wm, setWm] = useState(() => readJsonCookie(WM_COOKIE, DEFAULT_WM));
  const [dragOver, setDragOver] = useState(false);

  // Hình học khung xem: vw/vh kích thước khung, base*z tỷ lệ hiển thị ảnh, ox/oy độ dời ảnh
  const geo = useRef({ vw: 0, vh: 0, base: 1, z: 1, ox: 0, oy: 0 });
  const [, rerender] = useReducer((x) => x + 1, 0);
  const viewRef = useRef(null);
  const wmRef = useRef(null);
  const fileRef = useRef(null);
  const logoFileRef = useRef(null);
  const pointers = useRef(new Map());
  const pinchDist = useRef(0);
  const logoDrag = useRef(null);

  const W = photo?.image.naturalWidth ?? 1;
  const H = photo?.image.naturalHeight ?? 1;
  const rw = ratio.key === 'orig' ? W : ratio.w;
  const rh = ratio.key === 'orig' ? H : ratio.h;

  const clampGeo = useCallback(() => {
    const g = geo.current;
    const s = g.base * g.z;
    g.ox = clamp(g.ox, Math.min(0, g.vw - W * s), 0);
    g.oy = clamp(g.oy, Math.min(0, g.vh - H * s), 0);
  }, [W, H]);

  const measure = useCallback(
    (reset) => {
      const el = viewRef.current;
      if (!el || !photo) return;
      const { width: vw, height: vh } = el.getBoundingClientRect();
      if (!vw || !vh) return;
      const g = geo.current;
      const nb = Math.max(vw / W, vh / H);
      if (reset || !g.vw) {
        Object.assign(g, { z: 1, base: nb, ox: (vw - W * nb) / 2, oy: (vh - H * nb) / 2 });
      } else {
        // Giữ nguyên phần đang xem khi khung đổi kích thước
        const k = nb / g.base;
        Object.assign(g, { ox: g.ox * k, oy: g.oy * k, base: nb });
      }
      g.vw = vw;
      g.vh = vh;
      clampGeo();
      rerender();
    },
    [photo, W, H, clampGeo],
  );

  useLayoutEffect(() => measure(true), [measure, rw, rh]);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const zoomTo = useCallback(
    (nz, cx, cy) => {
      const g = geo.current;
      nz = clamp(nz, 1, MAX_ZOOM);
      cx ??= g.vw / 2;
      cy ??= g.vh / 2;
      const s0 = g.base * g.z;
      const s1 = g.base * nz;
      const ix = (cx - g.ox) / s0; // điểm ảnh dưới con trỏ giữ nguyên vị trí
      const iy = (cy - g.oy) / s0;
      Object.assign(g, { z: nz, ox: cx - ix * s1, oy: cy - iy * s1 });
      clampGeo();
      rerender();
    },
    [clampGeo],
  );

  // Cuộn chuột để zoom (cần listener không passive để chặn cuộn trang)
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomTo(geo.current.z * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTo, photo]);

  // Vẽ lại chữ chìm sau mỗi lần render
  useEffect(() => {
    const cv = wmRef.current;
    const { vw, vh } = geo.current;
    if (!cv || !vw) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(vw * dpr);
    const ch = Math.round(vh * dpr);
    if (cv.width !== cw || cv.height !== ch) {
      cv.width = cw;
      cv.height = ch;
    }
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.scale(dpr, dpr);
    paintWatermark(g, vw, vh, wm);
  });

  useEffect(() => writeJsonCookie(LOGO_COOKIE, logoOpts), [logoOpts]);
  useEffect(() => writeJsonCookie(WM_COOKIE, wm), [wm]);

  // Thu hồi object URL khi đổi ảnh/logo hoặc rời trang
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);
  useEffect(() => () => logo && URL.revokeObjectURL(logo.url), [logo]);

  const loadPhoto = async (file) => {
    try {
      const { image, url } = await loadImageFile(file);
      geo.current.vw = 0;
      setRatio(ORIGINAL); // ảnh mới mặc định giữ kích thước gốc
      setPhoto({ image, url, name: file.name.replace(/\.[^.]+$/, '') || 'anh' });
    } catch {
      // Bỏ qua file không phải ảnh
    }
  };

  const loadLogo = async (file) => {
    try {
      const { image, url } = await loadImageFile(file);
      // Đặt logo sát góc dưới bên phải khung
      const { vw, vh } = geo.current;
      const w = (logoOpts.size / 100) * vw;
      const h = (w * image.naturalHeight) / image.naturalWidth;
      const m = LOGO_MARGIN * vw;
      setLogoPos({ x: (vw - m - w / 2) / vw, y: (vh - m - h / 2) / vh });
      setLogo({ image, url });
    } catch {
      // Bỏ qua file không phải ảnh
    }
  };

  // Kéo ảnh bằng 1 ngón/chuột, 2 ngón để pinch zoom
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    pinchDist.current = 0;
  };

  const onPointerMove = (e) => {
    const ptrs = pointers.current;
    if (!ptrs.has(e.pointerId)) return;
    const [px, py] = ptrs.get(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) {
      const g = geo.current;
      g.ox += e.clientX - px;
      g.oy += e.clientY - py;
      clampGeo();
      rerender();
      return;
    }
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinchDist.current) {
      const r = viewRef.current.getBoundingClientRect();
      zoomTo((geo.current.z * d) / pinchDist.current, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
    }
    pinchDist.current = d;
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    pinchDist.current = 0;
  };

  const onKeyDown = (e) => {
    const g = geo.current;
    const step = 20;
    if (e.key === 'ArrowLeft') g.ox += step;
    else if (e.key === 'ArrowRight') g.ox -= step;
    else if (e.key === 'ArrowUp') g.oy += step;
    else if (e.key === 'ArrowDown') g.oy -= step;
    else if (e.key === '+' || e.key === '=') return zoomTo(g.z * 1.1);
    else if (e.key === '-') return zoomTo(g.z / 1.1);
    else return;
    e.preventDefault();
    clampGeo();
    rerender();
  };

  // Kéo logo (không làm dời ảnh nền)
  const onLogoDown = (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    logoDrag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const onLogoMove = (e) => {
    const d = logoDrag.current;
    if (!d || d.id !== e.pointerId) return;
    e.stopPropagation();
    const { vw, vh } = geo.current;
    const dx = (e.clientX - d.x) / vw;
    const dy = (e.clientY - d.y) / vh;
    d.x = e.clientX;
    d.y = e.clientY;
    setLogoPos((p) => ({ x: clamp(p.x + dx, 0, 1), y: clamp(p.y + dy, 0, 1) }));
  };

  const onLogoUp = (e) => {
    e.stopPropagation();
    logoDrag.current = null;
  };

  const download = () => {
    if (!photo) return;
    const g = geo.current;
    const s = g.base * g.z;
    const sx = -g.ox / s;
    const sy = -g.oy / s;
    const sw = g.vw / s;
    const sh = g.vh / s;
    let w = Math.round(sw);
    let h = Math.round(sh);
    const ow = parseInt(outWidth, 10);
    if (ow > 0) {
      h = Math.round((ow * sh) / sw);
      w = ow;
    }
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(photo.image, sx, sy, sw, sh, 0, 0, w, h);
    paintWatermark(ctx, w, h, wm); // chữ chìm nằm dưới logo
    if (logo) {
      const lw = (logoOpts.size / 100) * w;
      const lh = (lw * logo.image.naturalHeight) / logo.image.naturalWidth;
      const x = logoPos.x * w - lw / 2;
      const y = logoPos.y * h - lh / 2;
      ctx.save();
      ctx.globalAlpha = logoOpts.opacity / 100;
      roundRect(ctx, x, y, lw, lh, (logoOpts.radius / 100) * Math.min(lw, lh));
      ctx.clip();
      ctx.drawImage(logo.image, x, y, lw, lh);
      ctx.restore();
    }
    const ext = format === 'image/png' ? 'png' : 'jpg';
    downloadCanvas(cv, `${photo.name}_${rw}x${rh}.${ext}`.replace(/[^\w.-]/g, '_'), format, 0.95);
  };

  const pickPhoto = () => fileRef.current.click();

  const fileInputs = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          if (e.target.files[0]) loadPhoto(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={logoFileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          if (e.target.files[0]) loadLogo(e.target.files[0]);
          e.target.value = '';
        }}
      />
    </>
  );

  if (!photo) {
    return (
      <div className="p-4">
        <button
          type="button"
          onClick={pickPhoto}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files[0]) loadPhoto(e.dataTransfer.files[0]);
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-12 text-center transition-colors ${
            dragOver
              ? 'border-primary-container bg-primary-fixed/40 text-primary'
              : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary-container'
          }`}
        >
          <Icon name="add_photo_alternate" className="text-4xl text-primary" />
          <span className="text-sm font-semibold text-on-surface">Bấm để chọn ảnh hoặc kéo ảnh vào đây</span>
          <span className="text-xs">Ảnh được xử lý ngay trên trình duyệt, không gửi đi đâu.</span>
        </button>
        {fileInputs}
      </div>
    );
  }

  const g = geo.current;
  const s = g.base * g.z;
  const cropW = Math.round(g.vw / s) || 0;
  const cropH = Math.round(g.vh / s) || 0;
  const logoW = logo ? (logoOpts.size / 100) * g.vw : 0;
  const logoH = logo ? (logoW * logo.image.naturalHeight) / logo.image.naturalWidth : 0;
  const ratioName = ratio.key === 'custom' ? `${rw}:${rh}` : ratio.key === 'orig' ? 'Gốc' : ratio.key;

  return (
    <div className="space-y-5 p-4">
      <div>
        <SectionLabel>Tỷ lệ khung hình</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={ratio.key === 'orig'} onClick={() => setRatio(ORIGINAL)}>
            Gốc
          </Chip>
          {PRESETS.map((p) => (
            <Chip key={p.key} active={ratio.key === p.key} onClick={() => setRatio(p)}>
              {p.key}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
          <span>Tuỳ chỉnh</span>
          <input
            type="number"
            min="1"
            max="100"
            value={custom.w}
            onChange={(e) => setCustom((c) => ({ ...c, w: e.target.value }))}
            aria-label="Rộng"
            className={`${inputClass} w-16`}
          />
          :
          <input
            type="number"
            min="1"
            max="100"
            value={custom.h}
            onChange={(e) => setCustom((c) => ({ ...c, h: e.target.value }))}
            aria-label="Cao"
            className={`${inputClass} w-16`}
          />
          <Chip
            active={ratio.key === 'custom'}
            onClick={() => {
              const w = parseFloat(custom.w);
              const h = parseFloat(custom.h);
              if (w > 0 && h > 0) setRatio({ key: 'custom', w, h });
            }}
          >
            Áp dụng
          </Chip>
        </div>
      </div>

      <div>
        <div
          ref={viewRef}
          tabIndex={0}
          aria-label="Khung cắt ảnh"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className="relative mx-auto cursor-grab touch-none select-none overflow-hidden rounded-lg bg-inverse-surface outline-none focus-visible:ring-2 focus-visible:ring-primary-container active:cursor-grabbing"
          style={{ aspectRatio: `${rw} / ${rh}`, width: `min(100%, ${Math.round((60 * rw) / rh)}vh)` }}
        >
          <img
            src={photo.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
            style={{ width: W, height: H, transform: `translate(${g.ox}px, ${g.oy}px) scale(${s})` }}
          />
          {/* Lưới 1/3 hỗ trợ căn bố cục */}
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                'linear-gradient(#fff,#fff) 33.33% 0/1px 100% no-repeat,linear-gradient(#fff,#fff) 66.66% 0/1px 100% no-repeat,linear-gradient(#fff,#fff) 0 33.33%/100% 1px no-repeat,linear-gradient(#fff,#fff) 0 66.66%/100% 1px no-repeat',
            }}
          />
          <canvas ref={wmRef} className="pointer-events-none absolute inset-0 size-full" />
          {logo && g.vw > 0 && (
            <div
              onPointerDown={onLogoDown}
              onPointerMove={onLogoMove}
              onPointerUp={onLogoUp}
              onPointerCancel={onLogoUp}
              className="absolute cursor-move touch-none overflow-hidden outline-dashed outline-1 outline-white/70"
              style={{
                width: logoW,
                height: logoH,
                left: logoPos.x * g.vw - logoW / 2,
                top: logoPos.y * g.vh - logoH / 2,
                borderRadius: (logoOpts.radius / 100) * Math.min(logoW, logoH),
                opacity: logoOpts.opacity / 100,
              }}
            >
              <img src={logo.url} alt="Logo" draggable={false} className="pointer-events-none block size-full" />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <ZoomButton icon="remove" label="Thu nhỏ" onClick={() => zoomTo(g.z / 1.2)} />
          <input
            type="range"
            min="1"
            max={MAX_ZOOM}
            step="0.01"
            value={g.z}
            onChange={(e) => zoomTo(parseFloat(e.target.value))}
            aria-label="Zoom"
            className="min-w-0 flex-1 accent-primary-container"
          />
          <ZoomButton icon="add" label="Phóng to" onClick={() => zoomTo(g.z * 1.2)} />
          <ZoomButton icon="restart_alt" label="Đặt lại" onClick={() => measure(true)} />
          <span className="w-11 text-right text-xs tabular-nums text-on-surface-variant">{Math.round(g.z * 100)}%</span>
        </div>
        <p className="mt-2 text-center text-xs text-on-surface-variant">
          Ảnh gốc {W}×{H}px, vùng cắt {cropW}×{cropH}px, tỷ lệ {ratioName}
        </p>
        <button
          type="button"
          onClick={pickPhoto}
          className="mx-auto mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Icon name="swap_horiz" className="text-base" />
          Chọn ảnh khác
        </button>
      </div>

      <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
        <h2 className="text-sm font-bold text-on-surface">Logo</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Chip onClick={() => logoFileRef.current.click()}>{logo ? 'Đổi logo' : 'Tải logo lên'}</Chip>
          {logo && <Chip onClick={() => setLogo(null)}>Xoá logo</Chip>}
        </div>
        {logo && <p className="text-xs text-on-surface-variant">Kéo logo trong khung để đổi vị trí.</p>}
        <Slider
          label="Bo góc"
          min="0"
          max="50"
          step="1"
          value={logoOpts.radius}
          disabled={!logo}
          onChange={(e) => setLogoOpts((o) => ({ ...o, radius: +e.target.value }))}
          display={`${logoOpts.radius}%`}
        />
        <Slider
          label="Độ mờ"
          min="5"
          max="100"
          step="1"
          value={logoOpts.opacity}
          disabled={!logo}
          onChange={(e) => setLogoOpts((o) => ({ ...o, opacity: +e.target.value }))}
          display={`${logoOpts.opacity}%`}
        />
        <Slider
          label="Kích thước"
          min="5"
          max="100"
          step="1"
          value={logoOpts.size}
          disabled={!logo}
          onChange={(e) => setLogoOpts((o) => ({ ...o, size: +e.target.value }))}
          display={`${logoOpts.size}%`}
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
        <h2 className="text-sm font-bold text-on-surface">Chữ chìm chéo màn hình</h2>
        <input
          type="text"
          maxLength={80}
          value={wm.text}
          onChange={(e) => setWm((w) => ({ ...w, text: e.target.value }))}
          placeholder="Nhập chữ (để trống = tắt), ví dụ: © tenbanquyen.com"
          autoComplete="off"
          className={`${inputClass} w-full`}
        />
        <Slider
          label="Cỡ chữ"
          min="1"
          max="15"
          step="0.5"
          value={wm.size}
          onChange={(e) => setWm((w) => ({ ...w, size: +e.target.value }))}
          display={`${wm.size}%`}
        />
        <Slider
          label="Độ mờ"
          min="5"
          max="100"
          step="1"
          value={wm.opacity}
          onChange={(e) => setWm((w) => ({ ...w, opacity: +e.target.value }))}
          display={`${wm.opacity}%`}
        />
        <Slider
          label="Cách lần lặp"
          min="0"
          max="50"
          step="1"
          value={wm.gapX}
          onChange={(e) => setWm((w) => ({ ...w, gapX: +e.target.value }))}
          display={`${wm.gapX}%`}
        />
        <Slider
          label="Cách hàng"
          min="0"
          max="50"
          step="1"
          value={wm.gapY}
          onChange={(e) => setWm((w) => ({ ...w, gapY: +e.target.value }))}
          display={`${wm.gapY}%`}
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
        <h2 className="text-sm font-bold text-on-surface">Xuất ảnh</h2>
        <div className="flex gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-on-surface-variant">
            Chiều rộng (px)
            <input
              type="number"
              min="16"
              max="8000"
              value={outWidth}
              onChange={(e) => setOutWidth(e.target.value)}
              placeholder={`Gốc (${cropW})`}
              className={inputClass}
            />
          </label>
          <label className="flex w-24 flex-col gap-1 text-xs text-on-surface-variant">
            Định dạng
            <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputClass}>
              <option value="image/jpeg">JPG</option>
              <option value="image/png">PNG</option>
            </select>
          </label>
        </div>
        <PrimaryButton onClick={download}>
          <Icon name="download" className="text-lg" />
          Tải về
        </PrimaryButton>
      </section>

      {fileInputs}
    </div>
  );
}

function ZoomButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 text-on-surface hover:border-primary-container"
    >
      <Icon name={icon} className="text-lg" />
    </button>
  );
}
