import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { CHANNEL_KEYS, MISSING_LABELS, getChannel } from '../api/channels';
import CalendarTab from '../components/channel/CalendarTab';
import PlansTab from '../components/channel/PlansTab';
import LineupTab from '../components/channel/LineupTab';
import TextTemplatesTab from '../components/channel/TextTemplatesTab';
import PersonaTab from '../components/channel/PersonaTab';
import SettingsTab from '../components/channel/SettingsTab';

const TABS = [
  { key: 'calendar', label: 'Lịch đăng', icon: 'calendar_month' },
  { key: 'plans', label: 'Kế hoạch', icon: 'event_note' },
  { key: 'lineup', label: 'Tuyến nội dung', icon: 'view_list' },
  { key: 'templates', label: 'Template chữ', icon: 'text_fields' },
  { key: 'persona', label: 'Chân dung', icon: 'person_search' },
  { key: 'settings', label: 'Cấu hình', icon: 'tune' },
];

/** /channels/:id: lịch đăng, kế hoạch, tuyến nội dung, template chữ, chân dung khách hàng, cấu hình của 1 kênh. */
export default function ChannelPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'calendar';
  const { data: channel, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.detail(id), queryFn: () => getChannel(id) });
  useSeo({ title: channel ? `Kênh ${channel.name}` : 'Kênh TikTok', noindex: true });
  // Cột xem trước bên phải (desktop, tab Lịch đăng): CalendarTab vẽ khung xem trước vào đây (portal)
  const [previewSlot, setPreviewSlot] = useState(null);
  const withPreview = tab === 'calendar';

  return (
    <div className={withPreview ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-2' : ''}>
    <div className="min-w-0">
      <header className="border-b border-surface-container bg-surface-container-lowest">
        <div className="flex items-center gap-2 px-2 py-2">
          <Link to="/channels" aria-label="Quay lại" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
            <Icon name="arrow_back" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 text-base font-bold text-on-surface">
              <span className="truncate">{channel?.name ?? 'Kênh TikTok'}</span>
              {channel && <span className="shrink-0 rounded bg-surface-container px-1.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">ID: {channel.id}</span>}
            </h1>
            {channel && <p className="truncate text-[11px] text-on-surface-variant">{channel.worker ? `Worker: ${channel.worker.name}` : 'Chưa có worker'}</p>}
          </div>
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
            {tab === 'calendar' && <CalendarTab channel={channel} previewSlot={previewSlot} />}
            {tab === 'plans' && <PlansTab channel={channel} />}
            {tab === 'lineup' && <LineupTab channel={channel} />}
            {tab === 'templates' && <TextTemplatesTab channel={channel} />}
            {tab === 'persona' && <PersonaTab channel={channel} />}
            {tab === 'settings' && <SettingsTab channel={channel} />}
          </>
        )}
      </section>
    </div>
    {/* Cột phải: chỉ có khung xem trước, ghim khi cuộn, vừa chiều cao màn hình */}
    {withPreview && <aside ref={setPreviewSlot} className="hidden lg:sticky lg:top-[72px] lg:block lg:py-4 lg:pr-4" />}
    </div>
  );
}
