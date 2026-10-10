import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Icon from '../common/Icon';
import { Chip, PrimaryButton, SectionLabel, Slider, clamp, downloadCanvas, loadImageFile, timestamp } from './toolUtils';

// Chiều rộng ảnh xuất (px), chiều cao tính theo tỷ lệ khung
const OUT_W = 1200;
const BG = '#111111';

// Vùng cắt của ảnh để phủ kín ô (w×h) theo mức zoom; giữ tâm cũ khi zoom/đổi tỷ lệ
function getCrop(state, w, h) {
  const { image } = state;
  const br = w / h;
  let baseSw;
  let baseSh;
  if (image.width / image.height > br) {
    baseSh = image.height;
    baseSw = baseSh * br;
  } else {
    baseSw = image.width;
    baseSh = baseSw / br;
  }
  const sw = baseSw / state.scale;
  const sh = baseSh / state.scale;
  if (state.sx === undefined) {
    state.sx = (image.width - sw) / 2;
    state.sy = (image.height - sh) / 2;
  } else {
    state.sx += (state.lastSw - sw) / 2;
    state.sy += (state.lastSh - sh) / 2;
  }
  state.sx = clamp(state.sx, 0, Math.max(0, image.width - sw));
  state.sy = clamp(state.sy, 0, Math.max(0, image.height - sh));
  state.lastSw = sw;
  state.lastSh = sh;
  return { sx: state.sx, sy: state.sy, sw, sh };
}

export default function CollageTool({ tool }) {
  const { slots, ratios, layout } = tool;
  const [ratioLabel, setRatioLabel] = useState(tool.defaultRatio);
  const ratio = ratios.find((r) => r.label === ratioLabel);
  const W = OUT_W;
  const H = Math.round((W * ratio.h) / ratio.w);
  const boxes = useMemo(() => layout(W, H), [layout, W, H]);

  // Trạng thái từng ô: { image, url, scale, sx, sy, lastSw, lastSh }; đổi trực tiếp khi kéo cho mượt
  const imgs = useRef({});
  const [, rerender] = useReducer((x) => x + 1, 0);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const pickingSlot = useRef(null);
  const dragging = useRef(null);
  const [dropSlot, setDropSlot] = useState(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    slots.forEach(({ key }) => {
      const st = imgs.current[key];
      if (!st) return;
      const b = boxes[key];
      const { sx, sy, sw, sh } = getCrop(st, b.w, b.h);
      ctx.drawImage(st.image, sx, sy, sw, sh, b.x, b.y, b.w, b.h);
    });
  }, [W, H, boxes, slots]);

  useEffect(draw);

  useEffect(
    () => () => Object.values(imgs.current).forEach((st) => URL.revokeObjectURL(st.url)),
    [],
  );

  const setImage = async (key, file) => {
    try {
      const { image, url } = await loadImageFile(file);
      const old = imgs.current[key];
      if (old) URL.revokeObjectURL(old.url);
      imgs.current[key] = { image, url, scale: 1 };
      rerender();
    } catch {
      // Bỏ qua file không phải ảnh
    }
  };

  const pick = (key) => {
    pickingSlot.current = key;
    fileRef.current.click();
  };

  // Toạ độ con trỏ quy về hệ toạ độ ảnh xuất
  const toCanvas = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * W) / rect.width, y: ((e.clientY - rect.top) * H) / rect.height };
  };

  const slotAt = ({ x, y }) =>
    slots.find(({ key }) => {
      const b = boxes[key];
      return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    })?.key;

  const onPointerDown = (e) => {
    const p = toCanvas(e);
    const key = slotAt(p);
    if (!key || !imgs.current[key]) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = { key, id: e.pointerId, ...p };
  };

  const onPointerMove = (e) => {
    const d = dragging.current;
    if (!d || d.id !== e.pointerId) return;
    const p = toCanvas(e);
    const st = imgs.current[d.key];
    const b = boxes[d.key];
    if (st.lastSw === undefined) return;
    st.sx = clamp(st.sx - (p.x - d.x) * (st.lastSw / b.w), 0, Math.max(0, st.image.width - st.lastSw));
    st.sy = clamp(st.sy - (p.y - d.y) * (st.lastSh / b.h), 0, Math.max(0, st.image.height - st.lastSh));
    d.x = p.x;
    d.y = p.y;
    draw();
  };

  const endDrag = () => {
    dragging.current = null;
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDropSlot(slotAt(toCanvas(e)) ?? null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDropSlot(null);
    const key = slotAt(toCanvas(e));
    const file = e.dataTransfer.files[0];
    if (key && file) setImage(key, file);
  };

  const setScale = (key, scale) => {
    imgs.current[key].scale = scale;
    rerender();
  };

  const ready = slots.every(({ key }) => imgs.current[key]);
  const pct = (v, total) => `${(v / total) * 100}%`;

  return (
    <div className="space-y-5 p-4">
      <div>
        <SectionLabel>Tỷ lệ khung hình</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {ratios.map((r) => (
            <Chip key={r.label} active={r.label === ratioLabel} onClick={() => setRatioLabel(r.label)}>
              {r.label}
            </Chip>
          ))}
        </div>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-xl bg-inverse-surface shadow-sm"
        style={{ width: `min(100%, ${Math.round((60 * W) / H)}vh)` }}
        onDragOver={onDragOver}
        onDragLeave={() => setDropSlot(null)}
        onDrop={onDrop}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block h-auto w-full cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
        {slots.map(({ key, label }) => {
          const b = boxes[key];
          const filled = !!imgs.current[key];
          const style = { left: pct(b.x, W), top: pct(b.y, H), width: pct(b.w, W), height: pct(b.h, H) };
          return filled ? (
            <div key={key} className="pointer-events-none absolute" style={style}>
              <button
                type="button"
                onClick={() => pick(key)}
                aria-label={`Đổi ${label.toLowerCase()}`}
                className="pointer-events-auto absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-inverse-surface/60 text-on-primary backdrop-blur-sm hover:bg-inverse-surface/80"
              >
                <Icon name="swap_horiz" className="text-lg" />
              </button>
              {dropSlot === key && <div className="absolute inset-0 border-2 border-primary-fixed-dim" />}
            </div>
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              style={style}
              className={`absolute flex flex-col items-center justify-center gap-1 border-2 border-dashed p-1 text-center transition-colors ${
                dropSlot === key
                  ? 'border-primary-fixed-dim bg-primary-container/30 text-on-primary'
                  : 'border-outline/60 text-inverse-on-surface/80 hover:border-primary-fixed-dim hover:text-on-primary'
              }`}
            >
              <Icon name="add_photo_alternate" className="text-2xl" />
              <span className="text-[11px] font-semibold leading-tight">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
        <SectionLabel>Zoom từng ảnh</SectionLabel>
        {slots.map(({ key, label }) => {
          const st = imgs.current[key];
          const scale = st?.scale ?? 1;
          return (
            <Slider
              key={key}
              label={label}
              min="1"
              max="3"
              step="0.05"
              value={scale}
              disabled={!st}
              onChange={(e) => setScale(key, parseFloat(e.target.value))}
              display={`${scale.toFixed(2)}x`}
            />
          );
        })}
        <p className="text-xs leading-relaxed text-on-surface-variant">
          Bấm vào từng ô để chọn ảnh (hoặc kéo thả ảnh vào ô). Kéo trên ảnh để chỉnh phần hiển thị, dùng thanh trượt để
          phóng to/thu nhỏ.
        </p>
      </div>

      <PrimaryButton disabled={!ready} onClick={() => downloadCanvas(canvasRef.current, `anh-ghep-${timestamp()}.png`)}>
        <Icon name="download" className="text-lg" />
        Tải ảnh kết quả (PNG)
      </PrimaryButton>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files[0];
          if (file && pickingSlot.current) setImage(pickingSlot.current, file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
