import { Link } from 'react-router-dom';
import Avatar from '../components/common/Avatar';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { useMe } from '../hooks/queries';

export default function StorePage() {
  const { data: me, isLoading, error, refetch } = useMe();

  // creator_profile từ GET /auth/me; null = tài khoản chưa tạo profile người bán
  const shop = me?.creatorProfile;

  // Backend chỉ cho tạo Creative khi đã có profile người bán (middleware "creator")
  const features = [
    {
      to: '/seller/settings',
      icon: 'tune',
      title: 'Quản lý cửa hàng',
      description: shop ? 'Tên shop, ảnh đại diện, mô tả, API key AI' : 'Tạo cửa hàng để bắt đầu bán AI Creative',
    },
    {
      to: '/seller/products',
      icon: 'inventory_2',
      title: 'Quản lý sản phẩm',
      description: shop ? 'Xem và quản lý các AI Creative của bạn' : 'Cần tạo cửa hàng của bạn trước',
      disabled: !shop,
    },
  ];

  return (
    <>
      <header className="sticky top-[60px] z-30 border-b border-surface-container bg-surface-container-lowest/90 px-4 py-3 backdrop-blur-md">
        <h1 className="text-lg font-bold text-on-surface">Trung tâm người bán</h1>
      </header>

      <section className="space-y-4 p-4">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/40 p-4">
            {isLoading ? (
              <>
                <Skeleton className="size-14 !rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </>
            ) : shop ? (
              <>
                <Avatar src={shop.avatar_url} name={shop.shop_name} className="size-14 ring-2 ring-primary/20" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-base font-bold text-on-surface">
                    <span className="truncate">{shop.shop_name}</span>
                    {shop.verified && <Icon name="verified" fill className="shrink-0 text-base text-secondary" />}
                  </p>
                  <p className="truncate text-xs text-on-surface-variant">@{shop.username}</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
                  <Icon name="storefront" className="text-[28px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-on-surface">Bạn chưa tạo thông tin người bán</p>
                  <p className="text-xs text-on-surface-variant">
                    Bấn vào quản lý cửa hàng để đăng ký.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <nav aria-label="Chức năng cửa hàng" className="overflow-hidden rounded-2xl border border-outline-variant/40">
          {features.map(({ to, icon, title, description, disabled }, i) => {
            const content = (
              <>
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                    disabled ? 'bg-surface-container-low text-outline' : 'bg-surface-container text-primary'
                  }`}
                >
                  <Icon name={icon} className="text-[22px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-bold ${disabled ? 'text-outline' : 'text-on-surface'}`}>
                    {title}
                  </span>
                  <span className="block truncate text-xs text-on-surface-variant">{description}</span>
                </span>
                <Icon name={disabled ? 'lock' : 'chevron_right'} className="shrink-0 text-xl text-outline" />
              </>
            );
            const cls = `flex items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-surface-container' : ''}`;
            return disabled ? (
              <div key={to} aria-disabled="true" className={`${cls} cursor-not-allowed`}>
                {content}
              </div>
            ) : (
              <Link key={to} to={to} className={`${cls} transition-colors hover:bg-surface-container-low`}>
                {content}
              </Link>
            );
          })}
        </nav>
      </section>
    </>
  );
}
