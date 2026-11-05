import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import ProductFormDialog from '../components/product/ProductFormDialog';
import { useCreatorProfile } from '../hooks/creatorQueries';
import { AUTO_KEYS, deleteProduct, listProducts, setProductActive } from '../api/autoBatch';
import { Switch } from '../components/template/inputs';
import { useConfirm } from '../components/common/ConfirmDialog';

const PAGE_SIZE = 20;

function ProductCard({ product, onEdit }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const { confirm, alert } = useConfirm();
  const title = product.name || `Sản phẩm #${product.id}`;

  const remove = async () => {
    if (!(await confirm(`Xoá "${title}"? Lô đã tạo từ sản phẩm này vẫn giữ nguyên.`, { confirmLabel: 'Xoá', danger: true }))) return;
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      await queryClient.invalidateQueries({ queryKey: AUTO_KEYS.products });
    } catch (err) {
      alert(err?.message || 'Không xoá được sản phẩm, vui lòng thử lại.');
      setDeleting(false);
    }
  };

  // Cập nhật ngay trong cache, lỗi thì trả lại như cũ
  const patchCache = (isActive) =>
    queryClient.setQueryData(AUTO_KEYS.products, (old) =>
      old && {
        ...old,
        pages: old.pages.map((pg) => ({ ...pg, items: pg.items.map((it) => (it.id === product.id ? { ...it, isActive } : it)) })),
      },
    );

  const toggleActive = async (isActive) => {
    setToggling(true);
    patchCache(isActive);
    try {
      await setProductActive(product.id, isActive);
    } catch (err) {
      patchCache(!isActive);
      alert(err?.message || 'Không đổi được trạng thái sản phẩm, vui lòng thử lại.');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      className={`relative flex gap-3 rounded-2xl border border-outline-variant/40 p-3 lg:flex-col ${
        product.isActive ? '' : 'bg-surface-container-low'
      }`}
    >
      {/* Ảnh giữ nguyên tỷ lệ gốc, không cắt: desktop cao theo ảnh, mobile vừa khung 80px */}
      <CoverImage
        src={product.coverUrl}
        alt=""
        className={`size-20 shrink-0 rounded-xl bg-surface-container !object-contain lg:h-auto lg:min-h-40 lg:w-full ${
          product.isActive ? '' : 'opacity-50 grayscale'
        }`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-bold text-on-surface">{title}</p>
        {product.hashtags.length > 0 && (
          <p className="truncate text-xs font-semibold text-primary">{product.hashtags.map((h) => `#${h}`).join(' ')}</p>
        )}
        <div className="flex flex-wrap gap-1">
          {product.images.map((img) => (
            <span key={img.id} className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-[11px] text-on-surface-variant">
              {img.fieldKey}
            </span>
          ))}
        </div>
        <p className="text-xs text-on-surface-variant">
          {product.images.length} ảnh · Đã tạo tự động {product.autoBatchCount} lô
        </p>
        <div className="!mt-2 rounded-lg bg-surface-container-low px-2 py-1.5">
          <Switch
            label={product.isActive ? 'Đang hoạt động' : 'Đã tắt'}
            hint={product.isActive ? 'Được tạo lô tự động' : 'Không được tạo lô tự động'}
            checked={product.isActive}
            disabled={toggling}
            onChange={toggleActive}
          />
        </div>
        {/* Tạo lô tay cho sản phẩm này: chọn creative + số ảnh, ảnh sản phẩm tự điền vào trường ảnh trùng key */}
        <Link
          to="/batches/new"
          state={{ product }}
          className="!mt-2 flex h-8 w-fit items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary"
        >
          <Icon name="auto_awesome" className="text-base" />
          Tạo ảnh
        </Link>
      </div>
      <div className="flex shrink-0 flex-col gap-1 lg:absolute lg:right-5 lg:top-5 lg:flex-row lg:rounded-lg lg:bg-surface-container-lowest/90 lg:shadow">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Sửa ${title}`}
          className="flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name="edit" className="text-lg" />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          aria-label={`Xoá ${title}`}
          className="flex size-8 items-center justify-center rounded-lg text-error hover:bg-error-container/40 disabled:opacity-50"
        >
          <Icon name={deleting ? 'progress_activity' : 'delete'} className={`text-lg ${deleting ? 'animate-spin' : ''}`} />
        </button>
        </div>
    </div>
  );
}

/**
 * /seller/items: sản phẩm cho tạo lô tự động (note/auto-tao-lo.txt). Cần hồ sơ người bán.
 */
export default function ProductsPage() {
  useSeo({ title: 'Quản lý sản phẩm', noindex: true });
  const queryClient = useQueryClient();
  const { hasProfile, meLoaded } = useCreatorProfile();
  // null: đóng, {}: thêm mới, { product }: sửa
  const [editing, setEditing] = useState(null);

  const { data, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: AUTO_KEYS.products,
    queryFn: ({ pageParam }) => listProducts({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
    enabled: hasProfile,
  });
  const products = data ? data.pages.flatMap((p) => p.items) : null;

  // Cuộn gần tới cuối danh sách thì tự tải trang tiếp, hết trang thì thôi
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && fetchNextPage(), {
      rootMargin: '300px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const addButton = (
    <button
      type="button"
      onClick={() => setEditing({})}
      className="flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary"
    >
      <Icon name="add" className="text-base" />
      Thêm sản phẩm
    </button>
  );

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <Link to="/tools" aria-label="Quay lại" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
          <Icon name="arrow_back" />
        </Link>
        <h1 className="flex-1 text-base font-bold text-on-surface">Quản lý sản phẩm</h1>
        {hasProfile && <span className="mr-2">{addButton}</span>}
      </header>

      <section className="space-y-3 p-4 lg:py-6">
        {!meLoaded ? (
          <Skeleton className="h-24 w-full" />
        ) : !hasProfile ? (
          <EmptyState icon="storefront" message="Bạn cần tạo cửa hàng trước khi quản lý sản phẩm.">
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          </EmptyState>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !products ? (
          <div className="grid gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 lg:h-80" />
            ))}
          </div>
        ) : (
          <>
            <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
              <Icon name="info" className="text-base" />
              <span>
                Bấm "Tạo tự động" ở{' '}
                <Link to="/batches" className="font-bold text-primary hover:underline">
                  Lô ảnh
                </Link>{' '}
                để tạo lô (chỉ sản phẩm đang hoạt động): mỗi lô là 1 sản phẩm với các creative của 1{' '}
                <Link to="/seller/creative-groups" className="font-bold text-primary hover:underline">
                  nhóm creative
                </Link>
                {' '}có creative trùng hashtag với sản phẩm. Sản phẩm ít lô nhất được tạo trước.
              </span>
            </p>
            {!products.length ? (
              <EmptyState icon="shopping_bag" message="Chưa có sản phẩm nào.">
                {hasProfile && <div className="mt-2">{addButton}</div>}
              </EmptyState>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-4">
                {products.map((p) => (
                  <li key={p.id}>
                    <ProductCard product={p} onEdit={() => setEditing({ product: p })} />
                  </li>
                ))}
              </ul>
            )}
            {isFetchingNextPage && (
              <div className="grid gap-3 lg:grid-cols-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 lg:h-80" />
                ))}
              </div>
            )}
            {hasNextPage && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
          </>
        )}
      </section>

      {editing && (
        <ProductFormDialog
          product={editing.product}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: AUTO_KEYS.products });
          }}
        />
      )}
    </>
  );
}
