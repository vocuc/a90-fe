import client from './client';

/*
 * ---- Kênh TikTok + kế hoạch nội dung (note/xay-kenh-tiktok/dac-ta-giai-doan-1.txt mục 6.1), cần hồ sơ người bán ----
 * GET    /creator/channels                            -> { data: ChannelSummary[], meta: { max } }
 * POST   /creator/channels { name, worker_id }        -> 201 { data: Channel }   (kênh đầu tiên chép cài đặt AI cũ của shop)
 * GET    /creator/channels/{id}                       -> { data: Channel }
 * PUT    /creator/channels/{id} { ...phần muốn sửa }  -> { data: Channel }
 * DELETE /creator/channels/{id}                       -> 204 | 409 CHANNEL_HAS_POSTS
 * GET    /creator/channel-workers                     -> { data: [{ id, name, channel_id }] }
 * GET    /creator/channels/post-samples               -> { data: PostSample[], meta: { groups } }
 * GET    /creator/channels/{id}/lineups               -> { data: { current, pending[] } }
 * PUT    /creator/channels/{id}/lineups/{l} { items } ; POST .../{l}/approve | /reject
 * GET    /creator/channels/{id}/text-templates        -> { data: TextTemplate[], meta: { fonts, preview_image, ... } }
 * POST   /creator/channels/{id}/text-templates { name, style, sample_text, sample_keys } -> 201 (chủ shop tự thêm, duyệt luôn)
 * PUT    /creator/channels/{id}/text-templates/{t} { name?, style?, sample_text?, sample_keys? } ; POST .../{t}/approve | /reject
 * GET    /creator/channels/{id}/plans                 -> { data: PlanSummary[] }
 * GET    /creator/channels/{id}/plans/{p}             -> { data: Plan (kèm items) }
 * GET    /creator/channels/{id}/plan-job              -> { data: { plan_worker, job, note_max } } (lượt "Lập kế hoạch mới"
 *          gần nhất: { id, status: queued|processing|completed|failed, note, result: { summary, plan_id, plan_status },
 *          error_message, created_at, finished_at })
 * POST   /creator/channels/{id}/plan-jobs { note? }   -> 201 { data: job } (việc cho worker điều phối chạy /lap-ke-hoach)
 * POST   /creator/channels/{id}/plans/{p}/approve | /cancel
 * PUT    /creator/channels/{id}/plans/{p}/items/{i}   ; POST .../items/{i}/cancel
 * GET    /creator/channels/{id}/calendar?from=&to=    -> { data: CalendarPost[] }
 * PUT    /creator/channel-posts/{post}/overlays { overlays: [{ image_id, text, text_template_id }] }
 * POST   /creator/channel-posts/{post}/redo | DELETE  đánh dấu / bỏ đánh dấu làm lại
 * GET    /creator/channels/{id}/topics                -> { data: { topics: Topic[], tag_options, topic_worker, job, count } }
 *          topic_worker: shop có worker lập chủ đề; job: lượt xây dựng tự động gần nhất { id, status: queued|processing|
 *          completed|failed, count, note, result: { created, skipped, errors }, error_message, created_at, finished_at }
 * POST   /creator/channels/{id}/topics { name, tags? } -> 201 { data: Topic }  (xây dựng chủ đề thủ công)
 * POST   /creator/channels/{id}/topic-jobs { count, note? } -> 201 { data: job } (tự động: việc cho worker lập chủ đề)
 *          409 TOPIC_WORKER_REQUIRED | TOPIC_JOB_RUNNING. note/xay-kenh-tiktok/worker-lap-chu-de.txt
 *          Topic: { id, name, tags (bộ lọc tag sản phẩm), source: ai|owner, status: active|paused,
 *                   posts: { sample_key: số bài }, last_used: { sample_key: 'YYYY-MM-DD' } }
 * PUT    /creator/channels/{id}/topics/{t} { name?, tags?, status? } -> { data: Topic } (sửa tên / tags -> nguồn owner)
 *          Chủ đề: note/xay-kenh-tiktok/chu-de-va-tag-san-pham.txt mục 4. AI tự tạo khi lập kế hoạch; tạm tắt -> AI không dùng.
 * Soạn nội dung (chân dung, tuyến, template, kỳ) do lệnh /lap-ke-hoach của đội A51 làm, không có API ở đây.
 */

export const CHANNEL_KEYS = {
  all: ['creator', 'channels'],
  detail: (id) => ['creator', 'channels', String(id)],
  workers: ['creator', 'channel-workers'],
  samples: ['creator', 'channels', 'post-samples'],
  lineups: (id) => ['creator', 'channels', String(id), 'lineups'],
  templates: (id) => ['creator', 'channels', String(id), 'text-templates'],
  plans: (id) => ['creator', 'channels', String(id), 'plans'],
  plan: (id, planId) => ['creator', 'channels', String(id), 'plans', String(planId)],
  calendar: (id, from, to) => ['creator', 'channels', String(id), 'calendar', from, to],
  topics: (id) => ['creator', 'channels', String(id), 'topics'],
  planJob: (id) => ['creator', 'channels', String(id), 'plan-job'],
};

/** Nhãn những gì kênh còn thiếu (channel.missing). */
export const MISSING_LABELS = {
  worker: 'Chưa có worker đăng bài',
  persona: 'Chưa có chân dung khách hàng',
  time_slots: 'Chưa có khung giờ đăng',
  lineup: 'Chưa có tuyến nội dung được duyệt',
  text_templates: 'Chưa có template chữ được duyệt',
};

export const PERSONA_LABELS = {
  age_range: 'Độ tuổi',
  gender: 'Giới tính',
  occupation: 'Nghề nghiệp',
  price_range: 'Mức giá chấp nhận',
  style: 'Phong cách, sở thích',
  pain_points: 'Nỗi đau, điều lo lắng',
  occasions: 'Dịp hay mua',
  tone: 'Giọng văn, cách xưng hô',
  active_hours: 'Giờ hay lướt TikTok',
  note: 'Ghi chú khác',
};

const mapWorker = (w) => (w ? { id: w.id, name: w.name } : null);

const mapSummary = (c) => ({
  id: c.id,
  name: c.name,
  platform: c.platform,
  isActive: c.is_active !== false,
  worker: mapWorker(c.worker),
  missing: c.missing ?? [],
  upcomingPosts: c.upcoming_posts ?? 0,
  createdAt: c.created_at,
});

const mapChannel = (c) => ({
  ...mapSummary(c),
  persona: c.persona ?? {},
  planDays: c.plan_days,
  postsPerDay: c.posts_per_day,
  timeSlots: c.time_slots ?? [],
  videoPercent: c.video_percent,
  autoApproveLineup: !!c.auto_approve_lineup,
  autoApproveTemplates: !!c.auto_approve_templates,
  autoApprovePlan: !!c.auto_approve_plan,
  titleMax: c.title_max,
  contentMax: c.content_max,
  requirements: c.requirements ?? '',
  hashtags: c.hashtags ?? [],
  productHashtags: c.product_hashtags ?? [],
  limits: c.limits,
});

export const listChannels = () =>
  client.get('/creator/channels').then(({ data, meta }) => ({ items: data.map(mapSummary), max: meta?.max ?? 10 }));

export const getChannel = (id) => client.get(`/creator/channels/${id}`).then(({ data }) => mapChannel(data));

export const createChannel = ({ name, workerId }) =>
  client.post('/creator/channels', { name: name.trim(), worker_id: Number(workerId) }).then(({ data }) => mapChannel(data));

/** Chỉ gửi phần có trong values (camelCase -> snake_case). */
export const updateChannel = (id, values) => {
  const map = {
    name: 'name',
    workerId: 'worker_id',
    planDays: 'plan_days',
    postsPerDay: 'posts_per_day',
    timeSlots: 'time_slots',
    videoPercent: 'video_percent',
    autoApproveLineup: 'auto_approve_lineup',
    autoApproveTemplates: 'auto_approve_templates',
    autoApprovePlan: 'auto_approve_plan',
    persona: 'persona',
    titleMax: 'title_max',
    contentMax: 'content_max',
    requirements: 'requirements',
    hashtags: 'hashtags',
  };
  const body = Object.fromEntries(Object.entries(values).filter(([k]) => map[k]).map(([k, v]) => [map[k], v]));
  return client.put(`/creator/channels/${id}`, body).then(({ data }) => mapChannel(data));
};

export const deleteChannel = (id) => client.delete(`/creator/channels/${id}`);

export const listChannelWorkers = () =>
  client.get('/creator/channel-workers').then(({ data }) => data.map((w) => ({ id: w.id, name: w.name, channelId: w.channel_id })));

export const listPostSamples = () =>
  client.get('/creator/channels/post-samples').then(({ data, meta }) => ({ items: data, groups: meta?.groups ?? {} }));

// ---- Tuyến nội dung ----

export const getLineups = (id) => client.get(`/creator/channels/${id}/lineups`).then(({ data }) => data);

export const updateLineup = (id, lineupId, items) =>
  client.put(`/creator/channels/${id}/lineups/${lineupId}`, { items }).then(({ data }) => data);

export const decideLineup = (id, lineupId, approve) =>
  client.post(`/creator/channels/${id}/lineups/${lineupId}/${approve ? 'approve' : 'reject'}`).then(({ data }) => data);

// ---- Template chữ ----

export const getTextTemplates = (id) =>
  client.get(`/creator/channels/${id}/text-templates`).then(({ data, meta }) => ({ items: data, meta }));

/** Chủ shop tự thêm template chữ: được duyệt luôn. */
export const createTextTemplate = (id, values) =>
  client.post(`/creator/channels/${id}/text-templates`, values).then(({ data }) => data);

export const updateTextTemplate = (id, templateId, values) =>
  client.put(`/creator/channels/${id}/text-templates/${templateId}`, values).then(({ data }) => data);

export const decideTextTemplate = (id, templateId, approve) =>
  client.post(`/creator/channels/${id}/text-templates/${templateId}/${approve ? 'approve' : 'reject'}`).then(({ data }) => data);

// ---- Kỳ kế hoạch ----

export const listPlans = (id) => client.get(`/creator/channels/${id}/plans`).then(({ data }) => data);

export const getPlanJob = (id) => client.get(`/creator/channels/${id}/plan-job`).then(({ data }) => data);

export const startPlanJob = (id, note) =>
  client.post(`/creator/channels/${id}/plan-jobs`, { note: note?.trim() || null }).then(({ data }) => data);

export const isPlanJobRunning = (job) => job?.status === 'queued' || job?.status === 'processing';

export const getPlan = (id, planId) => client.get(`/creator/channels/${id}/plans/${planId}`).then(({ data }) => data);

export const decidePlan = (id, planId, approve) =>
  client.post(`/creator/channels/${id}/plans/${planId}/${approve ? 'approve' : 'cancel'}`).then(({ data }) => data);

export const cancelPlanItem = (id, planId, itemId) =>
  client.post(`/creator/channels/${id}/plans/${planId}/items/${itemId}/cancel`).then(({ data }) => data);

export const updatePlanItem = (id, planId, itemId, body) =>
  client.put(`/creator/channels/${id}/plans/${planId}/items/${itemId}`, body).then(({ data }) => data);

// ---- Lịch đăng ----

export const getCalendar = (id, from, to) =>
  client.get(`/creator/channels/${id}/calendar`, { params: { from, to } }).then(({ data }) => data);

export const updateOverlays = (postId, overlays) =>
  client.put(`/creator/channel-posts/${postId}/overlays`, { overlays }).then(({ data }) => data);

export const setRedo = (postId, on) =>
  (on ? client.post(`/creator/channel-posts/${postId}/redo`) : client.delete(`/creator/channel-posts/${postId}/redo`)).then(({ data }) => data);

// ---- Chủ đề ----

export const TOPIC_STATUS = { ACTIVE: 'active', PAUSED: 'paused' };

export const getTopics = (id) => client.get(`/creator/channels/${id}/topics`).then(({ data }) => data);

export const createTopic = (id, values) => client.post(`/creator/channels/${id}/topics`, values).then(({ data }) => data);

export const startTopicJob = (id, { count, note }) =>
  client.post(`/creator/channels/${id}/topic-jobs`, { count: Number(count), note: note?.trim() || null }).then(({ data }) => data);

/** Lượt xây dựng tự động còn đang chạy (chờ worker / worker đang lập). */
export const isTopicJobRunning = (job) => job?.status === 'queued' || job?.status === 'processing';

export const updateTopic = (id, topicId, values) =>
  client.put(`/creator/channels/${id}/topics/${topicId}`, values).then(({ data }) => data);
