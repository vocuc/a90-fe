import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';
import CoverImage from '../common/CoverImage';
import { Skeleton } from '../common/Feedback';
import { listAllProducts } from '../../api/autoBatch';
import { startTagJob } from '../../api/productTags';

/**
 * Gắn tag bằng AI: chọn nhiều sản phẩm (chỉ sản phẩm của mình có ảnh trường anh_san_pham) -> Đồng ý -> việc cho worker gắn
 * tag (skill Claude /gan-tag-san-pham). Trường tag bạn đã sửa tay được giữ nguyên.
 */
export default function AiTagDialog({ max = 100, fieldKey = 'anh_san_pham', onStarted, onClose }) {
  const { data: products, error: loadError } = useQuery({ queryKey: ['creator', 'products', 'all'], queryFn: listAllProducts });
  const [selected, setSelected] = useState(() => new Set());
  const own = useMemo(() => (products ?? []).filter((p) => p.isOwner), [products]);
  const taggable = own.filter((p) => p.taggable);
  const mutation = useMutation({ mutationFn: () => startTagJob([...selected]), onSuccess: onStarted });

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < max) next.add(id);
      return next;
    });
  const pick = (list) => setSelected(new Set(list.slice(0, max).map((p) => p.id)));
  const error = mutation.error && (mutation.error.errors?.product_ids || mutation.error.message);

  return (
    <Dialog
      title="Gắn tag bằng AI"
      subtitle={`Đã chọn ${selected.size}/${Math.min(max, taggable.length || max)} sản phẩm`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container">
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!selected.size || mutation.isPending}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            <Icon name={mutation.isPending ? 'progress_activity' : 'auto_awesome'} className={`text-lg ${mutation.isPending ? 'animate-spin' : ''}`} />
            Đồng ý ({selected.size})
          </button>
        </>
      }
    >
      <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
        <Icon name="info" className="shrink-0 text-base" />
        <span>
          AI xem ảnh trường <b className="font-mono">{fieldKey}</b> của sản phẩm để gắn nhãn ngắn + kiểu, gót, màu, phong cách,
          dịp. Trường bạn đã sửa tay được giữ nguyên. Tối đa {max} sản phẩm mỗi lần, thường mất vài phút.
        </span>
      </p>
      {loadError ? (
        <p className="text-xs text-error">{loadError.message}</p>
      ) : !products ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => pick(taggable.filter((p) => !p.tags))} className="h-8 rounded-full border border-outline-variant/60 px-3 text-xs font-semibold hover:border-primary-container hover:text-primary">
              Chưa gắn tag ({taggable.filter((p) => !p.tags).length})
            </button>
            <button type="button" onClick={() => pick(taggable)} className="h-8 rounded-full border border-outline-variant/60 px-3 text-xs font-semibold hover:border-primary-container hover:text-primary">
              Tất cả ({taggable.length})
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="h-8 rounded-full px-3 text-xs font-semibold text-on-surface-variant hover:bg-surface-container">
              Bỏ chọn
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {own.map((p) => {
              const on = selected.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => p.taggable && toggle(p.id)}
                    disabled={!p.taggable}
                    aria-pressed={on}
                    className={`relative flex w-full flex-col gap-1 rounded-xl border p-1.5 text-left disabled:opacity-50 ${
                      on ? 'border-primary-container bg-primary-fixed/20' : 'border-outline-variant/40 hover:bg-surface-container-low'
                    }`}
                  >
                    <CoverImage src={p.coverUrl} alt="" className="aspect-square w-full rounded-lg bg-surface-container !object-contain" />
                    <span className={`absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full border-2 ${on ? 'border-primary-container bg-primary-container text-on-primary' : 'border-white bg-black/20'}`}>
                      {on && <Icon name="check" className="text-sm" />}
                    </span>
                    <span className="truncate text-xs font-semibold text-on-surface">{p.name || `Sản phẩm #${p.id}`}</span>
                    <span className="truncate text-[11px] text-on-surface-variant">
                      {!p.taggable ? `Thiếu ảnh ${fieldKey}` : p.aiLabel ? `Tag: ${p.aiLabel}` : 'Chưa gắn tag'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-error-container/60 px-3 py-2 text-xs text-on-error-container">
          {error}
        </p>
      )}
    </Dialog>
  );
}
