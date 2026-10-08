import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useMe, useUnreadCount } from '../../hooks/queries';
import Avatar from '../common/Avatar';
import Icon from '../common/Icon';
import { Skeleton } from '../common/Feedback';
import { formatCredit } from '../../utils/format';

// Header chung của mọi trang (gắn trong AppLayout). Cao cố định 60px: thanh tiêu đề riêng
// của từng trang dính ngay bên dưới bằng "sticky top-[60px] z-30".
const headerCls =
  'sticky top-0 z-40 flex h-[60px] items-center justify-between border-b border-surface-container bg-surface-container-lowest/90 px-4 backdrop-blur-md';

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
    <header className={headerCls}>
      <Link to="/" className="flex items-center gap-2" aria-label="AI90 - Trang chủ">
        <div className="flex size-9 items-center justify-center rounded-full bg-primary-container text-on-primary">
          <Icon name="auto_awesome" fill className="text-[20px]" />
        </div>
        <span className="text-lg font-extrabold tracking-tight text-on-surface">AI90</span>
      </Link>
      {!onAuthPage && (
        <Link
          to={`/login?redirect=${redirect}`}
          className="flex h-9 items-center gap-1.5 rounded-full bg-primary-container px-4 text-xs font-bold text-on-primary transition-colors hover:bg-primary"
        >
          <Icon name="login" className="text-base" />
          Đăng nhập
        </Link>
      )}
    </header>
  );
}

function UserHeader() {
  const { data: me, isLoading } = useMe();
  const { data: unread } = useUnreadCount();

  return (
    <header className={headerCls}>
      <Link to="/seller" className="flex items-center gap-3">
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
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1">
          <Icon name="token" fill className="text-base text-primary" />
          <span className="text-xs font-bold text-primary">{formatCredit(me?.credits)} Credits</span>
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
    </header>
  );
}
