import client from './client';

/*
 * ---- Worker admin gắn cho shop (note/quan-ly-worker.txt), cần hồ sơ người bán (403 khi chưa có shop) ----
 * GET /creator/workers -> { data: ShopWorker[] } (theo tên; worker đang tắt không có)
 * PATCH /creator/workers/{id}/name { name } -> ShopWorker. Tên dùng chung (admin + shop khác cùng được gắn thấy tên mới),
 *   duy nhất, tối đa 100 ký tự -> 422 errors["name"]. Worker không gắn cho shop / đang tắt -> 404.
 * POST /creator/workers/{id}/token -> ShopWorker (token mới). Token cũ hết hiệu lực ngay; token dùng chung (admin + shop
 *   khác cùng được gắn thấy token mới). Worker không gắn cho shop / đang tắt -> 404.
 * ShopWorker: { id, name, type: 'image'|'publish', functions: ('image'|'publish'|'video')[], online (gọi API trong 5 phút),
 *   last_seen_at | null,
 *   (publish + video: worker đăng bài ảnh / video được giao và tạo video cho shop, note/gop-luong-dang-bai.txt)
 *   token | null (null: worker tạo trước khi lưu token, liên hệ admin) }
 */

export const WORKER_KEYS = { all: ['creator', 'workers'] };

export const WORKER_FUNCTIONS = {
  image: { label: 'Tạo ảnh', icon: 'image' },
  publish: { label: 'Đăng bài', icon: 'upload' },
  video: { label: 'Tạo video', icon: 'movie' },
};

const mapWorker = (w) => ({
  id: w.id,
  name: w.name,
  // image: tạo ảnh | publish: đăng bài (chọn được ở trang bài đăng), note/quan-ly-worker.txt
  type: w.type ?? (w.functions?.includes('publish') ? 'publish' : 'image'),
  functions: w.functions,
  online: w.online,
  lastSeenAt: w.last_seen_at,
  token: w.token,
});

export const listWorkers = () => client.get('/creator/workers').then(({ data }) => data.map(mapWorker));

export const regenerateWorkerToken = (id) => client.post(`/creator/workers/${id}/token`).then(mapWorker);

export const renameWorker = (id, name) => client.patch(`/creator/workers/${id}/name`, { name }).then(mapWorker);

/*
 * ---- Worker tạo ảnh để chọn khi tạo ảnh / tạo lô (note/chon-worker-tao-anh.txt), mọi tài khoản đã đăng nhập ----
 * GET /image-workers -> { data: [{ id, name, online, last_seen_at }] } (loại image, đang bật, được gắn cho tài khoản, theo tên)
 * Gửi worker_id khi POST /generations, /image-batches, /image-batches/auto. Sai -> 422 errors["worker_id"].
 */
export const IMAGE_WORKER_KEYS = { all: ['image-workers'] };

export const listImageWorkers = () =>
  client.get('/image-workers').then(({ data }) =>
    data.map((w) => ({ id: w.id, name: w.name, online: w.online, lastSeenAt: w.last_seen_at })),
  );
