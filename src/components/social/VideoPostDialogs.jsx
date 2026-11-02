import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';
import CoverImage from '../common/CoverImage';
import { ErrorState, Skeleton } from '../common/Feedback';
import Pagination from '../common/Pagination';
import { FormAlert, SelectField, TextArea, TextField } from '../common/Form';
import { useConfirm } from '../common/ConfirmDialog';
import { PlatformStatusList, PostStatusBadge } from './PostStatus';
import {
  HASHTAG_MAX,
  PHOTO_TITLE_MAX,
  POST_STATUS,
  VIDEO_AUTO_MAX,
  VIDEO_GAP_MAX_MINUTES,
  VIDEO_STOP_MESSAGES,
  autoCreateVideoPosts,
  createVideoPost,
  deletePost,
  isVideoEditable,
  listVideoImages,
  listVideoPostTemplates,
  newIdempotencyKey,
  retryVideoPost,
  updateVideoPost,
} from '../../api/social';
import { WORKER_FUNCTIONS, WORKER_KEYS, listWorkers } from '../../api/workers';
import { listProducts } from '../../api/autoBatch';

export const POSTS_KEY = ['social', 'posts'];

// <input type="datetime-local"> dùng giờ máy người dùng; gửi backend dạng ISO (UTC)
const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (value) => new Date(value).toISOString();

export const formatSchedule = (iso) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const workerLabel = (w) =>
  `${w.name}${w.functions.length ? ` · ${w.functions.map((f) => WORKER_FUNCTIONS[f]?.label ?? f).join(', ')}` : ''}${w.online ? '' : ' (offline)'}`;

const parseHashtags = (text) =>
  [...new Set(text.split(/[\s,]+/).map((t) => t.replace(/^#+/, '').trim()).filter(Boolean))].slice(0, HASHTAG_MAX);

function useShopWorkers() {
  return useQuery({ queryKey: WORKER_KEYS.all, queryFn: listWorkers });
}

function WorkerSelect({ value, onChange, error }) {
  const { data: workers, isLoading } = useShopWorkers();
  return (
    <SelectField label="Worker dựng và đăng video" value={value} onChange={(e) => onChange(e.target.value)} error={error}>
      <option value="">{isLoading ? 'Đang tải...' : workers?.length ? 'Chọn worker' : 'Shop chưa được gắn worker nào'}</option>
      {(workers ?? []).map((w) => (
        <option key={w.id} value={w.id}>
          {workerLabel(w)}
        </option>
      ))}
    </SelectField>
  );
}

/** Nút đáy của 2 tab "Tạo video" (dính đáy popup như form Sửa). */
function CreateFooter({ onClose, onSubmit, saving }) {
  return (
    <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center gap-2 border-t border-surface-container bg-surface-container-lowest p-3">
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="h-10 rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
      >
        Huỷ
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={saving}
        className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
      >
        <Icon name={saving ? 'progress_activity' : 'movie'} className={`text-lg ${saving ? 'animate-spin' : ''}`} />
        {saving ? 'Đang tạo...' : 'Tạo lịch làm việc'}
      </button>
    </div>
  );
}

/**
 * Tab "Tự động": chọn worker, số bài, giờ đăng bài đầu, khoảng cách tối thiểu / tối đa giữa 2 bài (phút).
 * Hệ thống chọn ngẫu nhiên template + sản phẩm + ảnh, AI viết nội dung (trừ phí từng bài).
 */
function AutoCreateForm({ onClose, onCreated, saving, setSaving }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ workerId: '', count: '5', firstAt: toLocalInput(Date.now()), gapMin: '40', gapMax: '60' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  // Giữ khoá khi bấm lại do lỗi mạng, đổi khi người dùng sửa form
  const [idemKey, setIdemKey] = useState(newIdempotencyKey);

  const set = (field, errorKey) => (e) => {
    setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));
    setErrors((er) => ({ ...er, [errorKey]: undefined }));
    setIdemKey(newIdempotencyKey());
  };

  const validate = () => {
    const er = {};
    const count = Number(form.count);
    const min = Number(form.gapMin);
    const max = Number(form.gapMax);
    if (!form.workerId) er.worker_id = 'Chọn worker.';
    if (!Number.isInteger(count) || count < 1 || count > VIDEO_AUTO_MAX) er.count = `Nhập từ 1 đến ${VIDEO_AUTO_MAX} bài.`;
    if (!form.firstAt) er.first_at = 'Chọn giờ đăng bài đầu tiên.';
    if (!Number.isInteger(min) || min < 0 || min > VIDEO_GAP_MAX_MINUTES) er.gap_min = `Từ 0 đến ${VIDEO_GAP_MAX_MINUTES} phút.`;
    if (!Number.isInteger(max) || max < 0 || max > VIDEO_GAP_MAX_MINUTES) er.gap_max = `Từ 0 đến ${VIDEO_GAP_MAX_MINUTES} phút.`;
    else if (!er.gap_min && max < min) er.gap_max = 'Tối đa phải lớn hơn hoặc bằng tối thiểu.';
    return er;
  };

  const submit = async () => {
    const er = validate();
    setErrors(er);
    setFormError(null);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const result = await autoCreateVideoPosts(
        {
          workerId: Number(form.workerId),
          count: Number(form.count),
          firstAt: fromLocalInput(form.firstAt),
          gapMin: Number(form.gapMin),
          gapMax: Number(form.gapMax),
        },
        idemKey,
      );
      await queryClient.invalidateQueries({ queryKey: POSTS_KEY });
      onCreated(result);
    } catch (err) {
      if (err?.errors && Object.keys(err.errors).length) setErrors(err.errors);
      else setFormError(err?.message || 'Không tạo được bài video, vui lòng thử lại.');
      setSaving(false);
    }
  };

  return (
    <>
      <WorkerSelect value={form.workerId} onChange={set('workerId', 'worker_id')} error={errors.worker_id} />
      <TextField
        label="Số bài video"
        icon="format_list_numbered"
        type="number"
        inputMode="numeric"
        min={1}
        max={VIDEO_AUTO_MAX}
        value={form.count}
        onChange={set('count', 'count')}
        error={errors.count}
        hint={`Tối đa ${VIDEO_AUTO_MAX} bài mỗi lần. Mỗi bài trừ một lần phí AI viết nội dung, hết tiền thì dừng.`}
      />
      <TextField
        label="Giờ đăng bài đầu tiên"
        icon="schedule"
        type="datetime-local"
        value={form.firstAt}
        onChange={set('firstAt', 'first_at')}
        error={errors.first_at}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Cách nhau tối thiểu (phút)"
          icon="timer"
          type="number"
          inputMode="numeric"
          min={0}
          value={form.gapMin}
          onChange={set('gapMin', 'gap_min')}
          error={errors.gap_min}
        />
        <TextField
          label="Cách nhau tối đa (phút)"
          icon="timer"
          type="number"
          inputMode="numeric"
          min={0}
          value={form.gapMax}
          onChange={set('gapMax', 'gap_max')}
          error={errors.gap_max}
        />
      </div>
      <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
        <Icon name="info" className="text-base" />
        Mỗi bài: template ngẫu nhiên, sản phẩm ngẫu nhiên đủ ảnh, ảnh ngẫu nhiên đúng số ảnh template cần. Bài sau đăng cách bài
        trước một số phút ngẫu nhiên trong khoảng trên.
      </p>
      {formError && <FormAlert>{formError}</FormAlert>}
      <CreateFooter onClose={onClose} onSubmit={submit} saving={saving} />
    </>
  );
}

/**
 * Tab "Thủ công": chủ shop tự chọn worker, template, sản phẩm, ảnh (đúng số ảnh template cần), giờ đăng -> 1 bài.
 * AI viết tiêu đề / nội dung / hashtag như tab tự động (trừ phí); sửa lại được sau khi tạo.
 */
function ManualCreateForm({ onClose, onCreated, saving, setSaving }) {
  const queryClient = useQueryClient();
  const templates = useQuery({ queryKey: ['social', 'video-templates'], queryFn: listVideoPostTemplates });
  const products = useQuery({ queryKey: ['creator', 'products', 'all-50'], queryFn: () => listProducts({ limit: 50 }) });
  const [form, setForm] = useState({ workerId: '', templateId: '', productId: '', images: [], scheduledAt: toLocalInput(Date.now()) });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [idemKey, setIdemKey] = useState(newIdempotencyKey);

  const template = templates.data?.find((t) => String(t.id) === form.templateId) ?? null;

  const update = (patch, errorKey) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((er) => ({ ...er, [errorKey]: undefined }));
    setIdemKey(newIdempotencyKey());
  };
  const set = (field, errorKey) => (e) => update({ [field]: e?.target ? e.target.value : e }, errorKey);

  // Đổi template: bỏ bớt ảnh đã chọn nếu template mới cần ít ảnh hơn
  const changeTemplate = (e) => {
    const next = templates.data?.find((t) => String(t.id) === e.target.value);
    update({ templateId: e.target.value, images: next ? form.images.slice(0, next.imageCount) : form.images }, 'video_template_id');
  };

  const submit = async () => {
    const er = {};
    if (!form.workerId) er.worker_id = 'Chọn worker.';
    if (!template) er.video_template_id = 'Chọn template.';
    else if (form.images.length !== template.imageCount) er.images = `Template cần đúng ${template.imageCount} ảnh, đã chọn ${form.images.length}.`;
    if (!form.scheduledAt) er.scheduled_at = 'Chọn giờ đăng.';
    setErrors(er);
    setFormError(null);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      await createVideoPost(
        {
          workerId: Number(form.workerId),
          templateId: Number(form.templateId),
          productId: form.productId ? Number(form.productId) : null,
          images: form.images,
          scheduledAt: fromLocalInput(form.scheduledAt),
        },
        idemKey,
      );
      await queryClient.invalidateQueries({ queryKey: POSTS_KEY });
      onCreated({ created: 1, requested: 1, stopped: null });
    } catch (err) {
      if (err?.errors && Object.keys(err.errors).length) setErrors(err.errors);
      else setFormError(err?.message || 'Không tạo được bài video, vui lòng thử lại.');
      setSaving(false);
    }
  };

  const imageError = errors.images ?? Object.entries(errors).find(([k]) => k.startsWith('images.'))?.[1];

  return (
    <>
      <WorkerSelect value={form.workerId} onChange={set('workerId', 'worker_id')} error={errors.worker_id} />
      <SelectField
        label="Video template"
        value={form.templateId}
        onChange={changeTemplate}
        error={errors.video_template_id}
        hint={templates.data && !templates.data.length ? 'Chưa có template nào đang bật và có số ảnh.' : undefined}
      >
        <option value="">{templates.isLoading ? 'Đang tải...' : 'Chọn template'}</option>
        {(templates.data ?? []).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {t.imageCount} ảnh
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Sản phẩm"
        value={form.productId}
        onChange={set('productId', 'product_id')}
        error={errors.product_id}
        hint="Chọn sản phẩm để lấy ảnh của sản phẩm đó. Có thể chọn ảnh ở tab Tất cả ảnh."
      >
        <option value="">Không theo sản phẩm</option>
        {(products.data?.items ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || `Sản phẩm #${p.id}`}
          </option>
        ))}
      </SelectField>
      {template ? (
        <VideoImagePicker
          key={form.productId || 'all'}
          productId={form.productId ? Number(form.productId) : null}
          selected={form.images}
          onChange={(images) => update({ images }, 'images')}
          required={template.imageCount}
        />
      ) : (
        <p className="rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
          Chọn template để biết cần bao nhiêu ảnh rồi chọn ảnh.
        </p>
      )}
      {imageError && <p className="text-xs text-error">{imageError}</p>}
      <TextField
        label="Giờ đăng"
        icon="schedule"
        type="datetime-local"
        value={form.scheduledAt}
        onChange={set('scheduledAt', 'scheduled_at')}
        error={errors.scheduled_at}
      />
      <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
        <Icon name="info" className="text-base" />
        AI viết tiêu đề, nội dung, hashtag từ ảnh đã chọn (trừ một lần phí). Tạo xong bấm vào bài để sửa nếu cần.
      </p>
      {formError && <FormAlert>{formError}</FormAlert>}
      <CreateFooter onClose={onClose} onSubmit={submit} saving={saving} />
    </>
  );
}

const CREATE_TABS = [
  { value: 'auto', label: 'Tự động', icon: 'auto_awesome' },
  { value: 'manual', label: 'Thủ công', icon: 'touch_app' },
];

/**
 * Popup "Tạo video" (note/lap-lich-worker.txt): tab "Tự động" (mặc định, hệ thống random nhiều bài) và tab "Thủ công"
 * (chủ shop tự chọn worker / template / sản phẩm / ảnh / giờ đăng cho 1 bài). Cả 2 tab giữ dữ liệu khi chuyển qua lại.
 */
export function CreateVideoDialog({ onClose, onCreated }) {
  const [tab, setTab] = useState('auto');
  const [saving, setSaving] = useState(false);
  const formProps = { onClose, onCreated, saving, setSaving };

  return (
    <Dialog title="Tạo video" subtitle="Worker dựng video từ template + ảnh sản phẩm rồi tự đăng đúng giờ" onClose={saving ? () => {} : onClose}>
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container-low p-1 text-sm font-bold">
        {CREATE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            disabled={saving}
            onClick={() => setTab(t.value)}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-lg disabled:opacity-60 ${
              tab === t.value ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon name={t.icon} className="text-lg" />
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className={tab === 'auto' ? 'space-y-3' : 'hidden'}>
        <AutoCreateForm {...formProps} />
      </div>
      <div role="tabpanel" className={tab === 'manual' ? 'space-y-3' : 'hidden'}>
        <ManualCreateForm {...formProps} />
      </div>
    </Dialog>
  );
}

/** Kết quả "Tạo video": số bài đã tạo + lý do dừng sớm. */
export const createdMessage = (result) =>
  `Đã tạo ${result.created}/${result.requested} bài video.${result.stopped ? ` ${VIDEO_STOP_MESSAGES[result.stopped] ?? ''}` : ''}`;

const MOVE_MIME = 'application/x-a51-video-image';
const ORDER_BTN =
  'flex h-6 flex-1 items-center justify-center rounded-md border border-outline-variant/50 text-on-surface-variant hover:border-primary-container hover:text-primary disabled:opacity-30';

/**
 * Ảnh đã chọn theo thứ tự trong video: kéo thả (máy tính) hoặc nút trái / phải để đổi thứ tự, nút x để bỏ.
 */
function SelectedImages({ selected, onChange, large }) {
  // Vị trí đang kéo tới, null = không kéo
  const [dropIndex, setDropIndex] = useState(null);
  const sortable = selected.length > 1;

  const move = (from, to) => {
    if (to < 0 || to >= selected.length || from === to) return;
    const next = [...selected];
    const [img] = next.splice(from, 1);
    next.splice(to, 0, img);
    onChange(next);
  };

  const dragProps = (i) =>
    sortable
      ? {
          draggable: true,
          onDragStart: (e) => {
            e.dataTransfer.setData(MOVE_MIME, String(i));
            e.dataTransfer.effectAllowed = 'move';
          },
          onDragOver: (e) => {
            if (![...e.dataTransfer.types].includes(MOVE_MIME)) return;
            e.preventDefault();
            if (dropIndex !== i) setDropIndex(i);
          },
          onDrop: (e) => {
            e.preventDefault();
            setDropIndex(null);
            const from = Number(e.dataTransfer.getData(MOVE_MIME));
            if (Number.isInteger(from)) move(from, i);
          },
          onDragEnd: () => setDropIndex(null),
        }
      : {};

  return (
    <div className="space-y-1">
      {sortable && <p className="text-[11px] text-on-surface-variant">Thứ tự ảnh trong video. Kéo thả hoặc bấm mũi tên để đổi.</p>}
      <ul className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {selected.map((img, i) => (
          <li key={img.key} className={`shrink-0 space-y-1 ${large ? 'w-24' : 'w-16'}`} {...dragProps(i)}>
            <div
              className={`relative overflow-hidden rounded-lg ${dropIndex === i ? 'ring-2 ring-primary ring-offset-1' : ''} ${
                sortable ? 'cursor-grab' : ''
              }`}
            >
              <CoverImage src={img.thumbUrl} alt="" className="aspect-square w-full" />
              <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] font-bold text-white">{i + 1}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((s) => s.key !== img.key))}
                aria-label={`Bỏ ảnh ${i + 1}`}
                className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-error"
              >
                <Icon name="close" className="text-xs" />
              </button>
            </div>
            {sortable && (
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Đưa ảnh ${i + 1} lên trước`} className={ORDER_BTN}>
                  <Icon name="chevron_left" className="text-sm" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === selected.length - 1}
                  aria-label={`Đưa ảnh ${i + 1} ra sau`}
                  className={ORDER_BTN}
                >
                  <Icon name="chevron_right" className="text-sm" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Chọn ảnh cho bài video: ảnh của sản phẩm hoặc mọi ảnh đã tạo, đúng số ảnh template cần (theo thứ tự chọn, đổi thứ tự
 * được). Ảnh để chọn chia trang 1 2 3 ... large: lưới ảnh to hơn (trang sửa bài).
 */
function VideoImagePicker({ productId, selected, onChange, required, large = false }) {
  const [source, setSource] = useState(productId ? 'product' : 'all');
  const [page, setPage] = useState(1);
  const useProduct = source === 'product' && productId;
  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } = useQuery({
    queryKey: ['social', 'video-images', useProduct ? productId : 'all', page],
    queryFn: () => listVideoImages({ productId: useProduct ? productId : undefined, page }),
    // Giữ trang cũ trong lúc tải trang mới, lưới không bị nhảy
    placeholderData: keepPreviousData,
  });
  const images = data?.items ?? [];
  const order = (key) => selected.findIndex((s) => s.key === key);
  const toggle = (img) => {
    if (order(img.key) >= 0) onChange(selected.filter((s) => s.key !== img.key));
    else if (selected.length < required) onChange([...selected, img]);
  };
  const changeSource = (value) => {
    setSource(value);
    setPage(1);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-on-surface">
          Ảnh của bài{' '}
          <span className={selected.length === required ? 'text-primary' : 'text-error'}>
            ({selected.length}/{required})
          </span>
        </span>
        <div role="tablist" className="flex gap-1 rounded-lg bg-surface-container-low p-0.5 text-xs font-bold">
          {[
            { value: 'product', label: 'Ảnh sản phẩm', disabled: !productId },
            { value: 'all', label: 'Tất cả ảnh' },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={source === t.value}
              disabled={t.disabled}
              onClick={() => changeSource(t.value)}
              className={`rounded-md px-2 py-1 disabled:opacity-40 ${source === t.value ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {selected.length > 0 && <SelectedImages selected={selected} onChange={onChange} large={large} />}
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !images.length ? (
        <p className="py-4 text-center text-xs text-on-surface-variant">Không có ảnh nào.</p>
      ) : (
        <div className="space-y-2 rounded-xl border border-outline-variant/30 p-1.5">
          <div
            className={`grid gap-1.5 transition-opacity ${isPlaceholderData ? 'opacity-50' : ''} ${
              large ? 'grid-cols-3 sm:grid-cols-4 xl:grid-cols-5' : 'grid-cols-4 sm:grid-cols-5'
            }`}
          >
            {images.map((img) => {
              const idx = order(img.key);
              return (
                <button
                  key={img.key}
                  type="button"
                  onClick={() => toggle(img)}
                  aria-pressed={idx >= 0}
                  className={`relative overflow-hidden rounded-lg ring-2 ${idx >= 0 ? 'ring-primary' : 'ring-transparent'} ${idx < 0 && selected.length >= required ? 'opacity-50' : ''}`}
                >
                  <CoverImage src={img.thumbUrl} alt="" className="aspect-square w-full" />
                  {idx >= 0 && (
                    <span className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
                      {idx + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Pagination page={page} lastPage={data?.lastPage} onChange={setPage} disabled={isFetching && isPlaceholderData} />
        </div>
      )}
    </div>
  );
}

/** Sửa bài video (worker chưa nhận / bài lỗi): mọi thứ. */
function VideoPostForm({ post, onSaved, footerExtra }) {
  const templates = useQuery({ queryKey: ['social', 'video-templates'], queryFn: listVideoPostTemplates });
  const products = useQuery({ queryKey: ['creator', 'products', 'all-50'], queryFn: () => listProducts({ limit: 50 }) });
  const [form, setForm] = useState(() => ({
    workerId: post.video?.worker?.id ? String(post.video.worker.id) : '',
    templateId: post.video?.template?.id ? String(post.video.template.id) : '',
    productId: post.video?.product?.id ? String(post.video.product.id) : '',
    images: post.images.map((i) => ({ key: i.key, generationId: i.generationId, outputId: i.outputId, thumbUrl: i.thumbUrl })),
    scheduledAt: toLocalInput(post.video?.scheduledAt ?? Date.now()),
    title: post.title,
    content: post.content,
    hashtags: post.hashtags.map((h) => `#${h}`).join(' '),
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Template bị xoá sau khi tạo bài: vẫn hiện tên cũ, phải chọn template khác
  const template = useMemo(
    () => templates.data?.find((t) => String(t.id) === form.templateId) ?? null,
    [templates.data, form.templateId],
  );
  const required = template?.imageCount ?? post.video?.template?.imageCount ?? form.images.length;

  const set = (field, errorKey) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((er) => ({ ...er, [errorKey]: undefined }));
  };

  const submit = async () => {
    const er = {};
    if (!form.workerId) er.worker_id = 'Chọn worker.';
    if (!template) er.video_template_id = 'Chọn template.';
    if (template && form.images.length !== template.imageCount) er.images = `Template cần đúng ${template.imageCount} ảnh.`;
    if (!form.scheduledAt) er.scheduled_at = 'Chọn giờ đăng.';
    setErrors(er);
    setFormError(null);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const saved = await updateVideoPost(post.id, {
        workerId: Number(form.workerId),
        templateId: Number(form.templateId),
        productId: form.productId ? Number(form.productId) : null,
        images: form.images,
        scheduledAt: fromLocalInput(form.scheduledAt),
        title: form.title,
        content: form.content,
        hashtags: parseHashtags(form.hashtags),
      });
      onSaved(saved);
    } catch (err) {
      if (err?.errors && Object.keys(err.errors).length) setErrors(err.errors);
      else setFormError(err?.message || 'Không lưu được bài, vui lòng thử lại.');
      setSaving(false);
    }
  };

  const imageError = errors.images ?? Object.entries(errors).find(([k]) => k.startsWith('images.'))?.[1];

  return (
    <>
      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-3">
      <WorkerSelect value={form.workerId} onChange={set('workerId', 'worker_id')} error={errors.worker_id} />
      <SelectField label="Video template" value={form.templateId} onChange={set('templateId', 'video_template_id')} error={errors.video_template_id}>
        <option value="">{templates.isLoading ? 'Đang tải...' : 'Chọn template'}</option>
        {!template && post.video?.template?.name && form.templateId && (
          <option value={form.templateId} disabled>
            {post.video.template.name} (đã tắt / đã xoá / chưa có số ảnh)
          </option>
        )}
        {(templates.data ?? []).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {t.imageCount} ảnh
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Sản phẩm"
        value={form.productId}
        onChange={set('productId', 'product_id')}
        error={errors.product_id}
        hint="Để chọn ảnh theo sản phẩm. Có thể chọn ảnh ở tab Tất cả ảnh."
      >
        <option value="">Không theo sản phẩm</option>
        {(products.data?.items ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || `Sản phẩm #${p.id}`}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Giờ đăng"
        icon="schedule"
        type="datetime-local"
        value={form.scheduledAt}
        onChange={set('scheduledAt', 'scheduled_at')}
        error={errors.scheduled_at}
      />
      <TextField label="Tiêu đề" icon="title" value={form.title} maxLength={PHOTO_TITLE_MAX} onChange={set('title', 'title')} error={errors.title} />
      <TextArea label="Nội dung" value={form.content} rows={4} onChange={set('content', 'content')} error={errors.content} />
      <TextField
        label="Hashtag"
        icon="tag"
        value={form.hashtags}
        onChange={set('hashtags', 'hashtags')}
        placeholder="#giay #thoitrang"
        hint={`Cách nhau bằng dấu cách, tối đa ${HASHTAG_MAX}.`}
        error={errors.hashtags ?? Object.entries(errors).find(([k]) => k.startsWith('hashtags.'))?.[1]}
      />
        </div>
        <div className="space-y-2">
          <VideoImagePicker
            key={form.productId || 'all'}
            productId={form.productId ? Number(form.productId) : null}
            selected={form.images}
            onChange={(images) => {
              setForm((f) => ({ ...f, images }));
              setErrors((er) => ({ ...er, images: undefined }));
            }}
            required={required}
            large
          />
          {imageError && <p className="text-xs text-error">{imageError}</p>}
        </div>
      </div>
      {formError && <FormAlert>{formError}</FormAlert>}
      {/* Mobile có tab đáy cố định nên nút nằm cuối form; desktop dính đáy màn hình */}
      <div className="-mx-4 flex items-center gap-2 border-t border-surface-container bg-surface-container-lowest px-4 pt-3 lg:sticky lg:bottom-0 lg:pb-3">
        {footerExtra}
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50 lg:ml-auto lg:flex-none lg:px-8"
        >
          {saving && <Icon name="progress_activity" className="animate-spin text-lg" />}
          Lưu
        </button>
      </div>
    </>
  );
}

/**
 * Nội dung trang bài video (/posts/:id/video): sửa (worker chưa nhận / lỗi), xoá, "Đăng lại" (lỗi), "Tạo lại" (worker
 * nhận rồi im lặng, có thể đăng trùng), xem (đã đăng). onDone: sau khi lưu / xoá / đăng lại xong.
 */
export function VideoPostPanel({ post, onDone }) {
  const queryClient = useQueryClient();
  const { confirm, alert } = useConfirm();
  const [busy, setBusy] = useState(false);
  const editable = isVideoEditable(post);
  const failed = post.status === POST_STATUS.PENDING_REVIEW;

  const refresh = () => queryClient.invalidateQueries({ queryKey: POSTS_KEY });

  const run = async (action, failMessage) => {
    setBusy(true);
    try {
      await action();
      await refresh();
      onDone();
    } catch (err) {
      alert(err?.message || failMessage);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm('Xoá bài video này?', { confirmLabel: 'Xoá', danger: true }))) return;
    run(() => deletePost(post.id), 'Không xoá được bài, vui lòng thử lại.');
  };

  const retry = async () => {
    if (post.status === POST_STATUS.PUBLISHING) {
      const ok = await confirm(
        'Worker đã nhận bài này. Nếu worker thực ra đã đăng xong nhưng chưa báo lại, tạo lại có thể làm bài bị đăng 2 lần. Vẫn tạo lại?',
        { confirmLabel: 'Tạo lại', danger: true },
      );
      if (!ok) return;
    }
    run(() => retryVideoPost(post.id), 'Không đưa bài về chờ đăng được, vui lòng thử lại.');
  };

  const header = (
    <div className="space-y-1.5 rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant">
      <div className="flex flex-wrap items-center gap-2">
        <PostStatusBadge status={post.status} />
        <span>
          Đăng lúc <b className="text-on-surface">{formatSchedule(post.video?.scheduledAt)}</b>
        </span>
      </div>
      <PlatformStatusList platforms={post.platforms} />
      {post.lastError?.message && <p className="font-semibold text-error">{post.lastError.message}</p>}
      {failed && <p>Sửa bài nếu cần rồi bấm <b>Đăng lại</b> để worker làm lại.</p>}
    </div>
  );

  const deleteButton = (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      aria-label="Xoá bài"
      className="flex size-10 items-center justify-center rounded-xl text-error hover:bg-error-container/40 disabled:opacity-50"
    >
      <Icon name="delete" className="text-xl" />
    </button>
  );

  if (editable) {
    return (
      <div className="space-y-3">
        <div className="space-y-3 lg:flex lg:items-start lg:gap-3 lg:space-y-0">
          <div className="lg:flex-1">{header}</div>
          {failed && (
            <button
              type="button"
              onClick={retry}
              disabled={busy}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-primary px-6 text-sm font-bold text-primary hover:bg-primary-fixed/30 disabled:opacity-50 lg:w-auto"
            >
              <Icon name="replay" className="text-lg" />
              Đăng lại
            </button>
          )}
        </div>
        <VideoPostForm
          post={post}
          footerExtra={deleteButton}
          onSaved={async () => {
            await refresh();
            onDone();
          }}
        />
      </div>
    );
  }

  const tpl = post.video?.template;
  return (
    <div className="space-y-3 lg:max-w-3xl">
      {header}
      {post.status === POST_STATUS.PUBLISHING && (
        <p className="text-xs text-on-surface-variant">
          Worker <b>{post.video?.worker?.name ?? ''}</b> đang dựng và đăng video. Nếu worker bị tắt và không báo lại, bấm <b>Tạo lại</b>
          để bài về chờ đăng.
        </p>
      )}
      {post.status === POST_STATUS.GENERATING && <p className="text-xs text-on-surface-variant">AI đang viết nội dung, chờ xong là sửa được.</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-on-surface-variant">Worker</dt>
        <dd className="font-semibold text-on-surface">{post.video?.worker?.name ?? '—'}</dd>
        <dt className="text-on-surface-variant">Template</dt>
        <dd className="font-semibold text-on-surface">
          {tpl?.videoUrl ? (
            <a href={tpl.videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {tpl.name}
            </a>
          ) : (
            tpl?.name || '—'
          )}
        </dd>
        <dt className="text-on-surface-variant">Sản phẩm</dt>
        <dd className="font-semibold text-on-surface">{post.video?.product?.name ?? '—'}</dd>
      </dl>
      <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {post.images.map((img) => (
          <li key={img.key}>
            <CoverImage src={img.thumbUrl} alt="" className="aspect-square w-full rounded-lg" />
          </li>
        ))}
      </ul>
      {post.content && <p className="whitespace-pre-line text-sm text-on-surface">{post.content}</p>}
      {post.hashtags.length > 0 && <p className="text-xs font-semibold text-primary">{post.hashtags.map((h) => `#${h}`).join(' ')}</p>}
      <p className="text-[11px] text-outline">
        Template và sản phẩm quản lý ở{' '}
        <Link to="/seller/video-templates" className="text-primary hover:underline">
          Quản lý video template
        </Link>
        .
      </p>
      {post.status === POST_STATUS.PUBLISHING && (
        <button
          type="button"
          onClick={retry}
          disabled={busy}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary-container px-6 text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50 lg:w-auto"
        >
          <Icon name={busy ? 'progress_activity' : 'replay'} className={`text-lg ${busy ? 'animate-spin' : ''}`} />
          Tạo lại
        </button>
      )}
    </div>
  );
}
