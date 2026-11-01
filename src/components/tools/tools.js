// Danh sách công cụ xử lý ảnh (chạy hoàn toàn trên trình duyệt, ảnh không gửi lên server)

export const TOOLS = [
  {
    slug: 'chen-logo',
    title: 'Chèn logo',
    description: 'Cắt ảnh theo tỷ lệ, chèn logo và chữ chìm',
    type: 'logo',
    icon: 'branding_watermark',
  },
  {
    // Có trang riêng (to), không mở trong ToolDetailPage
    slug: 'tao-anh-theo-lo',
    title: 'Tạo ảnh theo lô',
    description: 'Chọn nhiều mẫu AI Creative, tạo nhiều ảnh một lần rồi đăng bài',
    type: 'link',
    to: '/batches',
    icon: 'burst_mode',
  },
  {
    // Có trang riêng (to), không mở trong ToolDetailPage
    slug: 'dang-bai',
    title: 'Đăng bài',
    description: 'Đăng ảnh đã tạo trên A51 lên TikTok, Facebook, Instagram',
    type: 'link',
    to: '/posts',
    icon: 'upload',
  },
  {
    // Có trang riêng (to), không mở trong ToolDetailPage
    slug: 'tao-don-ghn',
    title: 'Tạo đơn GHN từ ảnh',
    description: 'Tải ảnh chat với khách, AI điền sẵn đơn Giao Hàng Nhanh',
    type: 'link',
    to: '/shipping-orders',
    icon: 'local_shipping',
  },
];

export const findTool = (slug) => TOOLS.find((t) => t.slug === slug && !t.to);
