import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
 * /seller/channel (Công cụ > Quản lý > Kênh TikTok): danh sách kênh của tài khoản + ô "Tạo kênh mới" (tối đa meta.max =
 * Channel::MAX_PER_SHOP ở backend; mỗi kênh cần 1 worker đăng bài riêng). Chưa có kênh / ?new=1 -> form tạo kênh.
 * /channels/:id mở 1 kênh, đầu trang có ô chuyển nhanh sang kênh khác. Link cũ /seller/channel?tab=... khi shop chỉ có
 * 1 kênh thì mở thẳng kênh đó ở tab tương ứng.
 */
export default function ChannelPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  useSeo({ title: 'Kênh TikTok', noindex: true });
  const { hasProfile, meLoaded } = useCreatorProfile();
  const { data, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.all, queryFn: listChannels, enabled: hasProfile && !id });

  if (id) return <ChannelView id={id} />;
  const tab = params.get('tab');
  if (tab && data?.items.length === 1) return <Navigate to={`/channels/${data.items[0].id}?tab=${tab}`} replace />;

  const items = data?.items ?? [];
  const canCreate = !!data && items.length < data.max;
  const creating = !!data && (items.length === 0 || (params.get('new') === '1' && canCreate));
  const subPage = creating && items.length > 0;

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        {subPage ? <BackLink to="/seller/channel" label="Quay lại danh sách kênh" /> : <BackLink />}
        <h1 className="flex-1 text-base font-bold text-on-surface">{subPage ? 'Tạo kênh mới' : 'Kênh TikTok'}</h1>
        {data && !creating && (
          <span className="mr-2 text-xs text-on-surface-variant">
            {items.length}/{data.max} kênh
          </span>
        )}
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
        ) : creating ? (
          <CreateChannelForm cancelTo={items.length ? '/seller/channel' : null} />
        ) : (
          <ChannelList items={items} canCreate={canCreate} max={data.max} />
        )}
      </section>
    </>
  );
}

const BackLink = ({ to = '/tools', label = 'Quay lại Công cụ' }) => (
  <Link to={to} aria-label={label} className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-surface-container">
    <Icon name="arrow_back" />
  </Link>
);

function ChannelList({ items, canCreate, max }) {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((c) => (
          <Link
            key={c.id}
            to={`/channels/${c.id}`}
            className="flex flex-col gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 transition hover:border-primary hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed/40 text-primary">
                <Icon name="smart_display" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-on-surface">{c.name}</p>
                <p className="truncate text-[11px] text-on-surface-variant">{c.worker ? `Worker: ${c.worker.name}` : 'Chưa có worker'}</p>
              </div>
              <Icon name="chevron_right" className="text-on-surface-variant" />
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
              <span className="rounded bg-surface-container px-1.5 py-0.5 text-on-surface-variant">ID: {c.id}</span>
              <span className="rounded bg-surface-container px-1.5 py-0.5 text-on-surface-variant">{c.upcomingPosts} bài sắp đăng</span>
              {!c.isActive && <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-on-surface-variant">Đang tắt</span>}
              {c.missing.length > 0 ? (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">Thiếu {c.missing.length} mục thiết lập</span>
              ) : (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">Sẵn sàng</span>
              )}
            </div>
          </Link>
        ))}
        {canCreate && (
          <Link
            to="/seller/channel?new=1"
            className="flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-outline-variant/60 p-4 text-sm font-bold text-primary hover:border-primary hover:bg-primary-fixed/20"
          >
            <Icon name="add_circle" className="text-2xl" />
            Tạo kênh mới
          </Link>
        )}
      </div>
      {!canCreate && <p className="text-center text-xs text-on-surface-variant">Đã đạt tối đa {max} kênh cho mỗi tài khoản.</p>}
    </div>
  );
}

/** Ô chuyển nhanh sang kênh khác (chỉ hiện khi có từ 2 kênh), giữ tab đang xem. */
function ChannelSwitcher({ id, tab }) {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: CHANNEL_KEYS.all, queryFn: listChannels });
  if (!data || data.items.length < 2) return null;
  return (
    <select
      aria-label="Chuyển kênh"
      value={String(id)}
      onChange={(e) => navigate(`/channels/${e.target.value}?tab=${tab}`)}
      className="h-8 max-w-[40vw] shrink-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 text-xs font-semibold text-on-surface"
    >
      {data.items.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function ChannelView({ id }) {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'plans';
  const { data: channel, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.detail(id), queryFn: () => getChannel(id) });
  useSeo({ title: channel ? `Kênh ${channel.name}` : 'Kênh TikTok', noindex: true });

  return (
    <div className="min-w-0">
      <header className="border-b border-surface-container bg-surface-container-lowest">
        <div className="flex items-center gap-2 px-2 py-2">
          <BackLink to="/seller/channel" label="Danh sách kênh" />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 text-base font-bold text-on-surface">
              <span className="truncate">{channel?.name ?? 'Kênh TikTok'}</span>
              {channel && <span className="shrink-0 rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">ID: {channel.id}</span>}
            </h1>
            {channel && <p className="truncate text-[11px] text-on-surface-variant">{channel.worker ? `Worker: ${channel.worker.name}` : 'Chưa có worker'}</p>}
          </div>
          <ChannelSwitcher id={id} tab={tab} />
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
