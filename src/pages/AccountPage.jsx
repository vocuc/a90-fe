import useSeo from '../hooks/useSeo';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/common/Avatar';
import AccountSwitcher from '../components/auth/AccountSwitcher';
import TikTokConnectionCard from '../components/social/TikTokConnectionCard';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { useAuth } from '../context/AuthContext';
import { useMe } from '../hooks/queries';
import { useCreatorWallet } from '../hooks/creatorQueries';
import { staffApi } from '../api/services';
import { formatVnd } from '../utils/format';
import { useConfirm } from '../components/common/ConfirmDialog';

// Khớp UserRole của backend
const ROLE_LABEL = { user: 'Thành viên', admin: 'Quản trị viên' };

/** Nhân viên của shop (note/chia-se-tai-nguyen.txt): shop đang làm + nút rời shop. */
function StaffShopCard({ shopName }) {
  const queryClient = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const { confirm, alert } = useConfirm();

  const leave = async () => {
    if (!(await confirm(`Rời shop ${shopName}? Bạn sẽ không dùng được sản phẩm, nhóm creative và mẫu của shop nữa. Lô đã tạo vẫn giữ nguyên.`, { confirmLabel: 'Rời shop', danger: true }))) return;
    setLeaving(true);
    try {
      await staffApi.leaveShop();
      queryClient.removeQueries({ queryKey: ['creator'] });
      queryClient.removeQueries({ queryKey: ['staff'] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    } catch (err) {
      alert(err?.message || 'Không rời shop được, vui lòng thử lại.');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <section className="flex items-center gap-3 rounded-2xl border border-outline-variant/40 p-4">
      <Icon name="badge" className="text-2xl text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-on-surface">Nhân viên của shop {shopName}</p>
        <p className="text-xs text-on-surface-variant">Dùng sản phẩm, nhóm creative và mẫu của shop để tạo ảnh. Tiền trừ vào ví của bạn.</p>
      </div>
      <button
        type="button"
        onClick={leave}
        disabled={leaving}
        className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-error/40 px-3 text-xs font-bold text-error hover:bg-error-container/40 disabled:opacity-50"
      >
        {leaving && <Icon name="progress_activity" className="animate-spin text-base" />}
        Rời shop
      </button>
    </section>
  );
}

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

  // Backend chỉ cho quản lý Creative khi đã có profile người bán (middleware "creator"). Nhân viên của shop
  // (note/chia-se-tai-nguyen.txt) không được mở shop riêng, chỉ xem sản phẩm / nhóm creative của shop chủ
  const staffOf = me?.staffOf;
  const menu = [
    { to: '/account/history', icon: 'receipt_long', title: 'Lịch sử mua hàng' },
    { to: '/seller/settings', icon: 'tune', title: 'Quản lý cửa hàng', disabled: !!staffOf },
    { to: '/seller/creatives', icon: 'inventory_2', title: 'Quản lý Creative', disabled: !me?.creatorProfile },
    // Sản phẩm cho tạo lô tự động (note/auto-tao-lo.txt)
    { to: '/seller/items', icon: 'shopping_bag', title: 'Quản lý sản phẩm', disabled: !me?.creatorProfile && !staffOf },
    // Chủ shop vào nhóm creative từ trang Quản lý Creative; nhân viên không có trang đó
    ...(staffOf ? [{ to: '/seller/creative-groups', icon: 'workspaces', title: 'Nhóm creative' }] : []),
    ...(me?.creatorProfile ? [{ to: '/seller/staff', icon: 'groups', title: 'Nhân viên' }] : []),
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
            <section className="overflow-hidden rounded-2xl border border-outline-variant/40">
              <div className="flex items-center gap-4 p-4">
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
              </div>
              {me && <AccountSwitcher currentId={me.id} />}
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
                  (me.creatorProfile?.shop_name ?? (staffOf ? 'Không có (nhân viên)' : 'Chưa tạo'))
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

        {staffOf && <StaffShopCard shopName={staffOf.shopName} />}

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
