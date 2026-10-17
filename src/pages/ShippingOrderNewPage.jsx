import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import ActionBar from '../components/common/ActionBar';
import { Skeleton } from '../components/common/Feedback';
import { GHN_SETTINGS_KEY } from '../components/store/GhnSettings';
import { ADDRESS_TYPES, IMAGE_MAX_MB, IMAGE_TYPES, MAX_IMAGES, getGhnSettings, parseOrder } from '../api/shipping';

const imageId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

/**
 * /shipping-orders/new: chọn địa chỉ cũ / mới + tải 1-10 ảnh chat của MỘT đơn -> AI đọc -> sang trang sửa đơn nháp.
 * AI đọc ảnh không trừ credit.
 */
export default function ShippingOrderNewPage() {
  useSeo({ title: 'Tạo đơn GHN từ ảnh', noindex: true });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const { data: settings, isLoading: settingsLoading } = useQuery({ queryKey: GHN_SETTINGS_KEY, queryFn: getGhnSettings });
  const [addressType, setAddressType] = useState('old');
  const [images, setImages] = useState([]); // [{ id, file, url }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/shipping-orders', { replace: true }));

  // Thu hồi URL xem trước khi rời trang
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach((img) => URL.revokeObjectURL(img.url)), []);

  const connected = settings?.hasToken && settings?.shopId;

  const addFiles = (fileList) => {
    setError(null);
    const files = Array.from(fileList ?? []);
    const valid = files.filter((f) => IMAGE_TYPES.includes(f.type) && f.size <= IMAGE_MAX_MB * 1024 * 1024);
    if (valid.length < files.length) setError(`Chỉ nhận ảnh JPG, PNG, WebP, tối đa ${IMAGE_MAX_MB}MB mỗi ảnh.`);
    const room = MAX_IMAGES - images.length;
    if (valid.length > room) setError(`Tối đa ${MAX_IMAGES} ảnh mỗi đơn.`);
    setImages((prev) => [...prev, ...valid.slice(0, room).map((file) => ({ id: imageId(), file, url: URL.createObjectURL(file) }))]);
  };

  const removeImage = (id) =>
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.url);
      return prev.filter((i) => i.id !== id);
    });

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const order = await parseOrder(
        images.map((i) => i.file),
        addressType,
      );
      queryClient.invalidateQueries({ queryKey: ['shipping', 'orders'] });
      navigate(`/shipping-orders/${order.id}`, { replace: true });
    } catch (err) {
      setError(err?.message || 'Không đọc được ảnh, vui lòng thử lại.');
      setLoading(false);
    }
  };

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
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-on-surface">Tạo đơn GHN từ ảnh</h1>
      </header>

      <div className="space-y-5 p-4 lg:py-6">
        {settingsLoading ? (
          <Skeleton className="h-14" />
        ) : (
          !connected && (
            <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <Icon name="link_off" className="text-base" />
              <span className="flex-1">Bạn chưa kết nối GHN.</span>
              <Link to="/seller/settings" className="font-bold text-primary hover:underline">
                Kết nối ngay
              </Link>
            </p>
          )
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-on-surface">Kiểu địa chỉ người nhận</h2>
          <div className="grid grid-cols-2 gap-2">
            {ADDRESS_TYPES.map((t) => (
              <label
                key={t.value}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition-colors ${
                  addressType === t.value
                    ? 'border-primary-container bg-primary-container/10'
                    : 'border-outline-variant/40 hover:bg-surface-container-low'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
                  <input
                    type="radio"
                    name="address_type"
                    value={t.value}
                    checked={addressType === t.value}
                    onChange={() => setAddressType(t.value)}
                    className="text-primary-container focus:ring-primary-container/30"
                  />
                  {t.label}
                </span>
                <span className="text-[11px] text-on-surface-variant">{t.hint}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-bold text-on-surface">Ảnh chụp đoạn chat với khách</h2>
            <p className="text-xs text-on-surface-variant">
              Tất cả ảnh là của <b>một đơn hàng</b>, tối đa {MAX_IMAGES} ảnh. AI sẽ đọc tên, số điện thoại, địa chỉ và tổng
              tiền; bạn xem lại và sửa trước khi gửi GHN.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {images.map((img, i) => (
              <div key={img.id} className="relative aspect-[9/16] overflow-hidden rounded-xl bg-surface-container">
                <img src={img.url} alt={`Ảnh ${i + 1}`} className="size-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
                {!loading && (
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    aria-label={`Xoá ảnh ${i + 1}`}
                    className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <Icon name="close" className="text-base" />
                  </button>
                )}
              </div>
            ))}
            {images.length < MAX_IMAGES && !loading && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex aspect-[9/16] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-outline-variant/60 text-on-surface-variant hover:border-primary-container hover:text-primary"
              >
                <Icon name="add_photo_alternate" className="text-3xl" />
                <span className="text-xs font-semibold">Thêm ảnh</span>
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </section>
      </div>

      <ActionBar
        summary={
          loading ? (
            'Đang tải ảnh lên...'
          ) : images.length ? (
            <>
              Đã chọn <b className="text-on-surface">{images.length}</b>/{MAX_IMAGES} ảnh
            </>
          ) : (
            'Chưa chọn ảnh nào'
          )
        }
        error={error}
        disabled={!images.length || !connected}
        loading={loading}
        onSubmit={submit}
        label="Đọc ảnh & tạo đơn nháp"
        icon="document_scanner"
        loadingText="Đang tải ảnh..."
      />
    </>
  );
}
