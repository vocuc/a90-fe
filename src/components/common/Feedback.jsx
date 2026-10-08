import Icon from './Icon';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-surface-container ${className}`} />;
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-error-container bg-error-container/40 p-4 text-center">
      <Icon name="error" className="text-error" />
      <p className="text-xs text-on-error-container">{error?.message || 'Không tải được dữ liệu.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-bold text-primary hover:underline">
          Thử lại
        </button>
      )}
    </div>
  );
}

// children: nút hành động hiện dưới thông báo (tuỳ chọn)
export function EmptyState({ icon = 'search_off', message, children }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-on-surface-variant">
      <Icon name={icon} className="text-4xl text-outline" />
      <p className="text-sm">{message}</p>
      {children}
    </div>
  );
}
