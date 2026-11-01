import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { useConfirm } from '../components/common/ConfirmDialog';
import { useCreatorProfile } from '../hooks/creatorQueries';
import { VIDEO_TEMPLATE_KEYS, deleteVideoTemplate, listVideoTemplates } from '../api/videoTemplates';

const PAGE_SIZE = 20;

const formatDate = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

function TemplateRow({ template }) {
  const queryClient = useQueryClient();
  const { confirm, alert } = useConfirm();
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (!(await confirm(`Xoá template "${template.name}"?`, { confirmLabel: 'Xoá', danger: true }))) return;
    setDeleting(true);
    try {
      await deleteVideoTemplate(template.id);
      await queryClient.invalidateQueries({ queryKey: VIDEO_TEMPLATE_KEYS.all });
    } catch (err) {
      alert(err?.message || 'Không xoá được template, vui lòng thử lại.');
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/40 p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
        <Icon name="movie" className="text-xl" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-on-surface">{template.name}</p>
        <a
          href={template.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Icon name="open_in_new" className="shrink-0 text-sm" />
          <span className="truncate">{template.videoUrl}</span>
        </a>
        <p className="text-[11px] text-outline">Tạo lúc {formatDate(template.createdAt)}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Link
          to={`/seller/video-templates/${template.id}/edit`}
          aria-label={`Sửa ${template.name}`}
          className="flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name="edit" className="text-lg" />
        </Link>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          aria-label={`Xoá ${template.name}`}
          className="flex size-8 items-center justify-center rounded-lg text-error hover:bg-error-container/40 disabled:opacity-50"
        >
          <Icon name={deleting ? 'progress_activity' : 'delete'} className={`text-lg ${deleting ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}

/** /seller/video-templates: danh sách video template của shop (note/quan-ly-video-template.txt), mới tạo trước. */
export default function VideoTemplatesPage() {
  useSeo({ title: 'Quản lý video template', noindex: true });
  const { hasProfile, meLoaded } = useCreatorProfile();

  const { data, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: VIDEO_TEMPLATE_KEYS.all,
    queryFn: ({ pageParam }) => listVideoTemplates({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
    enabled: hasProfile,
  });
  const templates = data ? data.pages.flatMap((p) => p.items) : null;

  // Cuộn tới cuối danh sách thì tải trang tiếp
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const addButton = (
    <Link
      to="/seller/video-templates/new"
      className="flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary"
    >
      <Icon name="add" className="text-base" />
      Thêm template
    </Link>
  );

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <Link to="/tools" aria-label="Quay lại" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
          <Icon name="arrow_back" />
        </Link>
        <h1 className="flex-1 text-base font-bold text-on-surface">Quản lý video template</h1>
        {hasProfile && <span className="mr-2">{addButton}</span>}
      </header>

      <section className="space-y-3 p-4 lg:py-6">
        {!meLoaded ? (
          <Skeleton className="h-20 w-full" />
        ) : !hasProfile ? (
          <EmptyState icon="storefront" message="Bạn cần tạo cửa hàng trước khi quản lý video template.">
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          </EmptyState>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !templates ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : !templates.length ? (
          <EmptyState icon="movie" message="Chưa có video template nào.">
            <div className="mt-2">{addButton}</div>
          </EmptyState>
        ) : (
          <>
            <ul className="grid gap-3 lg:grid-cols-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <TemplateRow template={t} />
                </li>
              ))}
            </ul>
            {isFetchingNextPage && <Skeleton className="h-20 w-full" />}
            <div ref={sentinelRef} />
          </>
        )}
      </section>
    </>
  );
}
