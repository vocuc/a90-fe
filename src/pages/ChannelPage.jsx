import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { useCreatorProfile } from '../hooks/creatorQueries';
import { CHANNEL_KEYS, MISSING_LABELS, getChannel, listChannels } from '../api/channels';
import CreateChannelForm from '../components/channel/CreateChannelForm';
import PlansTab from '../components/channel/PlansTab';
import LineupTab from '../components/channel/LineupTab';
import PostSamplesTab from '../components/channel/PostSamplesTab';
import TextTemplatesTab from '../components/channel/TextTemplatesTab';
import TopicsTab from '../components/channel/TopicsTab';
import CreativesTab from '../components/channel/CreativesTab';
import PersonaTab from '../components/channel/PersonaTab';
import SettingsTab from '../components/channel/SettingsTab';

const TABS = [
  { key: 'plans', label: 'Kế hoạch', icon: 'event_note' },
  { key: 'lineup', label: 'Tuyến nội dung', icon: 'view_list' },
  { key: 'topics', label: 'Chủ đề', icon: 'tag' },
  { key: 'creatives', label: 'Creative', icon: 'auto_awesome' },
  // Tab Bài viết mẫu: tạm ẩn (người dùng yêu cầu 2026-11-20), bỏ comment dòng dưới để hiện lại
  // { key: 'samples', label: 'Bài viết mẫu', icon: 'library_books' },
  { key: 'templates', label: 'Template chữ', icon: 'text_fields' },
  { key: 'persona', label: 'Chân dung', icon: 'person_search' },
  { key: 'settings', label: 'Cấu hình', icon: 'tune' },
];

/**
 * /seller/channel (Công cụ > Quản lý > Kênh TikTok). Giao diện hiện cho mỗi tài khoản 1 kênh: mở thẳng kênh đầu tiên,
 * chưa có kênh thì hiện form thiết lập. API / dữ liệu vẫn theo danh sách kênh (số kênh tối đa: Channel::MAX_PER_SHOP ở
 * backend) để sau này mở nhiều kênh chỉ cần thêm ô chọn kênh. /channels/:id vẫn mở đúng kênh theo id.
 */
export default function ChannelPage() {
  const { id } = useParams();
  useSeo({ title: 'Kênh TikTok', noindex: true });
  const { hasProfile, meLoaded } = useCreatorProfile();
  const { data, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.all, queryFn: listChannels, enabled: hasProfile && !id });
  const channelId = id ?? data?.items[0]?.id;

  if (channelId) return <ChannelView id={channelId} />;
  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <BackLink />
        <h1 className="flex-1 text-base font-bold text-on-surface">Kênh TikTok</h1>
      </header>
      <section className="p-4 lg:py-6">
        {!meLoaded ? (
          <Skeleton className="h-40 w-full" />
        ) : !hasProfile ? (
          <EmptyState icon="storefront" message="Bạn cần tạo cửa hàng trước khi tạo kênh.">
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          </EmptyState>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <CreateChannelForm />
        )}
      </section>
    </>
  );
}

const BackLink = () => (
  <Link to="/tools" aria-label="Quay lại Công cụ" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
    <Icon name="arrow_back" />
  </Link>
);

function ChannelView({ id }) {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'plans';
  const { data: channel, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.detail(id), queryFn: () => getChannel(id) });
  useSeo({ title: channel ? `Kênh ${channel.name}` : 'Kênh TikTok', noindex: true });

  return (
    <div className="min-w-0">
      <header className="border-b border-surface-container bg-surface-container-lowest">
        <div className="flex items-center gap-2 px-2 py-2">
          <BackLink />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 text-base font-bold text-on-surface">
              <span className="truncate">{channel?.name ?? 'Kênh TikTok'}</span>
              {channel && <span className="shrink-0 rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">ID: {channel.id}</span>}
            </h1>
            {channel && <p className="truncate text-[11px] text-on-surface-variant">{channel.worker ? `Worker: ${channel.worker.name}` : 'Chưa có worker'}</p>}
          </div>
          {/* Tab Lịch đăng đã gộp vào /posts (2026-11-25): xem / sửa / làm lại bài của kênh ở đó, lọc sẵn theo kênh */}
          {channel && (
            <Link
              to={`/posts?channel=${channel.id}`}
              className="mr-2 flex h-8 shrink-0 items-center gap-1 rounded-lg border border-primary px-3 text-xs font-bold text-primary hover:bg-primary-fixed/30"
            >
              <Icon name="calendar_month" className="text-base" />
              Bài đăng
            </Link>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Các mục của kênh">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setParams({ tab: t.key }, { replace: true })}
              aria-current={tab === t.key ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
                tab === t.key ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <Icon name={t.icon} className="text-sm" />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="space-y-4 p-4 lg:py-6">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !channel ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {channel.missing.length > 0 && tab !== 'settings' && (
              <div className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">
                <p className="mb-1 font-bold">Kênh chưa sẵn sàng lập kế hoạch:</p>
                <ul className="list-inside list-disc">
                  {channel.missing.map((m) => (
                    <li key={m}>{MISSING_LABELS[m] ?? m}</li>
                  ))}
                </ul>
              </div>
            )}
            {tab === 'plans' && <PlansTab channel={channel} />}
            {tab === 'lineup' && <LineupTab channel={channel} />}
            {tab === 'topics' && <TopicsTab channel={channel} />}
            {tab === 'creatives' && <CreativesTab channel={channel} />}
            {tab === 'samples' && <PostSamplesTab channel={channel} />}
            {tab === 'templates' && <TextTemplatesTab channel={channel} />}
            {tab === 'persona' && <PersonaTab channel={channel} />}
            {tab === 'settings' && <SettingsTab channel={channel} />}
          </>
        )}
      </section>
    </div>
  );
}
