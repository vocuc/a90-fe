import client from './client';

/*
 * ---- Đăng bài lên TikTok / Facebook / Instagram (cần đăng nhập) ----
 * Đặc tả: note/dang-bai-da-nen-tang.txt (bản mới nhất), note/nghiep-vu-dang-bai-tiktik.txt (bài đăng).
 * Ảnh của bài lấy từ lô ảnh (src/api/batches.js) hoặc lịch sử tạo ảnh.
 * Bấm đăng thì backend tạo 1 job / nền tảng đã chọn, mỗi worker (FlowKit) giữ một tài khoản của một nền tảng (admin gắn
 * cho tài khoản A51) nhận job và đăng bài (TikTok: LƯU NHÁP).
 * TikTok qua API (note/dang-tiktok-qua-api.txt): người dùng tự kết nối TikTok thì mặc định đăng qua API, không qua worker:
 * ảnh vào hộp thư TikTok, người dùng mở app TikTok để đăng.
 * Một tài khoản A51 kết nối được nhiều tài khoản TikTok (note/uy-quyen-nhieu-tiktok.txt): đăng bài thì chọn một hoặc
 * nhiều tài khoản (tiktok_account_ids), mỗi tài khoản một trạng thái riêng (platforms.tiktok.accounts).
 *
 * GET    /social/accounts                                -> { data: PublishAccount[] }  (admin gắn / tự kết nối)
 * POST   /social/tiktok/oauth/authorize { redirect }     -> { data: { url } }  (chuyển sang TikTok)
 * POST   /social/tiktok/oauth/callback { code, state, error } -> { data: { status, reason, redirect } }
 * DELETE /social/tiktok/accounts/{id}                    -> 204  (huỷ kết nối một tài khoản)
 * GET    /social/posts?page=&per_page=&status=           -> { data: SocialPost[], meta }
 * GET    /social/posts/{id}                              -> { data: SocialPost }
 * POST   /social/posts/from-images                       -> 201 { data: SocialPost }
 * POST   /social/posts/{id}/publish                      -> { data: SocialPost }   (các nền tảng chọn sang queued)
 * POST   /social/posts/{id}/ai-content                   -> { data: { title, content, hashtags, credit_balance } }
 *        "Viết lại bằng AI": không lưu vào bài, trừ phí khi AI viết được (note/ai-viet-noi-dung-bai-dang.txt)
 * GET    /creator/ai-content                             -> { data: AiContentSettings }  (trang "AI viết nội dung", chủ shop)
 * PUT    /creator/ai-content { hashtags, samples, title_max, content_max } -> như trên
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

// Cách đăng: worker (admin gắn) | api (TikTok người dùng tự kết nối)
export const DRIVER = { WORKER: 'worker', API: 'api' };

/** Nhãn khi đăng xong theo cách đăng: TikTok qua API thì ảnh vào hộp thư TikTok. */
export const doneLabelOf = (platform, driver) =>
  platform === 'tiktok' && driver === DRIVER.API ? 'Đã gửi vào hộp thư' : platformInfo(platform).doneLabel;

/*
 * Trạng thái chung của bài:
 *   generating      Đang chuẩn bị: AI đang viết tiêu đề / nội dung / hashtag (chỉ khi bật AI viết nội dung lúc tạo bài)
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

/**
 * Tài khoản đăng bài của người dùng (admin gắn worker, hoặc các TikTok tự kết nối; có tự kết nối thì không có dòng worker
 * của TikTok). connection (chỉ driver api): { status: active | expired | revoked | scope_missing, avatarUrl, connectedAt }.
 */
export const getAccounts = () =>
  client.get('/social/accounts').then(({ data }) =>
    data.map((a) => ({
      id: a.id,
      platform: a.platform,
      label: a.label,
      name: a.name,
      username: a.username,
      isActive: a.is_active,
      driver: a.driver ?? DRIVER.WORKER,
      connection: a.connection
        ? { status: a.connection.status, avatarUrl: a.connection.avatar_url ?? null, connectedAt: a.connection.connected_at }
        : null,
    })),
  );

/** Các TikTok tự kết nối của người dùng (có thể có tài khoản đã mất kết nối), theo thứ tự kết nối. */
export const tiktokConnectionsOf = (accounts) => (accounts ?? []).filter((a) => a.platform === 'tiktok' && a.driver === DRIVER.API);

export const isConnectionActive = (account) => account?.connection?.status === 'active';

/** "@username", không có thì tên hiển thị. */
export const tiktokNameOf = (account) => (account.username ? `@${account.username}` : account.name);

/** Chuyển sang TikTok để người dùng đồng ý; TikTok trả về /mxh/tiktok/author, xong quay lại redirect. */
export const authorizeTikTok = (redirect = window.location.pathname + window.location.search) =>
  client.post('/social/tiktok/oauth/authorize', { redirect }).then(({ data }) => {
    window.location.href = data.url;
  });

/** Trang /mxh/tiktok/author gửi tham số TikTok trả về: { status: connected | error, reason, redirect }. */
export const tiktokCallback = ({ code, state, error }) =>
  client.post('/social/tiktok/oauth/callback', { code, state, error }).then(({ data }) => data);

export const disconnectTikTok = (id) => client.delete(`/social/tiktok/accounts/${id}`);

/** Thông báo theo kết quả kết nối (reason của callback / connection.status). */
export const TIKTOK_CONNECT_MESSAGES = {
  connected: 'Đã kết nối tài khoản TikTok.',
  access_denied: 'Bạn đã huỷ kết nối TikTok.',
  scope_missing: 'Cần cho phép quyền tải nội dung lên để A51 gửi bài sang TikTok. Vui lòng kết nối lại.',
  state_invalid: 'Phiên kết nối đã hết hạn, vui lòng thử lại.',
  server_error: 'Không kết nối được TikTok, vui lòng thử lại sau.',
  limit_reached: 'Bạn đã kết nối đủ số tài khoản TikTok tối đa. Huỷ kết nối bớt một tài khoản để thêm tài khoản khác.',
  expired: 'Kết nối TikTok đã hết hạn, vui lòng kết nối lại.',
  revoked: 'Kết nối TikTok đã bị gỡ, vui lòng kết nối lại.',
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

/**
 * { tiktok: { status, ... } } -> [{ platform, status, driver, postUrl, error, finishedAt, accounts }] theo thứ tự PLATFORMS.
 * accounts: TikTok gửi qua API, trạng thái từng tài khoản [{ accountId, name, status, error, finishedAt }].
 */
const mapPlatforms = (platforms) =>
  PLATFORMS.filter((p) => platforms?.[p.value]).map((p) => {
    const s = platforms[p.value];
    return {
      platform: p.value,
      status: s.status,
      driver: s.driver ?? null,
      postUrl: s.post_url ?? null,
      error: s.error ?? null,
      finishedAt: s.finished_at ?? null,
      accounts: (s.accounts ?? []).map((a) => ({
        accountId: a.account_id ?? null,
        name: a.name ?? 'TikTok',
        status: a.status,
        error: a.error ?? null,
        finishedAt: a.finished_at ?? null,
      })),
    };
  });

const mapPost = (p) => ({
  id: p.id,
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
export const listPosts = ({ page = 1, limit = 20, status } = {}) =>
  client.get('/social/posts', { params: { page, per_page: limit, status } }).then(({ data, meta }) => ({
    items: data.map(mapPost),
    page: meta.current_page,
    lastPage: meta.last_page,
    total: meta.total,
  }));

export const getPost = (id) => client.get(`/social/posts/${id}`).then(({ data }) => mapPost(data));

/**
 * Tạo bài từ ảnh của một lô hoặc ảnh đã có trên A51: bài chờ người dùng chọn nền tảng và đăng.
 * images: [{ generationId, outputId }] theo thứ tự, ảnh đầu làm ảnh bìa. batchId: lô tạo ra bài (nút "Tạo bài đăng" của lô).
 * aiContent: bật "AI viết nội dung" -> trừ phí ngay (không đủ: 402 INSUFFICIENT_CREDIT, không tạo bài), bài ở generating
 * tới khi AI viết xong; AI lỗi thì bài dùng nội dung mặc định và được hoàn phí. Không bật thì không tính phí.
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
 * "Viết lại bằng AI": nội dung mới để điền vào form (không lưu vào bài). Chỉ trừ phí khi AI viết được;
 * AI lỗi 503 AI_CONTENT_FAILED, không đủ Credit 402 INSUFFICIENT_CREDIT.
 */
export const rewritePostContent = (id) =>
  client.post(`/social/posts/${id}/ai-content`, null, { timeout: AI_TIMEOUT }).then(({ data }) => ({
    title: data.title ?? '',
    content: data.content ?? '',
    hashtags: data.hashtags ?? [],
    creditBalance: data.credit_balance,
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
  titleMax: d.title_max,
  contentMax: d.content_max,
  productHashtags: d.product_hashtags ?? [],
  limits: {
    hashtags: d.limits.hashtags,
    aiHashtags: d.limits.ai_hashtags,
    samples: d.limits.samples,
    sampleTitle: d.limits.sample_title,
    sampleContent: d.limits.sample_content,
    titleMax: d.limits.title_max,
    contentMax: d.limits.content_max,
  },
});

export const getAiContentSettings = () => client.get('/creator/ai-content').then(({ data }) => mapAiContentSettings(data));

export const saveAiContentSettings = ({ hashtags, samples, titleMax, contentMax }) =>
  client
    .put('/creator/ai-content', { hashtags, samples, title_max: titleMax, content_max: contentMax })
    .then(({ data }) => mapAiContentSettings(data));

/**
 * Đăng bài: lưu toàn bộ chỉnh sửa trên trang rồi tạo 1 job / nền tảng trong form.platforms, bài chuyển sang queued
 * (khoá tới khi worker xong). Tiêu đề, nội dung, hashtag không bắt buộc. Nền tảng lỗi: xong hết thì bài về
 * pending_review với last_error, người dùng đăng lại các nền tảng lỗi (nền tảng đã đăng xong không đăng lại được).
 * form.tiktokAccountIds: các TikTok tự kết nối sẽ nhận bài (chỉ gửi khi chọn TikTok).
 */
export const publishPost = (id, form) =>
  client
    .post(`/social/posts/${id}/publish`, {
      title: form.title,
      content: form.content,
      hashtags: form.hashtags,
      platforms: form.platforms,
      tiktok_account_ids: form.platforms.includes('tiktok') && form.tiktokAccountIds?.length ? form.tiktokAccountIds : undefined,
      images: form.images.map((img) =>
        img.id ? { image_id: img.id } : { generation_id: img.generationId, output_id: img.outputId },
      ),
    })
    .then(({ data }) => mapPost(data));

export const deletePost = (id) => client.delete(`/social/posts/${id}`);
