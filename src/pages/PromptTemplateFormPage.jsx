import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { Input, borderCls, inputCls } from '../components/template/inputs';
import { MAX_PROMPT_LENGTH } from '../components/template/templateSchema';
import {
  MAX_BLOCKS,
  MAX_BLOCK_TITLE,
  MAX_TEMPLATE_TITLE,
  mergePrompt,
  templateParts,
  createBlock,
  fromTemplate,
  toTemplateBody,
} from '../components/template/promptTemplate';
import { useCreatorProfile, usePromptTemplate, useSavePromptTemplate } from '../hooks/creatorQueries';

/*
 * /seller/prompt-templates/new và /:id/edit: soạn Template prompt bằng các block (note/template-prompt.txt).
 * Prompt Template = các block ghép lại; Creative chọn Template thì prompt cuối = Template + prompt riêng của Creative.
 */

function BlockCard({ block, index, count, onChange, onRemove, onMove, onTogglePin }) {
  // Ô nội dung tự cao theo nội dung (tối thiểu rows=5), không cần kéo giãn tay
  const contentRef = useRef(null);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [block.content]);

  return (
    <div
      className={`space-y-2 rounded-xl border bg-surface-container-lowest p-3 ${
        block.pinned ? 'border-primary-container ring-1 ring-primary-container/40' : 'border-outline-variant/40'
      }`}
    >
      {block.pinned && (
        <p className="flex items-center gap-1 text-[11px] font-bold text-primary">
          <Icon name="keep" className="text-sm" />
          Ghim cuối: luôn đứng sau prompt riêng của Creative
        </p>
      )}
      <div className="flex items-center gap-1">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-[11px] font-bold text-primary">
          {index + 1}
        </span>
        <input
          value={block.title}
          maxLength={MAX_BLOCK_TITLE}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
          placeholder="Tiêu đề block, ví dụ: BỐI CẢNH"
          aria-label={`Tiêu đề block ${index + 1}`}
          className={`${inputCls} ${borderCls()} h-9 flex-1 font-semibold`}
        />
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={!!block.pinned}
          aria-label={block.pinned ? 'Bỏ ghim block' : 'Ghim block xuống cuối prompt'}
          title={block.pinned ? 'Bỏ ghim' : 'Ghim xuống cuối: đứng sau prompt riêng của Creative (chỉ 1 block)'}
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-surface-container ${
            block.pinned ? 'bg-primary-fixed text-primary' : 'text-outline hover:text-on-surface'
          }`}
        >
          <Icon name={block.pinned ? 'keep' : 'keep_off'} className="text-lg" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index - 1)}
          disabled={index === 0}
          aria-label="Đưa block lên"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-outline hover:bg-surface-container hover:text-on-surface disabled:opacity-30"
        >
          <Icon name="arrow_upward" className="text-lg" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index + 1)}
          disabled={index === count - 1}
          aria-label="Đưa block xuống"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-outline hover:bg-surface-container hover:text-on-surface disabled:opacity-30"
        >
          <Icon name="arrow_downward" className="text-lg" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={count === 1}
          aria-label="Xoá block"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-outline hover:bg-error-container/50 hover:text-error disabled:opacity-30"
        >
          <Icon name="delete" className="text-lg" />
        </button>
      </div>
      <textarea
        ref={contentRef}
        value={block.content}
        maxLength={MAX_PROMPT_LENGTH}
        onChange={(e) => onChange({ ...block, content: e.target.value })}
        rows={5}
        spellCheck={false}
        placeholder="Nội dung block..."
        aria-label={`Nội dung block ${index + 1}`}
        className={`${inputCls} ${borderCls()} resize-none overflow-hidden font-mono text-[13px] leading-relaxed`}
      />
    </div>
  );
}

function Editor({ loaded }) {
  const navigate = useNavigate();
  const [state, setState] = useState(() => fromTemplate(loaded));
  const [errors, setErrors] = useState([]);
  const save = useSavePromptTemplate();
  // head: trước prompt riêng của Creative, tail: block ghim sau prompt riêng
  const { head, tail } = templateParts(state.blocks);
  const prompt = mergePrompt(head, tail);
  const tooLong = prompt.length > MAX_PROMPT_LENGTH;

  const setBlocks = (fn) => setState((s) => ({ ...s, blocks: fn(s.blocks) }));
  // Chỉ ghim được 1 block: ghim block này thì bỏ ghim block khác
  const togglePin = (id) => setBlocks((list) => list.map((b) => ({ ...b, pinned: b._id === id ? !b.pinned : false })));
  const addBlock = () => setBlocks((list) => [...list, createBlock()]);
  const moveBlock = (from, to) =>
    setBlocks((list) => {
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  const submit = () => {
    const issues = [];
    if (!state.title.trim()) issues.push('Chưa nhập tên Template.');
    if (!prompt) issues.push('Template cần ít nhất 1 block có nội dung.');
    if (tooLong) issues.push(`Prompt Template tối đa ${MAX_PROMPT_LENGTH.toLocaleString('vi-VN')} ký tự.`);
    setErrors(issues);
    if (issues.length) return;
    save.mutate(
      { id: loaded?.id, body: toTemplateBody(state) },
      {
        onSuccess: () => navigate('/seller/prompt-templates', { replace: true }),
        onError: (err) => setErrors(err.errors ? [...new Set(Object.values(err.errors).flat())] : [err.message]),
      },
    );
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="sticky top-0 z-40 border-b border-outline-variant/40 bg-surface-container-lowest/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2">
          <Link
            to="/seller/prompt-templates"
            aria-label="Về danh sách Template"
            className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-surface-container"
          >
            <Icon name="arrow_back" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate px-2 text-sm font-bold text-on-surface">{state.title.trim() || (loaded ? 'Sửa Template' : 'Tạo Template')}</p>
            <p className="px-2 text-[10px] text-outline">
              {loaded?.creative_count
                ? `${loaded.creative_count} Creative đang dùng: lưu xong prompt của các Creative đó đổi theo`
                : 'Ghép các block thành prompt dùng chung cho nhiều Creative'}
            </p>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={save.isPending}
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary disabled:opacity-60"
          >
            <Icon name={save.isPending ? 'progress_activity' : 'save'} className={`text-base ${save.isPending ? 'animate-spin' : ''}`} />
            {save.isPending ? 'Đang lưu...' : loaded ? 'Lưu thay đổi' : 'Tạo Template'}
          </button>
        </div>
        {errors.length > 0 && (
          <ul role="alert" className="mx-auto max-w-6xl space-y-1 px-3 pb-2">
            {errors.map((message) => (
              <li key={message} className="flex items-start gap-2 rounded-lg bg-error-container/60 px-3 py-2 text-xs text-on-error-container">
                <Icon name="error" className="shrink-0 text-base" />
                <span className="flex-1">{message}</span>
              </li>
            ))}
          </ul>
        )}
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 p-3 sm:p-4 lg:grid-cols-2">
        <div className="space-y-3">
          <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
            <Input
              label="Tên Template *"
              maxLength={MAX_TEMPLATE_TITLE}
              placeholder="Ví dụ: Ảnh sản phẩm studio"
              value={state.title}
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            />
          </section>
          {state.blocks.map((block, i) => (
            <BlockCard
              key={block._id}
              block={block}
              index={i}
              count={state.blocks.length}
              onChange={(next) => setBlocks((list) => list.map((b) => (b._id === block._id ? next : b)))}
              onRemove={() => setBlocks((list) => list.filter((b) => b._id !== block._id))}
              onMove={(to) => moveBlock(i, to)}
              onTogglePin={() => togglePin(block._id)}
            />
          ))}
          <button
            type="button"
            onClick={addBlock}
            disabled={state.blocks.length >= MAX_BLOCKS}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-outline-variant/60 text-sm font-bold text-primary hover:border-primary-container hover:bg-primary-fixed/30 disabled:opacity-50"
          >
            <Icon name="add" className="text-lg" />
            Thêm block
          </button>
        </div>

        <section className="space-y-2 self-start rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 lg:sticky lg:top-20">
          <div>
            <h2 className="text-sm font-bold text-on-surface">Prompt hoàn chỉnh</h2>
            <p className="text-[11px] text-on-surface-variant">
              Các block ghép theo thứ tự, prompt riêng của Creative nối sau. Block ghim (nếu có) luôn ở cuối cùng.
            </p>
          </div>
          <pre className="max-h-[70vh] min-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-inverse-surface p-3 font-mono text-[12px] leading-relaxed text-inverse-on-surface">
            {prompt ? (
              <>
                {head && `${head}\n\n`}
                <span className="rounded bg-white/15 px-1 italic opacity-80">[Prompt riêng của Creative]</span>
                {tail && `\n\n${tail}`}
              </>
            ) : (
              '(Chưa có nội dung)'
            )}
          </pre>
          <p className={`text-right text-[11px] ${tooLong ? 'text-error' : 'text-outline'}`}>
            {prompt.length.toLocaleString('vi-VN')}/{MAX_PROMPT_LENGTH.toLocaleString('vi-VN')}
          </p>
        </section>
      </main>
    </div>
  );
}

export default function PromptTemplateFormPage() {
  const { id } = useParams();
  const isEdit = id != null;
  useSeo({ title: isEdit ? 'Sửa Template' : 'Tạo Template', noindex: true });
  const { hasProfile, meLoaded } = useCreatorProfile();
  const template = usePromptTemplate(id, hasProfile && isEdit);
  const loading = !meLoaded || (hasProfile && isEdit && template.isLoading);

  if (loading || !hasProfile || (isEdit && template.error)) {
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
              <p className="text-sm text-on-surface-variant">Bạn cần tạo cửa hàng trước khi tạo Template.</p>
              <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
                Tạo cửa hàng
              </Link>
            </div>
          ) : (
            <ErrorState error={template.error} onRetry={template.refetch} />
          )}
        </div>
      </div>
    );
  }

  return <Editor key={id ?? 'new'} loaded={isEdit ? template.data : null} />;
}
