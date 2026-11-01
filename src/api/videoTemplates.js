import client from './client';

/*
 * ---- Quản lý video template (note/quan-ly-video-template.txt), cần hồ sơ người bán (403 khi chưa có shop) ----
 * GET    /creator/video-templates?page=&per_page=        -> { data: VideoTemplate[], meta } (mới tạo trước)
 * GET    /creator/video-templates/{id}                   -> { data: VideoTemplate }
 * POST   /creator/video-templates { name, video_url, image_count }    -> 201 { data: VideoTemplate }
 * PUT    /creator/video-templates/{id} { name, video_url, image_count } -> { data: VideoTemplate }
 * DELETE /creator/video-templates/{id}                   -> 204
 * VideoTemplate: { id, name, video_url, image_count, synced, source_key, created_at }. Template của người khác -> 404.
 * synced: đồng bộ từ máy làm template (D:\video-tmp, npm run sync-templates), video_url null; chỉ xem, sửa / xoá -> 409
 * VIDEO_TEMPLATE_SYNCED. Template bị xoá khỏi máy làm template thì ẩn, không có trong danh sách.
 * image_count: số ảnh template cần (bài video lấy đúng số ảnh này, note/lap-lich-worker.txt); null với template cũ.
 * Lỗi 422: errors.name (bắt buộc, <= 150 ký tự), errors.video_url (bắt buộc, link TikTok, <= 500 ký tự),
 * errors.image_count (bắt buộc, 1-35).
 */

export const VIDEO_TEMPLATE_KEYS = {
  all: ['creator', 'video-templates'],
  detail: (id) => ['creator', 'video-templates', 'detail', String(id)],
};

export const VIDEO_TEMPLATE_NAME_MAX = 150;
export const VIDEO_TEMPLATE_IMAGE_MAX = 35;

/** Khớp VideoTemplateController::TIKTOK_URL: tiktok.com, www / m / vt / vm.tiktok.com. */
export const isTikTokUrl = (url) => /^https?:\/\/((www|m|vt|vm)\.)?tiktok\.com(\/\S*)?$/i.test(url.trim());

const mapTemplate = (t) => ({
  id: t.id,
  name: t.name,
  videoUrl: t.video_url ?? '',
  imageCount: t.image_count ?? null,
  synced: Boolean(t.synced),
  createdAt: t.created_at,
});

const toBody = ({ name, videoUrl, imageCount }) => ({ name: name.trim(), video_url: videoUrl.trim(), image_count: Number(imageCount) });

export const listVideoTemplates = ({ page = 1, limit = 20 } = {}) =>
  client.get('/creator/video-templates', { params: { page, per_page: limit } }).then(({ data, meta }) => ({
    items: data.map(mapTemplate),
    page: meta.current_page,
    lastPage: meta.last_page,
  }));

export const getVideoTemplate = (id) => client.get(`/creator/video-templates/${id}`).then(({ data }) => mapTemplate(data));

export const createVideoTemplate = (values) =>
  client.post('/creator/video-templates', toBody(values)).then(({ data }) => mapTemplate(data));

export const updateVideoTemplate = (id, values) =>
  client.put(`/creator/video-templates/${id}`, toBody(values)).then(({ data }) => mapTemplate(data));

export const deleteVideoTemplate = (id) => client.delete(`/creator/video-templates/${id}`);
