export const formatCount = (n) => {
  if (n == null) return '0';
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(n);
};

// null = chưa có lượt đánh giá nào
export const formatRating = (r) => (r == null ? 'Mới' : Number(r).toFixed(1));

// Credit hiển thị kiểu Việt Nam: 20000 -> "20.000"
export const formatCredit = (n) => Number(n ?? 0).toLocaleString('vi-VN');
