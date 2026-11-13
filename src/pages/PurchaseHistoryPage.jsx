import useSeo from '../hooks/useSeo';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import ImageViewer from '../components/common/ImageViewer';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { useConfirm } from '../components/common/ConfirmDialog';
import useIdempotencyKey from '../hooks/useIdempotencyKey';
import {
  thumbOf,
  useDisableOutput,
  useDownloadOutput,
  useEnableOutput,
  useGenerationFilters,
  useGenerationHistory,
  useRetryFromHistory,
} from '../hooks/generationQueries';

// Khớp GenerationStatus của backend
const STATUS = {
  queued: { label: 'Đang chờ', className: 'bg-surface-container text-on-surface-variant' },
  processing: { label: 'Đang tạo', className: 'bg-primary-fixed text-on-primary-fixed-variant' },
  completed: { label: 'Hoàn tất', className: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' },
  failed: { label: 'Thất bại', className: 'bg-error-container text-error' },
  cancelled: { label: 'Đã huỷ', className: 'bg-surface-container text-on-surface-variant' },
};

// Khớp ?tab= của GET /generations: backend chỉ trả đơn có ảnh thuộc tab, kèm đúng các ảnh đó
const TABS = [
  { value: 'active', label: 'Đang hoạt động', icon: 'photo_library', empty: 'Bạn chưa có ảnh nào.' },
  { value: 'failed', label: 'Bị lỗi', icon: 'broken_image', empty: 'Không có ảnh nào bị lỗi.' },
  { value: 'disabled', label: 'Đã tắt', icon: 'visibility_off', empty: 'Bạn chưa tắt ảnh nào.' },
];

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

const isPending = (o) => o.status === 'queued' || o.status === 'processing';

/** Ảnh nhỏ kèm nhãn (ảnh creative / ảnh sản phẩm), bấm để phóng to. Không có ảnh thì không hiện. */
function SourceThumb({ label, name, src, onView }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return null;
  return (
    <button
      type="button"
      onClick={() => onView({ src, alt: `${label}: ${name}` })}
      title={`${label}: ${name}`}
      aria-label={`Xem ảnh ${label.toLowerCase()} ${name}`}
      className="flex min-w-0 flex-1 cursor-zoom-in items-center gap-1.5 rounded-lg bg-surface-container-low p-1 text-left hover:bg-surface-container"
    >
      <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="size-8 shrink-0 rounded-md object-cover" />
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold leading-tight text-outline">{label}</span>
        <span className="block truncate text-[11px] font-bold leading-tight text-on-surface">{name}</span>
      </span>
    </button>
  );
}

/**
 * Một thẻ của lịch sử. kind:
 * - image: ảnh đang dùng (xem, tải về, tắt ảnh)
 * - pending: đơn chưa có ảnh xong (thẻ trạng thái)
 * - failed: ảnh tạo lỗi
 * - disabled: ảnh đã tắt (chỉ xem, làm mờ)
 */
function HistoryCard({ kind, order, output, onView }) {
  const download = useDownloadOutput();
  const disable = useDisableOutput();
  const enable = useEnableOutput();
  const retry = useRetryFromHistory();
  const retryKey = useIdempotencyKey();
  const { confirm } = useConfirm();
  const [broken, setBroken] = useState(false);
  const actionError = download.error || disable.error || enable.error || retry.error;

  const handleRetry = async () => {
    const ok = await confirm('Tạo lại ảnh này theo cùng mẫu và nguyên liệu? Phí tính theo giá hiện tại của mẫu.', {
      title: 'Tạo lại ảnh?',
      confirmLabel: 'Tạo lại',
    });
    if (!ok) return;
    retry.mutate(
      { id: order.id, outputIds: [output.id], idempotencyKey: retryKey.key.current },
      { onSuccess: retryKey.renew, onError: retryKey.renewAfter },
    );
  };
  const status = STATUS[order.status] ?? { label: order.status, className: 'bg-surface-container text-on-surface-variant' };
  const hasImage = (kind === 'image' || kind === 'disabled') && !broken;
  // Sản phẩm của lô tự động chứa ảnh (theo từng ảnh, rồi theo đơn); null khi tạo tay
  const product = output?.product ?? order.product ?? null;

  const handleDisable = async () => {
    const ok = await confirm('Ảnh sẽ chuyển sang tab "Đã tắt", không tải về và không dùng để đăng bài được nữa. Không hoàn tiền.', {
      title: 'Tắt ảnh này?',
      confirmLabel: 'Tắt ảnh',
      danger: true,
    });
    if (ok) disable.mutate({ generationId: order.id, outputId: output.id });
  };

  const title = order.creative ? (
    <Link to={`/creatives/${encodeURIComponent(order.creative.slug)}`} className="hover:text-primary">
      {order.creative.title}
    </Link>
  ) : (
    'Mẫu đã bị gỡ'
  );

  const placeholder = (icon, text, className = '') => (
    <div className={`relative flex aspect-square w-full flex-col items-center justify-center gap-2 bg-surface-container p-3 text-center text-on-surface-variant ${className}`}>
      {icon}
      {text}
    </div>
  );

  let media;
  if (hasImage) {
    media = (
      <button
        type="button"
        onClick={() => onView({ src: output.image_url, alt: `Ảnh ${output.position}` })}
        aria-label={`Xem ảnh ${output.position}`}
        className="group relative block w-full cursor-zoom-in overflow-hidden bg-surface-container"
      >
        <img
          src={thumbOf(output)}
          alt={`Ảnh ${output.position}`}
          loading="lazy"
          onError={() => setBroken(true)}
          className={`block h-auto w-full transition-transform duration-500 group-hover:scale-105 ${kind === 'disabled' ? 'opacity-40 grayscale' : ''}`}
        />
        {kind === 'disabled' && (
          <span className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            <Icon name="visibility_off" className="text-xs" />
            Đã tắt
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-inverse-surface/40 text-on-primary opacity-0 transition-opacity group-hover:opacity-100">
          <Icon name="zoom_in" className="text-2xl" />
        </span>
      </button>
    );
  } else if (kind === 'image' || kind === 'disabled') {
    // Ảnh không tải được (file mất...): giữ thẻ, ở tab đang hoạt động vẫn tắt được
    media = placeholder(<Icon name="broken_image" className="text-3xl" />, <span className="text-[11px] font-bold">Không tải được ảnh</span>);
  } else if (kind === 'failed') {
    media = placeholder(
      <Icon name="broken_image" className="text-3xl text-error" />,
      <span className="text-[11px] font-semibold leading-tight text-error">{output.error_message || 'Tạo ảnh thất bại.'}</span>,
      'bg-error-container/40',
    );
  } else {
    media = placeholder(
      <Icon name={isPending(order) ? 'progress_activity' : 'image_not_supported'} className={`text-3xl ${order.status === 'processing' ? 'animate-spin' : ''}`} />,
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.className}`}>{status.label}</span>,
    );
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md">
      {media}
      <div className="flex flex-1 flex-col p-2.5">
        <h3 className="mb-1 truncate text-xs font-bold text-on-surface">{title}</h3>
        <p className="text-[11px] text-outline">
          #{order.id} · {formatDateTime(order.created_at)}
        </p>
        {(order.creative?.cover_url || product?.cover_url) && (
          <div className="mt-2 flex gap-1.5">
            <SourceThumb label="Creative" name={order.creative?.title} src={order.creative?.cover_url} onView={onView} />
            <SourceThumb label="Sản phẩm" name={product?.name || `Sản phẩm #${product?.id}`} src={product?.cover_url} onView={onView} />
          </div>
        )}
        {actionError && <p className="text-[11px] text-error">{actionError.message}</p>}
        <div className="mt-auto pt-2.5">
          <div className="space-y-2 border-t border-surface-container pt-2.5">
            {kind === 'failed' && <p className="text-xs font-bold text-tertiary">Tạo lỗi</p>}
            {kind === 'image' && (
              <div className="flex gap-1.5">
                {!broken && (
                  <button
                    type="button"
                    onClick={() => download.mutate({ generationId: order.id, outputId: output.id })}
                    disabled={download.isPending}
                    className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary-container text-xs font-bold text-on-primary transition-colors hover:bg-primary disabled:opacity-50"
                  >
                    <Icon name={download.isPending ? 'progress_activity' : 'download'} className={`text-sm ${download.isPending ? 'animate-spin' : ''}`} />
                    Tải về
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={disable.isPending}
                  aria-label="Tắt ảnh"
                  title="Tắt ảnh"
                  className={`flex h-8 items-center justify-center gap-1 rounded-lg border border-outline-variant text-xs font-bold text-on-surface-variant transition-colors hover:border-error hover:text-error disabled:opacity-50 ${broken ? 'flex-1' : 'w-8'}`}
                >
                  <Icon name={disable.isPending ? 'progress_activity' : 'visibility_off'} className={`text-sm ${disable.isPending ? 'animate-spin' : ''}`} />
                  {broken && 'Tắt ảnh'}
                </button>
              </div>
            )}
            {kind === 'disabled' && (
              <button
                type="button"
                onClick={() => enable.mutate({ generationId: order.id, outputId: output.id })}
                disabled={enable.isPending}
                className="flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-outline-variant text-xs font-bold text-primary transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                <Icon name={enable.isPending ? 'progress_activity' : 'visibility'} className={`text-sm ${enable.isPending ? 'animate-spin' : ''}`} />
                Bật lại
              </button>
            )}
            {kind === 'failed' && order.creative && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={retry.isPending}
                className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-primary-container text-xs font-bold text-on-primary transition-colors hover:bg-primary disabled:opacity-50"
              >
                <Icon name={retry.isPending ? 'progress_activity' : 'refresh'} className={`text-sm ${retry.isPending ? 'animate-spin' : ''}`} />
                Tạo lại
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// Trải phẳng mỗi ảnh một thẻ. Tab đang hoạt động: đơn chưa có ảnh xong giữ một thẻ trạng thái.
const cardsOf = (tab, orders) =>
  orders.flatMap((order) => {
    const outputs = order.outputs ?? [];
    if (tab === 'failed') return outputs.map((output) => ({ key: `${order.id}-${output.id}`, kind: 'failed', order, output }));
    if (tab === 'disabled') return outputs.map((output) => ({ key: `${order.id}-${output.id}`, kind: 'disabled', order, output }));
    const images = outputs.filter((o) => o.status === 'completed' && o.image_url);
    return images.length
      ? images.map((output) => ({ key: `${order.id}-${output.id}`, kind: 'image', order, output }))
      : [{ key: `${order.id}`, kind: 'pending', order }];
  });

/** Ảnh nhỏ trong ô lọc; không có ảnh / ảnh lỗi thì hiện biểu tượng thay thế. */
function FilterThumb({ src, icon, size = 'size-5' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (!src || broken) {
    return (
      <span className={`${size} flex shrink-0 items-center justify-center rounded-md bg-surface-container text-outline`}>
        <Icon name={icon} className="text-base" />
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={`${size} shrink-0 rounded-md object-cover`} />;
}

/**
 * Ô chọn có ảnh (thay <select> vì <option> không hiện được ảnh).
 * options: [{ value, label, image }]; value '' = tất cả. Hỗ trợ phím mũi tên / Enter / Esc, bấm ra ngoài thì đóng.
 */
function FilterPicker({ label, allLabel, icon, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const items = [{ value: '', label: allLabel, image: null }, ...options];
  const selected = items.find((o) => String(o.value) === String(value ?? ''));

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const toggle = () => {
    if (!open) setActive(Math.max(0, items.indexOf(selected)));
    setOpen(!open);
  };
  const pick = (item) => {
    onChange(item.value === '' ? '' : String(item.value));
    setOpen(false);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return toggle();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault();
      pick(items[active]);
    }
    return undefined;
  };

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={toggle}
        onKeyDown={onKeyDown}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low pl-1.5 pr-2 text-left text-xs font-semibold text-on-surface focus:border-primary-container focus:outline-none focus:ring-2 focus:ring-primary-container/20 sm:text-sm"
      >
        {selected?.value ? <FilterThumb src={selected.image} icon={icon} /> : <Icon name={icon} className="ml-1 text-lg text-outline" />}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? allLabel}</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="shrink-0 text-lg text-outline" />
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 min-w-[14rem] overflow-y-auto rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-1 shadow-lg"
        >
          {items.map((item, i) => {
            const isSelected = item === selected;
            return (
              <li
                key={item.value || 'all'}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(item)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs sm:text-sm ${
                  i === active ? 'bg-surface-container' : ''
                } ${isSelected ? 'font-bold text-primary' : 'font-semibold text-on-surface'}`}
              >
                {item.value === '' ? (
                  <span className="flex size-20 shrink-0 items-center justify-center rounded-md bg-surface-container-low text-outline">
                    <Icon name="apps" className="text-lg" />
                  </span>
                ) : (
                  <FilterThumb src={item.image} icon={icon} size="size-20" />
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {isSelected && <Icon name="check" className="shrink-0 text-lg" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Lọc theo creative / sản phẩm (kèm ảnh): creative đang bán của chính shop, mọi sản phẩm đang hoạt động của mình. Không có sản phẩm thì ẩn ô sản phẩm. */
function HistoryFilters({ creativeId, productId, onChange }) {
  const { data } = useGenerationFilters();
  const creatives = data?.creatives ?? [];
  const products = data?.products ?? [];
  const filtered = creativeId || productId;
  if (!creatives.length && !products.length && !filtered) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      <FilterPicker
        label="Lọc theo creative"
        allLabel="Tất cả creative"
        icon="palette"
        value={creativeId}
        options={creatives.map((c) => ({ value: c.id, label: c.title, image: c.cover_url }))}
        onChange={(v) => onChange('creative', v)}
      />
      {(products.length > 0 || productId) && (
        <FilterPicker
          label="Lọc theo sản phẩm"
          allLabel="Tất cả sản phẩm"
          icon="inventory_2"
          value={productId}
          options={products.map((p) => ({ value: p.id, label: p.name || `Sản phẩm #${p.id}`, image: p.cover_url }))}
          onChange={(v) => onChange('product', v)}
        />
      )}
      {filtered && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Bỏ lọc"
          title="Bỏ lọc"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        >
          <Icon name="filter_alt_off" className="text-lg" />
        </button>
      )}
    </div>
  );
}

/** /account/history: các lần tạo ảnh đã mua, mới nhất trước, chia tab đang hoạt động / bị lỗi / đã tắt, lọc theo creative / sản phẩm. */
export default function PurchaseHistoryPage() {
  useSeo({ title: 'Lịch sử tạo ảnh', noindex: true });
  const navigate = useNavigate();
  const location = useLocation();
  // Tab và bộ lọc giữ trên URL để tải lại / quay lại vẫn đúng
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.find((t) => t.value === searchParams.get('tab')) ?? TABS[0];
  const creativeId = searchParams.get('creative') || undefined;
  const productId = searchParams.get('product') || undefined;
  const filtered = !!(creativeId || productId);
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useGenerationHistory(10, tab.value, {
    creativeId,
    productId,
  });
  // key = null: bỏ mọi bộ lọc; value rỗng: bỏ bộ lọc đó
  const setParam = (key, value) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === null) ['creative', 'product'].forEach((k) => next.delete(k));
        else if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const orders = data?.pages.flatMap((p) => p.items) ?? [];
  const [viewing, setViewing] = useState(null);
  const cards = cardsOf(tab.value, orders);

  // Cuộn tới cuối danh sách thì tải thêm
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && fetchNextPage(), { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      <header className="sticky top-[60px] z-30 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            // Mở thẳng link thì về trang tài khoản thay vì thoát khỏi app
            onClick={() => (location.key === 'default' ? navigate('/tools', { replace: true }) : navigate(-1))}
            aria-label="Quay lại"
            className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
          >
            <Icon name="arrow_back" />
          </button>
          <h1 className="text-base font-bold text-on-surface lg:text-lg">Lịch sử tạo ảnh</h1>
        </div>
        <div role="tablist" aria-label="Loại ảnh" className="mt-2 flex gap-1 rounded-xl bg-surface-container-low p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab.value === t.value}
              onClick={() => setParam('tab', t.value === TABS[0].value ? '' : t.value)}
              className={`flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1 text-xs font-bold transition-colors sm:text-sm ${
                tab.value === t.value ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon name={t.icon} className="hidden text-lg sm:inline" />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
        <HistoryFilters creativeId={creativeId} productId={productId} onChange={setParam} />
      </header>

      <ImageViewer src={viewing?.src} alt={viewing?.alt} onClose={() => setViewing(null)} />
      <div className="p-4">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-[3/4] !rounded-2xl" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <EmptyState icon={filtered ? 'filter_alt_off' : tab.icon} message={filtered ? 'Không có ảnh nào khớp bộ lọc.' : tab.empty}>
            {filtered ? (
              <button type="button" onClick={() => setParam(null)} className="text-sm font-bold text-primary">
                Bỏ lọc
              </button>
            ) : tab.value === 'active' && (
              <Link to="/explore" className="text-sm font-bold text-primary">
                Khám phá mẫu
              </Link>
            )}
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
              {cards.map((c) => (
                <HistoryCard key={c.key} kind={c.kind} order={c.order} output={c.output} onView={setViewing} />
              ))}
            </div>
            {isFetchingNextPage && (
              <div className="mt-3 grid grid-cols-2 gap-3 lg:mt-4 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5">
                {Array.from({ length: 2 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] !rounded-2xl" />
                ))}
              </div>
            )}
            {hasNextPage && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
          </>
        )}
      </div>
    </>
  );
}
