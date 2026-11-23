import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { FormAlert } from '../common/Form';
import { CHANNEL_KEYS, decideLineup, getLineups, listPostSamples, updateLineup } from '../../api/channels';
import Section from './Section';

/** Chỉ dạng nội dung A51 ĐÃ BẬT (bài viết mẫu làm xong): dạng chưa bật trong tuyến cũ bị ẩn, kế hoạch cũng bỏ qua. */
const enabledOnly = (items, samples) => {
  const enabled = new Set(samples.filter((s) => s.enabled).map((s) => s.key));
  return items.filter((i) => enabled.has(i.sample_key));
};

/** Gom dòng tuyến theo nhóm bài viết mẫu (Phối đồ / Ảnh sản phẩm / Video, backend PostSamples::GROUPS), giữ idx gốc để sửa. */
function groupRows(items, samples, groups) {
  const groupOf = Object.fromEntries(samples.map((s) => [s.key, s.group]));
  const list = [...Object.entries(groups).map(([key, label]) => ({ key, label })), { key: '_other', label: 'Khác' }]
    .map((g) => ({ ...g, rows: items.map((item, idx) => ({ item, idx })).filter(({ item }) => (groups[groupOf[item.sample_key]] ? groupOf[item.sample_key] : '_other') === g.key) }));
  return list.map((g) => ({ ...g, percent: g.rows.reduce((s, r) => s + Number(r.item.percent || 0), 0) }));
}

function LineupRows({ items, editing, onChange, samples, groups }) {
  const total = items.reduce((s, i) => s + Number(i.percent || 0), 0);
  // Chỉ bài viết mẫu ĐÃ LÀM XONG (enabled) mới thêm được vào tuyến
  const unused = samples.filter((s) => s.enabled && !items.some((i) => i.sample_key === s.key));
  // Mỗi nhóm 1 cột, luôn hiện đủ các nhóm (kể cả 0%) để cột không nhảy; "Khác" chỉ hiện khi có bài
  const rowGroups = groupRows(items, samples, groups).filter((g) => g.rows.length || g.key !== '_other');
  return (
    <div className="space-y-3">
      {!items.length && !editing && <p className="text-xs text-on-surface-variant">Tuyến chưa có dạng nội dung nào đang bật.</p>}
      <div className={`grid items-start gap-4 ${rowGroups.length > 3 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
        {rowGroups.map((g) => (
          <div key={g.key} className="space-y-2 rounded-xl bg-surface-container-low/60 p-3">
            <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-1">
              <h3 className="flex-1 text-xs font-bold uppercase tracking-wide text-on-surface-variant">{g.label}</h3>
              <span className="text-xs font-bold tabular-nums text-on-surface">{g.percent}%</span>
            </div>
            {!g.rows.length && <p className="text-[11px] text-outline">Chưa có bài nào trong nhóm.</p>}
            {g.rows.map(({ item, idx }) => (
              <div key={item.sample_key} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-on-surface">{item.name ?? item.sample_key}</p>
                  {item.reason && <p className="truncate text-[11px] text-on-surface-variant">{item.reason}</p>}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-container">
                    <div className="h-full rounded-full bg-primary-container" style={{ width: `${Math.min(100, item.percent)}%` }} />
                  </div>
                </div>
                {editing ? (
                  <>
                    <input
                      inputMode="numeric"
                      value={item.percent}
                      onChange={(e) => onChange(items.map((x, j) => (j === idx ? { ...x, percent: e.target.value.replace(/\D/g, '').slice(0, 3) } : x)))}
                      aria-label={`Tỉ lệ ${item.name}`}
                      className="w-16 rounded-lg border-outline-variant/40 bg-surface-container-low text-right text-sm"
                    />
                    <button type="button" aria-label={`Bỏ ${item.name}`} onClick={() => onChange(items.filter((_, j) => j !== idx))}
                      className="flex size-8 items-center justify-center rounded-lg text-error hover:bg-error-container/40">
                      <Icon name="close" className="text-lg" />
                    </button>
                  </>
                ) : (
                  <span className="w-12 text-right text-sm font-bold tabular-nums text-on-surface">{item.percent}%</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {editing && (
        <div className="flex items-center gap-2">
          <select
            value=""
            onChange={(e) => {
              const s = samples.find((x) => x.key === e.target.value);
              if (s) onChange([...items, { sample_key: s.key, name: s.name, percent: '10', reason: null }]);
            }}
            className="flex-1 rounded-lg border-outline-variant/40 bg-surface-container-low text-sm"
            aria-label="Thêm bài viết mẫu"
          >
            <option value="">+ Thêm bài viết mẫu</option>
            {Object.entries(groups).map(([key, label]) => {
              const opts = unused.filter((s) => s.group === key);
              return opts.length ? (
                <optgroup key={key} label={label}>
                  {opts.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
          <span className={`text-xs font-semibold ${total === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>Tổng {total}%</span>
        </div>
      )}
    </div>
  );
}

function LineupCard({ channelId, lineup, pending, samples, groups }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const shown = enabledOnly(lineup.items, samples);
  const [items, setItems] = useState(shown);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.lineups(channelId) });
    queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.detail(channelId) });
  };
  const save = useMutation({
    mutationFn: () => updateLineup(channelId, lineup.id, items.map((i) => ({ sample_key: i.sample_key, percent: Number(i.percent || 0), reason: i.reason }))),
    onSuccess: (d) => {
      setItems(enabledOnly(d.items, samples));
      setEditing(false);
      refresh();
    },
  });
  const decide = useMutation({ mutationFn: (approve) => decideLineup(channelId, lineup.id, approve), onSuccess: refresh });
  const error = save.error || decide.error;

  return (
    <div className="space-y-3">
      <LineupRows items={editing ? items : shown} editing={editing} onChange={setItems} samples={samples} groups={groups} />
      {error && <FormAlert>{error.message}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="rounded-lg bg-primary-container px-3 py-1.5 text-xs font-bold text-on-primary disabled:opacity-50">
              Lưu tỉ lệ
            </button>
            <button type="button" onClick={() => { setItems(shown); setEditing(false); }} className="rounded-lg px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container">
              Huỷ
            </button>
          </>
        ) : (
          <button type="button" onClick={() => { setItems(shown); setEditing(true); }} className="rounded-lg border border-outline-variant/60 px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container">
            Sửa tỉ lệ
          </button>
        )}
        {pending && !editing && (
          <>
            <button type="button" onClick={() => decide.mutate(true)} disabled={decide.isPending} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              Duyệt
            </button>
            <button type="button" onClick={() => decide.mutate(false)} disabled={decide.isPending} className="rounded-lg px-3 py-1.5 text-xs font-bold text-error hover:bg-error-container/40">
              Từ chối
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Tab Tuyến nội dung: bản đang dùng + các đề xuất chờ duyệt (đội A51 soạn bằng lệnh /lap-ke-hoach). */
export default function LineupTab({ channel }) {
  const { data, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.lineups(channel.id), queryFn: () => getLineups(channel.id) });
  const { data: samples } = useQuery({ queryKey: CHANNEL_KEYS.samples, queryFn: listPostSamples, staleTime: Infinity });

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data || !samples) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      {data.pending.map((l) => (
        <Section key={l.id} title="Đề xuất chờ duyệt" subtitle="Duyệt thì kế hoạch sau dùng tuyến này.">
          <LineupCard channelId={channel.id} lineup={l} pending samples={samples.items} groups={samples.groups} />
        </Section>
      ))}
      <Section title="Tuyến đang dùng" subtitle="Kế hoạch chọn bài viết mẫu theo tỉ lệ này.">
        {data.current ? (
          <LineupCard key={data.current.id} channelId={channel.id} lineup={data.current} samples={samples.items} groups={samples.groups} />
        ) : (
          <EmptyState icon="view_list" message="Chưa có tuyến nội dung. Đội A51 sẽ đề xuất khi lập kế hoạch lần đầu." />
        )}
      </Section>
    </div>
  );
}
