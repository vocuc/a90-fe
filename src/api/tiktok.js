import client from './client';

/*
 * ---- Đăng bài TikTok (cần đăng nhập) ----
 * Đặc tả: note/nghiep-vu-dang-bai-tiktik.txt (bài đăng), note/uy-quyen-tiktok.txt (ủy quyền OAuth).
 * Ảnh của bài lấy từ lô ảnh (src/api/batches.js) hoặc lịch sử tạo ảnh.
 * Backend giữ access token TikTok, gọi Content Posting API ở chế độ Upload (MEDIA_UPLOAD, scope video.upload):
 * bài được gửi vào hộp thư TikTok của người dùng, người dùng mở app TikTok để hoàn tất và đăng. Tiêu đề, nội dung,
 * hashtag không bắt buộc, chỉ điền sẵn trong app; quyền xem, bình luận, nhạc do người dùng chọn trong app.
 *
 * GET    /tiktok/account                                 -> { data: { connected, reason, account, creator } }
 * POST   /tiktok/oauth/authorize { redirect }            -> { data: { url } }
 * DELETE /tiktok/account                                 -> 204
 * GET    /tiktok/posts?page=&per_page=&status=           -> { data: TikTokPost[], meta }
 * GET    /tiktok/posts/{id}                              -> { data: TikTokPost }
 * POST   /tiktok/posts/from-images                       -> 201 { data: TikTokPost }
 * POST   /tiktok/posts/{id}/publish                      -> { data: TikTokPost }
 * DELETE /tiktok/posts/{id}                              -> 204
 */

// Giới hạn theo tài liệu TikTok
export const PHOTO_MAX_COUNT = 35;
export const PHOTO_TITLE_MAX = 90;
export const PHOTO_DESCRIPTION_MAX = 4000;
export const HASHTAG_MAX = 10;

/*
 * Trạng thái bài đăng:
 *   generating      Đang tạo ảnh: AI tạo ảnh (chỉ khi chọn tạo ảnh mới)
 *   pending_review  Chờ gửi: ảnh đã xong, chờ người dùng bấm gửi sang TikTok
 *   publishing      Đang gửi: đã gửi lên TikTok, chờ TikTok phản hồi
 *   published       Đã gửi vào hộp thư TikTok, người dùng mở app TikTok để đăng
 */
export const POST_STATUS = {
  GENERATING: 'generating',
  PENDING_REVIEW: 'pending_review',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
};

// Trạng thái ảnh trong bài
export const IMAGE_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};
export const isImageBusy = (img) => img.status === IMAGE_STATUS.QUEUED || img.status === IMAGE_STATUS.PROCESSING;

/** Khoá chống tạo trùng: tạo 1 lần cho mỗi lần bấm, bấm lại do lỗi mạng thì dùng lại khoá cũ. */
export const newIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ---- Ủy quyền TikTok ----

/**
 * Trạng thái ủy quyền + thông tin creator (backend lấy mới từ TikTok mỗi lần gọi). Giữ nguyên snake_case:
 * { connected, reason: not_connected|expired|revoked|scope_missing|null, account, creator }.
 * TikTok lỗi -> 502 code TIKTOK_UNAVAILABLE.
 */
export const getCreatorInfo = () => client.get('/tiktok/account').then(({ data }) => data);

/** Lấy URL ủy quyền rồi chuyển sang TikTok; xong TikTok đưa về {redirect}?tiktok=connected|error&reason=... */
export async function authorizeTikTok(redirect) {
  const { data } = await client.post('/tiktok/oauth/authorize', { redirect });
  window.location.href = data.url;
}

export const disconnectTikTok = () => client.delete('/tiktok/account');

// Thông báo khi TikTok đưa người dùng quay về trang (?tiktok=connected | error&reason=...)
export const OAUTH_RESULT_MESSAGES = {
  connected: 'Đã kết nối tài khoản TikTok.',
  access_denied: 'Bạn đã huỷ ủy quyền TikTok.',
  scope_missing: 'Cần cho phép quyền tải nội dung lên để A51 gửi bài sang TikTok. Vui lòng ủy quyền lại.',
  state_invalid: 'Phiên ủy quyền đã hết hạn, vui lòng thử lại.',
  server_error: 'Không kết nối được TikTok, vui lòng thử lại sau.',
};

// ---- Bài đăng ----

const mapCreative = (c) => (c ? { creativeId: c.id, creativeSlug: c.slug, creativeTitle: c.title, price: c.price_per_image ?? 0 } : {});

export const mapImage = (img) => ({
  // id ảnh trong bài, giữ nguyên khi tạo lại; ảnh vừa thêm ở bước duyệt (chưa lưu) có id null
  id: img.id,
  // Khoá theo ảnh gốc trong lịch sử tạo ảnh, dùng để không chọn trùng
  key: `${img.generation_id}_${img.output_id}`,
  position: img.position,
  generationId: img.generation_id,
  outputId: img.output_id,
  status: img.status,
  url: img.image_url,
  thumbUrl: img.thumb_url || img.image_url,
  errorMessage: img.error_message ?? null,
  creativeSlug: null,
  creativeTitle: null,
  price: 0,
  ...mapCreative(img.creative),
});

const mapPost = (p) => ({
  id: p.id,
  status: p.status,
  source: p.source,
  imageBatchId: p.image_batch_id ?? null,
  title: p.title ?? '',
  content: p.content ?? '',
  hashtags: p.hashtags ?? [],
  imageCount: p.image_count ?? p.images?.length ?? 0,
  coverUrl: p.cover_url,
  images: (p.images ?? []).map(mapImage),
  lastError: p.last_error,
  tiktokUsername: p.tiktok_username,
  createdAt: p.created_at,
  publishedAt: p.published_at,
});

/** Mới nhất trước, có phân trang. */
export const listPosts = ({ page = 1, limit = 20, status } = {}) =>
  client.get('/tiktok/posts', { params: { page, per_page: limit, status } }).then(({ data, meta }) => ({
    items: data.map(mapPost),
    page: meta.current_page,
    lastPage: meta.last_page,
    total: meta.total,
  }));

export const getPost = (id) => client.get(`/tiktok/posts/${id}`).then(({ data }) => mapPost(data));

/**
 * Tạo bài từ ảnh của một lô hoặc ảnh đã có trên A51 (không tính phí): bài chờ người dùng gửi sang TikTok.
 * images: [{ generationId, outputId }] theo thứ tự, ảnh đầu làm ảnh bìa. batchId: lô tạo ra bài (nút "Đăng TikTok" của lô).
 */
export const createPostFromImages = (images, idempotencyKey, batchId = null) =>
  client
    .post('/tiktok/posts/from-images', {
      images: images.map((i) => ({ generation_id: i.generationId, output_id: i.outputId })),
      image_batch_id: batchId ?? undefined,
      idempotency_key: idempotencyKey,
    })
    .then(({ data }) => mapPost(data));

/**
 * Gửi sang TikTok: lưu toàn bộ chỉnh sửa trên trang rồi tải ảnh vào hộp thư TikTok của người dùng, bài chuyển sang publishing.
 * Tiêu đề, nội dung, hashtag không bắt buộc (điền sẵn trong app TikTok). Gửi lỗi thì chỉnh sửa vẫn được lưu và bài có last_error.
 */
export const publishPost = (id, form) =>
  client
    .post(`/tiktok/posts/${id}/publish`, {
      title: form.title,
      content: form.content,
      hashtags: form.hashtags,
      images: form.images.map((img) =>
        img.id ? { image_id: img.id } : { generation_id: img.generationId, output_id: img.outputId },
      ),
    })
    .then(({ data }) => mapPost(data));

export const deletePost = (id) => client.delete(`/tiktok/posts/${id}`);
