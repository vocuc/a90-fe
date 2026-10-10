export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const pad = (n) => String(n).padStart(2, '0');

export const timestamp = (d = new Date()) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

// Xuất canvas thành file và tải về máy
export function downloadCanvas(canvas, filename, type = 'image/png', quality = 0.95) {
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    type,
    quality,
  );
}

// Đọc file ảnh thành HTMLImageElement; url cần revoke khi không dùng nữa
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type.startsWith('image/')) return reject(new Error('not-image'));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('load-failed'));
    };
    image.src = url;
  });
}

export function SectionLabel({ children }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">{children}</p>;
}

export function Chip({ active, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-primary-container bg-primary-container text-on-primary'
          : 'border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:border-primary-container'
      }`}
    >
      {children}
    </button>
  );
}

// Thanh trượt có nhãn và giá trị hiển thị
export function Slider({ label, display, ...props }) {
  return (
    <label className="flex items-center gap-3 text-xs text-on-surface-variant">
      <span className="w-24 shrink-0">{label}</span>
      <input type="range" {...props} className="min-w-0 flex-1 accent-primary-container disabled:opacity-40" />
      <span className="w-11 shrink-0 text-right tabular-nums">{display}</span>
    </label>
  );
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-container text-sm font-bold text-on-primary shadow-md shadow-primary-container/25 transition-all hover:bg-primary active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
    >
      {children}
    </button>
  );
}
