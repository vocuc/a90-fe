import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import ActionBar from '../components/common/ActionBar';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import LogoCard, { batchLogoUrl } from '../components/batch/LogoCard';
import ProductPickerDialog from '../components/batch/ProductPickerDialog';
import ImageWorkerSelect, { useImageWorker } from '../components/common/ImageWorkerSelect';
import { useMe } from '../hooks/queries';
import useIdempotencyKey from '../hooks/useIdempotencyKey';
import { AUTO_KEYS, AUTO_MAX_COUNT, AUTO_RESULT_KEY, createAuto, previewAuto } from '../api/autoBatch';
import { formatVnd } from '../utils/format';

const PREVIEW_DELAY = 400;

/**
 * /batches/auto: "Tạo tự động" (note/auto-tao-lo.txt): nhập số lô + chèn logo, xem trước các lô sẽ tạo
 * (sản phẩm ít ảnh nhất trước x nhóm ít dùng nhất với sản phẩm, bằng nhau thì ngẫu nhiên; creative, tiền), "Chọn sản phẩm thủ công" để chỉ ghép lô từ các sản phẩm đã chọn
 * (gửi product_ids, số lô = số sản phẩm đã chọn), rồi tạo đúng các lô đang xem (gửi seed).
 * Hệ thống tạo lần lượt, hết tiền thì dừng. Tạo xong về danh sách lô, kết quả hiện ở đầu danh sách (AUTO_RESULT_KEY).
 */
export default function BatchAutoPage() {
  useSeo({ title: 'Tạo lô tự động', noindex: true });
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const logoUrl = batchLogoUrl(me);
  const idem = useIdempotencyKey();
  const [input, setInput] = useState('1');
  const [count, setCount] = useState(1);
  const [insertLogo, setInsertLogo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logoError, setLogoError] = useState(null);
  // Worker tạo ảnh cho mọi lô, bắt buộc chọn (note/chon-worker-tao-anh.txt)
  const worker = useImageWorker();
  const [workerError, setWorkerError] = useState(null);
  // Sản phẩm chọn thủ công; rỗng = hệ thống chọn ngẫu nhiên trong mọi sản phẩm
  const [products, setProducts] = useState([]);
  const [picking, setPicking] = useState(false);
  const productIds = products.map((p) => p.id);

  // Vào từ danh sách lô thì quay lại đúng trang đó (không để trang này lại trong lịch sử)
  const fromList = !!location.state?.fromList && window.history.state?.idx > 0;
  const goList = () => (fromList ? navigate(-1) : navigate('/batches', { replace: true }));

  // Gõ xong mới gọi xem trước
  useEffect(() => {
    const n = Math.min(AUTO_MAX_COUNT, Math.max(1, Math.floor(Number(input)) || 1));
    const t = setTimeout(() => setCount(n), PREVIEW_DELAY);
    return () => clearTimeout(t);
  }, [input]);

  const preview = useQuery({
    queryKey: ['auto-preview', count, productIds.join(',')],
    queryFn: () => previewAuto(count, productIds),
    placeholderData: (prev) => prev,
    gcTime: 0,
  });
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
    setWorkerError(worker.missingError);
    if (worker.missingError) {
      document.getElementById('auto-worker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setLoading(true);
    try {
      const result = await createAuto(
        {
          count: Number(input),
          insertLogo: !!logoUrl && insertLogo,
          seed: planReady ? plan.seed : undefined,
          productIds,
          workerId: worker.workerId,
        },
        idem.key.current,
      );
      idem.renew();
      queryClient.setQueryData(AUTO_RESULT_KEY, {
        created: result.batches.length,
        requested: result.requested,
        stopped: result.stopped,
        required: result.required,
      });
      // Đã trừ tiền -> tải lại số dư; lượt tự động của sản phẩm đổi
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: AUTO_KEYS.products });
      goList();
    } catch (err) {
      idem.renewAfter(err);
      if (err?.errors?.insert_logo) setLogoError(err.errors.insert_logo);
      else if (err?.errors?.worker_id) setWorkerError([].concat(err.errors.worker_id)[0]);
      else setError(err);
      setLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={goList}
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-on-surface">Tạo lô tự động</h1>
          <p className="truncate text-xs text-on-surface-variant">Mỗi lô = 1 sản phẩm (ít ảnh nhất trước) x các creative Đang bán của 1 nhóm (ít dùng nhất với sản phẩm đó)</p>
        </div>
      </header>

      <section className="space-y-4 p-4 lg:mx-auto lg:w-full lg:max-w-[800px] lg:py-6">
        <div className="rounded-2xl border border-outline-variant/40 p-4">
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
          logoUrl={logoUrl}
          checked={insertLogo}
          onChange={(v) => {
            setInsertLogo(v);
            setLogoError(null);
          }}
          error={logoError}
        />

        <div id="auto-worker" className="rounded-2xl border border-outline-variant/40 p-4">
          <ImageWorkerSelect worker={worker} error={workerError} onChange={() => setWorkerError(null)} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-1">
            <h2 className="flex flex-1 items-center gap-1 text-sm font-bold text-on-surface">
              Xem trước
              {preview.isFetching && <Icon name="progress_activity" className="animate-spin text-sm text-outline" />}
            </h2>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-surface-container"
            >
              <Icon name="checklist" className="text-base" />
              Chọn sản phẩm thủ công
            </button>
          </div>
          {products.length > 0 && (
            <div className="mb-2 flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs">
              <Icon name="shopping_bag" className="text-base text-primary" />
              <p className="min-w-0 flex-1 text-on-surface-variant">
                Chỉ tạo từ <b className="text-on-surface">{products.length}</b> sản phẩm đã chọn:{' '}
                {products.map((p) => p.name || `#${p.id}`).join(', ')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setProducts([]);
                  setInput('1');
                }}
                className="shrink-0 font-bold text-primary hover:underline"
              >
                Dùng ngẫu nhiên
              </button>
            </div>
          )}
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
              <ol className="grid gap-1.5 lg:grid-cols-2">
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
      </section>

      {picking && (
        <ProductPickerDialog
          picked={products}
          onClose={() => setPicking(false)}
          onConfirm={(list) => {
            setPicking(false);
            setProducts(list);
            // Mỗi sản phẩm 1 lô
            setInput(String(list.length || 1));
          }}
        />
      )}

      <ActionBar
        summary={
          planReady && !empty && !invalid ? (
            <>
              <b className="text-on-surface">{plan.batches.length}</b> lô ·{' '}
              <b className="text-on-surface">{formatVnd(plan.totalCost)}</b>
            </>
          ) : empty ? (
            'Chưa ghép được lô nào'
          ) : (
            'Đang xem trước...'
          )
        }
        error={
          error &&
          (error.code === 'INSUFFICIENT_CREDIT' ? (
            <>
              Số dư không đủ cho lô đầu tiên (cần {formatVnd(error.context?.required)}).{' '}
              <Link to="/account/topup" className="font-bold text-primary hover:underline">
                Nạp ví
              </Link>
            </>
          ) : (
            error.message || 'Không tạo được lô, vui lòng thử lại.'
          ))
        }
        disabled={invalid || !planReady || empty}
        loading={loading}
        onSubmit={submit}
        label={`Tạo ${invalid ? '' : `${planReady ? plan.batches.length : Number(input)} lô`}`}
        icon="auto_awesome"
      />
    </>
  );
}
