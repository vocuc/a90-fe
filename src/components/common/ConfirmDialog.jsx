import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Dialog from './Dialog';

/**
 * Popup xác nhận / thông báo của app, thay window.confirm / window.alert: Safari trên iPhone có lúc chặn hộp thoại gốc
 * (confirm trả false ngay, không hiện gì) khiến nút bấm như không chạy, phải tải lại trang mới được.
 *
 *   const { confirm, alert } = useConfirm();
 *   if (!(await confirm('Xoá ảnh này?', { confirmLabel: 'Xoá', danger: true }))) return;
 *   await alert('Không xoá được, vui lòng thử lại.');
 */
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  // { message, title, confirmLabel, cancelLabel, danger, alertOnly }
  const [current, setCurrent] = useState(null);
  const resolveRef = useRef(null);

  const open = useCallback(
    (options) =>
      new Promise((resolve) => {
        // Đang mở popup khác: coi popup cũ là huỷ
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setCurrent(options);
      }),
    [],
  );

  const close = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setCurrent(null);
  }, []);
  const cancel = useCallback(() => close(false), [close]);

  const api = useMemo(
    () => ({
      confirm: (message, options = {}) => open({ message, ...options }),
      alert: (message, options = {}) => open({ message, alertOnly: true, ...options }),
    }),
    [open],
  );

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {current && (
        <Dialog
          title={current.title ?? (current.alertOnly ? 'Thông báo' : 'Xác nhận')}
          onClose={cancel}
          footer={
            <>
              {!current.alertOnly && (
                <button
                  type="button"
                  onClick={cancel}
                  className="h-11 flex-1 rounded-xl border border-outline-variant/50 text-sm font-bold text-on-surface hover:bg-surface-container"
                >
                  {current.cancelLabel ?? 'Huỷ'}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={`h-11 flex-1 rounded-xl text-sm font-bold shadow-md ${
                  current.danger ? 'bg-error text-on-error hover:opacity-90' : 'bg-primary-container text-on-primary hover:bg-primary'
                }`}
              >
                {current.confirmLabel ?? (current.alertOnly ? 'Đã hiểu' : 'Đồng ý')}
              </button>
            </>
          }
        >
          <p className="whitespace-pre-line text-sm text-on-surface">{current.message}</p>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm phải dùng bên trong ConfirmProvider');
  return ctx;
}
