import Icon from './Icon';

/** Danh sách số trang cần hiện: luôn có trang đầu, trang cuối và 1 trang mỗi bên trang hiện tại; chỗ bị bỏ là '…'. */
export function pageItems(page, lastPage) {
  if (lastPage <= 7) return Array.from({ length: lastPage }, (_, i) => i + 1);
  const pages = new Set([1, lastPage, page - 1, page, page + 1]);
  // Gần đầu / cuối: hiện thêm cho đủ 5 số liền nhau, tránh "1 … 3"
  if (page <= 4) [2, 3, 4, 5].forEach((p) => pages.add(p));
  if (page >= lastPage - 3) [lastPage - 4, lastPage - 3, lastPage - 2, lastPage - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= lastPage).sort((a, b) => a - b);
  const items = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push(`gap-${p}`);
    items.push(p);
  });
  return items;
}

const BTN = 'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold disabled:opacity-40';

/** Phân trang dạng ‹ 1 2 3 … 10 ›. Ẩn khi chỉ có 1 trang. */
export default function Pagination({ page, lastPage, onChange, disabled = false, className = '' }) {
  if (!lastPage || lastPage <= 1) return null;
  return (
    <nav aria-label="Phân trang" className={`flex flex-wrap items-center justify-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={disabled || page <= 1}
        aria-label="Trang trước"
        className={`${BTN} text-on-surface-variant hover:bg-surface-container`}
      >
        <Icon name="chevron_left" className="text-base" />
      </button>
      {pageItems(page, lastPage).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="px-1 text-xs text-outline" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            disabled={disabled}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Trang ${p}`}
            className={`${BTN} ${
              p === page ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={disabled || page >= lastPage}
        aria-label="Trang sau"
        className={`${BTN} text-on-surface-variant hover:bg-surface-container`}
      >
        <Icon name="chevron_right" className="text-base" />
      </button>
    </nav>
  );
}
