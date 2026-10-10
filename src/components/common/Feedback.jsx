import Icon from './Icon';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-surface-container ${className}`} />;
}

export function ErrorState({ error, onRetry }) {
  // Không gọi được API -> thông báo bảo trì màu xanh nhạt thay vì đỏ
  const maintenance = error?.maintenance;
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center ${
        maintenance ? 'border-emerald-200 bg-emerald-50' : 'border-error-container bg-error-container/40'
      }`}
    >
      <Icon name={maintenance ? 'construction' : 'error'} className={maintenance ? 'text-emerald-600' : 'text-error'} />
      <p className={`text-xs ${maintenance ? 'text-emerald-800' : 'text-on-error-container'}`}>{error?.message || 'Không tải được dữ liệu.'}</p>
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
