import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Avatar from '../common/Avatar';
import Icon from '../common/Icon';
import { Skeleton } from '../common/Feedback';
import {
  TIKTOK_CONNECT_MESSAGES,
  authorizeTikTok,
  disconnectTikTok,
  getAccounts,
  tiktokConnectionOf,
} from '../../api/social';

const btn = 'flex h-8 shrink-0 items-center gap-1 rounded-full px-4 text-xs font-bold disabled:opacity-60';

/**
 * "TikTok của bạn" (trang Tài khoản): người dùng tự kết nối TikTok để A51 gửi bài thẳng vào hộp thư TikTok của họ
 * (note/dang-tiktok-qua-api.txt). Đã kết nối thì mọi bài đăng TikTok đi qua API, không qua tài khoản A51.
 */
export default function TikTokConnectionCard() {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useQuery({ queryKey: ['social', 'accounts'], queryFn: getAccounts, staleTime: 60_000 });
  const [busy, setBusy] = useState(null); // 'connect' | 'disconnect'
  const [error, setError] = useState(null);
  const connection = tiktokConnectionOf(accounts);
  const active = connection?.connection?.status === 'active';

  const run = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      setBusy(null);
    }
  };

  const connect = () => run('connect', () => authorizeTikTok());
  const disconnect = () => {
    if (!window.confirm('Huỷ kết nối TikTok? Bài đăng TikTok sau đó sẽ không gửi vào tài khoản của bạn nữa.')) return;
    run('disconnect', async () => {
      await disconnectTikTok();
      await queryClient.invalidateQueries({ queryKey: ['social', 'accounts'] });
      setBusy(null);
    });
  };

  return (
    <section className="rounded-2xl border border-outline-variant/40 p-4">
      <div className="flex items-center gap-3">
        {isLoading ? (
          <Skeleton className="size-10 !rounded-full" />
        ) : connection ? (
          <Avatar src={connection.connection?.avatarUrl} name={connection.name} className="size-10 shrink-0" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container">
            <Icon name="music_note" className="text-xl text-outline" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-on-surface">TikTok của bạn</h2>
          {isLoading ? (
            <Skeleton className="mt-1 h-3 w-32" />
          ) : connection ? (
            <p className={`truncate text-xs ${active ? 'text-emerald-700' : 'text-error'}`}>
              {connection.username ? `@${connection.username}` : connection.name} ·{' '}
              {active ? 'Đã kết nối' : 'Mất kết nối'}
            </p>
          ) : (
            <p className="text-xs text-on-surface-variant">Kết nối để A51 gửi bài vào hộp thư TikTok của bạn.</p>
          )}
        </div>
        {!isLoading &&
          (!connection || !active ? (
            <button type="button" onClick={connect} disabled={!!busy} className={`${btn} bg-primary text-on-primary`}>
              <Icon name={busy === 'connect' ? 'progress_activity' : 'link'} className={`text-base ${busy === 'connect' ? 'animate-spin' : ''}`} />
              {connection ? 'Kết nối lại' : 'Kết nối'}
            </button>
          ) : (
            <button
              type="button"
              onClick={disconnect}
              disabled={!!busy}
              className={`${btn} border border-outline-variant text-on-surface-variant hover:text-error`}
            >
              {busy === 'disconnect' && <Icon name="progress_activity" className="animate-spin text-base" />}
              Huỷ kết nối
            </button>
          ))}
      </div>
      {connection && !active && (
        <p className="mt-2 text-xs text-error">{TIKTOK_CONNECT_MESSAGES[connection.connection?.status] ?? TIKTOK_CONNECT_MESSAGES.expired}</p>
      )}
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </section>
  );
}
