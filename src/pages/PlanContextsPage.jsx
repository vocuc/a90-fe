import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SelectField, SubmitButton, TextArea, TextField } from '../components/common/Form';
import { useConfirm } from '../components/common/ConfirmDialog';
import { useAiModels } from '../hooks/creatorQueries';
import {
  PLAN_CONTEXT_DEFAULT_RATIO,
  PLAN_CONTEXT_DESCRIPTION_MAX,
  PLAN_CONTEXT_KEYS,
  PLAN_CONTEXT_NAME_MAX,
  createPlanContext,
  deletePlanContext,
  listPlanContexts,
  updatePlanContext,
} from '../api/planner';

const EMPTY = { name: '', description: '', modelId: '', aspectRatio: PLAN_CONTEXT_DEFAULT_RATIO };

/** Form thêm / sửa bối cảnh. context: null = thêm mới. */
function ContextForm({ context, models, onDone, onCancel }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() =>
    context
      ? { name: context.name, description: context.description, modelId: String(context.model?.id ?? ''), aspectRatio: context.aspectRatio }
      : { ...EMPTY, modelId: String(models[0]?.id ?? '') },
  );
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const model = models.find((m) => String(m.id) === form.modelId);
  const ratios = model?.supported_aspect_ratios ?? [form.aspectRatio];

  const save = useMutation({
    mutationFn: () => (context ? updatePlanContext(context.id, form) : createPlanContext(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_CONTEXT_KEYS.all });
      onDone();
    },
    onError: (e) => setErrors(e.errors ?? {}),
  });

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Nhập tên bối cảnh.';
    if (!form.description.trim()) next.description = 'Mô tả bối cảnh để AI tạo ảnh theo.';
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-primary-container/40 bg-surface-container-lowest p-4">
      <TextField
        label="Tên bối cảnh"
        value={form.name}
        onChange={set('name')}
        maxLength={PLAN_CONTEXT_NAME_MAX}
        placeholder="Ví dụ: Quán cafe gỗ buổi sáng"
        error={errors.name}
      />
      <TextArea
        label="Mô tả bối cảnh"
        value={form.description}
        onChange={set('description')}
        maxLength={PLAN_CONTEXT_DESCRIPTION_MAX}
        rows={6}
        placeholder="Nền, ánh sáng, người mẫu, màu chủ đạo, các ảnh bắt buộc phải có, câu phải thêm vào cuối prompt..."
        hint="Đây là yêu cầu cho skill kế hoạch nội dung: skill đọc rồi tự viết prompt cho từng ảnh theo đúng yêu cầu, không ghép nguyên mô tả này vào prompt."
        error={errors.description}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Model AI"
          value={form.modelId}
          onChange={(e) => {
            const next = models.find((m) => String(m.id) === e.target.value);
            setForm((f) => ({
              ...f,
              modelId: e.target.value,
              aspectRatio: next?.supported_aspect_ratios?.includes(f.aspectRatio) ? f.aspectRatio : (next?.supported_aspect_ratios?.[0] ?? f.aspectRatio),
            }));
          }}
          error={errors.model_id}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Tỉ lệ khung" value={form.aspectRatio} onChange={set('aspectRatio')} error={errors.aspect_ratio}>
          {ratios.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </SelectField>
      </div>
      {save.error && !save.error.errors && <FormAlert>{save.error.message}</FormAlert>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-12 flex-1 items-center justify-center rounded-xl border border-outline-variant/60 text-sm font-bold text-on-surface hover:bg-surface-container"
        >
          Huỷ
        </button>
        <div className="flex-[2]">
          <SubmitButton loading={save.isPending} loadingText="Đang lưu...">
            {context ? 'Lưu thay đổi' : 'Thêm bối cảnh'}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

function ContextCard({ context, onEdit }) {
  const queryClient = useQueryClient();
  const { confirm, alert } = useConfirm();
  const refresh = () => queryClient.invalidateQueries({ queryKey: PLAN_CONTEXT_KEYS.all });
  const toggle = useMutation({ mutationFn: () => updatePlanContext(context.id, { active: !context.active }), onSuccess: refresh, onError: (e) => alert(e.message) });
  const remove = useMutation({ mutationFn: () => deletePlanContext(context.id), onSuccess: refresh, onError: (e) => alert(e.message) });

  const onDelete = async () => {
    const ok = await confirm(`Xoá bối cảnh "${context.name}"? Bài kế hoạch đã tạo vẫn giữ ảnh, nhưng không "Làm lại" được nữa.`, {
      confirmLabel: 'Xoá',
      danger: true,
    });
    if (ok) remove.mutate();
  };

  return (
    <li className={`space-y-2 rounded-2xl border p-4 ${context.active ? 'border-outline-variant/40' : 'border-dashed border-outline-variant/60 opacity-70'}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface">{context.name}</p>
          <p className="text-[11px] text-on-surface-variant">
            {context.model?.name ?? '—'} · {context.aspectRatio}
            {!context.active && ' · Đã tắt'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={context.active}
          aria-label={context.active ? 'Tắt bối cảnh' : 'Bật bối cảnh'}
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${context.active ? 'bg-primary' : 'bg-outline-variant'}`}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${context.active ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      <p className="line-clamp-4 whitespace-pre-line text-xs text-on-surface-variant">{context.description}</p>
      <div className="flex gap-1">
        <button type="button" onClick={onEdit} className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary hover:bg-surface-container">
          <Icon name="edit" className="text-base" />
          Sửa
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={remove.isPending}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-error hover:bg-error-container/40 disabled:opacity-50"
        >
          <Icon name="delete" className="text-base" />
          Xoá
        </button>
      </div>
    </li>
  );
}

/**
 * /plan-contexts: bối cảnh mẫu cho ảnh của bài kế hoạch nội dung (src/api/planner.js). Planner chọn 1 bối cảnh đang
 * bật cho mỗi bài, đọc mô tả làm yêu cầu và tự viết prompt đầy đủ cho từng ảnh (mô tả không ghép vào prompt).
 */
export default function PlanContextsPage() {
  useSeo({ title: 'Bối cảnh mẫu', noindex: true });
  const navigate = useNavigate();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/tools'));
  const { data: contexts, error, refetch } = useQuery({ queryKey: PLAN_CONTEXT_KEYS.all, queryFn: listPlanContexts });
  const { data: models, error: modelsError } = useAiModels(true);
  // null: không mở form; 'new': thêm; id: sửa bối cảnh đó
  const [editing, setEditing] = useState(null);

  const ready = contexts && models;
  const editingContext = contexts?.find((c) => c.id === editing) ?? null;

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button type="button" onClick={goBack} aria-label="Quay lại" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
          <Icon name="arrow_back" />
        </button>
        <h1 className="flex-1 text-base font-bold text-on-surface">Bối cảnh mẫu</h1>
        {ready && editing === null && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="mr-2 flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary"
          >
            <Icon name="add" className="text-base" />
            Thêm bối cảnh
          </button>
        )}
      </header>

      <section className="space-y-4 p-4 lg:mx-auto lg:w-full lg:max-w-[720px] lg:py-6">
        <p className="flex items-start gap-2 rounded-xl bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
          <Icon name="info" className="text-base" />
          <span>
            Skill kế hoạch nội dung chọn một bối cảnh <b>đang bật</b> cho mỗi bài, đọc mô tả như yêu cầu rồi tự viết prompt cho từng ảnh
            theo đúng yêu cầu đó (mô tả không được ghép nguyên vào prompt).
            Ảnh của bài kế hoạch không tính phí.
          </span>
        </p>

        {error || modelsError ? (
          <ErrorState error={error ?? modelsError} onRetry={refetch} />
        ) : !ready ? (
          <div className="space-y-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : (
          <>
            {editing !== null && (
              <ContextForm
                key={editing}
                context={editingContext}
                models={models}
                onDone={() => setEditing(null)}
                onCancel={() => setEditing(null)}
              />
            )}
            {!contexts.length && editing === null ? (
              <EmptyState icon="landscape" message="Chưa có bối cảnh nào. Thêm ít nhất 1 bối cảnh để skill lập kế hoạch tạo được bài.">
                <button
                  type="button"
                  onClick={() => setEditing('new')}
                  className="mt-2 flex h-10 items-center gap-1 rounded-xl bg-primary-container px-4 text-sm font-bold text-on-primary hover:bg-primary"
                >
                  <Icon name="add" className="text-lg" />
                  Thêm bối cảnh
                </button>
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {contexts
                  .filter((c) => c.id !== editing)
                  .map((c) => (
                    <ContextCard key={c.id} context={c} onEdit={() => setEditing(c.id)} />
                  ))}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}
