import client, { MOCK_AUTH, MOCK_MARKETPLACE } from './client';
import { mock } from './mock/handlers';

/*
 * ---- Xác thực: khớp backend Laravel (D:\OSPanel\home\a90.local, tiền tố /api/v1) ----
 *
 * POST /auth/register { name, email, password, password_confirmation }   -> 201 { data: { token, token_type, expires_at, user } }
 * POST /auth/login    { email, password }                                -> 200 { data: { token, token_type, expires_at, user } }
 * POST /auth/google   { id_token }                                       -> 200 | 201 (tài khoản mới), cùng dạng như login
 * POST /auth/logout   (Bearer)                                           -> { message }
 * GET  /auth/me       (Bearer)                                           -> { data: user }
 *
 * user (UserResource): { id, name, email, role, credit_balance, creator_profile: { avatar_url, ... } | null, created_at }
 * Lỗi dữ liệu: 422 { message, errors: { field: [msg] } }. Gửi quá nhiều lần: 429.
 *
 * ---- Marketplace (công khai) ----
 *
 * GET /categories        -> { data: [{ id, name, slug, icon }] }
 * GET /hashtags          -> { data: [{ name, slug, creative_count }] }  (hashtag có nhiều Creative đang bán nhất trước)
 *     query: q (tiền tố, có hoặc không có #), limit (<= 50, mặc định 20)
 * GET /creatives         -> { data: CreativeCard[], meta: { current_page, last_page, per_page, total } }
 *     query: q, category (slug), hashtag (slug), sort (newest|popular|price_asc|price_desc), page, per_page (<= 50)
 * GET /creatives/{slug}  -> { data: CreativeCard + { description, images: [{ id, url }], options } }
 *
 * CreativeCard: { id, slug, title, price_per_image, cover_url, category, hashtags: [{ name, slug }], usage_count, rating_avg,
 *                 rating_count, published_at, creator: { username, shop_name, avatar_url, verified } | null }
 * Link ảnh (cover_url, images[].url) là link ký số, hết hạn sau 15 phút.
 *
 * Frontend dùng dạng đã đổi tên bên dưới (mapCategory, mapCreative); mock trả sẵn dạng này.
 */

export const DEFAULT_CATEGORY_ICON = 'category';

const mapCategory = (c) => ({ id: c.id, slug: c.slug, name: c.name, icon: c.icon || DEFAULT_CATEGORY_ICON });

const mapCreative = (c) => ({
  // URL trang chi tiết dùng slug
  id: c.slug,
  // id số, dùng khi gọi API theo id (POST /generations)
  creativeId: c.id,
  title: c.title,
  description: c.description ?? null,
  imageUrl: c.cover_url,
  images: c.images?.map((i) => i.url) ?? [],
  // Chưa có lượt đánh giá nào -> null để giao diện hiện "Mới"
  rating: c.rating_count > 0 ? c.rating_avg : null,
  ratingCount: c.rating_count,
  price: c.price_per_image,
  usageCount: c.usage_count,
  category: c.category ? { slug: c.category.slug, name: c.category.name } : null,
  hashtags: c.hashtags?.map((h) => ({ name: h.name, slug: h.slug })) ?? [],
  author: c.creator
    ? {
        name: c.creator.shop_name,
        username: c.creator.username,
        avatarUrl: c.creator.avatar_url,
        verified: c.creator.verified,
      }
    : null,
  options: c.options ?? null,
  // Form người mua theo input_schema (chỉ có ở trang chi tiết)
  inputSchema: c.input_schema ?? null,
  videoUrl: c.video_url ?? null,
});

const mapPage = ({ data, meta }) => ({
  items: data.map(mapCreative),
  total: meta.total,
  page: meta.current_page,
  lastPage: meta.last_page,
  limit: meta.per_page,
});

// Đổi user của backend sang dạng frontend dùng
const mapUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  credits: u.credit_balance ?? 0,
  avatarUrl: u.creator_profile?.avatar_url ?? null,
  creatorProfile: u.creator_profile ?? null,
});

const mapSession = ({ data }) => ({ token: data.token, expiresAt: data.expires_at, user: mapUser(data.user) });

export const authApi = {
  login: ({ email, password }) =>
    MOCK_AUTH
      ? mock.login({ email, password })
      : client.post('/auth/login', { email, password }).then(mapSession),
  register: ({ name, email, password, passwordConfirmation }) =>
    MOCK_AUTH
      ? mock.register({ name, email, password })
      : client
          .post('/auth/register', { name, email, password, password_confirmation: passwordConfirmation })
          .then(mapSession),
  // Lần đầu -> tạo tài khoản, các lần sau -> đăng nhập; email trùng tài khoản cũ -> gắn vào tài khoản đó
  google: ({ idToken }) =>
    MOCK_AUTH ? mock.googleLogin() : client.post('/auth/google', { id_token: idToken }).then(mapSession),
  logout: () => (MOCK_AUTH ? mock.logout() : client.post('/auth/logout')),
};

export const userApi = {
  getMe: () => (MOCK_AUTH ? mock.getMe() : client.get('/auth/me').then(({ data }) => mapUser(data))),
};

export const notificationApi = {
  // Backend chưa có API thông báo -> khi dùng tài khoản thật luôn trả 0
  getUnreadCount: () => (MOCK_AUTH ? mock.getUnreadCount() : Promise.resolve({ count: 0 })),
};

// GET /banners -> { data: [{ id, title, image_url, link_url }] }, link_url là đường dẫn trong app (/...) hoặc link ngoài
export const bannerApi = {
  getAll: () =>
    MOCK_MARKETPLACE
      ? mock.getBanners()
      : client
          .get('/banners')
          .then(({ data }) => data.map((b) => ({ id: b.id, title: b.title, imageUrl: b.image_url, linkUrl: b.link_url }))),
};

export const categoryApi = {
  getAll: () =>
    MOCK_MARKETPLACE
      ? mock.getCategories()
      : client.get('/categories').then(({ data }) => data.map(mapCategory)),
};

// Gợi ý hashtag (tìm kiếm ở Khám phá, nhập hashtag khi tạo Creative). Mock chưa có hashtag -> rỗng
export const hashtagApi = {
  suggest: ({ q, limit } = {}) =>
    MOCK_MARKETPLACE
      ? Promise.resolve([])
      : client
          .get('/hashtags', { params: { q: q || undefined, limit } })
          .then(({ data }) => data.map((h) => ({ name: h.name, slug: h.slug, count: h.creative_count ?? 0 }))),
};

/*
 * ---- Creator Studio: cửa hàng (cần đăng nhập, dữ liệu giữ nguyên snake_case như form gửi lên) ----
 *
 * POST /creator/profile          { shop_name, username, description?, website?, social_links? } -> 201 { data: profile }
 * GET  /creator/profile          -> { data: profile }      (chưa có hồ sơ -> 403 CREATOR_PROFILE_REQUIRED)
 * PUT  /creator/profile          (các trường như trên, gửi trường nào sửa trường đó)
 * POST /creator/profile/avatar   multipart image (jpg/png/webp, <= 5MB) -> { data: profile }
 * POST /creator/profile/cover    như avatar
 * profile: { username, shop_name, avatar_url, cover_url, description, website, social_links, verified,
 *            followers_count, creative_count, usage_count, rating_avg, rating_count, platform_fee_percent }
 *
 * GET    /ai-models                    -> { data: [{ id, name, code, provider: { id, code, name }, supported_aspect_ratios }] }
 *
 * GET /creator/creatives?status=&page=&per_page=  (Creative của chính creator, mới sửa trước)
 *   -> { data: [{ id, slug, title, price_per_image, status: draft|published|paused,
 *                 pause_reason: manual|no_valid_api_key|null, is_hidden, usage_count, rating_avg, cover_url,
 *                 published_at, created_at, updated_at }], meta: { current_page, last_page, per_page, total } }
 * POST /creator/creatives  { title, description? (hướng dẫn sử dụng mẫu), category_id?, model_id, price_per_image,
 *                            video_url? (TikTok), input_schema: field[], prompt_template, max_outputs?,
 *                            hashtags? (tối đa 10, mỗi cái <= 50 ký tự: chữ, số, _; có hoặc không có #; gửi cả danh sách để thay thế) }
 *   input_schema: đúng 1 trường { key: 'aspectRatio', type: 'aspect_ratio', default_value } -> default_aspect_ratio
 *   -> 201 { data: creative } (trạng thái draft)
 * GET  /creator/creatives/{id}  -> { data: creative + { video_url, images: [{ id, url, sort_order }],
 *                                           config: { input_schema, prompt_template, max_outputs, default_aspect_ratio } } }
 * PATCH /creator/creatives/{id}/images/order  { image_ids } (ảnh đầu tiên là ảnh đại diện)
 * PUT  /creator/creatives/{id}  (các trường như POST, gửi trường nào sửa trường đó)
 * POST /creator/creatives/{id}/images  multipart image (jpg/png/webp, <= 10MB, tối đa 10 ảnh) -> 201 { data: { id, url, sort_order } }
 * DELETE /creator/creatives/{id}/images/{imageId}  (Creative đang bán phải còn ít nhất 1 ảnh -> 409 INVALID_STATE)
 * POST /creator/creatives/{id}/publish  (chỉ draft|paused) -> { data: creative }
 * POST /creator/creatives/{id}/pause    (chỉ published) -> { data: creative } (trạng thái paused)
 *
 * GET /creator/wallet  -> { data: { pending_balance, available_balance, withdrawable_balance, total_earned } }
 *   ví hoa hồng; doanh thu nằm ở pending trong thời gian giữ rồi mới chuyển sang available
 *   chưa đủ điều kiện -> 422 CREATIVE_NOT_PUBLISHABLE, context.reasons: string[]; sai trạng thái -> 409 INVALID_STATE
 */

// Chế độ mock chưa giả lập Creator Studio; gọi backend bằng token giả sẽ bị 401 và văng đăng xuất
const requireRealBackend = (fn) => (...args) =>
  MOCK_AUTH
    ? Promise.reject(new Error('Cửa hàng cần backend thật. Đặt VITE_MOCK_AUTH=false trong .env.'))
    : fn(...args);

const UPLOAD_TIMEOUT = 60_000;

const uploadImage = (path, file) => {
  const form = new FormData();
  form.append('image', file);
  return client.post(path, form, { timeout: UPLOAD_TIMEOUT }).then(({ data }) => data);
};

export const creatorApi = {
  getProfile: requireRealBackend(() => client.get('/creator/profile').then(({ data }) => data)),
  createProfile: requireRealBackend((body) => client.post('/creator/profile', body).then(({ data }) => data)),
  updateProfile: requireRealBackend((body) => client.put('/creator/profile', body).then(({ data }) => data)),
  uploadAvatar: requireRealBackend((file) => uploadImage('/creator/profile/avatar', file)),
  uploadCover: requireRealBackend((file) => uploadImage('/creator/profile/cover', file)),

  listCreatives: requireRealBackend(({ status, page, limit } = {}) =>
    client.get('/creator/creatives', { params: { status, page, per_page: limit } }).then(({ data, meta }) => ({
      items: data,
      total: meta.total,
      page: meta.current_page,
      lastPage: meta.last_page,
    })),
  ),
  getCreative: requireRealBackend((id) => client.get(`/creator/creatives/${id}`).then(({ data }) => data)),
  createCreative: requireRealBackend((body) => client.post('/creator/creatives', body).then(({ data }) => data)),
  updateCreative: requireRealBackend((id, body) => client.put(`/creator/creatives/${id}`, body).then(({ data }) => data)),
  uploadCreativeImage: requireRealBackend((id, file) => uploadImage(`/creator/creatives/${id}/images`, file)),
  deleteCreativeImage: requireRealBackend((id, imageId) => client.delete(`/creator/creatives/${id}/images/${imageId}`)),
  // Ảnh đầu tiên là ảnh đại diện
  reorderCreativeImages: requireRealBackend((id, imageIds) =>
    client.patch(`/creator/creatives/${id}/images/order`, { image_ids: imageIds }),
  ),
  publishCreative: requireRealBackend((id) =>
    client.post(`/creator/creatives/${id}/publish`).then(({ data }) => data),
  ),
  pauseCreative: requireRealBackend((id) =>
    client.post(`/creator/creatives/${id}/pause`).then(({ data }) => data),
  ),
  getWallet: requireRealBackend(() => client.get('/creator/wallet').then(({ data }) => data)),
};

export const aiModelApi = {
  list: requireRealBackend(() => client.get('/ai-models').then(({ data }) => data)),
};

export const creativeApi = {
  // params: { q, category, hashtag, sort, page, limit }
  list: ({ limit, ...params } = {}) =>
    MOCK_MARKETPLACE
      ? mock.getCreatives({ ...params, limit })
      : client.get('/creatives', { params: { ...params, per_page: limit } }).then(mapPage),
  getById: (slug) =>
    MOCK_MARKETPLACE
      ? mock.getCreative(slug)
      : client.get(`/creatives/${encodeURIComponent(slug)}`).then(({ data }) => mapCreative(data)),
};

/*
 * ---- Trang nhà sáng tạo (công khai) ----
 *
 * GET /creators/{username}  -> { data: { profile, creatives } }  (không có -> 404)
 *   profile: { username, shop_name, avatar_url, cover_url, description, website, social_links, verified,
 *              followers_count, creative_count, usage_count, rating_avg, rating_count, created_at }
 *   creatives: trang đầu Creative mới nhất; trang này không dùng (danh sách lấy ở GET /creatives?creator=)
 * GET /creatives?creator={username}&sort=&page=&per_page=  (như GET /creatives, chỉ Creative của người đó)
 */
const mapCreatorProfile = (p) => ({
  username: p.username,
  name: p.shop_name,
  avatarUrl: p.avatar_url,
  coverUrl: p.cover_url,
  description: p.description,
  website: p.website,
  // Backend trả social_links là {} hoặc [] khi trống
  socialLinks: p.social_links && !Array.isArray(p.social_links) ? p.social_links : {},
  verified: p.verified,
  followersCount: p.followers_count,
  creativeCount: p.creative_count,
  usageCount: p.usage_count,
  ratingAvg: p.rating_avg,
  ratingCount: p.rating_count,
  joinedAt: p.created_at,
});

export const creatorPageApi = {
  getByUsername: (username) =>
    MOCK_MARKETPLACE
      ? mock.getCreatorByUsername(username)
      : client
          // per_page=1: chỉ cần hồ sơ, bớt tải danh sách Creative đi kèm
          .get(`/creators/${encodeURIComponent(username)}`, { params: { per_page: 1 } })
          .then(({ data }) => mapCreatorProfile(data.profile)),
  // params: { sort, page, limit }
  listCreatives: (username, params) =>
    MOCK_MARKETPLACE
      ? mock.getCreatorCreatives(username, params)
      : creativeApi.list({ ...params, creator: username }),
};

/*
 * ---- Tạo ảnh (cần đăng nhập) ----
 *
 * POST /generations  multipart { creative_id, quantity (1..max_outputs), idempotency_key,
 *                                inputs[key] theo input_schema: ảnh (jpg/png/webp <= 10MB) hoặc giá trị,
 *                                inputs[aspectRatio] (một trong options.aspect_ratios, bỏ trống = mặc định) }
 *   -> 202 { data: generation }  (trừ tiền ngay, xử lý nền; chủ Creative tự dùng không bị trừ)
 *   lỗi: 402 INSUFFICIENT_CREDIT (context: { required, balance }), 404 CREATIVE_NOT_AVAILABLE,
 *        409 CREATIVE_TEMPORARILY_UNAVAILABLE, 409 IDEMPOTENCY_CONFLICT, 422 quantity/aspect_ratio
 * GET  /generations?page=&per_page= (<= 50, mới nhất trước) -> { data: generation[] (kèm outputs), meta: { current_page, last_page, ... } }
 * GET  /generations/{id}/status  -> { data: { id, status, success_count, failed_count,
 *                                             outputs: [{ id, position, status, image_url, error_code }] } }
 *   status (generation và output): queued | processing | completed | failed (generation có thêm cancelled)
 * POST /generations/{id}/retry  { output_ids, idempotency_key } -> 202 { data: generation mới } (trừ tiền lại)
 * GET  /generations/{id}/outputs/{outputId}/download -> { data: { url, filename, expires_in_minutes } }
 *   url ký số có Content-Disposition: attachment -> mở là tải về
 * generation: { id, status, creative: { id, slug, title }, quantity, aspect_ratio, price_per_image, total_charged,
 *               success_count, failed_count, outputs?: [{ id, position, status, image_url, error_message }], created_at }
 */
const GENERATION_UPLOAD_TIMEOUT = 60_000;

// inputs[key] cho multipart: mảng -> inputs[key][], bật/tắt -> 1/0, trống thì bỏ qua
const appendInputs = (form, inputs) =>
  Object.entries(inputs).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) value.forEach((v) => form.append(`inputs[${key}][]`, v));
    else if (typeof value === 'boolean') form.append(`inputs[${key}]`, value ? '1' : '0');
    else form.append(`inputs[${key}]`, value);
  });

export const generationApi = {
  // inputs: { [key]: File | giá trị } theo input_schema của Creative (gồm inputs.aspectRatio)
  create: requireRealBackend(({ creativeId, inputs, quantity, idempotencyKey }) => {
    const form = new FormData();
    form.append('creative_id', creativeId);
    appendInputs(form, inputs);
    form.append('quantity', quantity);
    form.append('idempotency_key', idempotencyKey);
    return client.post('/generations', form, { timeout: GENERATION_UPLOAD_TIMEOUT }).then(({ data }) => data);
  }),
  list: requireRealBackend(({ page, limit } = {}) =>
    client.get('/generations', { params: { page, per_page: limit } }).then(({ data, meta }) => ({
      items: data,
      page: meta.current_page,
      lastPage: meta.last_page,
    })),
  ),
  status: requireRealBackend((id) => client.get(`/generations/${id}/status`).then(({ data }) => data)),
  retry: requireRealBackend(({ id, outputIds, idempotencyKey }) =>
    client
      .post(`/generations/${id}/retry`, { output_ids: outputIds, idempotency_key: idempotencyKey })
      .then(({ data }) => data),
  ),
  download: requireRealBackend((id, outputId) =>
    client.get(`/generations/${id}/outputs/${outputId}/download`).then(({ data }) => data),
  ),
};
