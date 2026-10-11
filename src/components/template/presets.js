import { createField, emptyTemplate } from './templateSchema';

// Mẫu khởi đầu theo hai ví dụ trong đặc tả (§6, Phụ lục A)

const imageField = (key, label, role, description) => ({
  ...createField('image'),
  key,
  label,
  description,
  required: true,
  prompt_mapping: { role },
});

const SHOE_PROMPT = `TẠO ẢNH QUẢNG CÁO GIÀY CAO CẤP

Sử dụng chính xác đôi giày trong ảnh sản phẩm được cung cấp.

BẢO TOÀN SẢN PHẨM
- Giữ nguyên kiểu dáng, màu sắc, chất liệu và tỉ lệ.
- Giữ nguyên logo, họa tiết, dây, quai, khóa, đế và gót.
- Không thêm, xóa hoặc thiết kế lại chi tiết sản phẩm.

BỐI CẢNH
Trưng bày đôi giày trong studio cao cấp.
Nền đá tối sang trọng, ánh sáng mềm và bóng đổ chân thực.
Bố cục tập trung vào sản phẩm, phong cách ảnh thương mại cao cấp.

ĐẦU RA
Tạo ảnh sản phẩm hoàn chỉnh theo tỉ lệ đã cấu hình.
Không thêm chữ, watermark hoặc logo không có trong ảnh gốc.`;

const FASHION_PROMPT = `TẠO ẢNH THỜI TRANG CAO CẤP

VAI TRÒ ẢNH ĐẦU VÀO
1. Ảnh sản phẩm giày: nguồn sản phẩm chính.
Người mẫu phải mang đúng đôi giày được cung cấp.
2. Ảnh outfit: tham chiếu trang phục, màu sắc, phong cách
và cách phối đồ của người mẫu.

QUY TẮC ƯU TIÊN
- Không lấy giày trong ảnh outfit để thay thế giày chính.
- Không đổi màu, thiết kế lại hoặc thay chi tiết đôi giày.
- Không tự ý thêm logo hoặc chi tiết không có trên sản phẩm.
- Khi hai ảnh mâu thuẫn về giày, ưu tiên ảnh sản phẩm giày.

BỐ CỤC
Tạo ảnh editorial thời trang cao cấp, người mẫu xuất hiện
đủ để nhìn rõ outfit và đôi giày. Tư thế tự nhiên, tỉ lệ cơ
thể chân thực, ánh sáng chuyên nghiệp.

YÊU CẦU BỔ SUNG
{{additional_instructions}}

ĐẦU RA
Tạo một ảnh thời trang hoàn chỉnh theo cấu hình đã chọn.`;

export const PRESETS = [
  {
    id: 'blank',
    title: 'Trống',
    icon: 'add_box',
    description: 'Tự thêm từng trường đầu vào.',
    build: emptyTemplate,
  },
  {
    id: 'shoe',
    title: 'Ảnh sản phẩm giày',
    icon: 'steps',
    description: 'Người mua chỉ tải 1 ảnh giày.',
    build: () => ({
      name: 'Ảnh sản phẩm giày',
      template_key: 'single-shoe-product',
      fields: [imageField('product_image', 'Ảnh sản phẩm giày', 'primary_product', 'Tải ảnh đôi giày cần quảng cáo')],
      prompt_text: SHOE_PROMPT,
    }),
  },
  {
    id: 'fashion',
    title: 'Ảnh thời trang',
    icon: 'checkroom',
    description: 'Ảnh giày + ảnh outfit + yêu cầu bổ sung.',
    build: () => ({
      name: 'Đầu vào tạo ảnh giày thời trang',
      template_key: 'shoe-fashion-input',
      fields: [
        imageField('product_image', 'Ảnh sản phẩm giày', 'primary_product', 'Tải ảnh đôi giày cần quảng cáo'),
        imageField('outfit_image', 'Ảnh outfit', 'outfit_reference', 'Ảnh trang phục người mẫu sẽ mặc'),
        {
          ...createField('textarea'),
          key: 'additional_instructions',
          label: 'Yêu cầu bổ sung',
          required: false,
          validation: { max_length: 1000 },
          prompt_mapping: { role: 'user_instruction' },
        },
      ],
      prompt_text: FASHION_PROMPT,
    }),
  },
];
