import client from './client';

/*
 * ---- Đăng bài lên TikTok / Facebook / Instagram (cần đăng nhập) ----
 * Đặc tả: note/dang-bai-da-nen-tang.txt (bản mới nhất), note/nghiep-vu-dang-bai-tiktik.txt (bài đăng).
 * Ảnh của bài lấy từ lô ảnh (src/api/batches.js) hoặc lịch sử tạo ảnh.
 * Không dùng API của các nền tảng: bấm đăng thì backend tạo 1 job / nền tảng đã chọn, mỗi worker (FlowKit) giữ
 * một tài khoản của một nền tảng (admin gắn cho tài khoản A51) nhận job và đăng bài (TikTok: LƯU NHÁP).
 *
 * GET    /social/accounts                                -> { data: PublishAccount[] }  (nền tảng admin đã gắn)
 * GET    /social/posts?page=&per_page=&status=           -> { data: SocialPost[], meta }
 * GET    /social/posts/{id}                              -> { data: SocialPost }
 * POST   /social/posts/from-images                       -> 201 { data: SocialPost }
 * POST   /social/posts/{id}/publish                      -> { data: SocialPost }   (các nền tảng chọn sang queued)
 * DELETE /social/posts/{id}                              -> 204
 */

// Giới hạn chung khi soạn bài (lớn nhất trong các nền tảng); giới hạn riêng từng nền tảng ở PLATFORMS
export const PHOTO_MAX_COUNT = 35;
export const PHOTO_TITLE_MAX = 90;
export const PHOTO_DESCRIPTION_MAX = 4000;
export const HASHTAG_MAX = 10;

/*
 * Nền tảng đăng bài, cùng thứ tự và giới hạn với backend (App\Enums\SocialPlatform).
 * maxImages: số ảnh tối đa; descriptionMax: nội dung + dòng hashtag tối đa; doneLabel: nhãn khi đăng xong.
 */
export const PLATFORMS = [
  { value: 'tiktok', label: 'TikTok', icon: 'music_note', maxImages: 35, descriptionMax: 4000, doneLabel: 'Đã lưu nháp' },
  { value: 'facebook', label: 'Facebook', icon: 'thumb_up', maxImages: 35, descriptionMax: 63206, doneLabel: 'Đã đăng' },
  { value: 'instagram', label: 'Instagram', icon: 'photo_camera', maxImages: 10, descriptionMax: 2200, doneLabel: 'Đã đăng' },
];
export const platformInfo = (value) => PLATFORMS.find((p) => p.value === value) ?? { value, label: value, icon: 'public', doneLabel: 'Đã đăng' };

/*
 * Trạng thái chung của bài:
 *   generating      Đang chuẩn bị: A51 viết sẵn nội dung (chỉ khi bật AI viết nội dung)
 *   pending_review  Chờ gửi: chờ người dùng bấm đăng (đăng lần trước có nền tảng lỗi thì có last_error)
 *   queued          Chờ đăng: đã tạo job, chờ worker nhận (không hết hạn). Khoá: không sửa, không xoá
 *   publishing      Đang đăng: có worker đang đăng ít nhất 1 nền tảng. Khoá: không sửa, không xoá
 *   published       Đã đăng xong mọi nền tảng đã chọn (TikTok: đã lưu nháp, nhân viên A51 tự đăng nháp)
 */
export const POST_STATUS = {
  GENERATING: 'generating',
  PENDING_REVIEW: 'pending_review',
  QUEUED: 'queued',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
};

// Trạng thái bài trên từng nền tảng (post.platforms[platform].status)
export const PLATFORM_STATUS = {
  QUEUED: 'queued',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
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

// ---- Tài khoản đăng bài ----

/** Nền tảng admin đã gắn tài khoản cho người dùng: trang đăng bài chọn sẵn các nền tảng này. */
export const getAccounts = () =>
  client.get('/social/accounts').then(({ data }) =>
    data.map((a) => ({ platform: a.platform, label: a.label, name: a.name, username: a.username, isActive: a.is_active })),
  );

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

/** { tiktok: { status, ... } } -> [{ platform, status, postUrl, error, finishedAt }] theo thứ tự PLATFORMS. */
const mapPlatforms = (platforms) =>
  PLATFORMS.filter((p) => platforms?.[p.value]).map((p) => {
    const s = platforms[p.value];
    return { platform: p.value, status: s.status, postUrl: s.post_url ?? null, error: s.error ?? null, finishedAt: s.finished_at ?? null };
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
  platforms: mapPlatforms(p.platforms),
  lastError: p.last_error,
  createdAt: p.created_at,
  publishedAt: p.published_at,
});

/** Mới nhất trước, có phân trang. */
export const listPosts = ({ page = 1, limit = 20, status } = {}) =>
  client.get('/social/posts', { params: { page, per_page: limit, status } }).then(({ data, meta }) => ({
    items: data.map(mapPost),
    page: meta.current_page,
    lastPage: meta.last_page,
    total: meta.total,
  }));

export const getPost = (id) => client.get(`/social/posts/${id}`).then(({ data }) => mapPost(data));

/**
 * Tạo bài từ ảnh của một lô hoặc ảnh đã có trên A51 (không tính phí): bài chờ người dùng chọn nền tảng và đăng.
 * images: [{ generationId, outputId }] theo thứ tự, ảnh đầu làm ảnh bìa. batchId: lô tạo ra bài (nút "Tạo bài đăng" của lô).
 */
export const createPostFromImages = (images, idempotencyKey, batchId = null) =>
  client
    .post('/social/posts/from-images', {
      images: images.map((i) => ({ generation_id: i.generationId, output_id: i.outputId })),
      image_batch_id: batchId ?? undefined,
      idempotency_key: idempotencyKey,
    })
    .then(({ data }) => mapPost(data));

/**
 * Đăng bài: lưu toàn bộ chỉnh sửa trên trang rồi tạo 1 job / nền tảng trong form.platforms, bài chuyển sang queued
 * (khoá tới khi worker xong). Tiêu đề, nội dung, hashtag không bắt buộc. Nền tảng lỗi: xong hết thì bài về
 * pending_review với last_error, người dùng đăng lại các nền tảng lỗi (nền tảng đã đăng xong không đăng lại được).
 */
export const publishPost = (id, form) =>
  client
    .post(`/social/posts/${id}/publish`, {
      title: form.title,
      content: form.content,
      hashtags: form.hashtags,
      platforms: form.platforms,
      images: form.images.map((img) =>
        img.id ? { image_id: img.id } : { generation_id: img.generationId, output_id: img.outputId },
      ),
    })
    .then(({ data }) => mapPost(data));

export const deletePost = (id) => client.delete(`/social/posts/${id}`);
