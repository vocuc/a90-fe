import client from './client';
import { mapBatch } from './batches';

/*
 * ---- Chủ shop quản lý nhân viên (cần hồ sơ người bán) ----
 * Đặc tả: note/chia-se-tai-nguyen.txt. Thêm bằng email là thành nhân viên ngay; mỗi người chỉ thuộc một shop, tài khoản
 * đã có shop không làm nhân viên được. Nhân viên dùng sản phẩm / nhóm / creative của shop, tiền trừ ví nhân viên.
 *
 * GET    /creator/staff                         -> { data: Staff[] } (mới thêm trước)
 * POST   /creator/staff { email }               -> 201 { data: Staff }; 422 errors.email (không tìm thấy, đã có shop,
 *                                                  đã thuộc shop khác...)
 * DELETE /creator/staff/{id}                    -> 204 (nhân viên mất quyền ngay, lô đã tạo vẫn ở tài khoản nhân viên)
 * GET    /creator/staff-batches?user_id=&page=&per_page=  lô nhân viên tạo bằng tài nguyên shop, kể cả nhân viên đã gỡ
 *                                                  -> { data: ImageBatch[] (kèm user), meta }
 * GET    /creator/staff-batches/{id}            -> { data: ImageBatch (kèm images, user) }; chủ shop chỉ xem
 * Staff: { id, user: { id, name, email }, created_at }
 */

export const STAFF_KEYS = {
  staff: ['creator', 'staff'],
  batches: ['creator', 'staff-batches'],
};

const mapStaff = (s) => ({ id: s.id, user: s.user, createdAt: s.created_at });

const mapStaffBatch = (b) => ({ ...mapBatch(b), user: b.user ?? null });

export const listStaff = () => client.get('/creator/staff').then(({ data }) => data.map(mapStaff));

export const addStaff = (email) => client.post('/creator/staff', { email }).then(({ data }) => mapStaff(data));

export const removeStaff = (id) => client.delete(`/creator/staff/${id}`);

export const listStaffBatches = ({ userId, page = 1, limit = 20 } = {}) =>
  client
    .get('/creator/staff-batches', { params: { user_id: userId || undefined, page, per_page: limit } })
    .then(({ data, meta }) => ({
      items: data.map(mapStaffBatch),
      page: meta.current_page,
      lastPage: meta.last_page,
      total: meta.total,
    }));

export const getStaffBatch = (id) => client.get(`/creator/staff-batches/${id}`).then(({ data }) => mapStaffBatch(data));
