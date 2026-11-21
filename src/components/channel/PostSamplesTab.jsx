import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Icon from '../common/Icon';
import { ErrorState, Skeleton } from '../common/Feedback';
import { CHANNEL_KEYS, getLineups, listPostSamples } from '../../api/channels';

const GOALS = {
  reach: { label: 'Kéo view', className: 'bg-sky-50 text-sky-700' },
  engagement: { label: 'Tương tác', className: 'bg-violet-50 text-violet-700' },
  save: { label: 'Lưu bài', className: 'bg-amber-50 text-amber-700' },
  sale: { label: 'Bán hàng', className: 'bg-emerald-50 text-emerald-700' },
  trust: { label: 'Tạo tin tưởng', className: 'bg-rose-50 text-rose-700' },
};

const IMAGE = { product: 'Ảnh sản phẩm', outfit: 'Ảnh phối đồ', any: 'Ảnh bất kỳ', collage: 'Ảnh ghép' };
const AT = { first: 'Slide đầu', middle: 'Slide giữa', last: 'Slide cuối', each: 'Các slide còn lại' };

function SampleCard({ sample, percent }) {
  const goal = GOALS[sample.goal];
  const used = percent != null;
  return (
    <article className={`space-y-2 rounded-2xl border p-3 ${used ? 'border-primary-container bg-primary-fixed/10' : 'border-outline-variant/40'} ${sample.enabled ? '' : 'opacity-60'}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-on-surface">{sample.name}</h3>
          <p className="text-[11px] text-outline">{sample.key}</p>
        </div>
        {!sample.enabled ? (
          <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-outline">Chưa làm xong</span>
        ) : used ? (
          <span className="shrink-0 rounded-full bg-primary-container px-2 py-0.5 text-[11px] font-bold text-on-primary">Kênh dùng {percent}%</span>
        ) : (
          <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">Chưa dùng</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 text-[11px] font-semibold">
        {goal && <span className={`rounded px-1.5 py-0.5 ${goal.className}`}>{goal.label}</span>}
        <span className="rounded bg-surface-container px-1.5 py-0.5 text-on-surface-variant">
          {sample.slides.min === sample.slides.max ? sample.slides.min : `${sample.slides.min}-${sample.slides.max}`} slide
        </span>
        <span className="rounded bg-surface-container px-1.5 py-0.5 text-on-surface-variant">
          {sample.formats.includes('video') ? 'Ảnh + video' : 'Chỉ bài ảnh'}
        </span>
        {sample.same_product && <span className="rounded bg-surface-container px-1.5 py-0.5 text-on-surface-variant">Cùng 1 sản phẩm</span>}
      </div>

      <ul className="space-y-1">
        {sample.slide_rules.map((r, i) => (
          <li key={i} className="flex gap-2 text-xs">
            <span className="w-24 shrink-0 font-semibold text-on-surface">{AT[r.at] ?? r.at}</span>
            <span className="min-w-0 flex-1 text-on-surface-variant">
              {IMAGE[r.image] ?? r.image}
              {r.text ? (
                <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-primary">
                  <Icon name="text_fields" className="text-xs" />
                  có chữ
                </span>
              ) : (
                <span className="ml-1 text-outline">· không chữ</span>
              )}
              {r.note && <span className="block text-[11px] text-outline">{r.note}</span>}
            </span>
          </li>
        ))}
      </ul>

      <p className="rounded-lg bg-surface-container-low p-2 text-xs text-on-surface">{sample.guide}</p>
    </article>
  );
}

/**
 * Tab Bài viết mẫu: thư viện cách dựng bài (viết trong code backend, dùng chung mọi shop), chỉ xem.
 * Đánh dấu bài kênh đang dùng theo tuyến nội dung đã duyệt. Muốn thêm bài viết mẫu mới: liên hệ đội A51.
 */
export default function PostSamplesTab({ channel }) {
  const { data, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.samples, queryFn: listPostSamples, staleTime: Infinity });
  const { data: lineups } = useQuery({ queryKey: CHANNEL_KEYS.lineups(channel.id), queryFn: () => getLineups(channel.id) });
  const [onlyUsed, setOnlyUsed] = useState(false);

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-60 w-full" />;

  const percents = Object.fromEntries((lineups?.current?.items ?? []).map((i) => [i.sample_key, i.percent]));
  // Bài đã làm xong (enabled) xếp trước; bài chưa làm xong chỉ để xem, không dùng được
  const samples = (onlyUsed ? data.items.filter((s) => percents[s.key] != null) : data.items)
    .slice().sort((a, b) => Number(b.enabled) - Number(a.enabled));
  const groups = Object.entries(data.groups)
    .map(([key, label]) => ({ key, label, items: samples.filter((s) => s.group === key) }))
    .filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-xs text-on-surface-variant">
          {data.items.length} bài viết mẫu dùng chung mọi shop, mới dùng được {data.items.filter((s) => s.enabled).length} bài đã làm xong. Mỗi bài là một cách dựng bài: số slide, loại ảnh từng slide, slide nào có chữ. Muốn
          thêm bài viết mẫu mới, liên hệ đội A51.
        </p>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-on-surface">
          <input type="checkbox" checked={onlyUsed} onChange={(e) => setOnlyUsed(e.target.checked)} className="rounded" />
          Chỉ bài kênh đang dùng
        </label>
      </div>
      {!groups.length && <p className="text-sm text-on-surface-variant">Kênh chưa có tuyến nội dung được duyệt.</p>}
      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <h2 className="text-sm font-bold text-on-surface">
            {g.label} <span className="font-normal text-outline">({g.items.length})</span>
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {g.items.map((s) => (
              <SampleCard key={s.key} sample={s} percent={percents[s.key]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
