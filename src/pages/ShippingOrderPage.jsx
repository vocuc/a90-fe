import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import ActionBar from '../components/common/ActionBar';
import ImageViewer from '../components/common/ImageViewer';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SelectField, TextArea, TextField } from '../components/common/Form';
import { OrderStatusBadge } from '../components/shipping/OrderStatus';
import { formatVnd } from '../utils/format';
import {
  ADDRESS_TYPES,
  MAX_COD,
  MAX_WEIGHT,
  ORDER_STATUS,
  PAYMENT_TYPES,
  REQUIRED_NOTES,
  deleteOrder,
  fieldErrors,
  getDistricts,
  getOrder,
  getProvinces,
  getWards,
  isOrderEditable,
  lowConfidence,
  submitOrder,
  updateOrder,
} from '../api/shipping';
import { useConfirm } from '../components/common/ConfirmDialog';

// Các trường form sửa được (cùng tên với FIELD_NAMES trong api/shipping.js)
const POLL_INTERVAL = 3000;

const FORM_FIELDS = [
  'addressType',
  'toName',
  'toPhone',
  'toAddress',
  'toProvinceId',
  'toDistrictId',
  'toWardCode',
  'itemName',
  'codAmount',
  'weight',
  'requiredNote',
  'note',
];
const toForm = (order) => ({
  ...Object.fromEntries(FORM_FIELDS.map((k) => [k, order[k] ?? ''])),
  // Ai trả ship: mặc định khách trả (2), shop đổi được trước khi gửi
  paymentTypeId: order.paymentTypeId ?? 2,
});

const digits = (v) => String(v ?? '').replace(/\D/g, '');
const formatMoney = (n) => (n === '' || n == null ? '' : Number(n).toLocaleString('vi-VN'));
const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

/** Trường AI không chắc: nền vàng + nhắc kiểm tra lại (hết vàng khi người dùng sửa). */
function Highlight({ active, children }) {
  if (!active) return children;
  return (
    <div className="space-y-1 rounded-2xl bg-amber-50 p-2 ring-1 ring-amber-300">
      {children}
      <p className="flex items-center gap-1 px-1 text-[11px] font-semibold text-amber-800">
        <Icon name="help" className="text-sm" />
        AI không chắc, vui lòng kiểm tra lại
      </p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
      <h2 className="text-sm font-bold text-on-surface">{title}</h2>
      {children}
    </section>
  );
}

/** Ảnh chat của đơn: mobile cuộn ngang, desktop xếp dọc bên trái. Bấm để phóng to. */
function OrderImages({ images }) {
  const [viewing, setViewing] = useState(null);
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-[124px] lg:max-h-[calc(100vh-140px)] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setViewing(img)}
            className="relative w-32 shrink-0 overflow-hidden rounded-xl bg-surface-container lg:w-full"
          >
            <img src={img.url} alt={`Ảnh chat ${i + 1}`} className="w-full object-contain" loading="lazy" />
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
          </button>
        ))}
      </div>
      {viewing && <ImageViewer src={viewing.url} alt="Ảnh chat" onClose={() => setViewing(null)} />}
    </>
  );
}

/** Tỉnh -> (quận) -> phường theo danh mục GHN; đổi cấp trên thì xoá cấp dưới. */
function LocationFields({ form, setField, errors, low, disabled }) {
  const isNew = form.addressType === 'new';
  const provinces = useQuery({
    queryKey: ['shipping', 'ghn', 'provinces', form.addressType],
    queryFn: () => getProvinces(form.addressType),
    staleTime: Infinity,
  });
  const districts = useQuery({
    queryKey: ['shipping', 'ghn', 'districts', form.toProvinceId],
    queryFn: () => getDistricts(form.toProvinceId),
    enabled: !isNew && !!form.toProvinceId,
    staleTime: Infinity,
  });
  const wardParent = isNew ? form.toProvinceId : form.toDistrictId;
  const wards = useQuery({
    queryKey: ['shipping', 'ghn', 'wards', form.addressType, wardParent],
    queryFn: () => getWards(form.addressType, wardParent),
    enabled: !!wardParent,
    staleTime: Infinity,
  });

  const loadError = provinces.error || districts.error || wards.error;
  const placeholder = (q, label) => (q.isLoading ? 'Đang tải...' : `Chọn ${label}`);

  return (
    <>
      <Highlight active={low.has('toProvinceId')}>
        <SelectField
          label="Tỉnh / Thành phố *"
          value={form.toProvinceId ?? ''}
          disabled={disabled}
          error={errors.toProvinceId}
          onChange={(e) => {
            setField('toProvinceId', e.target.value ? Number(e.target.value) : '');
            setField('toDistrictId', '');
            setField('toWardCode', '');
          }}
        >
          <option value="">{placeholder(provinces, 'tỉnh / thành phố')}</option>
          {provinces.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
      </Highlight>
      {!isNew && (
        <Highlight active={low.has('toDistrictId')}>
          <SelectField
            label="Quận / Huyện *"
            value={form.toDistrictId ?? ''}
            disabled={disabled || !form.toProvinceId}
            error={errors.toDistrictId}
            onChange={(e) => {
              setField('toDistrictId', e.target.value ? Number(e.target.value) : '');
              setField('toWardCode', '');
            }}
          >
            <option value="">{form.toProvinceId ? placeholder(districts, 'quận / huyện') : 'Chọn tỉnh trước'}</option>
            {districts.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SelectField>
        </Highlight>
      )}
      <Highlight active={low.has('toWardCode')}>
        <SelectField
          label="Phường / Xã *"
          value={form.toWardCode ?? ''}
          disabled={disabled || !wardParent}
          error={errors.toWardCode}
          onChange={(e) => setField('toWardCode', e.target.value)}
        >
          <option value="">{wardParent ? placeholder(wards, 'phường / xã') : isNew ? 'Chọn tỉnh trước' : 'Chọn quận trước'}</option>
          {wards.data?.map((w) => (
            <option key={w.code} value={w.code}>
              {w.name}
            </option>
          ))}
        </SelectField>
      </Highlight>
      {loadError && <FormAlert>{loadError.message}</FormAlert>}
    </>
  );
}

/** Đơn đã gửi GHN: chỉ xem. */
function SubmittedSummary({ order }) {
  const rows = [
    ['Mã đơn GHN', <b key="c" className="select-all text-on-surface">{order.ghnOrderCode}</b>],
    ['Phí ship', order.shippingFee != null ? formatVnd(order.shippingFee) : '—'],
    ['Dự kiến giao', formatTime(order.expectedDeliveryTime)],
    ['Người nhận', `${order.toName} · ${order.toPhone}`],
    ['Địa chỉ', [order.toAddress, order.toWardName, order.toDistrictName, order.toProvinceName].filter(Boolean).join(', ')],
    ['Thu hộ (COD)', formatVnd(order.codAmount)],
    ['Ai trả ship', PAYMENT_TYPES.find((p) => p.value === order.paymentTypeId)?.label ?? '—'],
    ['Gửi lúc', formatTime(order.submittedAt)],
  ];
  return (
    <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
        <Icon name="check_circle" fill className="text-lg" />
        Đã tạo đơn bên GHN
      </p>
      <dl className="divide-y divide-outline-variant/30 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-3 py-2">
            <dt className="w-28 shrink-0 text-xs text-on-surface-variant">{label}</dt>
            <dd className="min-w-0 flex-1 text-on-surface">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** AI đang đọc ảnh ở job chạy ngầm: trang tự cập nhật khi xong, người dùng có thể rời trang. */
function ReadingState({ count }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-10 text-center">
      <Icon name="progress_activity" className="animate-spin text-3xl text-sky-700" />
      <p className="text-sm font-bold text-sky-900">AI đang đọc {count} ảnh...</p>
      <p className="max-w-sm text-xs text-sky-800">
        Thường mất dưới 1 phút. Bạn có thể rời trang hoặc tạo đơn khác, đơn này sẽ chuyển sang nháp trong danh sách Đơn GHN khi
        đọc xong.
      </p>
      <Link to="/shipping-orders/new" className="text-xs font-bold text-primary hover:underline">
        Tạo đơn khác
      </Link>
    </div>
  );
}

/** /shipping-orders/:id: ảnh bên trái, form bên phải (trường AI không chắc tô vàng), chọn ai trả ship, "Tạo đơn GHN". */
export default function ShippingOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryKey = ['shipping', 'orders', 'detail', String(id)];
  const { data: order, error, refetch } = useQuery({
    queryKey,
    queryFn: () => getOrder(id),
    // AI đọc ảnh ở job chạy ngầm: hỏi lại tới khi đơn thành nháp
    refetchInterval: (q) => (q.state.data?.status === ORDER_STATUS.READING ? POLL_INTERVAL : false),
  });
  const reading = order?.status === ORDER_STATUS.READING;

  // Vừa đọc xong: danh sách đơn cũng cần cập nhật
  const wasReading = useRef(false);
  useEffect(() => {
    if (wasReading.current && !reading) queryClient.invalidateQueries({ queryKey: ['shipping', 'orders', 'list'] });
    wasReading.current = reading;
  }, [reading, queryClient]);
  useSeo({ title: order ? `Đơn ${order.code}` : 'Đơn GHN', noindex: true });

  const [form, setForm] = useState(null);
  const [low, setLow] = useState(new Set());
  const [errors, setErrors] = useState({});
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(null); // 'save' | 'submit' | 'delete'
  const { confirm } = useConfirm();
  const [notice, setNotice] = useState(null);

  // Nạp đơn vào form lần đầu và sau mỗi lần lưu / gửi
  useEffect(() => {
    if (order) {
      setForm(toForm(order));
      setLow(lowConfidence(order));
    }
  }, [order]);

  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/shipping-orders', { replace: true }));

  const changes = useMemo(() => {
    if (!order || !form) return {};
    const base = toForm(order);
    return Object.fromEntries(FORM_FIELDS.filter((k) => String(form[k] ?? '') !== String(base[k] ?? '')).map((k) => [k, form[k]]));
  }, [order, form]);
  const dirty = Object.keys(changes).length > 0;

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setLow((s) => {
      if (!s.has(key)) return s;
      const next = new Set(s);
      next.delete(key);
      return next;
    });
    setErrors(({ [key]: _, ...rest }) => rest);
    setActionError(null);
    setNotice(null);
  };

  const field = (key) => ({ value: form[key] ?? '', onChange: (e) => setField(key, e.target.value), error: errors[key] });

  const applyOrder = (next) => queryClient.setQueryData(queryKey, next);

  const handleError = (err) => {
    const fe = fieldErrors(err);
    setErrors(fe);
    setActionError(Object.keys(fe).length ? 'Vui lòng kiểm tra lại các trường được đánh dấu.' : err.message);
  };

  const save = async () => {
    setBusy('save');
    setActionError(null);
    try {
      applyOrder(await updateOrder(order.id, changes));
      queryClient.invalidateQueries({ queryKey: ['shipping', 'orders', 'list'] });
      setNotice('Đã lưu đơn nháp.');
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!form.paymentTypeId) {
      setErrors((e) => ({ ...e, paymentTypeId: 'Vui lòng chọn ai trả phí ship.' }));
      setActionError('Vui lòng chọn ai trả phí ship.');
      return;
    }
    setBusy('submit');
    setActionError(null);
    try {
      // Lưu chỉnh sửa trước rồi mới gửi GHN
      if (dirty) applyOrder(await updateOrder(order.id, changes));
      applyOrder(await submitOrder(order.id, form.paymentTypeId));
      queryClient.invalidateQueries({ queryKey: ['shipping', 'orders', 'list'] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      handleError(err);
      // GHN từ chối: đơn chuyển "lỗi" kèm lời báo của GHN
      if (err.code === 'GHN_ERROR') refetch();
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!(await confirm('Xoá đơn nháp này?', { confirmLabel: 'Xoá', danger: true }))) return;
    setBusy('delete');
    try {
      await deleteOrder(order.id);
      queryClient.invalidateQueries({ queryKey: ['shipping', 'orders', 'list'] });
      navigate('/shipping-orders', { replace: true });
    } catch (err) {
      setActionError(err.message);
      setBusy(null);
    }
  };

  const editable = order && isOrderEditable(order);
  // Đơn đang đọc ảnh cũng xoá được (tải nhầm ảnh)
  const deletable = editable || reading;
  const disabled = !!busy;

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={goBack}
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-on-surface">{order ? `Đơn ${order.code}` : 'Đơn GHN'}</h1>
        {order && <OrderStatusBadge status={order.status} />}
        {deletable && (
          <button
            type="button"
            onClick={remove}
            disabled={disabled}
            aria-label="Xoá đơn nháp"
            className="mr-1 flex size-9 items-center justify-center rounded-full text-error hover:bg-error-container/40 disabled:opacity-50"
          >
            <Icon name="delete" />
          </button>
        )}
      </header>

      {error ? (
        <div className="p-4">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      ) : !order || !form ? (
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="grid items-start gap-4 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:py-6">
          <OrderImages images={order.images} />

          <div className="space-y-4">
            {reading ? (
              <ReadingState count={order.images.length} />
            ) : order.status === ORDER_STATUS.SUBMITTED ? (
              <SubmittedSummary order={order} />
            ) : (
              <>
                {order.status === ORDER_STATUS.FAILED && order.errorMessage && (
                  <p className="flex items-start gap-2 rounded-xl bg-error-container/60 px-3 py-2.5 text-xs text-on-error-container">
                    <Icon name="error" className="text-base" />
                    <span>
                      <b>GHN từ chối:</b> {order.errorMessage}. Sửa lại thông tin rồi bấm tạo đơn lần nữa.
                    </span>
                  </p>
                )}
                {low.size > 0 && (
                  <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    <Icon name="auto_awesome" className="text-base" />
                    AI đã điền sẵn từ ảnh. Các ô màu vàng cần bạn kiểm tra lại.
                  </p>
                )}

                <Section title="Người nhận">
                  <Highlight active={low.has('toName')}>
                    <TextField label="Tên người nhận *" icon="person" maxLength={255} disabled={disabled} {...field('toName')} />
                  </Highlight>
                  <Highlight active={low.has('toPhone')}>
                    <TextField
                      label="Số điện thoại *"
                      icon="call"
                      inputMode="tel"
                      maxLength={11}
                      disabled={disabled}
                      {...field('toPhone')}
                      onChange={(e) => setField('toPhone', digits(e.target.value))}
                    />
                  </Highlight>
                </Section>

                <Section title="Địa chỉ giao hàng">
                  {order.rawAddress && (
                    <p className="rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
                      <span className="font-semibold text-on-surface">Địa chỉ trong ảnh:</span> {order.rawAddress}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {ADDRESS_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (form.addressType === t.value) return;
                          setField('addressType', t.value);
                          setField('toProvinceId', '');
                          setField('toDistrictId', '');
                          setField('toWardCode', '');
                        }}
                        className={`rounded-xl border px-3 py-2 text-left text-xs font-bold ${
                          form.addressType === t.value
                            ? 'border-primary-container bg-primary-container/10 text-on-surface'
                            : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low'
                        }`}
                      >
                        {t.label}
                        <span className="block text-[10px] font-normal">{t.hint}</span>
                      </button>
                    ))}
                  </div>
                  <LocationFields form={form} setField={setField} errors={errors} low={low} disabled={disabled} />
                  <Highlight active={low.has('toAddress')}>
                    <TextField
                      label="Số nhà, tên đường *"
                      icon="home"
                      maxLength={500}
                      disabled={disabled}
                      {...field('toAddress')}
                    />
                  </Highlight>
                </Section>

                <Section title="Hàng hoá & thu hộ">
                  <TextField label="Tên sản phẩm *" icon="inventory_2" maxLength={500} disabled={disabled} {...field('itemName')} />
                  <Highlight active={low.has('codAmount')}>
                    <TextField
                      label="Tiền thu hộ (COD, VND)"
                      icon="payments"
                      inputMode="numeric"
                      disabled={disabled}
                      hint="Tiền hàng thu khi giao, không gồm phí ship. 0 nếu khách đã chuyển khoản."
                      value={formatMoney(form.codAmount)}
                      error={errors.codAmount}
                      onChange={(e) => setField('codAmount', Math.min(Number(digits(e.target.value) || 0), MAX_COD))}
                    />
                  </Highlight>
                  <TextField
                    label="Khối lượng (gram)"
                    icon="scale"
                    inputMode="numeric"
                    disabled={disabled}
                    hint="Dưới 20kg. Mặc định 2000g."
                    value={form.weight ?? ''}
                    error={errors.weight}
                    onChange={(e) => setField('weight', digits(e.target.value) ? Math.min(Number(digits(e.target.value)), MAX_WEIGHT) : '')}
                  />
                </Section>

                <Section title="Giao hàng">
                  <SelectField label="Ghi chú bắt buộc" disabled={disabled} {...field('requiredNote')}>
                    {REQUIRED_NOTES.map((n) => (
                      <option key={n.value} value={n.value}>
                        {n.label}
                      </option>
                    ))}
                  </SelectField>
                  <Highlight active={low.has('note')}>
                    <TextArea label="Ghi chú cho shipper" rows={3} maxLength={2000} disabled={disabled} {...field('note')} />
                  </Highlight>
                  <fieldset>
                    <legend className="mb-1.5 text-xs font-semibold text-on-surface">Ai trả phí ship? *</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_TYPES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          disabled={disabled}
                          aria-pressed={form.paymentTypeId === p.value}
                          onClick={() => setField('paymentTypeId', p.value)}
                          className={`flex h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-bold ${
                            form.paymentTypeId === p.value
                              ? 'border-primary-container bg-primary-container/10 text-primary'
                              : errors.paymentTypeId
                                ? 'border-error text-on-surface'
                                : 'border-outline-variant/40 text-on-surface hover:bg-surface-container-low'
                          }`}
                        >
                          <Icon name={p.icon} className="text-lg" />
                          {p.label}
                        </button>
                      ))}
                    </div>
                    {errors.paymentTypeId && <p className="mt-1 text-xs text-error">{errors.paymentTypeId}</p>}
                  </fieldset>
                </Section>
              </>
            )}

            {order.status === ORDER_STATUS.SUBMITTED && (
              <Link
                to="/shipping-orders/new"
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary"
              >
                <Icon name="add" className="text-lg" />
                Tạo đơn khác
              </Link>
            )}
          </div>
        </div>
      )}

      {editable && form && (
        <ActionBar
          summary={notice ?? (dirty ? 'Có thay đổi chưa lưu' : `Thu hộ ${formatVnd(form.codAmount || 0)}`)}
          error={actionError}
          loading={busy === 'submit'}
          disabled={!!busy}
          onSubmit={submit}
          label="Tạo đơn GHN"
          icon="local_shipping"
          loadingText="Đang gửi GHN..."
          secondary={
            <button
              type="button"
              onClick={save}
              disabled={!dirty || !!busy}
              className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-outline-variant/50 px-4 text-sm font-bold text-on-surface hover:bg-surface-container disabled:opacity-50"
            >
              {busy === 'save' && <Icon name="progress_activity" className="animate-spin text-base" />}
              Lưu nháp
            </button>
          }
        />
      )}
    </>
  );
}
