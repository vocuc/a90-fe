import client from './client';
import { mapBatch } from './batches';

/*
 * ---- Tạo lô tự động (cần đăng nhập) ----
 * Đặc tả: note/auto-tao-lo.txt. Sản phẩm và nhóm creative chỉ dành cho Creator (middleware "creator", 403 khi chưa có shop).
 * Nhân viên của shop (note/chia-se-tai-nguyen.txt) xem được (GET) sản phẩm / nhóm của shop chủ (is_owner = false, không
 * sửa / xoá) và tạo lô tự động bằng chúng; lượt tự động (auto_batch_count) đếm riêng từng người.
 * Mỗi lô = 1 sản phẩm x các creative Đang bán của 1 nhóm, mỗi creative 1 ảnh; ảnh sản phẩm điền vào trường ảnh có
 * key = field_key. Sản phẩm ít lượt tự động nhất được tạo trước. Sản phẩm chỉ ghép với nhóm có creative trùng ít nhất
 * một hashtag (tạo cả nhóm); sản phẩm không có hashtag thì bỏ qua.
 *
 * GET    /creator/products?page=&per_page=        -> { data: Product[], meta }
 * POST   /creator/products (multipart)            name?, hashtags[]?, images[i][file], images[i][field_key] -> 201 { data: Product }
 * POST   /creator/products/{id} (multipart)       như trên, images[i][id] (giữ ảnh cũ) thay cho file; không gửi hashtags = bỏ hết
 * DELETE /creator/products/{id}                   -> 204
 * GET    /creator/creative-groups                 -> { data: CreativeGroup[] } (cũ nhất trước = thứ tự tạo lô)
 * POST   /creator/creative-groups                 { name, creative_ids } -> 201 ; PUT /creator/creative-groups/{id}
 * DELETE /creator/creative-groups/{id}            -> 204
 * GET    /image-batches/auto/preview?count=       -> { data: { batches: AutoPlan[], total_cost, balance } }
 * POST   /image-batches/auto                      { count, insert_logo, idempotency_key }
 *          -> 201 { data: { batches: ImageBatch[], requested, stopped: null|insufficient_credit|no_valid_pair, required } }
 *          402 INSUFFICIENT_CREDIT (không tạo được lô nào), 422 AUTO_NOTHING_TO_CREATE.
 */

const UPLOAD_TIMEOUT = 60_000;

export const AUTO_KEYS = {
  products: ['creator', 'products'],
  groups: ['creator', 'creative-groups'],
};

/** Số lô tối đa mỗi lần bấm (khớp AutoBatchService::MAX_COUNT). */
export const AUTO_MAX_COUNT = 100;

export const AUTO_STOP = {
  INSUFFICIENT_CREDIT: 'insufficient_credit',
  NO_VALID_PAIR: 'no_valid_pair',
};

const mapProduct = (p) => ({
  id: p.id,
  name: p.name,
  coverUrl: p.cover_url,
  images: p.images.map((i) => ({ id: i.id, url: i.url, fieldKey: i.field_key })),
  hashtags: (p.hashtags ?? []).map((h) => h.name),
  autoBatchCount: p.auto_batch_count,
  isOwner: p.is_owner ?? true,
  createdAt: p.created_at,
});

const mapGroup = (g) => ({
  id: g.id,
  name: g.name,
  creatives: g.creatives.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    coverUrl: c.cover_url,
    price: c.price_per_image,
    status: c.status,
    isHidden: c.is_hidden,
  })),
  isOwner: g.is_owner ?? true,
  createdAt: g.created_at,
});

export const listProducts = ({ page = 1, limit = 20 } = {}) =>
  client.get('/creator/products', { params: { page, per_page: limit } }).then(({ data, meta }) => ({
    items: data.map(mapProduct),
    page: meta.current_page,
    lastPage: meta.last_page,
    total: meta.total,
  }));

/**
 * Lưu sản phẩm. images: [{ id?, file?, fieldKey }] theo thứ tự hiển thị; ảnh đã lưu gửi id, ảnh mới gửi file.
 * hashtags: tên không có #. id: sửa sản phẩm, bỏ trống: tạo mới.
 */
export function saveProduct({ id, name, hashtags = [], images }) {
  const form = new FormData();
  if (name) form.append('name', name);
  hashtags.forEach((h) => form.append('hashtags[]', h));
  images.forEach((img, i) => {
    if (img.file) form.append(`images[${i}][file]`, img.file);
    else form.append(`images[${i}][id]`, img.id);
    form.append(`images[${i}][field_key]`, img.fieldKey);
  });
  const url = id ? `/creator/products/${id}` : '/creator/products';
  return client.post(url, form, { timeout: UPLOAD_TIMEOUT }).then(({ data }) => mapProduct(data));
}

export const deleteProduct = (id) => client.delete(`/creator/products/${id}`);

export const listGroups = () => client.get('/creator/creative-groups').then(({ data }) => data.map(mapGroup));

export function saveGroup({ id, name, creativeIds }) {
  const body = { name, creative_ids: creativeIds };
  const req = id ? client.put(`/creator/creative-groups/${id}`, body) : client.post('/creator/creative-groups', body);
  return req.then(({ data }) => mapGroup(data));
}

export const deleteGroup = (id) => client.delete(`/creator/creative-groups/${id}`);

export const previewAuto = (count) =>
  client.get('/image-batches/auto/preview', { params: { count } }).then(({ data }) => ({
    batches: data.batches.map((b) => ({
      product: { id: b.product.id, name: b.product.name, coverUrl: b.product.cover_url },
      group: b.group,
      creatives: b.creatives.map((c) => ({ id: c.id, title: c.title, price: c.price_per_image })),
      cost: b.cost,
    })),
    totalCost: data.total_cost,
    balance: data.balance,
  }));

export const createAuto = ({ count, insertLogo }, idempotencyKey) =>
  client
    .post('/image-batches/auto', { count, insert_logo: insertLogo, idempotency_key: idempotencyKey })
    .then(({ data }) => ({
      batches: data.batches.map(mapBatch),
      requested: data.requested,
      stopped: data.stopped,
      required: data.required,
    }));
