import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import Icon from '../common/Icon';
import { FormAlert } from '../common/Form';
import { Chip, clamp } from '../tools/toolUtils';
import { cropBatchImage } from '../../api/batches';

const MAX_ZOOM = 8;
const ORIGINAL = { key: 'orig' };
const PRESETS = ['3:4', '1:1', '4:5', '9:16', '4:3', '16:9'].map((label) => {
  const [w, h] = label.split(':').map(Number);
  return { key: label, w, h };
});

// Tải ảnh qua fetch (CORS) thành blob để canvas không bị "tainted" khi xuất ảnh
async function loadRemoteImage(src) {
  const res = await fetch(src, { mode: 'cors', cache: 'no-store' });
  if (!res.ok) throw new Error('load-failed');
  const url = URL.createObjectURL(await res.blob());
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('load-failed'));
    };
    image.src = url;
  });
}

/**
 * Cắt một ảnh của lô: chọn tỷ lệ, kéo / phóng to ảnh trong khung (giống công cụ chèn logo), bấm Lưu thì cắt bằng
 * canvas và gửi ảnh mới lên máy chủ thay ảnh cũ. onSaved(imageMới).
 */
export default function CropImageDialog({ batchId, image, onSaved, onClose }) {
  const [photo, setPhoto] = useState(null); // { image, url }
  const [loadError, setLoadError] = useState(false);
  const [ratio, setRatio] = useState(ORIGINAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Hình học khung xem: vw/vh kích thước khung, base*z tỷ lệ hiển thị ảnh, ox/oy độ dời ảnh
  const geo = useRef({ vw: 0, vh: 0, base: 1, z: 1, ox: 0, oy: 0 });
  const [, rerender] = useReducer((x) => x + 1, 0);
  const viewRef = useRef(null);
  const pointers = useRef(new Map());
  const pinchDist = useRef(0);

  const W = photo?.image.naturalWidth ?? 1;
  const H = photo?.image.naturalHeight ?? 1;
  const rw = ratio.key === 'orig' ? W : ratio.w;
  const rh = ratio.key === 'orig' ? H : ratio.h;

  useEffect(() => {
    let alive = true;
    let loaded;
    loadRemoteImage(image.url)
      .then((p) => {
        loaded = p;
        if (alive) setPhoto(p);
        else URL.revokeObjectURL(p.url);
      })
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
      if (loaded) URL.revokeObjectURL(loaded.url);
    };
  }, [image.url]);

  // Esc để đóng, khoá cuộn trang phía sau
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [saving, onClose]);

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

  const save = async () => {
    const g = geo.current;
    const s = g.base * g.z;
    const sx = -g.ox / s;
    const sy = -g.oy / s;
    const sw = g.vw / s;
    const sh = g.vh / s;
    const cv = document.createElement('canvas');
    cv.width = Math.round(sw);
    cv.height = Math.round(sh);
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(photo.image, sx, sy, sw, sh, 0, 0, cv.width, cv.height);

    setSaving(true);
    setError(null);
    try {
      const blob = await new Promise((resolve, reject) =>
        cv.toBlob((b) => (b ? resolve(b) : reject(new Error('Không xuất được ảnh.'))), 'image/jpeg', 0.92),
      );
      onSaved(await cropBatchImage(batchId, image, blob));
    } catch (err) {
      setError(err?.message || 'Không lưu được ảnh, vui lòng thử lại.');
      setSaving(false);
    }
  };

  const g = geo.current;
  const s = g.base * g.z;
  const cropW = Math.round(g.vw / s) || 0;
  const cropH = Math.round(g.vh / s) || 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-image-title"
      onClick={() => !saving && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[95vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-surface-container-lowest shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center gap-3 border-b border-surface-container px-4 py-3">
          <h2 id="crop-image-title" className="flex-1 text-base font-bold text-on-surface">
            Cắt ảnh
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng"
            className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-50"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loadError ? (
            <FormAlert>Không tải được ảnh để cắt, vui lòng thử lại.</FormAlert>
          ) : !photo ? (
            <div className="flex h-64 items-center justify-center text-on-surface-variant">
              <Icon name="progress_activity" className="animate-spin text-3xl" />
            </div>
          ) : (
            <>
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

              <div
                ref={viewRef}
                aria-label="Khung cắt ảnh"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="relative mx-auto cursor-grab touch-none select-none overflow-hidden rounded-lg bg-inverse-surface active:cursor-grabbing"
                style={{ aspectRatio: `${rw} / ${rh}`, width: `min(100%, ${Math.round((55 * rw) / rh)}vh)` }}
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
              </div>

              <div className="flex items-center gap-2">
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
                <span className="w-11 text-right text-xs tabular-nums text-on-surface-variant">
                  {Math.round(g.z * 100)}%
                </span>
              </div>
              <p className="text-center text-xs text-on-surface-variant">
                Kéo để di chuyển, cuộn chuột hoặc 2 ngón để phóng to. Vùng cắt {cropW}×{cropH}px.
              </p>
            </>
          )}
          {error && <FormAlert>{error}</FormAlert>}
        </div>

        <div className="flex items-center gap-2 border-t border-surface-container p-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!photo || saving}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            <Icon name={saving ? 'progress_activity' : 'save'} className={`text-lg ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
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
