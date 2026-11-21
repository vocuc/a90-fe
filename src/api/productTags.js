import client from './client';

/*
 * ---- Tag sản phẩm + bộ lọc tag của chủ đề kênh (note/xay-kenh-tiktok/chu-de-va-tag-san-pham.txt mục 2, 4) ----
 * AI gắn tag bằng lệnh /gan-tag-san-pham của đội A51; chủ shop sửa được. Trường chủ shop đã sửa (nguồn "owner") AI không
 * ghi đè; xoá giá trị = trả lại cho AI gắn.
 * PUT /creator/products/{id}/tags { ai_label?: string|null, tags?: { kieu?, got?, mau?, phong_cach?, dip? } } -> { data: Product }
 *     Chỉ gửi trường muốn sửa (trường gửi lên thành nguồn owner). Sai giá trị -> 422 errors.tags.
 * Giá trị khớp App\Support\ProductTags ở backend.
 */

export const TAG_SOURCE = { AI: 'ai', OWNER: 'owner' };

export const LABEL_MAX = 60;

/** multi: nhiều giá trị (max), options: null = chữ tự do (màu). */
export const TAG_FIELDS = [
  {
    key: 'kieu',
    label: 'Kiểu giày',
    multi: false,
    options: {
      cao_got: 'Cao gót', sandal: 'Sandal', bup_be: 'Búp bê', mule: 'Mule',
      sneaker: 'Sneaker', boot: 'Boot', dep: 'Dép', slingback: 'Slingback',
    },
  },
  { key: 'got', label: 'Gót', multi: false, options: { bet: 'Bệt', thap: 'Thấp', vua: 'Vừa', cao: 'Cao' } },
  { key: 'mau', label: 'Màu', multi: true, max: 2, options: null },
  {
    key: 'phong_cach',
    label: 'Phong cách',
    multi: true,
    max: 3,
    options: { sang_chanh: 'Sang chảnh', nhe_nhang: 'Nhẹ nhàng', tre_trung: 'Trẻ trung', ca_tinh: 'Cá tính', basic: 'Basic' },
  },
  {
    key: 'dip',
    label: 'Dịp',
    multi: true,
    max: 4,
    options: { di_lam: 'Đi làm', di_tiec: 'Đi tiệc', tet: 'Tết', hen_ho: 'Hẹn hò', di_choi: 'Đi chơi', cafe: 'Cafe' },
  },
];

/** Màu dạng lưu (không dấu, gạch dưới) như backend: "Đỏ đô" -> "do_do". */
export const colorSlug = (text) =>
  text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** Nhãn hiển thị 1 giá trị tag. */
export const tagValueLabel = (field, value) => {
  const def = TAG_FIELDS.find((f) => f.key === field);
  return def?.options?.[value] ?? String(value).replace(/_/g, ' ');
};

/** Tag -> danh sách chip [{ field, value, label }] theo thứ tự trường. */
export const tagChips = (tags) =>
  TAG_FIELDS.flatMap((f) =>
    [].concat(tags?.[f.key] ?? []).map((value) => ({ field: f.key, value, label: tagValueLabel(f.key, value) })),
  );

/** values: { aiLabel?, tags? } chỉ phần đã đổi. */
export const updateProductTags = (id, { aiLabel, tags }) =>
  client
    .put(`/creator/products/${id}/tags`, {
      ...(aiLabel !== undefined ? { ai_label: aiLabel || null } : {}),
      ...(tags && Object.keys(tags).length ? { tags } : {}),
    })
    .then(({ data }) => data);
