import { useRef } from 'react';
import { newIdempotencyKey } from '../api/tiktok';

/*
 * Khoá chống tạo trùng cho mỗi lần bấm tạo (lô ảnh, bài đăng). Lỗi mạng (không có status) thì giữ khoá để bấm lại
 * không tạo bản thứ hai; máy chủ đã trả lỗi (422, 402...) thì chưa tạo gì -> lần sau dùng khoá mới.
 */
export default function useIdempotencyKey() {
  const key = useRef(newIdempotencyKey());
  const renew = () => {
    key.current = newIdempotencyKey();
  };
  return { key, renew, renewAfter: (err) => err?.status && renew() };
}
