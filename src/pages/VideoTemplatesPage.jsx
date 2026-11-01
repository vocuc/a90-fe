import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { useConfirm } from '../components/common/ConfirmDialog';
import { useCreatorProfile } from '../hooks/creatorQueries';
import { VIDEO_TEMPLATE_KEYS, deleteVideoTemplate, listVideoTemplates, setVideoTemplateEnabled } from '../api/videoTemplates';

const PAGE_SIZE = 20;

const formatDate = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

function TemplateRow({ template }) {
  const queryClient = useQueryClient();
  const { confirm, alert } = useConfirm();
  const [deleting, setDeleting] = useState(false);
  // Công tắc: hiện ngay giá trị mới, lỗi thì trả về như cũ
  const [enabled, setEnabled] = useState(template.enabled);
  const [toggling, setToggling] = useState(false);
  useEffect(() => setEnabled(template.enabled), [template.enabled]);

  const toggle = async (next) => {
    setEnabled(next);
    setToggling(true);
    try {
      await setVideoTemplateEnabled(template.id, next);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: VIDEO_TEMPLATE_KEYS.all }),
        // Ô chọn template trong popup bài video
        queryClient.invalidateQueries({ queryKey: ['social', 'video-templates'] }),
      ]);
    } catch (err) {
      setEnabled(!next);
      alert(err?.message || 'Không đổi được trạng thái template, vui lòng thử lại.');
    } finally {
      setToggling(false);
    }
  };

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
      <div className={`min-w-0 flex-1 ${enabled ? '' : 'opacity-60'}`}>
        <p className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
          <span className="truncate">{template.name}</span>
          {template.synced && (
            <span
              title="Đồng bộ từ máy làm template, không sửa / xoá được"
              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-primary-fixed/40 px-1 text-[10px] font-bold text-primary"
            >
              <Icon name="sync" className="text-xs" />
              Đồng bộ
            </span>
          )}
          {!enabled && (
            <span className="shrink-0 rounded bg-surface-container px-1 text-[10px] font-bold text-on-surface-variant">Đã tắt</span>
          )}
        </p>
        {template.videoUrl && (
          <a
            href={template.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <Icon name="open_in_new" className="shrink-0 text-sm" />
            <span className="truncate">{template.videoUrl}</span>
          </a>
        )}
        <p className="text-[11px] text-outline">
          {template.imageCount ? (
            `${template.imageCount} ảnh · `
          ) : (
            <span className="font-semibold text-amber-700">Chưa có số ảnh, sửa để dùng tạo video · </span>
          )}
          Tạo lúc {formatDate(template.createdAt)}
        </p>
      </div>
      {/* Công tắc: tắt thì không dùng cho bài video mới (cả template đồng bộ) */}
      <label className="flex shrink-0 cursor-pointer items-center" title={enabled ? 'Đang bật: dùng cho bài video' : 'Đã tắt: không dùng nữa'}>
        <span className="relative inline-flex">
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            disabled={toggling}
            onChange={(e) => toggle(e.target.checked)}
            aria-label={`${enabled ? 'Tắt' : 'Bật'} template ${template.name}`}
            className="peer sr-only"
          />
          <span className="h-6 w-10 rounded-full bg-outline-variant transition-colors peer-checked:bg-primary-container peer-focus-visible:ring-2 peer-focus-visible:ring-primary-container/40 peer-disabled:opacity-60" />
          <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
        </span>
      </label>
      {/* Template đồng bộ từ máy làm template: chỉ xem */}
      {!template.synced && (
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
      )}
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
