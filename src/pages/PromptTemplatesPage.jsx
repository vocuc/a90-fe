import { Link } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { useConfirm } from '../components/common/ConfirmDialog';
import { useCreatorProfile, useDeletePromptTemplate, usePromptTemplates } from '../hooks/creatorQueries';

/*
 * /seller/prompt-templates: Template prompt của Creator (note/template-prompt.txt).
 * Mỗi Template gồm các block tiêu đề + nội dung; Creative chọn Template thì prompt cuối = Template + prompt riêng.
 */

function TemplateCard({ template }) {
  const remove = useDeletePromptTemplate();
  const { confirm } = useConfirm();
  const inUse = template.creative_count > 0;

  const onDelete = async () => {
    if (!(await confirm(`Xoá Template "${template.title}"?`, { confirmLabel: 'Xoá' }))) return;
    remove.mutate(template.id);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
      <Link to={`/seller/prompt-templates/${template.id}/edit`} className="flex-1 p-3 transition-colors hover:bg-surface-container-low">
        <h3 className="line-clamp-2 text-sm font-bold text-on-surface">{template.title}</h3>
        <p className="mt-1 text-[11px] text-on-surface-variant">
          {template.blocks.length} block · {inUse ? `${template.creative_count} Creative đang dùng` : 'Chưa Creative nào dùng'}
        </p>
        <p className="mt-2 line-clamp-4 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-outline">{template.prompt}</p>
      </Link>
      <div className="flex items-center gap-2 border-t border-outline-variant/30 px-3 py-2">
        <Link to={`/seller/prompt-templates/${template.id}/edit`} className="text-xs font-bold text-primary hover:underline">
          Sửa
        </Link>
        <button
          type="button"
          onClick={onDelete}
          disabled={inUse || remove.isPending}
          title={inUse ? 'Template đang được Creative dùng, bỏ chọn ở Creative trước khi xoá' : undefined}
          className="ml-auto text-xs font-semibold text-on-surface-variant hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
        >
          {remove.isPending ? 'Đang xoá...' : 'Xoá'}
        </button>
      </div>
      {remove.error && <p className="px-3 pb-2 text-[11px] text-error">{remove.error.message}</p>}
    </div>
  );
}

export default function PromptTemplatesPage() {
  useSeo({ title: 'Template prompt', noindex: true });
  const { hasProfile, meLoaded } = useCreatorProfile();
  const { data, isLoading, error, refetch } = usePromptTemplates(hasProfile);

  return (
    <>
      <header className="sticky top-[60px] z-30 border-b border-surface-container bg-surface-container-lowest/90 backdrop-blur-md">
        <div className="flex items-center gap-2 px-2 py-2">
          <Link
            to="/seller/creatives"
            aria-label="Về Quản lý Creative"
            className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
          >
            <Icon name="arrow_back" />
          </Link>
          <h1 className="flex-1 text-base font-bold text-on-surface">Template prompt</h1>
          {hasProfile && (
            <Link
              to="/seller/prompt-templates/new"
              className="mr-2 flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary"
            >
              <Icon name="add" className="text-base" />
              Tạo Template
            </Link>
          )}
        </div>
      </header>

      <section className="p-4">
        {!meLoaded ? (
          <Skeleton className="h-24 w-full" />
        ) : !hasProfile ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Icon name="storefront" className="text-4xl text-outline" />
            <p className="text-sm text-on-surface-variant">Bạn cần tạo cửa hàng trước khi tạo Template.</p>
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <EmptyState icon="view_agenda" message="Chưa có Template nào. Template gồm các block prompt dùng chung cho nhiều Creative.">
            <Link
              to="/seller/prompt-templates/new"
              className="mt-2 flex h-10 items-center gap-1 rounded-xl bg-primary-container px-4 text-sm font-bold text-on-primary hover:bg-primary"
            >
              <Icon name="add" className="text-lg" />
              Tạo Template
            </Link>
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
