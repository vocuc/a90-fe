/** Khung 1 nhóm trong các tab của trang kênh. */
export default function Section({ title, subtitle, action, children }) {
  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-on-surface">{title}</h2>
          {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Công tắc bật / tắt kèm nhãn. */
export function Switch({ checked, onChange, label, hint, disabled }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-10 rounded-full bg-outline-variant transition-colors peer-checked:bg-primary-container peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container/40 peer-disabled:opacity-60" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-on-surface">{label}</span>
        {hint && <span className="block text-xs text-on-surface-variant">{hint}</span>}
      </span>
    </label>
  );
}

/** Nhãn chủ đề của bài (chủ đề kênh, note/xay-kenh-tiktok/chu-de-va-tag-san-pham.txt mục 4). */
/** name rỗng: bài không chủ đề (chủ đề tuỳ chọn, 2026-11-24) hoặc chủ đề đã bị xoá -> "Không chủ đề". */
export function TopicBadge({ name }) {
  if (!name) {
    return (
      <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
        <span aria-hidden="true">#</span>
        <span className="truncate">Không chủ đề</span>
      </span>
    );
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-fixed/40 px-2 py-0.5 text-[11px] font-semibold text-primary">
      <span aria-hidden="true">#</span>
      <span className="truncate">{name}</span>
    </span>
  );
}

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

export const formatDay = (iso) =>
  new Date(iso).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
