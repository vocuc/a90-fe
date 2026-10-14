// Khớp Hashtag::PATTERN / slugFor của backend

export const MAX_HASHTAGS = 10;
export const MAX_HASHTAG_LENGTH = 50;
const PATTERN = /^#?[\p{L}\p{N}_]+$/u;

/** "#ChânDung" -> "ChânDung" */
export const cleanHashtag = (value) => String(value ?? '').trim().replace(/^#+/, '');

/** "#ChânDung" -> "chandung" (khóa so trùng). Rỗng nếu không còn chữ/số Latin. */
export const hashtagSlug = (value) =>
  cleanHashtag(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9_]/g, '')
    .toLowerCase();

/** Lỗi của một hashtag, null nếu hợp lệ. */
export const hashtagError = (value) => {
  const name = cleanHashtag(value);
  if (!name) return 'Hashtag trống.';
  if (name.length > MAX_HASHTAG_LENGTH) return `#${name}: tối đa ${MAX_HASHTAG_LENGTH} ký tự.`;
  if (!PATTERN.test(name)) return `#${name}: chỉ gồm chữ, số và dấu gạch dưới (_), không có khoảng trắng.`;
  if (!hashtagSlug(name)) return `#${name}: phải chứa chữ cái hoặc chữ số.`;
  return null;
};
