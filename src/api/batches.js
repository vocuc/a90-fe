import client from './client';
import { appendInputs } from './services';
import { mapImage } from './tiktok';

/*
 * ---- Tạo ảnh theo lô (cần đăng nhập) ----
 * Đặc tả: note/tach-lo-anh-dang-tiktok.txt. Lô tạo một lần từ nhiều mẫu (mỗi mẫu một lần, nhập nguyên liệu một lần,
 * tạo N ảnh). Sau đó chỉ tạo lại / sửa nguyên liệu / xoá từng ảnh, hoặc xoá cả lô. Nút "Đăng TikTok" của lô tạo bài
 * bằng createPostFromImages (src/api/tiktok.js); lô và bài độc lập.
 *
 * GET    /image-batches?page=&per_page=                         -> { data: ImageBatch[] (không có images), meta }
 * GET    /image-batches/{id}                                    -> { data: ImageBatch }
 * POST   /image-batches (multipart)                             -> 201 { data: ImageBatch }
 * DELETE /image-batches/{id}                                    -> 204
 * GET    /image-batches/{id}/images/{imageId}/inputs            -> { data: { creative, inputs } }
 * POST   /image-batches/{id}/images/{imageId}/regenerate        -> 202 { data: Image }
 * DELETE /image-batches/{id}/images/{imageId}                   -> 204
 * POST   /image-batches/{id}/images/{imageId}/crop (multipart)  -> 200 { data: Image }
 */

export const BATCH_STATUS = {
  GENERATING: 'generating',
  COMPLETED: 'completed',
};

const UPLOAD_TIMEOUT = 60_000;

const mapBatch = (b) => ({
  id: b.id,
  status: b.status,
  imageCount: b.image_count ?? 0,
  generatingCount: b.generating_count ?? 0,
  failedCount: b.failed_count ?? 0,
  coverUrl: b.cover_url ?? null,
  postCount: b.post_count ?? 0,
  images: (b.images ?? []).map(mapImage),
  createdAt: b.created_at,
});

/** Mới nhất trước, có phân trang. */
export const listBatches = ({ page = 1, limit = 20 } = {}) =>
  client.get('/image-batches', { params: { page, per_page: limit } }).then(({ data, meta }) => ({
    items: data.map(mapBatch),
    page: meta.current_page,
    lastPage: meta.last_page,
    total: meta.total,
  }));

export const getBatch = (id) => client.get(`/image-batches/${id}`).then(({ data }) => mapBatch(data));

/*
 * Giá trị form (DynamicForm) -> inputs gửi đi. Trường ảnh trong form là mảng gồm File (ảnh mới tải lên) hoặc
 * ảnh đã lưu { fileId, url, name } (lấy từ getBatchImageInputs). Ảnh đã lưu gửi bằng keep_files[key][]=fileId.
 * Backend chỉ hỗ trợ trường ảnh 1 file (type image); image_set chưa hỗ trợ nên bỏ qua.
 */
const isFile = (v) => typeof Blob !== 'undefined' && v instanceof Blob;

const splitInputs = (schema, values) => {
  const inputs = {};
  const keepFiles = {};
  schema.forEach((f) => {
    const value = values[f.key];
    if (f.type === 'image_set') return;
    if (f.type === 'image' || f.type === 'image_list') {
      const list = value ?? [];
      const files = list.filter(isFile);
      const kept = list.filter((v) => !isFile(v) && v?.fileId).map((v) => v.fileId);
      if (files.length) inputs[f.key] = f.type === 'image' ? files[0] : files;
      else if (kept.length) keepFiles[f.key] = kept;
      return;
    }
    inputs[f.key] = value;
  });
  return { inputs, keepFiles };
};

/**
 * Tạo lô: trừ tổng phí ngay, ảnh tạo ở nền (status generating).
 * items: [{ creativeId (số), schema (input_schema), values (giá trị form), quantity }]
 */
export function createBatch(items, idempotencyKey) {
  const form = new FormData();
  items.forEach(({ creativeId, schema, values, quantity }, i) => {
    form.append(`items[${i}][creative_id]`, creativeId);
    form.append(`items[${i}][quantity]`, quantity);
    appendInputs(form, splitInputs(schema, values).inputs, `items[${i}][inputs]`);
  });
  form.append('idempotency_key', idempotencyKey);
  return client.post('/image-batches', form, { timeout: UPLOAD_TIMEOUT }).then(({ data }) => mapBatch(data));
}

/**
 * Nguyên liệu đã dùng để tạo ảnh, đổi sang giá trị form: trường ảnh -> [{ fileId, url, name }].
 * Trả { creative, values } ; values = null khi không còn nguyên liệu (file đã bị xoá theo chính sách lưu trữ).
 */
export const getBatchImageInputs = (batchId, image) =>
  client.get(`/image-batches/${batchId}/images/${image.id}/inputs`).then(({ data }) => ({
    creative: data.creative,
    values: data.inputs
      ? Object.fromEntries(
          Object.entries(data.inputs).map(([key, v]) => [
            key,
            Array.isArray(v) && v.some((x) => x && typeof x === 'object' && 'file_id' in x)
              ? v.map((x) => ({ fileId: x.file_id, url: x.url, name: x.name }))
              : v,
          ]),
        )
      : null,
  }));

/**
 * Tạo lại một ảnh của lô (tính phí như lần tạo đầu). Ảnh mới thay vào đúng vị trí cũ (cùng id), status queued:
 * trang tự hỏi lại lô tới khi ảnh xong. Bài TikTok đã tạo từ lô không đổi.
 * edit: { schema, values } khi người dùng sửa nguyên liệu; bỏ trống = dùng lại nguyên liệu cũ.
 */
export function regenerateBatchImage(batchId, image, idempotencyKey, edit) {
  const url = `/image-batches/${batchId}/images/${image.id}/regenerate`;
  if (!edit) return client.post(url, { idempotency_key: idempotencyKey }).then(({ data }) => mapImage(data));

  const { inputs, keepFiles } = splitInputs(edit.schema, edit.values);
  const form = new FormData();
  appendInputs(form, inputs);
  Object.entries(keepFiles).forEach(([key, ids]) => ids.forEach((id) => form.append(`keep_files[${key}][]`, id)));
  form.append('idempotency_key', idempotencyKey);
  return client.post(url, form, { timeout: UPLOAD_TIMEOUT }).then(({ data }) => mapImage(data));
}

/**
 * "Cắt ảnh": ảnh đã cắt trên trình duyệt ghi đè ảnh gốc (không tính phí, đổi cả ảnh trong lịch sử tạo ảnh và bài TikTok dùng ảnh này). file: Blob JPEG.
 * Máy chủ trả ảnh với image_url / thumb_url mới (file mới, url khác nên trình duyệt không dùng ảnh cache).
 */
export function cropBatchImage(batchId, image, file) {
  const form = new FormData();
  form.append('image', file, `crop_${image.id}.jpg`);
  return client
    .post(`/image-batches/${batchId}/images/${image.id}/crop`, form, { timeout: UPLOAD_TIMEOUT })
    .then(({ data }) => mapImage(data));
}

/** Xoá một ảnh khỏi lô (ảnh vẫn còn trong lịch sử tạo ảnh). Lô phải còn ít nhất 1 ảnh. */
export const deleteBatchImage = (batchId, image) => client.delete(`/image-batches/${batchId}/images/${image.id}`);

/** Xoá lô khi không còn ảnh đang tạo. Bài TikTok đã tạo và ảnh trong lịch sử tạo ảnh vẫn giữ. */
export const deleteBatch = (id) => client.delete(`/image-batches/${id}`);
