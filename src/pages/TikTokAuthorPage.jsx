import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { TIKTOK_CONNECT_MESSAGES, authorizeTikTok, tiktokCallback } from '../api/social';

// Đã kết nối: tự quay về trang cũ sau chừng này
const BACK_DELAY = 1500;

// state chỉ dùng được 1 lần: React StrictMode chạy effect 2 lần thì dùng lại lời gọi đầu
const pending = new Map();
const callbackOnce = (params) => {
  const key = params.state || params.code || 'none';
  if (!pending.has(key)) pending.set(key, tiktokCallback(params));
  return pending.get(key);
};

/**
 * /mxh/tiktok/author: TikTok trả người dùng về đây sau màn hình đồng ý (Redirect URI của Login Kit), kèm code + state
 * (hoặc error). Gửi cho backend đổi lấy token, báo kết quả rồi quay về trang đã bấm "Kết nối TikTok".
 */
export default function TikTokAuthorPage() {
  useSeo({ title: 'Kết nối TikTok', noindex: true });
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [result, setResult] = useState(null); // { status, reason, redirect }
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let alive = true;
    callbackOnce({ code: params.get('code'), state: params.get('state'), error: params.get('error') })
      .then((data) => alive && setResult(data))
      .catch(() => alive && setResult({ status: 'error', reason: 'server_error', redirect: '/posts' }));
    return () => {
      alive = false;
    };
  }, [params]);

  const connected = result?.status === 'connected';
  const back = () => navigate(result?.redirect || '/posts', { replace: true });

  useEffect(() => {
    if (!connected) return undefined;
    queryClient.invalidateQueries({ queryKey: ['social', 'accounts'] });
    const t = setTimeout(() => navigate(result.redirect || '/posts', { replace: true }), BACK_DELAY);
    return () => clearTimeout(t);
  }, [connected, result, navigate, queryClient]);

  const retry = async () => {
    setRetrying(true);
    try {
      await authorizeTikTok(result?.redirect || '/posts');
    } catch {
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      {!result ? (
        <>
          <Icon name="progress_activity" className="animate-spin text-4xl text-primary" />
          <p className="text-sm font-bold text-on-surface">Đang kết nối TikTok...</p>
        </>
      ) : connected ? (
        <>
          <Icon name="check_circle" fill className="text-5xl text-emerald-600" />
          <p className="text-sm font-bold text-on-surface">{TIKTOK_CONNECT_MESSAGES.connected}</p>
          <p className="text-xs text-on-surface-variant">Bài đăng TikTok sẽ được gửi vào hộp thư TikTok của bạn.</p>
          <button type="button" onClick={back} className="mt-2 h-10 rounded-xl bg-primary px-6 text-sm font-bold text-on-primary">
            Tiếp tục
          </button>
        </>
      ) : (
        <>
          <Icon name="error" className="text-5xl text-error" />
          <p className="text-sm font-bold text-on-surface">
            {TIKTOK_CONNECT_MESSAGES[result.reason] ?? TIKTOK_CONNECT_MESSAGES.server_error}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={back}
              className="h-10 rounded-xl border border-outline-variant px-5 text-sm font-bold text-on-surface-variant"
            >
              Quay lại
            </button>
            <button
              type="button"
              onClick={retry}
              disabled={retrying}
              className="flex h-10 items-center gap-1 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary disabled:opacity-60"
            >
              {retrying && <Icon name="progress_activity" className="animate-spin text-base" />}
              Thử lại
            </button>
          </div>
        </>
      )}
    </div>
  );
}
