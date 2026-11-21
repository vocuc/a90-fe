import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { FormAlert, SelectField, TextField } from '../common/Form';
import Dialog from '../common/Dialog';
import { useConfirm } from '../common/ConfirmDialog';
import { CHANNEL_KEYS, createTextTemplate, decideTextTemplate, getTextTemplates, updateTextTemplate } from '../../api/channels';
import Icon from '../common/Icon';
import TextOverlayPreview from './TextOverlayPreview';

const STATUS = {
  approved: { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700' },
};

/** Template mới chủ shop thêm: ô trắng chữ đen phía trên (sửa tiếp trong popup). */
const NEW_TEMPLATE = {
  name: 'Template của tôi',
  sample_text: 'Đập hộp đôi giày đi chúc Tết',
  style: { position: 'top', font: 'Be Vietnam Pro', weight: 800, size: 6, color: '#111111', stroke: null, background: 'box',
    box_color: '#FFFFFF', box_radius: 8, align: 'center', max_lines: 3 },
};

/** template có id: sửa; template không có id (NEW_TEMPLATE): thêm mới (được duyệt luôn). */
function EditDialog({ channelId, template, meta, onClose }) {
  const creating = !template.id;
  const queryClient = useQueryClient();
  const [name, setName] = useState(template.name);
  const [sample, setSample] = useState(template.sample_text ?? '');
  const [style, setStyle] = useState(template.style);
  const [sampleKeys, setSampleKeys] = useState(template.sample_keys ?? []);
  const set = (patch) => setStyle((s) => ({ ...s, ...patch }));
  const toggleSample = (key) => setSampleKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  const mutation = useMutation({
    mutationFn: () =>
      creating
        ? createTextTemplate(channelId, { name, sample_text: sample, style, sample_keys: sampleKeys })
        : updateTextTemplate(channelId, template.id, { name, sample_text: sample, style, sample_keys: sampleKeys }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.templates(channelId) });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.detail(channelId) });
      onClose();
    },
  });

  return (
    <Dialog
      title={creating ? 'Thêm template chữ' : 'Sửa template chữ'}
      subtitle={creating ? 'Template bạn thêm được duyệt luôn' : undefined}
      onClose={onClose}
      footer={
        <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="h-11 w-full rounded-xl bg-primary-container text-sm font-bold text-on-primary disabled:opacity-50">
          {creating ? 'Thêm template' : 'Lưu template'}
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
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-xs font-semibold text-on-surface">Dùng cho loại bài</legend>
          <p className="text-[11px] text-on-surface-variant">Template chỉ được dùng cho các loại bài được chọn. Không chọn loại nào thì template không được dùng.</p>
          <div className="flex flex-wrap gap-2">
            {(meta.post_samples ?? []).map((s) => {
              const on = sampleKeys.includes(s.key);
              return (
                <button key={s.key} type="button" onClick={() => toggleSample(s.key)} aria-pressed={on}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${on ? 'border-primary bg-primary-container text-on-primary' : 'border-outline-variant/60 text-on-surface'}`}>
                  {s.name}{s.in_lineup ? '' : ' (ngoài tuyến)'}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}

/** Tab Template chữ: các mẫu đội A51 tạo (6 mẫu / lần), chủ shop duyệt / từ chối / sửa. */
export default function TextTemplatesTab({ channel }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const { confirm, alert } = useConfirm();
  const { data, error, refetch } = useQuery({ queryKey: CHANNEL_KEYS.templates(channel.id), queryFn: () => getTextTemplates(channel.id) });
  const decide = useMutation({
    mutationFn: ({ id, approve }) => decideTextTemplate(channel.id, id, approve),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.templates(channel.id) });
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.detail(channel.id) });
      // Bài đang dùng template bị bỏ đã chuyển sang template khác: tải lại lịch đăng
      queryClient.invalidateQueries({ queryKey: ['creator', 'channels', String(channel.id), 'calendar'] });
      if (d?.moved_posts) alert(`${d.moved_posts} bài đang dùng template này đã chuyển sang template khác và sẽ được chèn chữ lại.`);
    },
  });
  const reject = async (t) => {
    const ok = await confirm(
      `Bỏ template "${t.name}"? Bài chưa đăng đang dùng template này sẽ chuyển sang template đã duyệt khác và chèn chữ lại.`,
      { confirmLabel: 'Bỏ template', danger: true },
    );
    if (ok) decide.mutate({ id: t.id, approve: false });
  };

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-60 w-full" />;
  const sampleNames = Object.fromEntries((data.meta.post_samples ?? []).map((s) => [s.key, s.name]));
  const addButton = (
    <button type="button" onClick={() => setEditing(NEW_TEMPLATE)}
      className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary">
      <Icon name="add" className="text-base" />
      Thêm template
    </button>
  );
  const dialog = editing && <EditDialog channelId={channel.id} template={editing} meta={data.meta} onClose={() => setEditing(null)} />;

  if (!data.items.length) {
    return (
      <>
        <EmptyState icon="text_fields" message="Chưa có template chữ. Đội A51 sẽ tạo mẫu khi lập kế hoạch lần đầu, hoặc bạn tự thêm.">
          <div className="mt-2 flex justify-center">{addButton}</div>
        </EmptyState>
        {dialog}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-xs text-on-surface-variant">Bản xem trước trên ảnh của shop. Ảnh thật do worker chèn chữ trước khi đăng.</p>
        {addButton}
      </div>
      {decide.error && <FormAlert>{decide.error.message}</FormAlert>}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {data.items.map((t) => (
          <li key={t.id} className="space-y-2 rounded-2xl border border-outline-variant/40 p-2">
            <TextOverlayPreview image={data.meta.preview_image} text={t.sample_text || t.name} style={t.style} />
            <div className="flex items-center gap-1">
              <p className="min-w-0 flex-1 truncate text-xs font-bold text-on-surface">{t.name}</p>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS[t.status]?.className}`}>{STATUS[t.status]?.label}</span>
            </div>
            {t.sample_keys?.length ? (
              <p className="text-[11px] text-on-surface-variant">
                Dùng cho: {t.sample_keys.map((k) => sampleNames[k] ?? k).join(', ')}
              </p>
            ) : (
              <p className="text-[11px] font-semibold text-error">Chưa gắn loại bài: không được dùng</p>
            )}
            <div className="flex flex-wrap gap-1">
              {t.status === 'pending' && (
                <button type="button" onClick={() => decide.mutate({ id: t.id, approve: true })} className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">
                  Duyệt
                </button>
              )}
              <button type="button" onClick={() => setEditing(t)} className="rounded-lg border border-outline-variant/60 px-2 py-1 text-[11px] font-bold text-on-surface">
                Sửa
              </button>
              <button type="button" onClick={() => (t.status === 'pending' ? decide.mutate({ id: t.id, approve: false }) : reject(t))} className="rounded-lg px-2 py-1 text-[11px] font-bold text-error hover:bg-error-container/40">
                {t.status === 'pending' ? 'Từ chối' : 'Bỏ'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {dialog}
    </div>
  );
}
