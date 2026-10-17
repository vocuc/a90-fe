import client from './client';

/*
 * ---- Tạo đơn GHN từ ảnh chụp màn hình (cần đăng nhập + hồ sơ người bán) ----
 * Đặc tả: note/tao-don-ghn-tu-anh.txt. Token GHN chỉ lưu ở backend, FE không bao giờ gọi thẳng GHN.
 * AI đọc ảnh: backend gọi thẳng Claude API trong request parse (đồng bộ, không qua worker), không trừ credit.
 *
 * GET    /creator/shipping/ghn-settings                 -> { data: { shop_id, has_token, token_last4 } }
 * PUT    /creator/shipping/ghn-settings                 -> như trên (422 errors.token / errors.shop_id khi sai)
 * GET    /shipping/ghn/provinces?address_type=          -> { data: [{ id, name }] }
 * GET    /shipping/ghn/districts?province_id=           -> { data: [{ id, name }] }   (chỉ địa chỉ cũ)
 * GET    /shipping/ghn/wards?district_id=               -> { data: [{ code, name }] } (địa chỉ cũ)
 * GET    /shipping/ghn/wards?province_id=&address_type=new
 * POST   /creator/shipping-orders/parse                 -> 201 { data: ShippingOrder }  (multipart images[], address_type)
 * GET    /creator/shipping-orders?status=&page=&per_page=
 * GET    /creator/shipping-orders/{id}
 * PUT    /creator/shipping-orders/{id}                  (gửi trường nào sửa trường đó; chỉ khi draft | failed)
 * DELETE /creator/shipping-orders/{id}
 * POST   /creator/shipping-orders/{id}/submit           { payment_type_id } -> đơn submitted | 422 GHN_ERROR (đơn failed)
 */

export const MAX_IMAGES = 10;
export const IMAGE_MAX_MB = 10;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Backend chặn dưới 20kg (GHN service_type_id = 2) và COD tối đa 50 triệu
export const MAX_WEIGHT = 19999;
export const MAX_COD = 50_000_000;

// AI đọc nhiều ảnh mất vài chục giây: không dùng timeout 15s mặc định
const PARSE_TIMEOUT = 120_000;

export const ORDER_STATUS = { DRAFT: 'draft', SUBMITTED: 'submitted', FAILED: 'failed' };
export const isOrderEditable = (order) => order.status !== ORDER_STATUS.SUBMITTED;

export const ADDRESS_TYPES = [
  { value: 'old', label: 'Địa chỉ cũ', hint: 'Tỉnh → Quận/Huyện → Phường/Xã' },
  { value: 'new', label: 'Địa chỉ mới', hint: 'Tỉnh → Phường/Xã (sau sáp nhập 01/07/2025)' },
];

export const PAYMENT_TYPES = [
  { value: 1, label: 'Shop trả ship', icon: 'storefront' },
  { value: 2, label: 'Khách trả ship', icon: 'person' },
];

export const REQUIRED_NOTES = [
  { value: 'CHOXEMHANGKHONGTHU', label: 'Cho xem hàng, không cho thử' },
  { value: 'CHOTHUHANG', label: 'Cho xem và thử hàng' },
  { value: 'KHONGCHOXEMHANG', label: 'Không cho xem hàng' },
];

// ---- Cài đặt GHN ----

const mapSettings = (s) => ({ shopId: s.shop_id, hasToken: s.has_token, tokenLast4: s.token_last4 });

export const getGhnSettings = () => client.get('/creator/shipping/ghn-settings').then(({ data }) => mapSettings(data));

export const saveGhnSettings = ({ token, shopId }) =>
  client.put('/creator/shipping/ghn-settings', { token, shop_id: shopId }).then(({ data }) => mapSettings(data));

// ---- Danh mục địa chỉ (backend gọi GHN, có cache) ----

export const getProvinces = (addressType) =>
  client.get('/shipping/ghn/provinces', { params: { address_type: addressType } }).then(({ data }) => data);

export const getDistricts = (provinceId) =>
  client.get('/shipping/ghn/districts', { params: { province_id: provinceId } }).then(({ data }) => data);

export const getWards = (addressType, parentId) =>
  client
    .get('/shipping/ghn/wards', {
      params: addressType === 'new' ? { province_id: parentId, address_type: 'new' } : { district_id: parentId },
    })
    .then(({ data }) => data);

// ---- Đơn vận chuyển ----

const mapOrder = (o) => ({
  id: o.id,
  code: o.code,
  status: o.status,
  addressType: o.address_type,
  toName: o.to_name ?? '',
  toPhone: o.to_phone ?? '',
  toAddress: o.to_address ?? '',
  toProvinceId: o.to_province_id,
  toProvinceName: o.to_province_name,
  toDistrictId: o.to_district_id,
  toDistrictName: o.to_district_name,
  toWardCode: o.to_ward_code,
  toWardName: o.to_ward_name,
  rawAddress: o.raw_address ?? '',
  itemName: o.item_name ?? '',
  codAmount: o.cod_amount ?? 0,
  weight: o.weight,
  requiredNote: o.required_note,
  paymentTypeId: o.payment_type_id,
  note: o.note ?? '',
  lowConfidenceFields: o.low_confidence_fields ?? [],
  images: o.images ?? [],
  ghnOrderCode: o.ghn_order_code,
  shippingFee: o.shipping_fee,
  expectedDeliveryTime: o.expected_delivery_time,
  errorMessage: o.error_message,
  createdAt: o.created_at,
  submittedAt: o.submitted_at,
});

// Tên trường FE -> backend (dùng cho PUT và để đổi lỗi 422 errors.{field} về tên trường form)
export const FIELD_NAMES = {
  addressType: 'address_type',
  toName: 'to_name',
  toPhone: 'to_phone',
  toAddress: 'to_address',
  toProvinceId: 'to_province_id',
  toDistrictId: 'to_district_id',
  toWardCode: 'to_ward_code',
  itemName: 'item_name',
  codAmount: 'cod_amount',
  weight: 'weight',
  requiredNote: 'required_note',
  paymentTypeId: 'payment_type_id',
  note: 'note',
};
const BACKEND_TO_FIELD = Object.fromEntries(Object.entries(FIELD_NAMES).map(([k, v]) => [v, k]));

/** Lỗi 422 { errors: { to_phone: msg } } -> { toPhone: msg }. */
export const fieldErrors = (err) =>
  Object.fromEntries(Object.entries(err?.errors ?? {}).map(([k, msg]) => [BACKEND_TO_FIELD[k] ?? k, msg]));

/** Trường backend AI không chắc -> tên trường form (để tô vàng). */
export const lowConfidence = (order) => new Set(order.lowConfidenceFields.map((f) => BACKEND_TO_FIELD[f] ?? f));

export const listOrders = ({ page = 1, limit = 20, status } = {}) =>
  client.get('/creator/shipping-orders', { params: { page, per_page: limit, status } }).then(({ data, meta }) => ({
    items: data.map(mapOrder),
    page: meta.current_page,
    lastPage: meta.last_page,
    total: meta.total,
  }));

export const getOrder = (id) => client.get(`/creator/shipping-orders/${id}`).then(({ data }) => mapOrder(data));

/** Tải 1-10 ảnh chat của một đơn: AI đọc rồi trả đơn nháp (AI không đọc được thì các trường để trống). */
export const parseOrder = (files, addressType) => {
  const body = new FormData();
  files.forEach((file) => body.append('images[]', file));
  body.append('address_type', addressType);
  return client
    .post('/creator/shipping-orders/parse', body, { timeout: PARSE_TIMEOUT })
    .then(({ data }) => mapOrder(data));
};

/** changes: { toName, toProvinceId, ... } (chỉ các trường đã sửa). */
export const updateOrder = (id, changes) =>
  client
    .put(
      `/creator/shipping-orders/${id}`,
      Object.fromEntries(Object.entries(changes).map(([k, v]) => [FIELD_NAMES[k], v === '' ? null : v])),
    )
    .then(({ data }) => mapOrder(data));

export const submitOrder = (id, paymentTypeId) =>
  client.post(`/creator/shipping-orders/${id}/submit`, { payment_type_id: paymentTypeId }).then(({ data }) => mapOrder(data));

export const deleteOrder = (id) => client.delete(`/creator/shipping-orders/${id}`);
