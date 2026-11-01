import client from './client';

/*
 * ---- Worker admin gắn cho shop (note/quan-ly-worker.txt), cần hồ sơ người bán (403 khi chưa có shop), chỉ xem ----
 * GET /creator/workers -> { data: ShopWorker[] } (theo tên; worker đang tắt không có)
 * ShopWorker: { id, name, functions: ('image'|'publish'|'video')[],
 *   publish_account: { platform, platform_label, name } | null, online (gọi API trong 5 phút), last_seen_at | null,
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
  functions: w.functions,
  publishAccount: w.publish_account ? { platformLabel: w.publish_account.platform_label, name: w.publish_account.name } : null,
  online: w.online,
  lastSeenAt: w.last_seen_at,
  token: w.token,
});

export const listWorkers = () => client.get('/creator/workers').then(({ data }) => data.map(mapWorker));
