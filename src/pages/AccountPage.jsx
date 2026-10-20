import useSeo from '../hooks/useSeo';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/common/Avatar';
import AccountSwitcher from '../components/auth/AccountSwitcher';
import TikTokConnectionCard from '../components/social/TikTokConnectionCard';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { useAuth } from '../context/AuthContext';
import { useMe } from '../hooks/queries';
import { useCreatorWallet } from '../hooks/creatorQueries';
import { formatVnd } from '../utils/format';

// Khớp UserRole của backend
const ROLE_LABEL = { user: 'Thành viên', admin: 'Quản trị viên' };

function InfoRow({ icon, label, children }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon name={icon} className="text-xl text-outline" />
      <span className="flex-1 text-sm text-on-surface-variant">{label}</span>
      <span className="min-w-0 truncate text-sm font-semibold text-on-surface">{children}</span>
    </div>
  );
}

/** /account: thông tin tài khoản đang đăng nhập và nút đăng xuất. */
export default function AccountPage() {
  useSeo({ title: 'Tài khoản', noindex: true });
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { data: me, isLoading, error, refetch } = useMe();
  const { data: wallet, isLoading: walletLoading } = useCreatorWallet();
  const [loggingOut, setLoggingOut] = useState(false);

  // Backend chỉ cho quản lý Creative khi đã có profile người bán (middleware "creator")
  const menu = [
    { to: '/account/history', icon: 'receipt_long', title: 'Lịch sử mua hàng' },
    { to: '/seller/settings', icon: 'tune', title: 'Quản lý cửa hàng' },
    { to: '/seller/creatives', icon: 'inventory_2', title: 'Quản lý Creative', disabled: !me?.creatorProfile },
    { to: '/shipping-orders', icon: 'local_shipping', title: 'Đơn GHN', disabled: !me?.creatorProfile },
    { to: '/support', icon: 'support_agent', title: 'Trung tâm hỗ trợ' },
    { to: '/terms', icon: 'gavel', title: 'Điều khoản sử dụng' },
    { to: '/privacy', icon: 'shield_person', title: 'Chính sách quyền riêng tư' },
  ];

  // Về trang chủ trước rồi mới xoá phiên, tránh RequireAuth chuyển sang trang đăng nhập
  const onLogout = async () => {
    setLoggingOut(true);
    navigate('/', { replace: true });
    await logout();
  };

  return (
    <>
      <header className="sticky top-[60px] z-30 flex h-[53px] items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-4 py-2 backdrop-blur-md">
        <h1 className="flex-1 text-base font-bold text-on-surface">Tài khoản</h1>
        <Link
          to="/account/topup"
          className="flex h-8 items-center gap-1 rounded-full bg-primary px-5 text-xs font-bold text-on-primary transition-opacity hover:opacity-90"
        >
          <Icon name="add_card" className="text-base" />
          Nạp ví
        </Link>
      </header>

      <div className="space-y-4 p-4">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <>
            <section className="flex items-center gap-4 rounded-2xl border border-outline-variant/40 p-4">
              {isLoading ? (
                <Skeleton className="size-16 !rounded-full" />
              ) : (
                <Avatar src={me.avatarUrl} name={me.name} className="size-16 shrink-0 ring-2 ring-primary/20" />
              )}
              <div className="min-w-0 flex-1">
                {isLoading ? (
                  <>
                    <Skeleton className="mb-2 h-5 w-32" />
                    <Skeleton className="h-4 w-44" />
                  </>
                ) : (
                  <>
                    <h2 className="truncate text-lg font-bold text-on-surface">{me.name}</h2>
                    <p className="truncate text-sm text-on-surface-variant">{me.email}</p>
                  </>
                )}
              </div>
            </section>

            <section className="divide-y divide-surface-container overflow-hidden rounded-2xl border border-outline-variant/40">
              <InfoRow icon="account_balance_wallet" label="Số dư">
                {isLoading ? <Skeleton className="h-4 w-20" /> : <span className="text-primary">{formatVnd(me.credits)}</span>}
              </InfoRow>
              {me?.creatorProfile && (
                <InfoRow icon="savings" label="Hoa hồng khả dụng">
                  {walletLoading ? <Skeleton className="h-4 w-20" /> : <span className="text-primary">{formatVnd(wallet?.available_balance)}</span>}
                </InfoRow>
              )}
              <InfoRow icon="badge" label="Vai trò">
                {isLoading ? <Skeleton className="h-4 w-20" /> : (ROLE_LABEL[me.role] ?? me.role)}
              </InfoRow>
              <InfoRow icon="storefront" label="Cửa hàng">
                {isLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  (me.creatorProfile?.shop_name ?? 'Chưa tạo')
                )}
              </InfoRow>
              {me?.creatorProfile && (
                <InfoRow icon="hourglass_top" label="Hoa hồng đang tạm giữ">
                  {walletLoading ? <Skeleton className="h-4 w-20" /> : formatVnd(wallet?.pending_balance)}
                </InfoRow>
              )}
            </section>
          </>
        )}

        {me && <AccountSwitcher currentId={me.id} />}

        <TikTokConnectionCard />

        <nav className="divide-y divide-surface-container overflow-hidden rounded-2xl border border-outline-variant/40">
          {menu.map(({ to, icon, title, disabled }) => {
            const content = (
              <>
                <Icon name={icon} className="text-xl text-outline" />
                <span className={`flex-1 text-sm font-semibold ${disabled ? 'text-outline' : 'text-on-surface'}`}>{title}</span>
                <Icon name={disabled ? 'lock' : 'chevron_right'} className="text-xl text-outline" />
              </>
            );
            return disabled ? (
              <div key={to} aria-disabled="true" className="flex cursor-not-allowed items-center gap-3 px-4 py-3">
                {content}
              </div>
            ) : (
              <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-container-low">
                {content}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-error/40 text-sm font-bold text-error transition-colors hover:bg-error-container/40 disabled:opacity-50"
        >
          <Icon name={loggingOut ? 'progress_activity' : 'logout'} className={`text-lg ${loggingOut ? 'animate-spin' : ''}`} />
          Đăng xuất
        </button>
      </div>
    </>
  );
}
