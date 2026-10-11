import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import FormCanvas from '../components/template/FormCanvas';
import CoverUpload from '../components/template/CoverUpload';
import PromptEditor from '../components/template/PromptEditor';
import DynamicForm, { initialValues, validateValues } from '../components/template/DynamicForm';
import { PRESETS } from '../components/template/presets';
import { Input } from '../components/template/inputs';
import {
  IMAGE_ROLES,
  buildRequestPreview,
  createField,
  fromPayload,
  toPayload,
  validateTemplate,
} from '../components/template/templateSchema';

/*
 * /template-builder: Creator thiết kế Template đầu vào + Prompt Template cho một AI Creative.
 * Bản dùng thử chỉ có frontend: tự lưu nháp vào localStorage, chưa gọi backend.
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
    return raw ? fromPayload(JSON.parse(raw)) : null;
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

function FileThumb({ file }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? <img src={url} alt={file.name} className="size-16 rounded-lg object-cover" /> : null;
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
  const parts = buildRequestPreview(template, formValues);
  const valid = Object.keys(validateValues(fields, formValues)).length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Form người mua" subtitle="Hiển thị đúng như trang Creative sau khi publish. Điền thử để kiểm tra.">
        <div className="rounded-xl bg-surface-container-low p-4">
          <p className="mb-3 text-base font-bold text-on-surface">{template.name || 'Template chưa đặt tên'}</p>
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
              {valid ? 'Dữ liệu hợp lệ — xem yêu cầu sẽ gửi tới model ở bên cạnh.' : 'Form còn lỗi, backend sẽ từ chối trước khi gọi model.'}
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

      <Panel title="Yêu cầu gửi tới model" subtitle="Mô phỏng Prompt Engine: thay biến, rồi gắn ảnh theo vai trò. Không gọi Gemini thật.">
        <ol className="space-y-2">
          {parts.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 shrink-0 rounded bg-surface-container px-1.5 py-0.5 font-mono text-[10px] font-bold text-on-surface-variant">
                {p.kind === 'image' ? 'image' : 'text'}
              </span>
              {p.kind === 'image' ? (
                <div className="flex items-center gap-2">
                  <FileThumb file={p.file} />
                  <span className="text-[11px] text-on-surface-variant">
                    {p.file.name}
                    <br />
                    {IMAGE_ROLES[p.role]?.label ?? p.role} · {p.file.type}
                  </span>
                </div>
              ) : (
                <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words rounded-lg bg-surface-container-low p-2 font-mono text-[11px] leading-relaxed text-on-surface">
                  {p.text || <span className="text-outline">(trống)</span>}
                </pre>
              )}
            </li>
          ))}
        </ol>
        {parts.length === 1 && <p className="text-[11px] text-on-surface-variant">Tải ảnh ở form bên cạnh để thấy ảnh được gắn vào yêu cầu.</p>}
      </Panel>
    </div>
  );
}

export default function TemplateBuilderPage() {
  useSeo({ title: 'Thiết kế Template', noindex: true });
  const [template, setTemplate] = useState(loadDraft);
  const [picking, setPicking] = useState(() => !template);
  const [tab, setTab] = useState('fields');
  const [selectedId, setSelectedId] = useState(() => template?.fields[0]?._id ?? null);
  const [savedAt, setSavedAt] = useState(null);
  const [cover, setCover] = useState(loadCover);
  const [coverSaved, setCoverSaved] = useState(true);

  // Tự lưu nháp
  useEffect(() => {
    if (!template) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPayload(template)));
      setSavedAt(new Date());
    } catch {
      setSavedAt(null);
    }
  }, [template]);

  useEffect(() => {
    try {
      if (cover) localStorage.setItem(COVER_KEY, cover);
      else localStorage.removeItem(COVER_KEY);
      setCoverSaved(true);
    } catch {
      setCoverSaved(false);
    }
  }, [cover]);

  const { errors, issues } = useMemo(() => (template ? validateTemplate(template) : { errors: {}, issues: [] }), [template]);
  const errorIssues = issues.filter((i) => i.level === 'error');
  const errorCount = errorIssues.length;

  // Nút Tạo sản phẩm: còn lỗi thì liệt kê lỗi dưới nút; hợp lệ thì ghi nháp ngay. Chưa có API lưu Template ở backend.
  const [saveState, setSaveState] = useState(null);
  // Đang hiện danh sách lỗi thì giữ để danh sách tự cập nhật khi sửa
  useEffect(() => setSaveState((s) => (s === 'invalid' ? s : null)), [template]);
  const save = () => {
    if (errorCount) {
      setSaveState('invalid');
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPayload(template)));
      setSavedAt(new Date());
      setSaveState('saved');
    } catch {
      setSaveState('failed');
    }
  };

  const start = (next) => {
    setTemplate(next);
    setSelectedId(next.fields[0]?._id ?? null);
    setPicking(false);
    setTab('fields');
  };

  const pickPreset = (preset) => {
    if (template && (template.fields.length || template.prompt_text.trim()) && !window.confirm('Thay thế Template hiện tại bằng mẫu mới?'))
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
          <Link to="/" aria-label="Về trang chủ" className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-surface-container">
            <Icon name="arrow_back" />
          </Link>
          <div className="min-w-0 flex-1">
            <input
              value={template.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Tên Template, ví dụ: Ảnh sản phẩm giày"
              aria-label="Tên Template"
              maxLength={150}
              className={`w-full rounded-lg border bg-transparent px-2 py-1 text-sm font-bold text-on-surface placeholder:font-normal placeholder:text-outline focus:outline-none focus:ring-2 ${
                errors.name ? 'border-error focus:ring-error/20' : 'border-transparent hover:border-outline-variant/50 focus:border-primary-container focus:ring-primary-container/20'
              }`}
            />
            <p className="px-2 text-[10px] text-outline">
              Bản dùng thử · {savedAt ? `Đã lưu nháp trên trình duyệt lúc ${savedAt.toLocaleTimeString('vi-VN')}` : 'Chưa lưu được nháp'}
            </p>
          </div>
          <span
            className={`flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-bold ${
              errorCount ? 'bg-error-container/60 text-on-error-container' : 'bg-emerald-50 text-emerald-800'
            }`}
          >
            <Icon name={errorCount ? 'error' : 'check_circle'} className="text-base" />
            <span className="hidden sm:inline">{errorCount ? `${errorCount} lỗi` : 'Hợp lệ'}</span>
            <span className="sm:hidden">{errorCount || '✓'}</span>
          </span>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-outline-variant/50 px-2.5 text-xs font-semibold text-on-surface hover:border-primary-container hover:text-primary"
          >
            <Icon name="note_add" className="text-base" />
            <span className="hidden sm:inline">Mẫu mới</span>
          </button>
        </div>
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
                className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:opacity-90"
              >
                <Icon name="add_circle" className="text-lg" />
                Tạo sản phẩm
              </button>
              {saveState === 'saved' && (
                <p className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700">
                  <Icon name="check_circle" className="text-base" />
                  Đã lưu
                </p>
              )}
              {saveState === 'failed' && <p className="mt-2 text-center text-xs text-error">Không lưu được trên trình duyệt.</p>}
              {saveState === 'invalid' && errorCount > 0 && (
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
