import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import FormCanvas from '../components/template/FormCanvas';
import CoverUpload from '../components/template/CoverUpload';
import PromptEditor from '../components/template/PromptEditor';
import DynamicForm, { initialValues, validateValues } from '../components/template/DynamicForm';
import { PRESETS } from '../components/template/presets';
import { Input } from '../components/template/inputs';
import { PUBLISHABLE, STATUS_BADGE } from '../components/creative/creativeStatus';
import {
  useAiModels,
  useCreatorCreative,
  useCreatorProfile,
  usePublishCreative,
  useSaveTemplateCreative,
} from '../hooks/creatorQueries';
import {
  buildRequestJson,
  createField,
  emptyTemplate,
  withRatioField,
  fromCreative,
  fromPayload,
  toCreativePayload,
  toPayload,
  validateTemplate,
} from '../components/template/templateSchema';

/*
 * /seller/products/new (tạo) và /seller/products/:id/edit (sửa): Creator thiết kế form người mua + Prompt Template.
 * Tạo mới tự lưu nháp vào localStorage tới khi tạo xong; sửa thì đọc/ghi thẳng Creative trên backend.
 */

const STORAGE_KEY = 'ai90_template_builder_draft';
// Ảnh đại diện lưu riêng: ảnh lớn vượt dung lượng localStorage thì vẫn giữ được nháp Template
const COVER_KEY = 'ai90_template_builder_cover';

const loadCover = () => {
  try {
    return localStorage.getItem(COVER_KEY);
  } catch {
    return null;
  }
};

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? withRatioField(fromPayload(JSON.parse(raw))) : null;
  } catch {
    return null;
  }
};

const TABS = [
  { id: 'fields', label: 'Thiết kế form', icon: 'dynamic_form' },
  { id: 'preview', label: 'Xem trước', icon: 'visibility' },
];

function PresetDialog({ onPick, onClose, canClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-on-surface">Bắt đầu Template mới</h2>
            <p className="text-xs text-on-surface-variant">Chọn mẫu khởi đầu, có thể sửa toàn bộ sau đó.</p>
          </div>
          {canClose && (
            <button type="button" onClick={onClose} aria-label="Đóng" className="text-outline hover:text-on-surface">
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className="flex flex-col items-start gap-1.5 rounded-xl border border-outline-variant/50 p-3 text-left transition-colors hover:border-primary-container hover:bg-primary-fixed/30"
            >
              <Icon name={p.icon} className="text-2xl text-primary" />
              <span className="text-sm font-bold text-on-surface">{p.title}</span>
              <span className="text-[11px] text-on-surface-variant">{p.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, className = '' }) {
  return (
    <section className={`space-y-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 ${className}`}>
      {title && (
        <div>
          <h2 className="text-sm font-bold text-on-surface">{title}</h2>
          {subtitle && <p className="text-[11px] text-on-surface-variant">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

function PreviewTab({ template }) {
  const { fields } = template;
  const [values, setValues] = useState(() => initialValues(fields));
  const [submitted, setSubmitted] = useState(false);
  // Trường mới thêm/đổi kiểu -> bổ sung giá trị mặc định
  const formValues = useMemo(() => {
    const base = initialValues(fields);
    Object.keys(base).forEach((k) => {
      if (k in values && Array.isArray(values[k]) === Array.isArray(base[k]) && typeof values[k] === typeof base[k]) base[k] = values[k];
    });
    return base;
  }, [fields, values]);
  const errors = submitted ? validateValues(fields, formValues) : {};
  const models = useAiModels(true);
  const model = models.data?.find((m) => String(m.id) === String(template.model_id));
  const request = buildRequestJson(template, formValues, model);
  const valid = Object.keys(validateValues(fields, formValues)).length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Form người mua" subtitle="Hiển thị đúng như trang Creative sau khi publish. Điền thử để kiểm tra.">
        <div className="rounded-xl bg-surface-container-low p-4">
          {template.title?.trim() && <p className="mb-3 text-base font-bold text-on-surface">{template.title.trim()}</p>}
          <DynamicForm
            fields={fields}
            values={formValues}
            errors={errors}
            onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
          />
          <button
            type="button"
            onClick={() => setSubmitted(true)}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary"
          >
            <Icon name="auto_awesome" className="text-lg" />
            Tạo ảnh (chạy thử)
          </button>
          {submitted && (
            <p className={`mt-2 text-center text-xs ${valid ? 'text-emerald-700' : 'text-error'}`}>
              {valid ? 'Dữ liệu hợp lệ — xem prompt hoàn chỉnh ở bên cạnh.' : 'Form còn lỗi, backend sẽ từ chối trước khi gọi model.'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setValues(initialValues(fields));
            setSubmitted(false);
          }}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Xoá dữ liệu thử
        </button>
      </Panel>

      <Panel title="Prompt hoàn chỉnh" subtitle="JSON gửi tới model: thay biến vào prompt, mỗi ảnh một khoá. Không gọi Gemini thật.">
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-inverse-surface p-3 font-mono text-[11px] leading-relaxed text-inverse-on-surface">
          {JSON.stringify(request, null, 4)}
        </pre>
        <p className="text-[11px] text-on-surface-variant">
          Ảnh chỉ có URL thật sau khi được tải lên lúc người mua tạo ảnh; bản thử ghi tên file thay cho URL.
        </p>
      </Panel>
    </div>
  );
}

/** Badge trạng thái + nút Đăng bán (tạm dừng ở trang Quản lý sản phẩm); đăng bán dùng nội dung đã lưu trên backend. */
function StatusControl({ id, status, publish, onChange }) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.draft;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
      {PUBLISHABLE.includes(status) && (
        <button
          type="button"
          onClick={() => publish.mutate(id, { onSuccess: (saved) => onChange(saved.status) })}
          disabled={publish.isPending}
          className="flex h-9 items-center gap-1 rounded-lg bg-primary-container px-2.5 text-xs font-bold text-on-primary hover:bg-primary disabled:opacity-50"
        >
          <Icon
            name={publish.isPending ? 'progress_activity' : 'rocket_launch'}
            className={`text-base ${publish.isPending ? 'animate-spin' : ''}`}
          />
          <span className="hidden sm:inline">{status === 'paused' ? 'Đăng bán lại' : 'Đăng bán'}</span>
        </button>
      )}
    </div>
  );
}

function Builder({ creative: loaded }) {
  const navigate = useNavigate();
  const isEdit = !!loaded;
  // Tạo mới đã lưu Creative nhưng ảnh đại diện lỗi -> các lần lưu sau là sửa Creative vừa tạo
  const [savedCreative, setSavedCreative] = useState(null);
  const creative = savedCreative ?? loaded;
  // Tạo mới chưa có nháp -> vào thẳng builder với Template trống
  const [template, setTemplate] = useState(() => (loaded ? fromCreative(loaded) : (loadDraft() ?? withRatioField(emptyTemplate()))));
  const [picking, setPicking] = useState(false);
  const [tab, setTab] = useState('fields');
  const [selectedId, setSelectedId] = useState(() => template?.fields[0]?._id ?? null);
  const [savedAt, setSavedAt] = useState(null);
  const [cover, setCover] = useState(() => (loaded ? (loaded.images?.[0]?.url ?? null) : loadCover()));
  const [coverSaved, setCoverSaved] = useState(true);
  const saveCreative = useSaveTemplateCreative();
  const publish = usePublishCreative();
  // Trạng thái hiện tại: lấy từ kết quả đăng bán gần nhất, không chờ tải lại Creative
  const [status, setStatus] = useState(loaded?.status ?? null);
  const statusError = publish.error;

  // Tạo mới: tự lưu nháp trên trình duyệt
  useEffect(() => {
    if (!template || isEdit) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPayload(template)));
      setSavedAt(new Date());
    } catch {
      setSavedAt(null);
    }
  }, [template, isEdit]);

  useEffect(() => {
    if (isEdit) return;
    try {
      if (cover) localStorage.setItem(COVER_KEY, cover);
      else localStorage.removeItem(COVER_KEY);
      setCoverSaved(true);
    } catch {
      setCoverSaved(false);
    }
  }, [cover, isEdit]);

  const { errors, issues } = useMemo(() => (template ? validateTemplate(template) : { errors: {}, issues: [] }), [template]);
  const errorIssues = issues.filter((i) => i.level === 'error');
  const errorCount = errorIssues.length;

  // Nút Tạo sản phẩm: còn lỗi thì liệt kê lỗi dưới nút; hợp lệ thì lưu lên backend
  const [showErrors, setShowErrors] = useState(false);
  // Lỗi backend trả về (422) hoặc lỗi tải ảnh đại diện
  const [serverErrors, setServerErrors] = useState([]);
  useEffect(() => setServerErrors([]), [template, cover]);
  const save = () => {
    if (errorCount) {
      setShowErrors(true);
      return;
    }
    setServerErrors([]);
    saveCreative.mutate(
      { creative, payload: toCreativePayload(template), cover },
      {
        onSuccess: ({ creative: saved, coverError }) => {
          if (coverError) {
            setSavedCreative(saved);
            setServerErrors([`Đã lưu sản phẩm nhưng chưa tải được ảnh đại diện: ${coverError} Bấm lưu lại để thử lại.`]);
            return;
          }
          if (!isEdit) {
            try {
              localStorage.removeItem(STORAGE_KEY);
              localStorage.removeItem(COVER_KEY);
            } catch {
              // Không xoá được nháp cũng không sao
            }
          }
          navigate('/seller/products', { replace: true });
        },
        onError: (err) => setServerErrors(err.errors ? [...new Set(Object.values(err.errors))] : [err.message]),
      },
    );
  };

  const start = (picked) => {
    const next = withRatioField(picked);
    setTemplate(next);
    setSelectedId(next.fields[0]?._id ?? null);
    setPicking(false);
    setTab('fields');
  };

  const pickPreset = (preset) => {
    const edited = template.fields.some((f) => f.type !== 'aspect_ratio') || template.prompt_text.trim();
    if (edited && !window.confirm('Thay thế Template hiện tại bằng mẫu mới?'))
      return;
    start(preset.build());
  };

  if (!template || picking) {
    return (
      <div className="min-h-screen bg-surface-container-low">
        <PresetDialog onPick={pickPreset} onClose={() => setPicking(false)} canClose={!!template} />
      </div>
    );
  }

  const set = (patch) => setTemplate((t) => ({ ...t, ...patch }));
  const setFields = (fn) => setTemplate((t) => ({ ...t, fields: fn(t.fields) }));
  const selected = template.fields.find((f) => f._id === selectedId);

  const addField = (type, at) => {
    const field = { ...createField(type, template.fields), _autoKey: true };
    setFields((list) => [...list.slice(0, at), field, ...list.slice(at)]);
    setSelectedId(field._id);
  };
  const updateField = (field) => {
    setFields((list) => {
      const old = list.find((f) => f._id === field._id);
      return list.map((f) => {
        if (f._id === field._id) return field;
        // Đổi key -> cập nhật điều kiện hiển thị đang trỏ tới key cũ
        if (old && old.key !== field.key && f.visibility_rule?.field === old.key)
          return { ...f, visibility_rule: { ...f.visibility_rule, field: field.key } };
        return f;
      });
    });
  };
  const removeField = (id) => {
    const index = template.fields.findIndex((f) => f._id === id);
    const removed = template.fields[index];
    if (!removed || removed.type === 'aspect_ratio') return;
    const next = template.fields.filter((f) => f._id !== id).map((f) =>
      f.visibility_rule?.field === removed.key ? { ...f, visibility_rule: null } : f,
    );
    set({ fields: next });
    setSelectedId(next[Math.min(index, next.length - 1)]?._id ?? null);
  };
  const moveField = (from, to) => {
    if (to < 0 || to >= template.fields.length) return;
    setFields((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const gotoIssue = (issue) => {
    if (issue.fieldId) setSelectedId(issue.fieldId);
    setTab('fields');
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="sticky top-0 z-40 border-b border-outline-variant/40 bg-surface-container-lowest/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2">
          <Link
            to="/seller/products"
            aria-label="Về danh sách sản phẩm"
            className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-surface-container"
          >
            <Icon name="arrow_back" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate px-2 text-sm font-bold text-on-surface">{template.title?.trim() || 'Tạo và chỉnh sửa Creative'}</p>
            <p className="px-2 text-[10px] text-outline">
              {isEdit
                ? status === 'published'
                  ? 'Sản phẩm đang bán: thay đổi có hiệu lực ngay khi lưu'
                  : 'Sửa sản phẩm · lưu thay đổi trước khi đăng bán'
                : savedAt
                  ? `Đã lưu nháp trên trình duyệt lúc ${savedAt.toLocaleTimeString('vi-VN')}`
                  : 'Chưa lưu được nháp'}
            </p>
          </div>
          {isEdit && <StatusControl id={creative.id} status={status} publish={publish} onChange={setStatus} />}
          {!isEdit && (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-outline-variant/50 px-2.5 text-xs font-semibold text-on-surface hover:border-primary-container hover:text-primary"
            >
              <Icon name="note_add" className="text-base" />
              <span className="hidden sm:inline">Mẫu mới</span>
            </button>
          )}
        </div>
        {statusError && (
          <div role="alert" className="mx-auto max-w-7xl px-3 pb-2">
            <div className="rounded-lg bg-error-container/60 px-3 py-2 text-xs text-on-error-container">
              <p className="flex items-start gap-1.5 font-semibold">
                <Icon name="error" className="text-base" />
                <span className="flex-1">{statusError.message}</span>
              </p>
              {statusError.context?.reasons?.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-6">
                  {statusError.context.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon name={t.icon} className="text-base" />
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl p-3 sm:p-4">
        {tab === 'fields' && (
          // md: ảnh | (prompt trên, form dưới); xl: ảnh | prompt | form
          <div className="grid gap-4 md:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_1fr]">
            <div className="space-y-4 md:sticky md:top-28 md:row-span-2 md:self-start xl:row-span-1">
              <Panel title="Ảnh đại diện Creative">
                <CoverUpload value={cover} onChange={setCover} />
                {!coverSaved && (
                  <p className="text-[11px] text-amber-800">Ảnh quá lớn để lưu nháp trên trình duyệt, tải lại trang sẽ mất ảnh.</p>
                )}
              </Panel>
              <Panel title="Video hướng dẫn">
                <Input
                  type="url"
                  inputMode="url"
                  placeholder="https://www.tiktok.com/@shop/video/..."
                  aria-label="Link video hướng dẫn trên TikTok"
                  value={template.video_url ?? ''}
                  onChange={(e) => set({ video_url: e.target.value })}
                  error={errors.video_url}
                  hint="Link video TikTok hướng dẫn người mua dùng mẫu (không bắt buộc)."
                />
              </Panel>
            </div>
            <div className="min-w-0">
              <Panel
                title="Prompt Template"
                subtitle="Chỉ dẫn cố định của Creator. Người mua không thấy và không sửa được; giá trị họ nhập chỉ thay vào {{biến}}."
              >
                <PromptEditor template={template} onChange={(prompt_text) => set({ prompt_text })} onSet={set} errors={errors} stacked />
              </Panel>
            </div>
            <div className="min-w-0 md:col-start-2 xl:col-start-3">
              <FormCanvas
                fields={template.fields}
                errors={errors}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAdd={addField}
                onChange={updateField}
                onRemove={removeField}
                onMove={moveField}
              />
              <button
                type="button"
                onClick={save}
                disabled={saveCreative.isPending}
                className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:opacity-90 disabled:opacity-60"
              >
                <Icon name={creative ? 'save' : 'add_circle'} className="text-lg" />
                {saveCreative.isPending ? 'Đang lưu...' : creative ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
              </button>
              {!isEdit && !savedCreative && (
                <p className="mt-2 text-center text-[11px] text-on-surface-variant">
                  Sản phẩm được lưu dạng nháp. Đăng bán ở trang Quản lý sản phẩm.
                </p>
              )}
              {serverErrors.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {serverErrors.map((message) => (
                    <li key={message} className="flex items-start gap-2 rounded-lg bg-error-container/50 px-3 py-2 text-xs text-on-error-container">
                      <Icon name="error" className="text-base" />
                      <span className="flex-1">{message}</span>
                    </li>
                  ))}
                </ul>
              )}
              {showErrors && errorCount > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {errorIssues.map((issue, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => gotoIssue(issue)}
                        className="flex w-full items-start gap-2 rounded-lg bg-error-container/50 px-3 py-2 text-left text-xs text-on-error-container hover:brightness-95"
                      >
                        <Icon name="error" className="text-base" />
                        <span className="flex-1">{issue.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'preview' && <PreviewTab template={template} />}
      </main>
    </div>
  );
}

/** Tải hồ sơ cửa hàng, danh sách model và Creative (khi sửa) trước khi mở builder. */
export default function TemplateBuilderPage() {
  const { id } = useParams();
  const isEdit = id != null;
  useSeo({ title: isEdit ? 'Sửa sản phẩm' : 'Tạo sản phẩm', noindex: true });
  const { hasProfile, meLoaded } = useCreatorProfile();
  const creative = useCreatorCreative(id, hasProfile && isEdit);

  const loading = !meLoaded || (hasProfile && isEdit && creative.isLoading);

  if (loading || !hasProfile || (isEdit && creative.error)) {
    return (
      <div className="min-h-screen bg-surface-container-low p-4">
        <div className="mx-auto max-w-3xl">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : !hasProfile ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Icon name="storefront" className="text-4xl text-outline" />
              <p className="text-sm text-on-surface-variant">Bạn cần tạo cửa hàng trước khi {isEdit ? 'quản lý' : 'tạo'} sản phẩm.</p>
              <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
                Tạo cửa hàng
              </Link>
            </div>
          ) : (
            <ErrorState error={creative.error} onRetry={creative.refetch} />
          )}
        </div>
      </div>
    );
  }

  return <Builder key={id ?? 'new'} creative={isEdit ? creative.data : null} />;
}
