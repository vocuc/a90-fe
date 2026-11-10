import client from './client';
import { mapBatch } from './batches';

/*
 * ---- Tạo lô tự động (cần đăng nhập) ----
 * Đặc tả: note/auto-tao-lo.txt. Sản phẩm và nhóm creative chỉ dành cho Creator (middleware "creator", 403 khi chưa có shop).
 * Mỗi lô = 1 sản phẩm x các creative Đang bán của 1 nhóm, mỗi creative 1 ảnh; ảnh sản phẩm điền vào trường ảnh có
 * key = field_key. N lô = N sản phẩm ngẫu nhiên ghép N nhóm ngẫu nhiên, không lặp sản phẩm / nhóm (ít hơn N khi không đủ).
 * Xem trước trả seed; gửi lại seed khi tạo để tạo đúng các lô đã xem.
 *
 * GET    /creator/products?page=&per_page=        -> { data: Product[], meta }
 * POST   /creator/products (multipart)            name?, prompt_note?, hashtags[]?, images[i][file], images[i][field_key] -> 201 { data: Product }
 * POST   /creator/products/{id} (multipart)       như trên, images[i][id] (giữ ảnh cũ) thay cho file; không gửi hashtags / prompt_note = bỏ
 *          prompt_note: "Yêu cầu" (tối đa PROMPT_NOTE_MAX ký tự), backend nối vào cuối prompt của mọi Creative khi tạo ảnh
 *          cho sản phẩm (generations.product_id: lô tay, lô tự động, tạo lại); quá dài -> 422 errors["prompt_note"]
 * DELETE /creator/products/{id}                   -> 204
 * PUT    /creator/products/{id}/active            { is_active } -> { data: Product }; sản phẩm tắt không được tạo tự động
 * GET    /creator/creative-groups                 -> { data: CreativeGroup[] } (cũ nhất trước = thứ tự tạo lô)
 * POST   /creator/creative-groups                 { name, creative_ids } -> 201 ; PUT /creator/creative-groups/{id}
 * DELETE /creator/creative-groups/{id}            -> 204
 * GET    /image-batches/auto/preview?count=&seed=&product_ids[]= -> { data: { seed, batches: AutoPlan[], total_cost, balance } }
 * POST   /image-batches/auto                      { count, insert_logo, idempotency_key, seed?, worker_id, product_ids? }
 *          product_ids: chỉ ghép lô từ các sản phẩm người dùng chọn thủ công; bỏ trống = mọi sản phẩm
 *          worker_id: worker tạo ảnh cho mọi lô (note/chon-worker-tao-anh.txt), sai -> 422 errors["worker_id"]
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

/** Kết quả lần "Tạo tự động" gần nhất, trang /batches/auto ghi, danh sách lô đọc để hiện thông báo. */
export const AUTO_RESULT_KEY = ['auto-batch-result'];

export const AUTO_STOP = {
  INSUFFICIENT_CREDIT: 'insufficient_credit',
  NO_VALID_PAIR: 'no_valid_pair',
};

// Product::PROMPT_NOTE_MAX ở backend
export const PROMPT_NOTE_MAX = 2000;

const mapProduct = (p) => ({
  id: p.id,
  name: p.name,
  promptNote: p.prompt_note ?? '',
  isActive: p.is_active !== false,
  coverUrl: p.cover_url,
  images: p.images.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumb_url ?? i.url, fieldKey: i.field_key })),
  hashtags: (p.hashtags ?? []).map((h) => h.name),
  autoBatchCount: p.auto_batch_count,
  // Số ảnh đã tạo xong cho sản phẩm (không tính ảnh lỗi / đang tạo / đã tắt)
  generatedImageCount: p.generated_image_count ?? 0,
  // false: sản phẩm người khác chia sẻ cho mình (chỉ tạo ảnh, không sửa / xoá / bật tắt / chia sẻ)
  isOwner: p.is_owner !== false,
  ownerName: p.owner?.name ?? null,
  // Số tài khoản đang được chia sẻ (chỉ chủ sản phẩm có)
  shareCount: p.share_count ?? 0,
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
  createdAt: g.created_at,
});

export const listProducts = ({ page = 1, limit = 20 } = {}) =>
  client.get('/creator/products', { params: { page, per_page: limit } }).then(({ data, meta }) => ({
    items: data.map(mapProduct),
    page: meta.current_page,
    lastPage: meta.last_page,
    total: meta.total,
  }));

/** Mọi sản phẩm của mình (tải hết các trang, 50 sản phẩm / trang), dùng cho ô chọn sản phẩm. */
export async function listAllProducts() {
  const first = await listProducts({ page: 1, limit: 50 });
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.lastPage - 1) }, (_, i) => listProducts({ page: i + 2, limit: 50 })),
  );
  return [first, ...rest].flatMap((p) => p.items);
}

/**
 * Lưu sản phẩm. images: [{ id?, file?, fieldKey }] theo thứ tự hiển thị; ảnh đã lưu gửi id, ảnh mới gửi file.
 * hashtags: tên không có #. id: sửa sản phẩm, bỏ trống: tạo mới.
 */
export function saveProduct({ id, name, promptNote = '', hashtags = [], images }) {
  const form = new FormData();
  if (name) form.append('name', name);
  if (promptNote) form.append('prompt_note', promptNote);
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

/** Công tắc Hoạt động / Tắt: tạo lô tự động chỉ dùng sản phẩm đang hoạt động. */
export const setProductActive = (id, isActive) =>
  client.put(`/creator/products/${id}/active`, { is_active: isActive }).then(({ data }) => mapProduct(data));

/**
 * Chia sẻ sản phẩm cho tài khoản A51 khác (chỉ chủ sản phẩm):
 * GET /creator/products/{id}/shares -> { data: [{ id, email, name, shared_at }] }
 * PUT /creator/products/{id}/shares { emails: string[] } ghi đè cả danh sách ([] = bỏ hết);
 *   422 errors["emails.i"]: email không phải tài khoản A51 / là chính mình / sai định dạng.
 */
const mapShare = (u) => ({ id: u.id, email: u.email, name: u.name, sharedAt: u.shared_at });

export const listProductShares = (id) => client.get(`/creator/products/${id}/shares`).then(({ data }) => data.map(mapShare));

export const saveProductShares = (id, emails) =>
  client.put(`/creator/products/${id}/shares`, { emails }).then(({ data }) => data.map(mapShare));

const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * GET /creator/products/{id}/images/{imageId}/file -> file ảnh (qua API, cùng domain). Signed URL S3 không tải bằng
 * fetch được (bucket không cho CORS). Trả File để gửi lên như ảnh người dùng tự chọn khi tạo lô tay.
 */
export async function getProductImageFile(productId, image) {
  const blob = await client.get(`/creator/products/${productId}/images/${image.id}/file`, {
    responseType: 'blob',
    timeout: UPLOAD_TIMEOUT,
  });
  const type = blob.type || 'image/jpeg';
  return new File([blob], `${image.fieldKey || `product_${image.id}`}.${IMAGE_EXT[type] ?? 'jpg'}`, { type, lastModified: Date.now() });
}

export const listGroups = () => client.get('/creator/creative-groups').then(({ data }) => data.map(mapGroup));

export function saveGroup({ id, name, creativeIds }) {
  const body = { name, creative_ids: creativeIds };
  const req = id ? client.put(`/creator/creative-groups/${id}`, body) : client.post('/creator/creative-groups', body);
  return req.then(({ data }) => mapGroup(data));
}

export const deleteGroup = (id) => client.delete(`/creator/creative-groups/${id}`);

/** productIds: sản phẩm chọn thủ công, rỗng = mọi sản phẩm. */
export const previewAuto = (count, productIds = []) =>
  client.get('/image-batches/auto/preview', { params: { count, product_ids: productIds.length ? productIds : undefined } }).then(({ data }) => ({
    seed: data.seed,
    batches: data.batches.map((b) => ({
      product: { id: b.product.id, name: b.product.name, coverUrl: b.product.cover_url },
      group: b.group,
      creatives: b.creatives.map((c) => ({ id: c.id, title: c.title, price: c.price_per_image })),
      cost: b.cost,
    })),
    totalCost: data.total_cost,
    balance: data.balance,
  }));

/** seed: của lần xem trước (tạo đúng các lô đã xem); bỏ trống thì hệ thống tự chọn ngẫu nhiên. */
export const createAuto = ({ count, insertLogo, seed, workerId, productIds = [] }, idempotencyKey) =>
  client
    .post('/image-batches/auto', {
      count,
      insert_logo: insertLogo,
      idempotency_key: idempotencyKey,
      seed,
      worker_id: workerId,
      product_ids: productIds.length ? productIds : undefined,
    })
    .then(({ data }) => ({
      batches: data.batches.map(mapBatch),
      requested: data.requested,
      stopped: data.stopped,
      required: data.required,
    }));
