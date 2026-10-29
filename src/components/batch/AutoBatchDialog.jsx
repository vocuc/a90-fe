import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Dialog from '../common/Dialog';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { ErrorState, Skeleton } from '../common/Feedback';
import LogoCard, { batchLogoUrl } from './LogoCard';
import { useMe } from '../../hooks/queries';
import useIdempotencyKey from '../../hooks/useIdempotencyKey';
import { AUTO_MAX_COUNT, createAuto, previewAuto } from '../../api/autoBatch';
import { formatVnd } from '../../utils/format';

const PREVIEW_DELAY = 400;

/**
 * Popup "Tạo tự động" ở trang danh sách lô (note/auto-tao-lo.txt): nhập số lô + chèn logo, xem trước các lô sẽ tạo
 * (sản phẩm x nhóm chọn ngẫu nhiên, creative, tiền), "Đổi ngẫu nhiên" để chọn lại, rồi tạo đúng các lô đang xem (gửi seed).
 * Hệ thống tạo lần lượt, hết tiền thì dừng. onDone(result) khi đã tạo.
 */
export default function AutoBatchDialog({ onDone, onClose }) {
  const { data: me } = useMe();
  const logoUrl = batchLogoUrl(me);
  const idem = useIdempotencyKey();
  const [input, setInput] = useState('1');
  const [count, setCount] = useState(1);
  const [insertLogo, setInsertLogo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logoError, setLogoError] = useState(null);

  // Gõ xong mới gọi xem trước
  useEffect(() => {
    const n = Math.min(AUTO_MAX_COUNT, Math.max(1, Math.floor(Number(input)) || 1));
    const t = setTimeout(() => setCount(n), PREVIEW_DELAY);
    return () => clearTimeout(t);
  }, [input]);

  const preview = useQuery({ queryKey: ['auto-preview', count], queryFn: () => previewAuto(count), placeholderData: (prev) => prev, gcTime: 0 });
  const plan = preview.data;
  const empty = plan && !plan.batches.length;
  // Xem trước đúng số lô đang nhập và không đang đổi ngẫu nhiên thì tạo đúng các lô đó
  const planReady = !!plan && count === Number(input) && !preview.isFetching;

  // Số lô đầu đủ tiền (tạo lần lượt, hết tiền thì dừng)
  let affordable = 0;
  if (plan) {
    let left = plan.balance;
    for (const b of plan.batches) {
      if (b.cost > left) break;
      left -= b.cost;
      affordable += 1;
    }
  }

  const invalid = !(Number(input) >= 1 && Number(input) <= AUTO_MAX_COUNT && Number.isInteger(Number(input)));

  const submit = async () => {
    setError(null);
    setLogoError(null);
    setLoading(true);
    try {
      const result = await createAuto(
        { count: Number(input), insertLogo: !!logoUrl && insertLogo, seed: planReady ? plan.seed : undefined },
        idem.key.current,
      );
      idem.renew();
      onDone(result);
    } catch (err) {
      idem.renewAfter(err);
      if (err?.errors?.insert_logo) setLogoError(err.errors.insert_logo);
      else setError(err);
      setLoading(false);
    }
  };

  return (
    <Dialog
      title="Tạo lô tự động"
      subtitle="Mỗi lô = 1 sản phẩm ngẫu nhiên x các creative Đang bán của 1 nhóm ngẫu nhiên"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading || invalid || !planReady || empty}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            <Icon name={loading ? 'progress_activity' : 'auto_awesome'} className={`text-lg ${loading ? 'animate-spin' : ''}`} />
            Tạo {invalid ? '' : `${planReady ? plan.batches.length : Number(input)} lô`}
            {planReady && !empty && !invalid ? ` · ${formatVnd(plan.totalCost)}` : ''}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="auto-count" className="mb-1.5 block text-xs font-semibold text-on-surface">
          Số lô muốn tạo
        </label>
        <input
          id="auto-count"
          type="number"
          inputMode="numeric"
          min={1}
          max={AUTO_MAX_COUNT}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`h-11 w-32 rounded-xl border bg-surface-container-low px-3.5 text-sm font-bold text-on-surface focus:outline-none ${
            invalid ? 'border-error' : 'border-outline-variant/40 focus:border-primary-container'
          }`}
        />
        {invalid && <p className="mt-1 text-xs text-error">Nhập từ 1 đến {AUTO_MAX_COUNT} lô.</p>}
      </div>

      <LogoCard
        hasShop={!!me?.creatorProfile}
        isStaff={!!me?.staffOf}
        logoUrl={logoUrl}
        checked={insertLogo}
        onChange={(v) => {
          setInsertLogo(v);
          setLogoError(null);
        }}
        error={logoError}
      />

      <div>
        <div className="mb-1.5 flex items-center gap-1">
          <p className="flex flex-1 items-center gap-1 text-xs font-semibold text-on-surface">
            Xem trước
            {preview.isFetching && <Icon name="progress_activity" className="animate-spin text-sm text-outline" />}
          </p>
          {plan && !empty && (
            <button
              type="button"
              onClick={() => preview.refetch()}
              disabled={preview.isFetching}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-surface-container disabled:opacity-50"
            >
              <Icon name="shuffle" className="text-base" />
              Đổi ngẫu nhiên
            </button>
          )}
        </div>
        {preview.error ? (
          <ErrorState error={preview.error} onRetry={preview.refetch} />
        ) : !plan ? (
          <div className="space-y-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : empty ? (
          <div className="space-y-2 rounded-xl bg-amber-50 px-3 py-3 text-xs text-amber-800">
            <p className="font-semibold">Cần có creative Đang bán của bạn để tạo lô tự động.</p>
            <p>
              Thêm{' '}
              <Link to="/seller/items" className="font-bold text-primary hover:underline">
                sản phẩm
              </Link>{' '}
              (ảnh + key trường nguyên liệu) và{' '}
              <Link to="/seller/creative-groups" className="font-bold text-primary hover:underline">
                nhóm creative
              </Link>{' '}
              có creative Đang bán chứa trường ảnh trùng key với ảnh sản phẩm.
            </p>
          </div>
        ) : (
          <>
            <ol className="space-y-1.5">
              {plan.batches.map((b, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-3 rounded-xl border border-outline-variant/40 p-2 ${i >= affordable ? 'opacity-50' : ''}`}
                >
                  <span className="w-6 shrink-0 text-center text-xs font-bold text-outline">{i + 1}</span>
                  <CoverImage src={b.product.coverUrl} alt="" className="size-10 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-on-surface">
                      {b.product.name || `Sản phẩm #${b.product.id}`}
                    </span>
                    <span className="block truncate text-[11px] text-on-surface-variant" title={b.creatives.map((c) => c.title).join(', ')}>
                      {b.group.name} · {b.creatives.length} creative
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-primary">{formatVnd(b.cost)}</span>
                </li>
              ))}
            </ol>
            <div className="mt-2 space-y-0.5 rounded-xl bg-surface-container-low px-3 py-2 text-xs">
              <p className="flex justify-between">
                <span className="text-on-surface-variant">Tổng tiền dự kiến</span>
                <span className="font-bold text-on-surface">{formatVnd(plan.totalCost)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-on-surface-variant">Số dư</span>
                <span className="font-bold text-on-surface">{formatVnd(plan.balance)}</span>
              </p>
            </div>
            {planReady && plan.batches.length < count && (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Icon name="info" className="text-base" />
                <span>
                  Mỗi sản phẩm / nhóm chỉ dùng 1 lần mỗi lượt tạo nên chỉ ghép được {plan.batches.length} lô. Thêm sản phẩm
                  hoặc nhóm creative để tạo nhiều lô hơn.
                </span>
              </p>
            )}
            {affordable < plan.batches.length && (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Icon name="info" className="text-base" />
                <span>
                  Số dư chỉ đủ {affordable} lô đầu, hệ thống tạo tới khi hết tiền thì dừng.{' '}
                  <Link to="/account/topup" className="font-bold text-primary hover:underline">
                    Nạp ví
                  </Link>
                </span>
              </p>
            )}
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-error-container/60 px-3 py-2 text-xs text-on-error-container">
          {error.code === 'INSUFFICIENT_CREDIT'
            ? `Số dư không đủ cho lô đầu tiên (cần ${formatVnd(error.context?.required)}).`
            : error.message || 'Không tạo được lô, vui lòng thử lại.'}
          {error.code === 'INSUFFICIENT_CREDIT' && (
            <Link to="/account/topup" className="ml-1 font-bold text-primary hover:underline">
              Nạp ví
            </Link>
          )}
        </p>
      )}
    </Dialog>
  );
}
