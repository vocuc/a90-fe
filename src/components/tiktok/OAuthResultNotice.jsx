import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../common/Icon';
import { OAUTH_RESULT_MESSAGES } from '../../api/tiktok';

/**
 * TikTok ủy quyền xong, backend đưa người dùng về trang kèm ?tiktok=connected | error&reason=...
 * Hiện thông báo rồi xoá tham số khỏi URL (tải lại trang không hiện lại).
 */
export default function OAuthResultNotice() {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState(null);

  useEffect(() => {
    const status = params.get('tiktok');
    if (!status) return;
    const ok = status === 'connected';
    const reason = ok ? 'connected' : params.get('reason');
    setResult({ ok, message: OAUTH_RESULT_MESSAGES[reason] ?? OAUTH_RESULT_MESSAGES.server_error });
    const next = new URLSearchParams(params);
    next.delete('tiktok');
    next.delete('reason');
    setParams(next, { replace: true });
  }, [params, setParams]);

  if (!result) return null;
  return (
    <p
      role="status"
      className={`mx-4 mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold lg:mx-auto lg:max-w-[1000px] ${
        result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-error-container/60 text-on-error-container'
      }`}
    >
      <Icon name={result.ok ? 'check_circle' : 'error'} fill={result.ok} className="text-base" />
      <span className="flex-1">{result.message}</span>
      <button type="button" onClick={() => setResult(null)} aria-label="Đóng" className="flex size-6 items-center justify-center rounded-full hover:bg-black/5">
        <Icon name="close" className="text-sm" />
      </button>
    </p>
  );
}
