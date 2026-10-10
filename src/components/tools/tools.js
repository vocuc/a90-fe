// Danh sách công cụ xử lý ảnh (chạy hoàn toàn trên trình duyệt, ảnh không gửi lên server)

// Khoảng cách giữa các ô ghép (px trên ảnh xuất)
const GAP = 6;

const ratio = (label) => {
  const [w, h] = label.split(':').map(Number);
  return { label, w, h };
};

const TALL_RATIOS = ['8:11', '2:3', '3:4', '4:5', '9:16', '1:1', '4:3', '16:9'].map(ratio);
const GRID_RATIOS = ['1:1', '4:5', '3:4', '2:3', '9:16', '4:3', '3:2', '16:9'].map(ratio);

// layout(W, H) trả về vị trí từng ô trên ảnh xuất: { [key]: { x, y, w, h } }
export const TOOLS = [
  {
    slug: 'ghep-2-anh',
    title: 'Ghép 2 ảnh',
    description: 'Ghép 2 ảnh đặt cạnh nhau theo chiều dọc',
    type: 'collage',
    slots: [
      { key: 'left', label: 'Ảnh trái' },
      { key: 'right', label: 'Ảnh phải' },
    ],
    ratios: TALL_RATIOS,
    defaultRatio: '9:16',
    layout: (W, H) => {
      const cw = (W - GAP) / 2;
      return {
        left: { x: 0, y: 0, w: cw, h: H },
        right: { x: cw + GAP, y: 0, w: W - cw - GAP, h: H },
      };
    },
  },
  {
    slug: 'ghep-3-anh',
    title: 'Ghép 3 ảnh',
    description: 'Ghép 3 ảnh dọc đặt cạnh nhau',
    type: 'collage',
    slots: [
      { key: 'left', label: 'Ảnh trái' },
      { key: 'middle', label: 'Ảnh giữa' },
      { key: 'right', label: 'Ảnh phải' },
    ],
    ratios: TALL_RATIOS,
    defaultRatio: '9:16',
    layout: (W, H) => {
      const cw = (W - GAP * 2) / 3;
      return {
        left: { x: 0, y: 0, w: cw, h: H },
        middle: { x: cw + GAP, y: 0, w: cw, h: H },
        right: { x: (cw + GAP) * 2, y: 0, w: cw, h: H },
      };
    },
  },
  {
    slug: 'ghep-1-doc-2-ngang',
    title: 'Ghép 1 dọc 2 ngang',
    description: '1 ảnh dọc bên trái, 2 ảnh ngang xếp chồng bên phải',
    type: 'collage',
    slots: [
      { key: 'left', label: 'Ảnh dọc' },
      { key: 'top', label: 'Ngang trên' },
      { key: 'bottom', label: 'Ngang dưới' },
    ],
    ratios: GRID_RATIOS,
    defaultRatio: '1:1',
    layout: (W, H) => {
      const cw = (W - GAP) / 2;
      const ch = (H - GAP) / 2;
      return {
        left: { x: 0, y: 0, w: cw, h: H },
        top: { x: cw + GAP, y: 0, w: W - cw - GAP, h: ch },
        bottom: { x: cw + GAP, y: ch + GAP, w: W - cw - GAP, h: H - ch - GAP },
      };
    },
  },
  {
    slug: 'ghep-4-anh',
    title: 'Ghép 4 ảnh',
    description: 'Chia khung thành 4 ô bằng nhau (2×2)',
    type: 'collage',
    slots: [
      { key: 'tl', label: 'Trên trái' },
      { key: 'tr', label: 'Trên phải' },
      { key: 'bl', label: 'Dưới trái' },
      { key: 'br', label: 'Dưới phải' },
    ],
    ratios: GRID_RATIOS,
    defaultRatio: '1:1',
    layout: (W, H) => {
      const cw = (W - GAP) / 2;
      const ch = (H - GAP) / 2;
      return {
        tl: { x: 0, y: 0, w: cw, h: ch },
        tr: { x: cw + GAP, y: 0, w: cw, h: ch },
        bl: { x: 0, y: ch + GAP, w: cw, h: ch },
        br: { x: cw + GAP, y: ch + GAP, w: cw, h: ch },
      };
    },
  },
  {
    slug: 'chen-logo',
    title: 'Chèn logo',
    description: 'Cắt ảnh theo tỷ lệ, chèn logo và chữ chìm',
    type: 'logo',
    icon: 'branding_watermark',
  },
];

export const findTool = (slug) => TOOLS.find((t) => t.slug === slug);
