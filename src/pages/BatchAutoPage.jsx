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
import { Switch } from '../components/template/inputs';
import { SelectField } from '../components/common/Form';
import { useMe } from '../hooks/queries';
import useIdempotencyKey from '../hooks/useIdempotencyKey';
import {
  AUTO_KEYS,
  AUTO_MAX_COUNT,
  AUTO_RESULT_KEY,
  OUTFIT_IMAGES,
  createAuto,
  createOutfit,
  previewAuto,
  previewOutfit,
} from '../api/autoBatch';
import { CHANNEL_KEYS, listChannels } from '../api/channels';

// creative: lô = sản phẩm x nhóm creative | outfit: lô phối đồ (1 đôi giày - nhiều cách phối, worker phối đồ)
const MODES = [
  { value: 'creative', label: 'Creative', icon: 'auto_awesome' },
  { value: 'outfit', label: 'Phối đồ', icon: 'checkroom' },
];
const MODE_KEY = 'a51_auto_batch_mode';
const readMode = () => {
  try {
    return localStorage.getItem(MODE_KEY) === 'outfit' ? 'outfit' : 'creative';
  } catch {
    return 'creative';
  }
};

const PREVIEW_DELAY = 400;

// Công tắc "Dùng ảnh sản phẩm" của lô phối đồ (mặc định tắt), nhớ lựa chọn trên máy
const USE_PRODUCT_KEY = 'a51_outfit_use_product';
const readUseProduct = () => {
  try {
    return localStorage.getItem(USE_PRODUCT_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * /batches/auto: "Tạo tự động" (note/auto-tao-lo.txt): nhập số lô + chèn logo, xem trước các lô sẽ tạo
 * (sản phẩm ít ảnh nhất trước x nhóm ít dùng nhất với sản phẩm, bằng nhau thì ngẫu nhiên; creative, tiền), "Chọn sản phẩm thủ công" để chỉ ghép lô từ các sản phẩm đã chọn
 * (gửi product_ids, số lô = số sản phẩm đã chọn), rồi tạo đúng các lô đang xem (gửi seed).
 * Hệ thống tạo lần lượt, hết tiền thì dừng. Tạo xong về danh sách lô, kết quả hiện ở đầu danh sách (AUTO_RESULT_KEY).
 * Chế độ "Phối đồ": mỗi lô = 1 sản phẩm (ít lô phối đồ nhất trước) x N ảnh (ảnh 1 bìa + N-1 ảnh outfit), giao worker
 * phối đồ (bắt buộc), không dùng nhóm creative. Công tắc "Dùng ảnh sản phẩm" (mặc định tắt): tắt thì lô không gắn sản phẩm,
 * tạo đúng số lô nhập; worker vẽ outfit theo ảnh gốc outfit + người mẫu, ảnh bìa dựng từ ảnh outfit của lô.
 * Chế độ Creative có ô "Tạo cho kênh": không theo kênh = chỉ nhóm dùng chung; chọn kênh = nhóm dùng chung + nhóm riêng
 * của kênh đó (gửi channel_id).
 */
export default function BatchAutoPage() {
  useSeo({ title: 'Tạo lô tự động', noindex: true });
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const logoUrl = batchLogoUrl(me);
  const idem = useIdempotencyKey();
  const [mode, setModeState] = useState(readMode);
  const outfit = mode === 'outfit';
  const [input, setInput] = useState('1');
  // Số ảnh mỗi lô phối đồ (gồm ảnh bìa)
  const [imagesInput, setImagesInput] = useState(String(OUTFIT_IMAGES.default));
  const [images, setImages] = useState(OUTFIT_IMAGES.default);
  const [count, setCount] = useState(1);
  const [insertLogo, setInsertLogo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logoError, setLogoError] = useState(null);
  // Worker tạo ảnh cho mọi lô, bắt buộc chọn (note/chon-worker-tao-anh.txt)
  const worker = useImageWorker(outfit ? 'outfit' : 'image');
  const [workerError, setWorkerError] = useState(null);
  const setMode = (m) => {
    setModeState(m);
    setWorkerError(null);
    setError(null);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // bỏ qua
    }
  };
  // Sản phẩm chọn thủ công; rỗng = hệ thống chọn ngẫu nhiên trong mọi sản phẩm
  const [products, setProducts] = useState([]);
  const [picking, setPicking] = useState(false);
  const [useProductState, setUseProductState] = useState(readUseProduct);
  const setUseProduct = (v) => {
    setUseProductState(v);
    setError(null);
    try {
      localStorage.setItem(USE_PRODUCT_KEY, v ? '1' : '0');
    } catch {
      // bỏ qua
    }
  };
  // Chế độ Creative luôn dùng sản phẩm; Phối đồ theo công tắc
  const useProduct = !outfit || useProductState;
  const productIds = useProduct ? products.map((p) => p.id) : [];
  // Kênh tạo lô (chế độ Creative): '' = không theo kênh, chỉ dùng nhóm creative dùng chung
  const { data: channelData } = useQuery({ queryKey: CHANNEL_KEYS.all, queryFn: listChannels });
  const channels = channelData?.items ?? [];
  const [channelPick, setChannelPick] = useState('');
  // Kênh đã chọn không còn thì về "không theo kênh"
  const channelId = channels.some((c) => String(c.id) === channelPick) ? channelPick : '';

  // Vào từ danh sách lô thì quay lại đúng trang đó (không để trang này lại trong lịch sử)
  const fromList = !!location.state?.fromList && window.history.state?.idx > 0;
  const goList = () => (fromList ? navigate(-1) : navigate('/batches', { replace: true }));

  // Gõ xong mới gọi xem trước
  useEffect(() => {
    const n = Math.min(AUTO_MAX_COUNT, Math.max(1, Math.floor(Number(input)) || 1));
    const t = setTimeout(() => setCount(n), PREVIEW_DELAY);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    const n = Math.min(OUTFIT_IMAGES.max, Math.max(OUTFIT_IMAGES.min, Math.floor(Number(imagesInput)) || OUTFIT_IMAGES.default));
    const t = setTimeout(() => setImages(n), PREVIEW_DELAY);
    return () => clearTimeout(t);
  }, [imagesInput]);

  const preview = useQuery({
    queryKey: outfit
      ? ['auto-preview', 'outfit', useProduct, count, images, productIds.join(',')]
      : ['auto-preview', count, productIds.join(','), channelId],
    queryFn: () => (outfit ? previewOutfit(count, images, productIds, useProduct) : previewAuto(count, productIds, channelId)),
    placeholderData: (prev) => prev,
    gcTime: 0,
  });
  const plan = preview.data;
  const empty = plan && !plan.batches.length;
  // Xem trước đúng số lô đang nhập và không đang đổi ngẫu nhiên thì tạo đúng các lô đó
  // Vừa đổi chế độ: placeholderData là kết quả của chế độ cũ, chưa dùng được
  const planOfMode = !!plan && (outfit ? 'imagesPerBatch' in plan && plan.useProduct === useProduct : 'seed' in plan);
  const planReady = planOfMode && count === Number(input) && !preview.isFetching && (!outfit || images === Number(imagesInput));

  const countInvalid = !(Number(input) >= 1 && Number(input) <= AUTO_MAX_COUNT && Number.isInteger(Number(input)));
  const imagesInvalid =
    outfit &&
    !(Number(imagesInput) >= OUTFIT_IMAGES.min && Number(imagesInput) <= OUTFIT_IMAGES.max && Number.isInteger(Number(imagesInput)));
  const invalid = countInvalid || imagesInvalid;

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
      const result = outfit
        ? await createOutfit(
            {
              count: Number(input),
              imagesPerBatch: Number(imagesInput),
              insertLogo: !!logoUrl && insertLogo,
              productIds,
              useProduct,
              workerId: worker.workerId,
            },
            idem.key.current,
          )
        : await createAuto(
            {
              count: Number(input),
              insertLogo: !!logoUrl && insertLogo,
              seed: planReady ? plan.seed : undefined,
              productIds,
              channelId,
              workerId: worker.workerId,
            },
            idem.key.current,
          );
      idem.renew();
      queryClient.setQueryData(AUTO_RESULT_KEY, {
        created: result.batches.length,
        requested: result.requested,
        stopped: result.stopped,
      });
      // Lượt tự động của sản phẩm đổi
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
          <p className="truncate text-xs text-on-surface-variant">
            {outfit
              ? useProduct
                ? 'Mỗi lô = 1 sản phẩm (ít lô phối đồ nhất trước): 1 ảnh bìa + các ảnh outfit phối với đôi giày'
                : 'Mỗi lô: các ảnh outfit vẽ từ outfit OOTD + người mẫu, ảnh bìa làm từ ảnh outfit của lô'
              : 'Mỗi lô = 1 sản phẩm (ít ảnh nhất trước) x các creative Đang bán của 1 nhóm (ít dùng nhất với sản phẩm đó)'}
          </p>
        </div>
      </header>

      <section className="space-y-4 p-4 lg:mx-auto lg:w-full lg:max-w-[800px] lg:py-6">
        <div role="radiogroup" aria-label="Loại lô" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-container-low p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-bold ${
                mode === m.value ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon name={m.icon} className="text-lg" />
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-2xl border border-outline-variant/40 p-4">
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
              countInvalid ? 'border-error' : 'border-outline-variant/40 focus:border-primary-container'
            }`}
          />
          {countInvalid && <p className="mt-1 text-xs text-error">Nhập từ 1 đến {AUTO_MAX_COUNT} lô.</p>}
          </div>
          {outfit && (
            <div>
              <label htmlFor="auto-images" className="mb-1.5 block text-xs font-semibold text-on-surface">
                Số ảnh mỗi lô
              </label>
              <input
                id="auto-images"
                type="number"
                inputMode="numeric"
                min={OUTFIT_IMAGES.min}
                max={OUTFIT_IMAGES.max}
                value={imagesInput}
                onChange={(e) => setImagesInput(e.target.value)}
                className={`h-11 w-32 rounded-xl border bg-surface-container-low px-3.5 text-sm font-bold text-on-surface focus:outline-none ${
                  imagesInvalid ? 'border-error' : 'border-outline-variant/40 focus:border-primary-container'
                }`}
              />
              {imagesInvalid ? (
                <p className="mt-1 text-xs text-error">
                  Nhập từ {OUTFIT_IMAGES.min} đến {OUTFIT_IMAGES.max} ảnh.
                </p>
              ) : (
                <p className="mt-1 text-xs text-on-surface-variant">1 ảnh bìa + {Math.max(0, Number(imagesInput) - 1)} ảnh outfit</p>
              )}
            </div>
          )}
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

        {!outfit && channels.length > 0 && (
          <div className="rounded-2xl border border-outline-variant/40 p-4">
            <SelectField
              label="Tạo cho kênh"
              value={channelId}
              onChange={(e) => {
                setChannelPick(e.target.value);
                setError(null);
              }}
              hint={
                channelId
                  ? 'Dùng nhóm creative dùng chung + nhóm riêng của kênh này.'
                  : 'Chỉ dùng nhóm creative dùng chung (nhóm riêng của kênh bị bỏ qua).'
              }
            >
              <option value="">Không theo kênh</option>
              {channels.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          </div>
        )}

        {outfit && (
          <div className="rounded-2xl border border-outline-variant/40 p-3">
            <Switch
              label="Dùng ảnh sản phẩm"
              hint={
                useProduct
                  ? 'Mỗi lô 1 sản phẩm: người mẫu đi đúng đôi giày, ảnh bìa từ ảnh giày'
                  : 'Không gắn sản phẩm: vẽ theo ảnh gốc outfit + người mẫu, ảnh bìa từ ảnh outfit của lô'
              }
              checked={useProduct}
              onChange={setUseProduct}
            />
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center gap-1">
            <h2 className="flex flex-1 items-center gap-1 text-sm font-bold text-on-surface">
              Xem trước
              {preview.isFetching && <Icon name="progress_activity" className="animate-spin text-sm text-outline" />}
            </h2>
            {useProduct && (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-surface-container"
              >
                <Icon name="checklist" className="text-base" />
                Chọn sản phẩm thủ công
              </button>
            )}
          </div>
          {useProduct && products.length > 0 && (
            <div className="mb-2 flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs">
              <Icon name="shopping_bag" className="shrink-0 text-base text-primary" />
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
          ) : !planOfMode ? (
            <div className="space-y-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : empty && outfit ? (
            <div className="space-y-2 rounded-xl bg-amber-50 px-3 py-3 text-xs text-amber-800">
              <p className="font-semibold">Cần có sản phẩm đang hoạt động (có ảnh) để tạo lô phối đồ.</p>
              <p>
                Thêm hoặc bật{' '}
                <Link to="/seller/items" className="font-bold text-primary hover:underline">
                  sản phẩm
                </Link>{' '}
                có ảnh đôi giày.
              </p>
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
                có creative Đang bán chứa trường ảnh trùng key với ảnh sản phẩm
                {channelId ? ' (nhóm dùng chung hoặc nhóm riêng của kênh đã chọn)' : ' (nhóm dùng chung, hoặc chọn kênh để dùng nhóm riêng của kênh)'}.
              </p>
            </div>
          ) : (
            <>
              <ol className="grid gap-1.5 lg:grid-cols-2">
                {plan.batches.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-outline-variant/40 p-2"
                  >
                    <span className="w-6 shrink-0 text-center text-xs font-bold text-outline">{i + 1}</span>
                    {b.product ? (
                      <CoverImage src={b.product.coverUrl} alt="" className="size-10 shrink-0 rounded-lg" />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                        <Icon name="checkroom" className="text-outline" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-on-surface">
                        {b.product ? b.product.name || `Sản phẩm #${b.product.id}` : `Lô phối đồ ${i + 1}`}
                      </span>
                      {outfit ? (
                        <span className="block truncate text-[11px] text-on-surface-variant">
                          {b.images} ảnh: 1 bìa + {b.images - 1} outfit
                        </span>
                      ) : (
                        <span className="block truncate text-[11px] text-on-surface-variant" title={b.creatives.map((c) => c.title).join(', ')}>
                          {b.group.name} · {b.creatives.length} creative
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              {planReady && plan.batches.length < count && (
                <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <Icon name="info" className="shrink-0 text-base" />
                  <span>
                    {outfit
                      ? `Mỗi sản phẩm 1 lô mỗi lượt tạo nên chỉ tạo được ${plan.batches.length} lô. Thêm sản phẩm để tạo nhiều lô hơn.`
                      : `Mỗi sản phẩm / nhóm chỉ dùng 1 lần mỗi lượt tạo nên chỉ ghép được ${plan.batches.length} lô. Thêm sản phẩm hoặc nhóm creative để tạo nhiều lô hơn.`}
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
              <b className="text-on-surface">{plan.batches.length}</b> lô
            </>
          ) : empty ? (
            'Chưa ghép được lô nào'
          ) : (
            'Đang xem trước...'
          )
        }
        error={error && (error.message || 'Không tạo được lô, vui lòng thử lại.')}
        disabled={invalid || !planReady || empty}
        loading={loading}
        onSubmit={submit}
        label={`Tạo ${invalid ? '' : `${planReady ? plan.batches.length : Number(input)} lô`}`}
        icon={outfit ? 'checkroom' : 'auto_awesome'}
      />
    </>
  );
}
