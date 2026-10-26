import { getCookie, setCookie } from './cookie';
import { hashtagSlug } from './hashtag';

/*
 * Hashtag người dùng đã nhập khi tạo bài đăng, lưu ở cookie kèm số lần dùng để gợi ý lại.
 * Lưu gọn "ten:so,ten:so" (tên hashtag không chứa , hoặc :), dùng nhiều nhất trước. Cookie tối đa ~4KB nên
 * bỏ bớt hashtag ít dùng nhất khi quá dài.
 */
const COOKIE = 'post_hashtags';
const MAX_ENCODED_LENGTH = 3500;
const SUGGEST_LIMIT = 10;

const byCount = (a, b) => b.count - a.count;

/** [{ name, count }], dùng nhiều nhất trước. */
export function readHashtagHistory() {
  try {
    return (getCookie(COOKIE) ?? '')
      .split(',')
      .map((item) => {
        const [name, count] = item.split(':');
        return { name, count: Number(count) || 1 };
      })
      .filter((h) => h.name && hashtagSlug(h.name))
      .sort(byCount);
  } catch {
    return [];
  }
}

/** Cộng 1 lần dùng cho mỗi hashtag (so trùng theo slug), trả lịch sử mới. */
export function recordHashtags(names) {
  const list = readHashtagHistory();
  names.forEach((name) => {
    const slug = hashtagSlug(name);
    const found = list.find((h) => hashtagSlug(h.name) === slug);
    if (found) {
      found.name = name;
      found.count += 1;
    } else if (slug) {
      list.push({ name, count: 1 });
    }
  });
  list.sort(byCount);
  const encode = (items) => items.map((h) => `${h.name}:${h.count}`).join(',');
  while (list.length && encodeURIComponent(encode(list)).length > MAX_ENCODED_LENGTH) list.pop();
  try {
    setCookie(COOKIE, encode(list));
  } catch {
    // Trình duyệt chặn cookie: vẫn gợi ý trong phiên này
  }
  return list;
}

/**
 * Tối đa 10 hashtag gợi ý, bỏ cái đã có trong bài (exclude). Chưa gõ gì: dùng nhiều nhất.
 * Đang gõ: hashtag chứa chữ đang gõ (không phân biệt dấu, hoa thường), bắt đầu bằng chữ đó xếp trước.
 */
export function suggestHashtags(history, text, exclude = []) {
  const taken = new Set(exclude.map(hashtagSlug));
  const prefix = hashtagSlug(text);
  const list = history.filter((h) => !taken.has(hashtagSlug(h.name)));
  if (!prefix) return list.slice(0, SUGGEST_LIMIT).map((h) => h.name);
  return list
    .filter((h) => hashtagSlug(h.name).includes(prefix))
    .sort((a, b) => hashtagSlug(b.name).startsWith(prefix) - hashtagSlug(a.name).startsWith(prefix) || byCount(a, b))
    .slice(0, SUGGEST_LIMIT)
    .map((h) => h.name);
}
