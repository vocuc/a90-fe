import client from './client';

/*
 * ---- Bài đăng ảnh / video, giao cho worker (cần đăng nhập) ----
 * Đặc tả: note/gop-luong-dang-bai.txt (bản mới nhất), note/lap-lich-worker.txt (bài video).
 * Ảnh của bài lấy từ lô ảnh (src/api/batches.js) hoặc lịch sử tạo ảnh.
 * Bấm đăng: chọn worker (thanh tiêu đề trang bài), loại bài (ảnh / video + template), nền tảng (một hoặc nhiều), giờ đăng
 * (mặc định bây giờ). Bài sang "Chờ đăng" (còn sửa / xoá được); tới giờ worker nhận 1 job chứa mọi nền tảng, tự đăng
 * bằng tài khoản trên máy rồi báo lại 1 lần. Lỗi -> "Chờ gửi" kèm last_error; worker im lặng -> "Tạo lại".
 *
 * GET    /social/posts?page=&per_page=&status=&type=&worker_id=&source= -> { data: SocialPost[], meta }
 *        (source: batch | existing | video | lookbook; lookbook = bài skill FlowKit tạo, ảnh upload thẳng)
 * GET    /social/posts/{id}                              -> { data: SocialPost }
 * POST   /social/posts/from-images                       -> 201 { data: SocialPost }
 * POST   /social/posts/{id}/publish { worker_id, type, video_template_id?, product_id?, platforms, scheduled_at, images,
 *        title, content, hashtags }                       -> { data: SocialPost }   (bài sang queued)
 * POST   /social/posts/{id}/retry                        -> { data: SocialPost }   "Đăng lại" (lỗi) / "Tạo lại" (đang đăng)
 * POST   /social/posts/{id}/ai-content                   -> { data: { title, content, hashtags } }
 *        "Viết lại bằng AI": không lưu vào bài (note/ai-viet-noi-dung-bai-dang.txt)
 * GET    /creator/ai-content                             -> { data: AiContentSettings }  (trang "AI viết nội dung", chủ shop)
 * PUT    /creator/ai-content { hashtags, samples, requirements, title_max, content_max } -> như trên
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
  { value: 'tiktok', label: 'TikTok', icon: 'music_note', maxImages: 35, descriptionMax: 4000, doneLabel: 'Đã đăng' },
  { value: 'facebook', label: 'Facebook', icon: 'thumb_up', maxImages: 35, descriptionMax: 63206, doneLabel: 'Đã đăng' },
  { value: 'instagram', label: 'Instagram', icon: 'photo_camera', maxImages: 10, descriptionMax: 2200, doneLabel: 'Đã đăng' },
];
export const platformInfo = (value) => PLATFORMS.find((p) => p.value === value) ?? { value, label: value, icon: 'public', doneLabel: 'Đã đăng' };


/*
 * Trạng thái chung của bài:
 *   generating      Đang chuẩn bị: AI đang viết tiêu đề / nội dung / hashtag (chỉ khi bật AI viết nội dung lúc tạo bài)
 *   pending_review  Chờ gửi: chờ người dùng bấm đăng (đăng lần trước lỗi thì có last_error)
 *   queued          Chờ đăng: đã giao cho worker, chờ tới giờ / worker nhận (không hết hạn). Còn sửa / xoá được
 *   publishing      Đang đăng: worker đã nhận. Khoá: không sửa, không xoá; worker im lặng thì "Tạo lại"
 *   published       Đã đăng xong mọi nền tảng đã chọn
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

// Worker đã nhận bài: không sửa, không xoá
export const isPostLocked = (post) => post.status === POST_STATUS.PUBLISHING;

// Còn sửa / đăng / xoá được: chờ gửi hoặc chờ tới giờ (worker chưa nhận)
export const isPostEditable = (post) => post.status === POST_STATUS.PENDING_REVIEW || post.status === POST_STATUS.QUEUED;

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

const mapCreative = (c) => (c ? { creativeId: c.id, creativeSlug: c.slug, creativeTitle: c.title } : {});

export const mapImage = (img) => ({
  // id ảnh trong bài, giữ nguyên khi tạo lại; ảnh vừa thêm ở bước duyệt (chưa lưu) có id null
  id: img.id,
  // Khoá theo ảnh gốc trong lịch sử tạo ảnh, dùng để không chọn trùng. Ảnh upload thẳng (bài lookbook) không có
  // generation / output: khoá theo id ảnh trong bài
  key: img.output_id ? `${img.generation_id}_${img.output_id}` : `upload_${img.id}`,
  position: img.position,
  generationId: img.generation_id,
  outputId: img.output_id,
  status: img.status,
  // Người dùng đã tắt ảnh ở Lịch sử tạo ảnh: vẫn hiện (làm mờ) nhưng không chọn để đăng
  disabled: !!img.disabled,
  url: img.image_url,
  thumbUrl: img.thumb_url || img.image_url,
  errorMessage: img.error_message ?? null,
  creativeSlug: null,
  creativeTitle: null,
  ...mapCreative(img.creative),
});

/** { tiktok: { status, ... } } -> [{ platform, status, postUrl, error, finishedAt }] theo thứ tự PLATFORMS. */
const mapPlatforms = (platforms) =>
  PLATFORMS.filter((p) => platforms?.[p.value]).map((p) => {
    const s = platforms[p.value];
    return {
      platform: p.value,
      status: s.status,
      postUrl: s.post_url ?? null,
      error: s.error ?? null,
      finishedAt: s.finished_at ?? null,
    };
  });

/** Bài video (note/lap-lich-worker.txt): worker dựng + đăng, template, sản phẩm, giờ đăng. Bài ảnh: null. */
const mapVideo = (v) =>
  v
    ? {
        worker: v.worker ? { id: v.worker.id, name: v.worker.name } : null,
        template: {
          id: v.template?.id ?? null,
          name: v.template?.name ?? '',
          videoUrl: v.template?.video_url ?? '',
          imageCount: v.template?.image_count ?? 0,
        },
        product: v.product ? { id: v.product.id, name: v.product.name } : null,
        scheduledAt: v.scheduled_at,
      }
    : null;

const mapPost = (p) => ({
  id: p.id,
  type: p.type ?? POST_TYPE.PHOTO,
  video: mapVideo(p.video),
  // Worker được giao, giờ đăng, nền tảng đã chọn (note/gop-luong-dang-bai.txt)
  worker: p.worker ? { id: p.worker.id, name: p.worker.name } : null,
  scheduledAt: p.scheduled_at ?? null,
  selectedPlatforms: p.selected_platforms ?? [],
  status: p.status,
  source: p.source,
  imageBatchId: p.image_batch_id ?? null,
  aiContent: !!p.ai_content,
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
export const listPosts = ({ page = 1, limit = 20, status, type, workerId, source } = {}) =>
  client.get('/social/posts', {
    params: { page, per_page: limit, status, type, worker_id: workerId || undefined, source: source || undefined },
  }).then(({ data, meta }) => ({
    items: data.map(mapPost),
    page: meta.current_page,
    lastPage: meta.last_page,
    total: meta.total,
  }));

export const getPost = (id) => client.get(`/social/posts/${id}`).then(({ data }) => mapPost(data));

/**
 * Tạo bài từ ảnh của một lô hoặc ảnh đã có trên A51: bài chờ người dùng chọn nền tảng và đăng.
 * images: [{ generationId, outputId }] theo thứ tự, ảnh đầu làm ảnh bìa. batchId: lô tạo ra bài (nút "Tạo bài đăng" của lô).
 * aiContent: bật "AI viết nội dung" -> bài ở generating tới khi AI viết xong; AI lỗi thì bài dùng nội dung mặc định.
 */
export const createPostFromImages = (images, idempotencyKey, batchId = null, aiContent = false) =>
  client
    .post('/social/posts/from-images', {
      images: images.map((i) => ({ generation_id: i.generationId, output_id: i.outputId })),
      image_batch_id: batchId ?? undefined,
      idempotency_key: idempotencyKey,
      ai_content: aiContent,
    })
    .then(({ data }) => mapPost(data));

// AI đọc ảnh rồi viết: không dùng timeout 15s mặc định
const AI_TIMEOUT = 90_000;

/**
 * "Viết lại bằng AI": nội dung mới để điền vào form (không lưu vào bài). AI lỗi 503 AI_CONTENT_FAILED.
 */
export const rewritePostContent = (id) =>
  client.post(`/social/posts/${id}/ai-content`, null, { timeout: AI_TIMEOUT }).then(({ data }) => ({
    title: data.title ?? '',
    content: data.content ?? '',
    hashtags: data.hashtags ?? [],
  }));

// Nhớ lựa chọn công tắc "AI viết nội dung" lần trước (mặc định bật)
const AI_CONTENT_PREF_KEY = 'a51.social.aiContent';
export const loadAiContentPref = () => {
  try {
    return localStorage.getItem(AI_CONTENT_PREF_KEY) !== '0';
  } catch {
    return true;
  }
};
export const saveAiContentPref = (on) => {
  try {
    localStorage.setItem(AI_CONTENT_PREF_KEY, on ? '1' : '0');
  } catch {
    // Trình duyệt chặn localStorage: không nhớ được, lần sau vẫn bật mặc định
  }
};

// ---- Cài đặt AI viết nội dung của shop (trang /seller/ai-content) ----
// hashtags: kho hashtag (AI chọn tối đa limits.aiHashtags, kho rỗng thì bài không có hashtag); samples: bài viết mẫu
// [{ title, content }] để AI học giọng văn; titleMax / contentMax: số ký tự tối đa AI viết.

const mapAiContentSettings = (d) => ({
  hashtags: d.hashtags ?? [],
  samples: d.samples ?? [],
  requirements: d.requirements ?? '',
  titleMax: d.title_max,
  contentMax: d.content_max,
  productHashtags: d.product_hashtags ?? [],
  limits: {
    hashtags: d.limits.hashtags,
    aiHashtags: d.limits.ai_hashtags,
    samples: d.limits.samples,
    sampleTitle: d.limits.sample_title,
    sampleContent: d.limits.sample_content,
    requirements: d.limits.requirements ?? 1000,
    titleMax: d.limits.title_max,
    contentMax: d.limits.content_max,
  },
});

export const getAiContentSettings = () => client.get('/creator/ai-content').then(({ data }) => mapAiContentSettings(data));

export const saveAiContentSettings = ({ hashtags, samples, requirements, titleMax, contentMax }) =>
  client
    .put('/creator/ai-content', { hashtags, samples, requirements, title_max: titleMax, content_max: contentMax })
    .then(({ data }) => mapAiContentSettings(data));

/**
 * "Đăng bài" (note/gop-luong-dang-bai.txt): lưu chỉnh sửa + worker + loại bài + nền tảng + giờ đăng, bài sang "Chờ đăng".
 * form: { workerId, type: 'photo'|'video', templateId?, productId?, platforms, scheduledAt (ISO), images, title, content,
 * hashtags }. Ảnh đang có trong bài gửi { image_id }, ảnh vừa thêm gửi { generation_id, output_id }.
 */
export const publishPost = (id, form) =>
  client
    .post(`/social/posts/${id}/publish`, {
      worker_id: form.workerId,
      type: form.type,
      video_template_id: form.type === POST_TYPE.VIDEO ? form.templateId : undefined,
      product_id: form.type === POST_TYPE.VIDEO ? form.productId || null : undefined,
      platforms: form.platforms,
      scheduled_at: form.scheduledAt,
      title: form.title,
      content: form.content,
      hashtags: form.hashtags,
      images: form.images.map((img) =>
        img.id ? { image_id: img.id } : { generation_id: img.generationId, output_id: img.outputId },
      ),
    })
    .then(({ data }) => mapPost(data));

/** "Đăng lại" (bài lỗi) / "Tạo lại" (worker nhận rồi im lặng, có thể đăng trùng): bài về "Chờ đăng". */
export const retryPost = (id) => client.post(`/social/posts/${id}/retry`).then(({ data }) => mapPost(data));

export const deletePost = (id) => client.delete(`/social/posts/${id}`);

// ---- Bài đăng video có lịch (note/lap-lich-worker.txt), cần hồ sơ người bán ----
// POST /social/video-posts/auto { worker_id, platforms, count, first_at, gap_min, gap_max, idempotency_key }
//   -> 201 { data: { created, requested, stopped: null|no_template|not_enough_images, post_ids } }
//   không tạo được bài nào: 422 VIDEO_NO_TEMPLATE / VIDEO_NOT_ENOUGH_IMAGES
// POST /social/video-posts { worker_id, platforms, video_template_id, product_id?, images, scheduled_at, idempotency_key } -> 201 { data: post }
//      tab "Thủ công": 1 bài, AI viết nội dung như tự động
// PUT  /social/video-posts/{id} { worker_id, platforms, video_template_id, product_id, images, scheduled_at, title, content, hashtags }
//   sửa khi worker chưa nhận (queued) hoặc bài lỗi (pending_review); số ảnh phải bằng số ảnh template
// POST /social/video-posts/{id}/retry   "Đăng lại" (lỗi) / "Tạo lại" (worker nhận rồi im lặng) -> bài về queued
// GET  /social/video-posts/images?product_id=&page=&per_page=  ảnh của sản phẩm, không có product_id: mọi ảnh đã tạo
// GET  /social/video-posts/templates    template có số ảnh

export const POST_TYPE = { PHOTO: 'photo', VIDEO: 'video' };

export const isVideoPost = (post) => post.type === POST_TYPE.VIDEO;

/** Bài video sửa / xoá được: worker chưa nhận (chờ tới giờ) hoặc lỗi chờ đăng lại. */
export const isVideoEditable = isPostEditable;

export const VIDEO_AUTO_MAX = 50;
export const VIDEO_GAP_MAX_MINUTES = 1440;

export const VIDEO_STOP_MESSAGES = {
  no_template: 'Hết video template có số ảnh.',
  not_enough_images: 'Không còn sản phẩm nào đủ ảnh cho các template.',
};

export const autoCreateVideoPosts = ({ workerId, platforms, count, firstAt, gapMin, gapMax }, idempotencyKey) =>
  client
    .post(
      '/social/video-posts/auto',
      { worker_id: workerId, platforms, count, first_at: firstAt, gap_min: gapMin, gap_max: gapMax, idempotency_key: idempotencyKey },
      // Mỗi bài chờ trừ phí + giao AI viết: không dùng timeout mặc định
      { timeout: AI_TIMEOUT },
    )
    .then(({ data }) => ({ created: data.created, requested: data.requested, stopped: data.stopped, postIds: data.post_ids }));

// Tab "Thủ công": 1 bài, chủ shop chọn worker / template / sản phẩm / ảnh / giờ đăng; AI viết nội dung (trừ phí, thiếu -> 402)
export const createVideoPost = (form, idempotencyKey) =>
  client
    .post('/social/video-posts', {
      worker_id: form.workerId,
      platforms: form.platforms,
      video_template_id: form.templateId,
      product_id: form.productId || null,
      images: form.images.map((i) => ({ generation_id: i.generationId, output_id: i.outputId })),
      scheduled_at: form.scheduledAt,
      idempotency_key: idempotencyKey,
    })
    .then(({ data }) => mapPost(data));

export const updateVideoPost = (id, form) =>
  client
    .put(`/social/video-posts/${id}`, {
      worker_id: form.workerId,
      platforms: form.platforms,
      video_template_id: form.templateId,
      product_id: form.productId || null,
      images: form.images.map((i) => ({ generation_id: i.generationId, output_id: i.outputId })),
      scheduled_at: form.scheduledAt,
      title: form.title,
      content: form.content,
      hashtags: form.hashtags,
    })
    .then(({ data }) => mapPost(data));

export const retryVideoPost = retryPost;

export const listVideoImages = ({ productId, page = 1, limit = 40 } = {}) =>
  client
    .get('/social/video-posts/images', { params: { product_id: productId || undefined, page, per_page: limit } })
    .then(({ data, meta }) => ({
      items: data.map((i) => ({
        key: `${i.generation_id}_${i.output_id}`,
        generationId: i.generation_id,
        outputId: i.output_id,
        thumbUrl: i.thumb_url,
        url: i.image_url,
      })),
      page: meta.current_page,
      lastPage: meta.last_page,
    }));

export const listVideoPostTemplates = () =>
  client.get('/social/video-posts/templates').then(({ data }) =>
    data.map((t) => ({ id: t.id, name: t.name, videoUrl: t.video_url, imageCount: t.image_count })),
  );
