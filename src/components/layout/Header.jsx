import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMe, useUnreadCount } from '../../hooks/queries';
import Avatar from '../common/Avatar';
import Icon from '../common/Icon';
import { Skeleton } from '../common/Feedback';
import { formatVnd } from '../../utils/format';
import Logo from './Logo';
import { NAV_ITEMS } from './navItems';

// Header chung của mọi trang (gắn trong AppLayout). Cao cố định 60px: thanh tiêu đề riêng
// của từng trang dính ngay bên dưới bằng "sticky top-[60px] z-30".
// Desktop: logo + menu ngang bên trái, ví / thông báo / tài khoản bên phải.
function HeaderBar({ children }) {
  return (
    <header className="sticky top-0 z-40 h-[60px] border-b border-surface-container bg-surface-container-lowest/90 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1200px] items-center gap-3 px-4 lg:px-8">{children}</div>
    </header>
  );
}

function DesktopNav() {
  return (
    <nav aria-label="Điều hướng chính" className="ml-6 hidden items-center gap-1 lg:flex">
      {NAV_ITEMS.filter((i) => !i.mobileOnly).map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              isActive ? 'bg-surface-container text-primary' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

const AUTH_PAGES = ['/login', '/register'];

export default function Header() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <UserHeader /> : <GuestHeader />;
}

function GuestHeader() {
  const location = useLocation();
  const redirect = encodeURIComponent(location.pathname + location.search);
  // Đang ở trang đăng nhập/đăng ký thì không cần nút Đăng nhập
  const onAuthPage = AUTH_PAGES.includes(location.pathname);

  return (
    <HeaderBar>
      <Logo />
      <DesktopNav />
      {!onAuthPage && (
        <Link
          to={`/login?redirect=${redirect}`}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-full bg-primary-container px-4 text-xs font-bold text-on-primary transition-colors hover:bg-primary"
        >
          <Icon name="login" className="text-base" />
          Đăng nhập
        </Link>
      )}
    </HeaderBar>
  );
}

function UserHeader() {
  const { data: me, isLoading } = useMe();
  const { data: unread } = useUnreadCount();

  return (
    <HeaderBar>
      {/* Mobile: avatar bên trái thay logo. Desktop: logo + menu bên trái, avatar dời về cuối bên phải */}
      <Logo className="hidden lg:flex" />
      <DesktopNav />
      <Link to="/account" aria-label="Thông tin tài khoản" className="flex min-w-0 items-center gap-3 lg:order-last">
        {isLoading ? (
          <Skeleton className="size-9 !rounded-full" />
        ) : (
          <Avatar src={me?.avatarUrl} name={me?.name} className="size-9 ring-2 ring-primary/20" />
        )}
        <div>
          <span className="block text-xs font-medium leading-none text-on-surface-variant">Xin chào,</span>
          {isLoading ? (
            <Skeleton className="mt-1 h-4 w-24" />
          ) : (
            <span className="text-base font-bold leading-snug text-on-surface">{me?.name}</span>
          )}
        </div>
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1">
          <Icon name="account_balance_wallet" fill className="text-base text-primary" />
          <span className="text-xs font-bold text-primary">{formatVnd(me?.credits)}</span>
        </div>
        <button
          aria-label="Thông báo"
          className="relative flex size-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface transition-colors hover:bg-surface-container"
        >
          <Icon name="notifications" className="text-[20px]" />
          {unread?.count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-on-error">
              {unread.count > 9 ? '9+' : unread.count}
            </span>
          )}
        </button>
      </div>
    </HeaderBar>
  );
}
