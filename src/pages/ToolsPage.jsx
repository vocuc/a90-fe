import useSeo from '../hooks/useSeo';
import { Link } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { TOOLS } from '../components/tools/tools';
import { useAuth } from '../context/AuthContext';
import { useMe } from '../hooks/queries';

const CARD_CLASS =
  'group flex flex-col gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-3 transition-all';
const ICON_CLASS = 'flex size-12 items-center justify-center rounded-xl bg-surface-container transition-colors';

/**
 * Lối tắt quản lý. Quản lý Creative / sản phẩm / AI viết nội dung cần profile người bán (mở cửa hàng trước).
 * Chưa đăng nhập: không khoá, bấm vào RequireAuth chuyển sang trang đăng nhập.
 */
function useManageTools() {
  const { isAuthenticated } = useAuth();
  const { data: me } = useMe();
  const noShop = isAuthenticated && !!me && !me.creatorProfile;
  return [
    { to: '/account/history', icon: 'receipt_long', title: 'Lịch sử mua hàng', description: 'Xem lại các lượt tạo và tải ảnh kết quả' },
    { to: '/seller/creatives', icon: 'inventory_2', title: 'Quản lý Creative', description: 'Tạo, sửa và đăng bán mẫu AI Creative', locked: noShop, lockHint: 'Cần mở cửa hàng' },
    { to: '/seller/items', icon: 'shopping_bag', title: 'Quản lý sản phẩm', description: 'Sản phẩm dùng để tạo ảnh theo lô tự động', locked: noShop, lockHint: 'Cần mở cửa hàng' },
    { to: '/seller/settings', icon: 'tune', title: 'Quản lý cửa hàng', description: 'Tên cửa hàng, ảnh đại diện và ảnh bìa' },
    // AI viết nội dung bài đăng (note/ai-viet-noi-dung-bai-dang.txt): chỉ hiện khi backend bật tính năng
    ...(me?.socialAi?.enabled
      ? [{ to: '/seller/ai-content', icon: 'auto_awesome', title: 'AI viết nội dung', description: 'Kho hashtag, bài mẫu và độ dài nội dung bài đăng', locked: !me.creatorProfile, lockHint: 'Cần mở cửa hàng' }]
      : []),
  ];
}

export default function ToolsPage() {
  useSeo({
    title: 'Công cụ',
    description: 'Công cụ trên A51: chèn logo và chữ chìm, tạo ảnh theo lô, đăng bài, tạo đơn GHN từ ảnh.',
  });
  const manageTools = useManageTools();

  return (
    <>
      <header className="sticky top-[60px] z-30 border-b border-surface-container bg-surface-container-lowest/90 px-4 py-3 backdrop-blur-md">
        <h1 className="text-lg font-bold text-on-surface">Công cụ</h1>
        <p className="text-xs text-on-surface-variant">Chèn logo, tạo ảnh theo lô, đăng bài và quản lý cửa hàng</p>
      </header>

      <section className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4 lg:gap-4">
        {TOOLS.map((t) => (
          <Link
            key={t.slug}
            to={t.to ?? `/tools/${t.slug}`}
            className={`${CARD_CLASS} hover:border-primary-container active:scale-[0.98]`}
          >
            <span className={`${ICON_CLASS} text-primary group-hover:bg-primary-container group-hover:text-on-primary`}>
              <Icon name={t.icon} className="text-[26px]" />
            </span>
            <span>
              <span className="block text-sm font-bold text-on-surface">{t.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-on-surface-variant">{t.description}</span>
            </span>
          </Link>
        ))}
      </section>

      <h2 className="px-4 pt-2 text-base font-bold text-on-surface">Quản lý</h2>
      <section className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4 lg:gap-4">
        {manageTools.map((t) => {
          const body = (
            <>
              <span className={`${ICON_CLASS} ${t.locked ? 'text-outline' : 'text-primary group-hover:bg-primary-container group-hover:text-on-primary'}`}>
                <Icon name={t.locked ? 'lock' : t.icon} className="text-[26px]" />
              </span>
              <span>
                <span className={`block text-sm font-bold ${t.locked ? 'text-outline' : 'text-on-surface'}`}>{t.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-on-surface-variant">{t.locked ? t.lockHint : t.description}</span>
              </span>
            </>
          );
          return t.locked ? (
            <div key={t.to} aria-disabled="true" className={`${CARD_CLASS} cursor-not-allowed opacity-70`}>
              {body}
            </div>
          ) : (
            <Link key={t.to} to={t.to} className={`${CARD_CLASS} hover:border-primary-container active:scale-[0.98]`}>
              {body}
            </Link>
          );
        })}
      </section>
    </>
  );
}
