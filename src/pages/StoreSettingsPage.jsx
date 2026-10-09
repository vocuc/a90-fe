import { Link } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import ShopInfoForm from '../components/store/ShopInfoForm';
import ShopImages from '../components/store/ShopImages';
import { useCreatorProfile } from '../hooks/creatorQueries';

function Section({ title, subtitle, children }) {
  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
      <div>
        <h2 className="text-base font-bold text-on-surface">{title}</h2>
        {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function StoreSettingsPage() {
  const { data: profile, hasProfile, meLoaded, isLoading, error, refetch } = useCreatorProfile();

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <Link to="/account" aria-label="Quay lại" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
          <Icon name="arrow_back" />
        </Link>
        <h1 className="text-base font-bold text-on-surface">{hasProfile ? 'Cấu hình cửa hàng' : 'Tạo cửa hàng'}</h1>
      </header>

      <div className="space-y-4 p-4">
        {!meLoaded || (hasProfile && isLoading) ? (
          <>
            <Skeleton className="aspect-[3/1] w-full !rounded-2xl" />
            <Skeleton className="h-64 w-full" />
          </>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !hasProfile ? (
          <Section
            title="Thông tin người bán"
            subtitle="Tạo profile người bán để đăng bán AI Creative. Bạn có thể đổi ảnh ngay sau đó."
          >
            {/* Tạo xong: /auth/me tải lại -> hasProfile = true -> trang hiện đủ các phần cấu hình */}
            <ShopInfoForm profile={null} onCreated={() => window.scrollTo({ top: 0 })} />
          </Section>
        ) : (
          <>
            <ShopImages profile={profile} />

            {profile.platform_fee_percent != null && (
              <p className="flex items-center gap-1.5 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
                <Icon name="percent" className="text-sm text-primary" />
                Phí nền tảng của bạn: <b className="text-on-surface">{Number(profile.platform_fee_percent)}%</b> trên mỗi
                ảnh bán được. Mức phí do A51 thiết lập.
              </p>
            )}

            <Section title="Thông tin cửa hàng" subtitle="Hiển thị trên trang shop và các AI Creative của bạn.">
              <ShopInfoForm profile={profile} />
            </Section>
          </>
        )}
      </div>
    </>
  );
}
