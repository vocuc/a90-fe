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
  isConnectionActive,
  tiktokConnectionsOf,
  tiktokNameOf,
} from '../../api/social';
import { useConfirm } from '../common/ConfirmDialog';

const btn = 'flex h-8 shrink-0 items-center gap-1 rounded-full px-4 text-xs font-bold disabled:opacity-60';

/**
 * "TikTok của bạn" (trang Tài khoản): người dùng tự kết nối một hoặc nhiều tài khoản TikTok để A51 gửi bài thẳng vào hộp
 * thư TikTok của họ (note/dang-tiktok-qua-api.txt, note/uy-quyen-nhieu-tiktok.txt). Khi đăng bài thì chọn tài khoản nhận bài.
 * Kết nối lại một tài khoản mất kết nối: ủy quyền lại bằng đúng tài khoản TikTok đó.
 */
export default function TikTokConnectionCard() {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useQuery({ queryKey: ['social', 'accounts'], queryFn: getAccounts, staleTime: 60_000 });
  const [busy, setBusy] = useState(null); // 'connect' | id tài khoản đang huỷ / kết nối lại
  const { confirm } = useConfirm();
  const [error, setError] = useState(null);
  const connections = tiktokConnectionsOf(accounts);

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

  const connect = (kind = 'connect') => run(kind, () => authorizeTikTok());
  const disconnect = async (account) => {
    if (!(await confirm(`Huỷ kết nối TikTok ${tiktokNameOf(account)}? Bài đăng sau đó sẽ không gửi vào tài khoản này nữa.`, { confirmLabel: 'Huỷ kết nối', danger: true }))) return;
    run(account.id, async () => {
      await disconnectTikTok(account.id);
      await queryClient.invalidateQueries({ queryKey: ['social', 'accounts'] });
      setBusy(null);
    });
  };

  return (
    <section className="rounded-2xl border border-outline-variant/40 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container">
          <Icon name="music_note" className="text-xl text-outline" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-on-surface">TikTok của bạn</h2>
          {isLoading ? (
            <Skeleton className="mt-1 h-3 w-32" />
          ) : (
            <p className="text-xs text-on-surface-variant">
              {connections.length
                ? `Đã kết nối ${connections.length} tài khoản. Khi đăng bài, chọn tài khoản nhận bài.`
                : 'Kết nối để A51 gửi bài vào hộp thư TikTok của bạn.'}
            </p>
          )}
        </div>
        {!isLoading && (
          <button type="button" onClick={() => connect()} disabled={!!busy} className={`${btn} bg-primary text-on-primary`}>
            <Icon
              name={busy === 'connect' ? 'progress_activity' : connections.length ? 'add' : 'link'}
              className={`text-base ${busy === 'connect' ? 'animate-spin' : ''}`}
            />
            {connections.length ? 'Thêm' : 'Kết nối'}
          </button>
        )}
      </div>

      {connections.length > 0 && (
        <ul className="mt-3 divide-y divide-surface-container border-t border-surface-container">
          {connections.map((account) => {
            const active = isConnectionActive(account);
            return (
              <li key={account.id} className="py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar src={account.connection?.avatarUrl} name={account.name} className="size-9 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{account.name}</p>
                    <p className={`truncate text-xs ${active ? 'text-emerald-700' : 'text-error'}`}>
                      {account.username ? `@${account.username} · ` : ''}
                      {active ? 'Đã kết nối' : 'Mất kết nối'}
                    </p>
                  </div>
                  {!active && (
                    <button
                      type="button"
                      onClick={() => connect(`reconnect-${account.id}`)}
                      disabled={!!busy}
                      className={`${btn} bg-primary text-on-primary`}
                    >
                      {busy === `reconnect-${account.id}` && <Icon name="progress_activity" className="animate-spin text-base" />}
                      Kết nối lại
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => disconnect(account)}
                    disabled={!!busy}
                    aria-label={`Huỷ kết nối ${tiktokNameOf(account)}`}
                    className={`${btn} border border-outline-variant text-on-surface-variant hover:text-error`}
                  >
                    {busy === account.id && <Icon name="progress_activity" className="animate-spin text-base" />}
                    Huỷ
                  </button>
                </div>
                {!active && (
                  <p className="mt-1 pl-12 text-xs text-error">
                    {TIKTOK_CONNECT_MESSAGES[account.connection?.status] ?? TIKTOK_CONNECT_MESSAGES.expired} Đăng nhập đúng tài
                    khoản {tiktokNameOf(account)} trên màn hình TikTok.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {connections.length > 0 && (
        <p className="mt-2 text-[11px] text-on-surface-variant">
          Thêm tài khoản: trên màn hình TikTok, đăng xuất hoặc chuyển sang tài khoản TikTok muốn thêm rồi đồng ý.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </section>
  );
}
