import client from './client';

/*
 * ---- Kế hoạch nội dung (FlowKit a51-skills/ke-hoach-noi-dung/thiet-ke.txt mục 9) ----
 * Skill kế hoạch (Claude) lập bài trên A51: sản phẩm + giờ đăng + bối cảnh + kịch bản (ý chính + 1 câu lệnh / ảnh).
 * Bài kế hoạch (source = plan) đi luồng bài ảnh: ảnh xong -> AI viết caption theo ý chính -> chờ duyệt. Miễn phí.
 *
 * Bối cảnh cố định (chủ shop quy ước, planner chỉ đọc):
 * GET    /plan-contexts                  -> { data: PlanContext[] }
 * POST   /plan-contexts { name, description, aspect_ratio?, model_id?, is_active? } -> 201 { data: PlanContext }
 * PUT    /plan-contexts/{id} (cùng trường, gửi trường nào sửa trường đó) -> { data: PlanContext }
 * DELETE /plan-contexts/{id}             -> 204
 * PlanContext: { id, name, description, aspect_ratio, model: { id, name }, is_active, created_at, updated_at }
 * Lỗi 422: errors.name (<= 100), errors.description (<= 4000), errors.aspect_ratio (model không hỗ trợ tỉ lệ).
 *
 * Token kế hoạch (trang Tài khoản): token dài hạn cho skill, chỉ gọi được /planner/*. Tạo lại -> token cũ hết hiệu lực.
 * GET    /planner-token                  -> { data: { exists, created_at, last_used_at } }
 * POST   /planner-token                  -> 201 { data: { token, created_at } }   (token chỉ trả về 1 lần)
 *
 * "Làm lại" bài kế hoạch: POST /social/posts/{id}/redo (src/api/social.js redoPlanPost)
 */

export const PLAN_CONTEXT_KEYS = { all: ['plan-contexts'] };
export const PLANNER_TOKEN_KEY = ['planner-token'];

export const PLAN_CONTEXT_NAME_MAX = 100;
export const PLAN_CONTEXT_DESCRIPTION_MAX = 4000;
export const PLAN_CONTEXT_DEFAULT_RATIO = '9:16';

const mapContext = (c) => ({
  id: c.id,
  name: c.name,
  description: c.description ?? '',
  aspectRatio: c.aspect_ratio,
  model: c.model ? { id: c.model.id, name: c.model.name } : null,
  active: !!c.is_active,
  updatedAt: c.updated_at,
});

const toBody = (v) => {
  const body = {};
  if (v.name !== undefined) body.name = v.name.trim();
  if (v.description !== undefined) body.description = v.description.trim();
  if (v.aspectRatio !== undefined) body.aspect_ratio = v.aspectRatio;
  if (v.modelId !== undefined) body.model_id = v.modelId ? Number(v.modelId) : null;
  if (v.active !== undefined) body.is_active = v.active;
  return body;
};

export const listPlanContexts = () => client.get('/plan-contexts').then(({ data }) => data.map(mapContext));

export const createPlanContext = (values) => client.post('/plan-contexts', toBody(values)).then(({ data }) => mapContext(data));

export const updatePlanContext = (id, values) => client.put(`/plan-contexts/${id}`, toBody(values)).then(({ data }) => mapContext(data));

export const deletePlanContext = (id) => client.delete(`/plan-contexts/${id}`);

export const getPlannerToken = () =>
  client.get('/planner-token').then(({ data }) => ({ exists: !!data.exists, createdAt: data.created_at, lastUsedAt: data.last_used_at }));

export const createPlannerToken = () => client.post('/planner-token').then(({ data }) => ({ token: data.token, createdAt: data.created_at }));
