import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { FormAlert, SelectField, TextField } from '../common/Form';
import Dialog from '../common/Dialog';
import { CHANNEL_KEYS, decideTextTemplate, getTextTemplates, updateTextTemplate } from '../../api/channels';
import TextOverlayPreview from './TextOverlayPreview';

const STATUS = {
  approved: { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700' },
};

function EditDialog({ channelId, template, meta, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(template.name);
  const [sample, setSample] = useState(template.sample_text ?? '');
  const [style, setStyle] = useState(template.style);
  const set = (patch) => setStyle((s) => ({ ...s, ...patch }));
  const mutation = useMutation({
    mutationFn: () => updateTextTemplate(channelId, template.id, { name, sample_text: sample, style }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.templates(channelId) });
      onClose();
    },
  });

  return (
    <Dialog
      title="Sửa template chữ"
      onClose={onClose}
      footer={
        <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="h-11 w-full rounded-xl bg-primary-container text-sm font-bold text-on-primary disabled:opacity-50">
          Lưu template
        </button>
      }
    >
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <TextOverlayPreview image={meta.preview_image} text={sample || 'Chữ mẫu'} style={style} />
        <div className="space-y-3">
          <TextField label="Tên" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          <TextField label="Chữ mẫu" value={sample} maxLength={150} onChange={(e) => setSample(e.target.value)} />
          <SelectField label="Vị trí" value={style.position} onChange={(e) => set({ position: e.target.value })}>
            <option value="top">Trên</option>
            <option value="middle">Giữa</option>
            <option value="bottom">Dưới</option>
          </SelectField>
          <SelectField label="Font" value={style.font} onChange={(e) => set({ font: e.target.value })}>
            {meta.fonts.map((f) => <option key={f} value={f}>{f}</option>)}
          </SelectField>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-on-surface">
              Cỡ chữ ({style.size})
              <input type="range" min="3" max="10" step="0.5" value={style.size} onChange={(e) => set({ size: Number(e.target.value) })} className="w-full" />
            </label>
            <label className="text-xs font-semibold text-on-surface">
              Độ đậm ({style.weight})
              <input type="range" min="400" max="900" step="100" value={style.weight} onChange={(e) => set({ weight: Number(e.target.value) })} className="w-full" />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-on-surface">
            <label>
              Màu chữ
              <input type="color" value={style.color} onChange={(e) => set({ color: e.target.value.toUpperCase() })} className="block h-9 w-full" />
            </label>
            <label>
              Nền chữ
              <select value={style.background} onChange={(e) => set({ background: e.target.value })} className="block w-full rounded-lg border-outline-variant/40 text-xs">
                <option value="none">Không</option>
                <option value="box">Ô màu</option>
              </select>
            </label>
            {style.background === 'box' ? (
              <label>
                Màu ô
                <input type="color" value={style.box_color ?? '#FFFFFF'} onChange={(e) => set({ box_color: e.target.value.toUpperCase() })} className="block h-9 w-full" />
              </label>
            ) : (
              <label>
                Viền
                <input type="color" value={style.stroke?.color ?? '#000000'}
                  onChange={(e) => set({ stroke: { color: e.target.value.toUpperCase(), width_px: style.stroke?.width_px || 6 } })} className="block h-9 w-full" />
              </label>
            )}
          </div>
          {mutation.error && <FormAlert>{mutation.error.message}</FormAlert>}
        </div>
      </div>
    </Dialog>
  );
}

/** Tab Template chữ: các mẫu đội A51 tạo (6 mẫu / lần), chủ shop duyệt / từ chối / sửa. */
export default function TextTemplatesTab({ channel }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const { data, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.templates(channel.id), queryFn: () => getTextTemplates(channel.id) });
  const decide = useMutation({
    mutationFn: ({ id, approve }) => decideTextTemplate(channel.id, id, approve),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.templates(channel.id) });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.detail(channel.id) });
    },
  });

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-60 w-full" />;
  if (!data.items.length) {
    return <EmptyState icon="text_fields" message="Chưa có template chữ. Đội A51 sẽ tạo mẫu khi lập kế hoạch lần đầu." />;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-on-surface-variant">Bản xem trước trên ảnh của shop. Ảnh thật do worker chèn chữ trước khi đăng.</p>
      {decide.error && <FormAlert>{decide.error.message}</FormAlert>}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {data.items.map((t) => (
          <li key={t.id} className="space-y-2 rounded-2xl border border-outline-variant/40 p-2">
            <TextOverlayPreview image={data.meta.preview_image} text={t.sample_text || t.name} style={t.style} />
            <div className="flex items-center gap-1">
              <p className="min-w-0 flex-1 truncate text-xs font-bold text-on-surface">{t.name}</p>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS[t.status]?.className}`}>{STATUS[t.status]?.label}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {t.status === 'pending' && (
                <button type="button" onClick={() => decide.mutate({ id: t.id, approve: true })} className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">
                  Duyệt
                </button>
              )}
              <button type="button" onClick={() => setEditing(t)} className="rounded-lg border border-outline-variant/60 px-2 py-1 text-[11px] font-bold text-on-surface">
                Sửa
              </button>
              <button type="button" onClick={() => decide.mutate({ id: t.id, approve: false })} className="rounded-lg px-2 py-1 text-[11px] font-bold text-error hover:bg-error-container/40">
                {t.status === 'pending' ? 'Từ chối' : 'Bỏ'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {editing && <EditDialog channelId={channel.id} template={editing} meta={data.meta} onClose={() => setEditing(null)} />}
    </div>
  );
}
