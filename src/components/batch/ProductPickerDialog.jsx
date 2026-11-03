import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Dialog from '../common/Dialog';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../common/Feedback';
import { AUTO_KEYS, AUTO_MAX_COUNT, listProducts } from '../../api/autoBatch';

const PAGE_SIZE = 20;

/**
 * Popup chọn sản phẩm thủ công cho "Tạo tự động": chọn nhiều sản phẩm (tối đa AUTO_MAX_COUNT), mỗi sản phẩm 1 lô.
 * picked: sản phẩm đang chọn; onConfirm(products) khi bấm Xong (rỗng = quay lại chọn ngẫu nhiên).
 */
export default function ProductPickerDialog({ picked, onConfirm, onClose }) {
  const [selected, setSelected] = useState(picked);
  const isOn = (p) => selected.some((s) => s.id === p.id);
  const full = selected.length >= AUTO_MAX_COUNT;
  const toggle = (p) => setSelected((prev) => (prev.some((s) => s.id === p.id) ? prev.filter((s) => s.id !== p.id) : [...prev, p]));

  const { data, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: AUTO_KEYS.products,
    queryFn: ({ pageParam }) => listProducts({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
  });
  const products = data ? data.pages.flatMap((p) => p.items) : null;

  // Cuộn gần tới cuối danh sách thì tự tải trang tiếp
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && fetchNextPage(), { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allLoaded = products && !hasNextPage;
  const allOn = !!products?.length && products.every(isOn);

  return (
    <Dialog
      title="Chọn sản phẩm"
      subtitle="Mỗi sản phẩm tạo 1 lô với các creative của 1 nhóm ngẫu nhiên"
      onClose={onClose}
      footer={
        <>
          <span className="flex-1 text-xs text-on-surface-variant">
            Đã chọn <b className="text-on-surface">{selected.length}</b> sản phẩm
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="flex h-11 items-center rounded-xl px-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
            >
              Bỏ chọn
            </button>
          )}
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-primary-container px-5 text-sm font-bold text-on-primary hover:bg-primary"
          >
            <Icon name="check" className="text-lg" />
            Xong
          </button>
        </>
      }
    >
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !products ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !products.length ? (
        <EmptyState icon="shopping_bag" message="Chưa có sản phẩm nào.">
          <Link to="/seller/items" className="mt-2 inline-block text-sm font-bold text-primary hover:underline">
            Thêm sản phẩm
          </Link>
        </EmptyState>
      ) : (
        <>
          {allLoaded && products.length <= AUTO_MAX_COUNT && (
            <button
              type="button"
              onClick={() => setSelected(allOn ? [] : products)}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <Icon name={allOn ? 'deselect' : 'select_all'} className="text-base" />
              {allOn ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          )}
          <ul className="space-y-2">
            {products.map((p) => {
              const on = isOn(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    disabled={!on && full}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors disabled:opacity-40 ${
                      on ? 'border-primary-container bg-primary-container/5 ring-1 ring-primary-container' : 'border-outline-variant/40 hover:bg-surface-container-low'
                    }`}
                  >
                    <CoverImage src={p.coverUrl} alt="" className="size-12 shrink-0 rounded-lg bg-surface-container !object-contain" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-on-surface">{p.name || `Sản phẩm #${p.id}`}</span>
                      <span className="block truncate font-mono text-[11px] text-on-surface-variant">
                        {p.images.map((img) => img.fieldKey).join(', ')}
                      </span>
                      <span className="block text-[11px] text-outline">Đã tạo tự động {p.autoBatchCount} lô</span>
                    </span>
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${
                        on ? 'border-primary-container bg-primary-container text-on-primary' : 'border-outline-variant'
                      }`}
                    >
                      {on && <Icon name="check" className="text-sm" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {isFetchingNextPage && <Skeleton className="h-16" />}
          {hasNextPage && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
        </>
      )}
    </Dialog>
  );
}
