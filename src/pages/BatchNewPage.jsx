import { useRef, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import useIdempotencyKey from '../hooks/useIdempotencyKey';
import Icon from '../components/common/Icon';
import CoverImage from '../components/common/CoverImage';
import ActionBar from '../components/common/ActionBar';
import { initialValues, validateValues } from '../components/template/DynamicForm';
import CreativePicker from '../components/batch/CreativePicker';
import CreativeInputCard from '../components/batch/CreativeInputCard';
import LogoCard, { batchLogoUrl } from '../components/batch/LogoCard';
import ImageWorkerSelect, { useImageWorker } from '../components/common/ImageWorkerSelect';
import ImageSelectField from '../components/common/ImageSelectField';
import { useMe } from '../hooks/queries';
import { creativeApi } from '../api/services';
import { createBatch } from '../api/batches';
import { formatVnd } from '../utils/format';
import { getProductImageFile, listAllProducts } from '../api/autoBatch';

const IMAGE_FIELDS = ['image', 'image_list'];

/**
 * Điền ảnh sản phẩm vào form: trường ảnh có key = field_key của ảnh sản phẩm (giống tạo lô tự động).
 * filesByKey: { [fieldKey]: File[] }.
 */
function prefillFromProduct(schema, values, filesByKey) {
  if (!filesByKey) return values;
  const next = { ...values };
  schema.forEach((f) => {
    const files = filesByKey[f.key];
    if (!IMAGE_FIELDS.includes(f.type) || !(f.key in next) || !files?.length) return;
    next[f.key] = f.type === 'image' ? files.slice(0, 1) : files.slice(0, f.validation?.max_files || undefined);
  });
  return next;
}

/**
 * /batches/new: tạo lô ảnh, 2 bước (?step=inputs là bước 2, nút quay lại của trình duyệt về bước 1):
 * 1. chọn mẫu (mỗi mẫu một lần); 2. nhập thông tin và số ảnh cho từng mẫu. Xong thì tạo lô ngay (đã trừ tiền),
 * ảnh được tạo ở nền; về danh sách lô để theo dõi trạng thái, bấm vào lô để xem, tạo lại ảnh và tạo bài đăng.
 */
export default function BatchNewPage() {
  useSeo({ title: 'Tạo lô ảnh', noindex: true });
  const navigate = useNavigate();
  const location = useLocation();
  // Vào từ danh sách lô: nhớ vị trí trong lịch sử của trang này (bước chọn mẫu) để tạo xong lùi về đúng danh sách,
  // không để lại các bước tạo lô trong lịch sử (nút Back của trình duyệt không quay lại form đã trống)
  const entry = useRef(location.state?.fromList ? (window.history.state?.idx ?? null) : null);
  const queryClient = useQueryClient();
  const idem = useIdempotencyKey();
  const [params, setParams] = useSearchParams();
  // Sản phẩm của lô: ảnh sản phẩm tự điền vào trường ảnh trùng key, gửi product_id (lưu vào generations.product_id).
  // Chọn ở bước nhập thông tin (dưới ô worker); vào từ nút "Tạo ảnh" của thẻ sản phẩm (/seller/items) thì chọn sẵn.
  // Giữ trong state vì đổi ?step làm mất location.state. null: không theo sản phẩm, người dùng tự nhập, product_id = 0
  const [product, setProduct] = useState(() => location.state?.product ?? null);
  const [picked, setPicked] = useState([]);
  // Giá trị người dùng đã sửa theo mẫu: { [id]: { [key]: value } }; trường chưa sửa lấy mặc định của form + ảnh sản phẩm
  const [inputs, setInputs] = useState({});
  // Số ảnh theo mẫu: { [id]: n }, mặc định 1
  const [quantities, setQuantities] = useState({});
  const [open, setOpen] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Lỗi theo trường do máy chủ trả về: { [slug]: { [key]: msg } } (errors["items.1.inputs.product_image"])
  const [serverErrors, setServerErrors] = useState({});
  // Logo shop = ảnh đại diện shop; có logo thì mặc định chèn
  const { data: me } = useMe();
  const logoUrl = batchLogoUrl(me);
  const [insertLogo, setInsertLogo] = useState(true);
  const [logoError, setLogoError] = useState(null);
  // Worker tạo ảnh cho cả lô, bắt buộc chọn (note/chon-worker-tao-anh.txt)
  const worker = useImageWorker();
  const [workerError, setWorkerError] = useState(null);

  const step = params.get('step') === 'inputs' && picked.length ? 'inputs' : 'pick';
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/batches', { replace: true }));

  // Chi tiết từng mẫu (danh sách mẫu không kèm form nhập liệu); dùng chung cache với trang chi tiết mẫu.
  // Mẫu riêng tư của chính mình cũng mở được qua GET /creatives/{slug} (đã đăng nhập)
  const details = useQueries({
    queries: picked.map((c) => ({ queryKey: ['creative', c.id], queryFn: () => creativeApi.getById(c.id), enabled: step === 'inputs' })),
  });

  // Tải ảnh sản phẩm thành File (gửi lên như ảnh người dùng tự chọn), nhóm theo field_key
  const productFiles = useQuery({
    queryKey: ['product-files', product?.id, product?.images.map((i) => i.id).join(',')],
    queryFn: async () => {
      const results = await Promise.allSettled(product.images.map((img) => getProductImageFile(product.id, img)));
      const byKey = {};
      let failed = 0;
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled') {
          failed += 1;
          return;
        }
        const key = product.images[i].fieldKey;
        (byKey[key] ??= []).push(r.value);
      });
      return { byKey, failed };
    },
    enabled: !!product?.images.length,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  const loadingProductFiles = !!product?.images.length && productFiles.isLoading;

  // Danh sách sản phẩm cho ô chọn (chỉ tài khoản có shop mới có sản phẩm; lỗi thì ẩn ô chọn)
  const products = useQuery({ queryKey: ['creator', 'products', 'all'], queryFn: listAllProducts, enabled: step === 'inputs' });
  const [productError, setProductError] = useState(null);

  /**
   * Đổi sản phẩm: bỏ giá trị đã sửa ở các trường ảnh trùng key của sản phẩm cũ và mới, để các trường đó
   * điền lại theo sản phẩm mới (bỏ chọn sản phẩm: các trường đó về trống, người dùng tự nhập).
   */
  const changeProduct = (id) => {
    const next = (products.data ?? []).find((p) => String(p.id) === String(id)) ?? null;
    const keys = new Set([...(product?.images ?? []), ...(next?.images ?? [])].map((img) => img.fieldKey));
    const strip = (obj) => Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => !keys.has(k)));
    setInputs((prev) => Object.fromEntries(Object.entries(prev).map(([cid, v]) => [cid, strip(v)])));
    setServerErrors((prev) => Object.fromEntries(Object.entries(prev).map(([cid, v]) => [cid, strip(v)])));
    setProduct(next);
    setProductError(null);
  };

  const toggle = (c) => setPicked((prev) => (prev.some((p) => p.id === c.id) ? prev.filter((p) => p.id !== c.id) : [...prev, c]));
  const quantityOf = (c) => quantities[c.id] ?? 1;
  const imageTotal = picked.reduce((sum, c) => sum + quantityOf(c), 0);
  const total = picked.reduce((sum, c) => sum + (c.price ?? 0) * quantityOf(c), 0);

  const productKeys = new Set(product?.images.map((img) => img.fieldKey) ?? []);
  const rows = picked.map((c, i) => {
    const schema = details[i]?.data?.inputSchema ?? null;
    // Trường chưa sửa lấy giá trị mặc định của form + ảnh sản phẩm (nếu có), đè bằng giá trị người dùng đã sửa
    const values = schema
      ? { ...prefillFromProduct(schema, initialValues(schema), productFiles.data?.byKey), ...inputs[c.id] }
      : (inputs[c.id] ?? {});
    const allErrors = schema ? validateValues(schema, values) : {};
    return {
      creative: c,
      detail: details[i] ?? {},
      schema,
      values,
      allErrors,
      missing: Object.keys(allErrors).length,
      // Mẫu có trường ảnh trùng key với ảnh sản phẩm (không phụ thuộc ảnh đã tải xong hay chưa)
      keyMatched: !!schema?.some((f) => IMAGE_FIELDS.includes(f.type) && productKeys.has(f.key)),
    };
  });
  const loadingDetails = rows.some((r) => !r.schema) || loadingProductFiles;
  // Mẫu không có trường ảnh nào trùng key với ảnh sản phẩm
  const unmatched = product ? rows.filter((r) => r.schema && !r.keyMatched) : [];
  const incomplete = rows.filter((r) => r.schema && r.missing);

  const goInputs = () => {
    setSubmitted(false);
    setOpen(picked.slice(0, 1).map((c) => c.id));
    setParams({ step: 'inputs' });
  };

  const toggleOpen = (id) => setOpen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async () => {
    setError(null);
    setWorkerError(worker.missingError);
    if (worker.missingError) {
      setError(worker.missingError);
      document.getElementById('batch-worker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (incomplete.length) {
      // Mở các mẫu còn thiếu và cuộn tới mẫu đầu tiên
      setSubmitted(true);
      setOpen((ids) => [...new Set([...ids, ...incomplete.map((r) => r.creative.id)])]);
      requestAnimationFrame(() =>
        document.getElementById(`creative-input-${incomplete[0].creative.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
      return;
    }
    setLoading(true);
    setServerErrors({});
    setLogoError(null);
    try {
      await createBatch(
        rows.map((r) => ({
          creativeId: r.detail.data?.creativeId ?? r.creative.creativeId,
          schema: r.schema,
          values: r.values,
          quantity: quantityOf(r.creative),
        })),
        idem.key.current,
        !!logoUrl && insertLogo,
        worker.workerId,
        product?.id ?? null,
      );
      idem.renew();
      // Đã trừ tiền -> tải lại số dư
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      // Về danh sách lô: lô vừa tạo đứng đầu, hiện "Đang tạo" tới khi xong (danh sách tự cập nhật)
      const idx = window.history.state?.idx;
      if (entry.current !== null && idx != null && idx >= entry.current) navigate(-(idx - entry.current + 1));
      else navigate('/batches', { replace: true });
    } catch (err) {
      idem.renewAfter(err);
      const byRow = {};
      Object.entries(err?.errors ?? {}).forEach(([field, msg]) => {
        const m = field.match(/^items\.(\d+)\.inputs\.([^.]+)/);
        const row = m && rows[Number(m[1])];
        if (row) byRow[row.creative.id] = { ...byRow[row.creative.id], [m[2]]: msg };
      });
      if (Object.keys(byRow).length) {
        setServerErrors(byRow);
        setOpen((ids) => [...new Set([...ids, ...Object.keys(byRow)])]);
      }
      if (err?.errors?.insert_logo) setLogoError([].concat(err.errors.insert_logo)[0]);
      if (err?.errors?.worker_id) setWorkerError([].concat(err.errors.worker_id)[0]);
      if (err?.errors?.product_id) setProductError([].concat(err.errors.product_id)[0]);
      setError(err?.message || 'Không tạo được lô ảnh, vui lòng thử lại.');
      setLoading(false);
    }
  };

  const header = (
    <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
      <button
        type="button"
        onClick={goBack}
        aria-label="Quay lại"
        className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
      >
        <Icon name="arrow_back" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold text-on-surface">{step === 'inputs' ? 'Nhập thông tin tạo ảnh' : 'Tạo lô ảnh'}</h1>
        {step === 'pick' && (
          <p className="truncate text-xs text-on-surface-variant">
            {product ? `Chọn mẫu AI Creative cho ${product.name || `sản phẩm #${product.id}`}` : 'Chọn các mẫu AI Creative cho lô'}
          </p>
        )}
      </div>
    </header>
  );

  const productBanner = product && (
    <div className="flex items-start gap-3 rounded-2xl border border-primary-container/40 bg-surface-container-low p-3">
      <CoverImage src={product.coverUrl} alt="" className="size-12 shrink-0 rounded-xl !object-contain" />
      <div className="min-w-0 flex-1 space-y-0.5 text-xs">
        <p className="truncate text-sm font-bold text-on-surface">{product.name || `Sản phẩm #${product.id}`}</p>
        <p className="text-on-surface-variant">
          Ảnh sản phẩm tự điền vào trường ảnh có key:{' '}
          {product.images.length
            ? [...new Set(product.images.map((img) => img.fieldKey))].map((k) => (
                <span key={k} className="mr-1 rounded bg-surface-container px-1.5 py-0.5 font-mono text-[11px]">
                  {k}
                </span>
              ))
            : 'sản phẩm chưa có ảnh'}
        </p>
        {product.promptNote && (
          <p className="line-clamp-2 text-on-surface-variant" title={product.promptNote}>
            Yêu cầu thêm vào cuối prompt: <span className="text-on-surface">{product.promptNote}</span>
          </p>
        )}
        {loadingProductFiles && (
          <p className="flex items-center gap-1 text-outline">
            <Icon name="progress_activity" className="animate-spin text-sm" />
            Đang tải ảnh sản phẩm...
          </p>
        )}
        {productFiles.data?.failed > 0 && (
          <p className="text-amber-700">Không tải được {productFiles.data.failed} ảnh sản phẩm, vui lòng tự tải ảnh lên cho trường đó.</p>
        )}
        {step === 'inputs' && unmatched.length > 0 && (
          <p className="text-amber-700">
            Mẫu {unmatched.map((r) => `"${r.creative.title}"`).join(', ')} không có trường ảnh trùng key, vui lòng tự nhập.
          </p>
        )}
      </div>
    </div>
  );

  if (step === 'pick') {
    return (
      <>
        {header}
        {productBanner && <div className="px-4 pt-4">{productBanner}</div>}
        <CreativePicker picked={picked} onToggle={toggle} hint="Chọn một hoặc nhiều mẫu, mỗi mẫu một lần. Số ảnh mỗi mẫu chọn ở bước sau." />
        <ActionBar
          summary={
            picked.length ? (
              <>
                <b className="text-on-surface">{picked.length}</b> mẫu đã chọn
              </>
            ) : (
              'Chưa chọn mẫu nào'
            )
          }
          label="Tiếp tục"
          icon="arrow_forward"
          disabled={!picked.length}
          onSubmit={goInputs}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <section className="space-y-3 p-4 lg:mx-auto lg:w-full lg:max-w-[800px] lg:py-6">
        <div>
          <h2 className="text-sm font-bold text-on-surface">Nhập thông tin cho từng mẫu</h2>
          <p className="text-xs text-on-surface-variant">
            Mỗi mẫu cần thông tin riêng (ảnh sản phẩm, ảnh tham chiếu, tuỳ chọn...). Chọn số ảnh ở góc phải: AI tạo
            các ảnh khác nhau từ cùng thông tin đã nhập.
          </p>
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
        <div id="batch-worker" className="rounded-2xl border border-outline-variant/40 p-4">
          <ImageWorkerSelect worker={worker} error={workerError} onChange={() => setWorkerError(null)} />
        </div>
        {(!products.isError || product) && (
          <div id="batch-product" className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
            <ImageSelectField
              label="Sản phẩm"
              icon="inventory_2"
              value={product ? String(product.id) : ''}
              onChange={changeProduct}
              emptyLabel={products.isLoading ? 'Đang tải sản phẩm...' : 'Không theo sản phẩm'}
              // Sản phẩm chọn sẵn (vào từ thẻ sản phẩm) luôn có trong danh sách, kể cả khi danh sách chưa tải xong
              options={[
                ...(product && !(products.data ?? []).some((p) => p.id === product.id) ? [product] : []),
                ...(products.data ?? []),
              ].map((p) => ({
                value: String(p.id),
                label: p.name || `Sản phẩm #${p.id}`,
                image: p.coverUrl ?? p.images?.[0]?.thumbUrl,
                description: p.images?.length ? `${p.images.length} ảnh` : 'Chưa có ảnh',
              }))}
              error={productError}
              hint="Chọn sản phẩm để tự điền ảnh sản phẩm vào các trường trùng key. Không chọn thì tự nhập thông tin."
            />
            {productBanner}
          </div>
        )}
        <ul className="space-y-3">
          {rows.map((r) => (
            <CreativeInputCard
              key={r.creative.id}
              creative={r.creative}
              detail={r.detail}
              values={r.values}
              errors={{ ...serverErrors[r.creative.id], ...(submitted ? r.allErrors : {}) }}
              missing={r.missing}
              open={open.includes(r.creative.id)}
              onToggleOpen={() => toggleOpen(r.creative.id)}
              onChange={(key, v) => {
                setInputs((prev) => ({ ...prev, [r.creative.id]: { ...prev[r.creative.id], [key]: v } }));
                setServerErrors((prev) => ({ ...prev, [r.creative.id]: { ...prev[r.creative.id], [key]: undefined } }));
              }}
              // Bước này luôn giữ ít nhất 1 mẫu; muốn đổi hết thì quay lại bước chọn mẫu
              onRemove={rows.length > 1 ? () => toggle(r.creative) : null}
              quantity={quantityOf(r.creative)}
              onQuantity={(n) => setQuantities((prev) => ({ ...prev, [r.creative.id]: Math.max(1, n) }))}
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant text-sm font-bold text-primary hover:bg-surface-container"
        >
          <Icon name="add" className="text-lg" />
          Chọn thêm mẫu
        </button>
      </section>
      <ActionBar
        summary={
          <>
            <b className="text-on-surface">{imageTotal}</b> ảnh ·{' '}
            <b className="text-on-surface">{total > 0 ? formatVnd(total) : 'Miễn phí'}</b>
            {loadingDetails ? (
              <span className="block">Đang tải thông tin mẫu...</span>
            ) : incomplete.length ? (
              <span className="block text-amber-700">Còn {incomplete.length} mẫu thiếu thông tin</span>
            ) : (
              <span className="block text-emerald-700">Đã đủ thông tin</span>
            )}
          </>
        }
        error={error}
        disabled={loadingDetails}
        loading={loading}
        onSubmit={submit}
        label="Tạo lô ảnh"
        icon="auto_awesome"
      />
    </>
  );
}
