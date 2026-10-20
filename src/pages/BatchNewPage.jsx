import { useRef, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import useIdempotencyKey from '../hooks/useIdempotencyKey';
import Icon from '../components/common/Icon';
import ActionBar from '../components/common/ActionBar';
import { initialValues, validateValues } from '../components/template/DynamicForm';
import CreativePicker from '../components/batch/CreativePicker';
import CreativeInputCard from '../components/batch/CreativeInputCard';
import LogoCard from '../components/batch/LogoCard';
import { useMe } from '../hooks/queries';
import { creativeApi } from '../api/services';
import { createBatch } from '../api/batches';
import { formatVnd } from '../utils/format';

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
  const [picked, setPicked] = useState([]);
  // Giá trị nhập theo mẫu: { [slug]: values }; chưa có thì lấy giá trị mặc định của form
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
  const logoUrl = me?.avatarUrl ?? null;
  const [insertLogo, setInsertLogo] = useState(true);
  const [logoError, setLogoError] = useState(null);

  const step = params.get('step') === 'inputs' && picked.length ? 'inputs' : 'pick';
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/batches', { replace: true }));

  // Chi tiết từng mẫu (danh sách mẫu không kèm form nhập liệu); dùng chung cache với trang chi tiết mẫu.
  // Mẫu riêng tư của chính mình cũng mở được qua GET /creatives/{slug} (đã đăng nhập)
  const details = useQueries({
    queries: picked.map((c) => ({ queryKey: ['creative', c.id], queryFn: () => creativeApi.getById(c.id), enabled: step === 'inputs' })),
  });

  const toggle = (c) => setPicked((prev) => (prev.some((p) => p.id === c.id) ? prev.filter((p) => p.id !== c.id) : [...prev, c]));
  const quantityOf = (c) => quantities[c.id] ?? 1;
  const imageTotal = picked.reduce((sum, c) => sum + quantityOf(c), 0);
  const total = picked.reduce((sum, c) => sum + (c.price ?? 0) * quantityOf(c), 0);

  const rows = picked.map((c, i) => {
    const schema = details[i]?.data?.inputSchema ?? null;
    const values = inputs[c.id] ?? (schema ? initialValues(schema) : {});
    const allErrors = schema ? validateValues(schema, values) : {};
    return { creative: c, detail: details[i] ?? {}, schema, values, allErrors, missing: Object.keys(allErrors).length };
  });
  const loadingDetails = rows.some((r) => !r.schema);
  const incomplete = rows.filter((r) => r.schema && r.missing);

  const goInputs = () => {
    setSubmitted(false);
    setOpen(picked.slice(0, 1).map((c) => c.id));
    setParams({ step: 'inputs' });
  };

  const toggleOpen = (id) => setOpen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async () => {
    setError(null);
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
        {step === 'pick' && <p className="text-xs text-on-surface-variant">Chọn các mẫu AI Creative cho lô</p>}
      </div>
    </header>
  );

  if (step === 'pick') {
    return (
      <>
        {header}
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
                setInputs((prev) => ({ ...prev, [r.creative.id]: { ...r.values, [key]: v } }));
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
