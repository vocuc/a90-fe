BÀI VIẾT MẪU - ĐẶC TẢ TỪNG LOẠI CHO LỆNH /lap-ke-hoach
======================================================================

Ngày: 2026-11-21. Mỗi loại 1 file <key>.txt. Đọc file của loại đang bàn + mục QUY TẮC CHUNG dưới đây.
Nguồn: D:\OSPanel\home\a90.local\app\Support\PostSamples.php, skill D:\FlowKit\.claude\skills\lap-ke-hoach.

QUY TẮC CHUNG (mọi loại)
----------------------------------------
- 1 slot giờ = 1 bài; format bài = format slot (ảnh / video). Bài video: đúng số ảnh của video template, không chữ.
- Chọn bài viết mẫu theo tỉ lệ tuyến đã duyệt, rải đều, không 2 bài cùng mẫu liền nhau nếu tránh được.
- Hook: theo chân dung khách hàng + dịp lễ gần ngày đăng + tình huống. Chủ đề (Tết...) chỉ là hook. Không nêu hãng.
- Chữ trên ảnh: chỉ slide bài viết mẫu cho phép, ngắn, KHÔNG emoji, nói như người thật; chọn template chữ đã duyệt.
- Caption: title <= title_max của kênh, theo Yêu cầu kênh; content để RỖNG (nội dung dài làm TikTok co khung ảnh 3:4);
  hashtag tối đa hashtags_max, chỉ trong kho hashtag kênh.
- Chủ đề (2026-11-21): mọi bài có topic_id, CHỈ chọn chủ đề có sẵn của kênh (worker lập chủ đề / chủ shop tạo);
  cùng chủ đề + cùng loại bài không lặp trong 14 ngày. Hook viết theo chủ đề + loại bài.
- Ảnh sản phẩm (2026-11-21): KHÔNG xem ảnh. kehoach.py products <id-kênh> <tag>=... lọc sản phẩm đã gắn tag theo tag
  của chủ đề, mỗi sản phẩm 1 ref (A51 chọn ngẫu nhiên trong 10 ảnh tạo gần nhất); ưu tiên used thấp / lâu chưa dùng.
  Sản phẩm chưa gắn tag: chạy /gan-tag-san-pham. Xem ../chu-de-va-tag-san-pham.txt.
- Không bịa thông tin: giá, ưu đãi, chính sách, bảng size chỉ dùng khi có trong Yêu cầu kênh.
- Bài sai bị backend trả rejected kèm lý do: sửa, gửi lại tối đa 2 lần, vẫn sai thì để trống slot.

CHỈ BÀI ĐÃ LÀM XONG MỚI BẬT (người dùng chốt 2026-11-21)
----------------------------------------
- PostSamples::READY (D:\OSPanel\home\a90.local\app\Support\PostSamples.php) = danh sách bài bật, hiện: top_n, lookbook,
  outfit_by_day, unboxing. Làm xong bài nào thì thêm key vào READY + đổi trạng thái trong mục lục thành "ĐÃ LÀM".
- Bài chưa bật: không thêm được vào tuyến (SAMPLE_NOT_READY), không lập kế hoạch được, không gắn template chữ được;
  tuyến cũ có bài chưa bật thì bài đó bị bỏ qua; tuyến không còn bài bật nào = kênh thiếu tuyến.
- Frontend: tab Bài viết mẫu hiện "Chưa làm xong", tab Tuyến nội dung chỉ thêm được bài bật.
- Hai bài bật đều CHỈ LÀ ẢNH -> slot video không có bài nào: đặt tỉ lệ video của kênh = 0%.

MỤC LỤC
----------------------------------------
Trưng bày hàng:
  unboxing               Đập hộp                      ĐÃ LÀM: kiểu bài ảnh chủ shop hay đăng, duyệt kỳ tạo lô tự động, không chữ
  closeup                Soi cận cảnh                 LÀM ĐƯỢC MỘT PHẦN (chưa cắt cận được)
  new_arrival            Hàng mới về                  LÀM ĐƯỢC
  color_options          1 mẫu nhiều màu              LÀM ĐƯỢC NẾU CÓ ẢNH (hệ thống chưa biết màu)
So sánh, chọn lựa:
  this_or_that           A hay B                      LÀM ĐƯỢC (chưa có slide ghép 2 ảnh)
  top_n                  Top N                        ĐÃ LÀM: content-worker dựng bìa ghép + chữ #1..#N
  which_suits_you        Bạn hợp đôi nào              LÀM ĐƯỢC
Phối đồ:
  lookbook               Phối đồ                      ĐÃ LÀM: chủ đề + hashtag -> lô phối đồ có sẵn hook, tìm outfit theo hashtag
  one_shoe_many_looks    1 đôi N cách phối            LÀM ĐƯỢC NẾU CÓ ẢNH KHỚP (khó) - tạm gác 2026-11-21
  box_to_feet            Từ hộp lên chân              LÀM ĐƯỢC NẾU CÓ ẢNH KHỚP (rất khó)
  outfit_by_day          Outfit theo ngày / dịp       ĐÃ LÀM: lô phối đồ mới, worker in nhãn ngày thay 'Outfit N'
Kể chuyện, cảm xúc:
  pov                    POV                          LÀM ĐƯỢC
  meme_types             Meme 'N kiểu người'          LÀM ĐƯỢC
  before_after           Trước / sau                  THIẾU ẢNH 'TRƯỚC'
Hữu ích, tư vấn:
  size_guide             Chọn size                    LÀM ĐƯỢC (chữ dài, xem lại độ đẹp)
  care_tips              Bảo quản / mẹo               LÀM ĐƯỢC
  faq                    Hỏi đáp                      LÀM ĐƯỢC NẾU CÓ THÔNG TIN SHOP
Gợi ý theo người nhận:
  gift_by_receiver       Quà theo người nhận          LÀM ĐƯỢC
  by_budget              Theo mức giá                 CHƯA LÀM ĐƯỢC (không có giá sản phẩm)
Chuỗi bài:
  daily_drop             Mỗi ngày 1 mẫu / đếm ngược   LÀM ĐƯỢC
  numbered               Đánh số tập                  LÀM ĐƯỢC
Ưu đãi:
  sale                   Ưu đãi                       LÀM ĐƯỢC NẾU CÓ THÔNG TIN ƯU ĐÃI

TỔNG HỢP CHỖ CẦN QUYẾT (chi tiết trong từng file)
----------------------------------------
- Ghép ảnh (collage) cho A hay B, Top N.
- Cắt cận 1 ảnh thành nhiều slide (Soi cận cảnh).
- Ảnh phối đồ mang đúng giày sản phẩm (1 đôi N cách phối, Từ hộp lên chân).
- Hook cố định cho lô phối đồ (Lookbook) + chọn outfit theo gì.
- Dữ liệu shop còn thiếu: giá sản phẩm, màu / biến thể, chính sách ship-đổi trả, bảng size, ưu đãi đang chạy.
- Bỏ hay giữ: Trước / sau (thiếu ảnh 'trước'), Theo mức giá (thiếu giá).
