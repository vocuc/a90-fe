import { Link } from 'react-router-dom';
import Avatar from '../common/Avatar';
import Icon from '../common/Icon';
import { useAuth } from '../../context/AuthContext';
import { MAX_ACCOUNTS } from '../../api/tokenStorage';

/** Danh sách tài khoản đã đăng nhập trên máy này: bấm để chuyển, nút x để gỡ khỏi máy. Nằm trong box hồ sơ ở trang tài khoản. */
export default function AccountSwitcher({ currentId }) {
  const { accounts, switchAccount, removeAccount } = useAuth();
  const others = accounts.filter((a) => a.id !== currentId);

  return (
    <div className="border-t border-surface-container">
      <h2 className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Chuyển tài khoản</h2>
      <ul className="divide-y divide-surface-container">
        {others.map((a) => (
          <li key={a.id} className="flex items-center gap-1 pr-2 transition-colors hover:bg-surface-container-low">
            <button
              type="button"
              onClick={() => switchAccount(a.id)}
              className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
            >
              <Avatar src={a.avatarUrl} name={a.name} className="size-9 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-on-surface">{a.name}</span>
                <span className="block truncate text-xs text-on-surface-variant">{a.email}</span>
              </span>
              <Icon name="swap_horiz" className="text-xl text-outline" />
            </button>
            <button
              type="button"
              onClick={() => removeAccount(a.id)}
              aria-label={`Gỡ ${a.name} khỏi thiết bị này`}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-outline hover:bg-surface-container"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </li>
        ))}
        {accounts.length < MAX_ACCOUNTS && (
          <li>
            <Link
              to="/login?add=1&redirect=%2Faccount"
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-container-low"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-surface-container text-primary">
                <Icon name="person_add" className="text-xl" />
              </span>
              <span className="flex-1 text-sm font-semibold text-primary">Thêm tài khoản</span>
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
