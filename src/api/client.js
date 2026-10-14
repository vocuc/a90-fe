import axios from 'axios';
import { tokenStorage, UNAUTHORIZED_EVENT } from './tokenStorage';

export const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
export const MOCK_MARKETPLACE = import.meta.env.VITE_MOCK_MARKETPLACE === 'true';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  // Laravel chỉ trả lỗi dạng JSON khi request có Accept: application/json
  headers: { Accept: 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Laravel trả lỗi dạng { message, code?, context?, errors?: { field: [msg, ...] } }
const firstErrors = (errors) =>
  errors
    ? Object.fromEntries(Object.entries(errors).map(([field, msgs]) => [field, [].concat(msgs)[0]]))
    : undefined;

export const MAINTENANCE_MESSAGE = 'Máy chủ đang bảo trì, xin vui lòng quay lại sau!';

// Không gọi được API: mất kết nối / timeout (không có status) hoặc proxy báo backend không phản hồi
const isUnreachable = (status) => !status || status === 502 || status === 503 || status === 504;

// Lỗi nghiệp vụ có mã (TIKTOK_*, POST_*...) mang thông báo tiếng Việt riêng, kể cả khi status là 429 / 502
const hasOwnMessage = (body) => Boolean(body?.code && body?.message);

const messageFor = (status, body, fallback) => {
  if (hasOwnMessage(body)) return body.message;
  if (status === 429) return 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.';
  if (isUnreachable(status)) return MAINTENANCE_MESSAGE;
  if (status >= 500) return 'Máy chủ đang gặp sự cố, vui lòng thử lại sau.';
  return body?.message || fallback || 'Có lỗi xảy ra, vui lòng thử lại.';
};

client.interceptors.response.use(
  (res) => res.data,
  (error) => {
    const status = error.response?.status;
    const body = error.response?.data;
    if (status === 401 && error.config?.headers?.Authorization) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(
      Object.assign(new Error(messageFor(status, body, error.message)), {
        status,
        code: body?.code,
        context: body?.context,
        errors: firstErrors(body?.errors),
        // 502 TIKTOK_UNAVAILABLE: TikTok lỗi, không phải máy chủ A51 bảo trì
        maintenance: isUnreachable(status) && !hasOwnMessage(body),
      }),
    );
  },
);

export default client;
