import client from './client';

/*
 * ---- Đăng bài TikTok (cần đăng nhập) ----
 * Đặc tả: note/dang-tiktok-qua-worker.txt (bản mới nhất), note/nghiep-vu-dang-bai-tiktik.txt (bài đăng).
 * Ảnh của bài lấy từ lô ảnh (src/api/batches.js) hoặc lịch sử tạo ảnh.
 * Không dùng API TikTok: bấm đăng thì backend tạo job tiktok_publish, worker (FlowKit) giữ tài khoản TikTok
 * của A51 nhận job, mở TikTok Studio và LƯU NHÁP bài. Người dùng không chọn / không cần kết nối tài khoản TikTok.
 *
 * GET    /tiktok/posts?page=&per_page=&status=           -> { data: TikTokPost[], meta }
 * GET    /tiktok/posts/{id}                              -> { data: TikTokPost }
 * POST   /tiktok/posts/from-images                       -> 201 { data: TikTokPost }
 * POST   /tiktok/posts/{id}/publish                      -> { data: TikTokPost }   (bài sang queued)
 * DELETE /tiktok/posts/{id}                              -> 204
 */

// Giới hạn theo tài liệu TikTok
export const PHOTO_MAX_COUNT = 35;
export const PHOTO_TITLE_MAX = 90;
export const PHOTO_DESCRIPTION_MAX = 4000;
export const HASHTAG_MAX = 10;

/*
 * Trạng thái bài đăng:
 *   generating      Đang chuẩn bị: A51 viết sẵn nội dung (chỉ khi bật AI viết nội dung)
 *   pending_review  Chờ gửi: chờ người dùng bấm đăng (lần đăng trước lỗi thì có last_error)
 *   queued          Chờ đăng: đã tạo job, chờ worker nhận (không hết hạn). Khoá: không sửa, không xoá
 *   publishing      Đang đăng: worker đang lưu nháp lên TikTok. Khoá: không sửa, không xoá
 *   published       Đã lưu nháp TikTok: A51 dừng theo dõi, nhân viên A51 tự đăng nháp trên TikTok
 */
export const POST_STATUS = {
  GENERATING: 'generating',
  PENDING_REVIEW: 'pending_review',
  QUEUED: 'queued',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
};

// Đã bấm đăng, đang chờ / đang được worker xử lý
export const isPostLocked = (post) => post.status === POST_STATUS.QUEUED || post.status === POST_STATUS.PUBLISHING;

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
 * Đăng TikTok: lưu toàn bộ chỉnh sửa trên trang rồi tạo job cho worker, bài chuyển sang queued (khoá tới khi worker xong).
 * Tiêu đề, nội dung, hashtag không bắt buộc. Worker lỗi thì bài về pending_review với last_error chung, người dùng đăng lại.
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
