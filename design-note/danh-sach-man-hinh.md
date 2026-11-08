# A51 — Design note toàn bộ màn hình (brief cho Stitch)

> Tài liệu mô tả **mọi màn hình** của web app A51 (a51.vn): mục đích, bố cục, nội dung, chức năng chi tiết và các trạng thái.
> Dùng làm input cho Google Stitch để thiết kế lại giao diện. Mỗi mục "Màn hình" có thể copy riêng thành 1 prompt.
> Nguồn: mã nguồn `src/pages`, `src/components` (cập nhật 07/11/2026).

---

## 0. Bối cảnh sản phẩm

**A51 là gì:** nền tảng tạo ảnh sản phẩm bằng AI cho người bán hàng online Việt Nam.
- **Người mua (user):** chọn một mẫu "AI Creative", tải ảnh sản phẩm lên, trả tiền theo số ảnh (trừ ví), nhận ảnh chuyên nghiệp.
- **Người bán / Creator (có "cửa hàng"):** tự tạo mẫu AI Creative (prompt + form nhập liệu) để bán, nhận hoa hồng; đồng thời dùng bộ công cụ tự động hoá: tạo ảnh theo lô, tạo lô tự động, AI viết nội dung, đăng bài lên TikTok / Facebook / Instagram qua "worker", tạo video từ template, tạo đơn Giao Hàng Nhanh (GHN) từ ảnh chụp chat.
- **Ngôn ngữ giao diện:** 100% tiếng Việt. Tiền tệ VND (vd `2.000 ₫`).
- **Thiết bị:** mobile-first (đa số dùng điện thoại), có giao diện desktop đầy đủ.

### Thuật ngữ cố định (giữ nguyên chữ trong thiết kế)
| Thuật ngữ | Nghĩa |
|---|---|
| AI Creative / Creative / Mẫu | Một mẫu tạo ảnh AI do creator bán |
| Lô ảnh | Một lần tạo nhiều ảnh từ nhiều mẫu |
| Nhóm creative | Tập creative dùng cho tạo lô tự động |
| Nguyên liệu / Nguyên liệu ẩn | Ảnh/thông tin đầu vào; ảnh ẩn do creator tải, người mua không thấy |
| Worker | Máy được admin cấp cho shop, tự tạo ảnh / dựng video / đăng bài |
| Ví / Số dư / Nạp ví | Tiền trong tài khoản để trả phí tạo ảnh |

---

## 1. Hệ thống thiết kế hiện tại (có thể làm mới, giữ tinh thần)

- **Phong cách:** Material 3, sạch, sáng, bo góc lớn (thẻ 16px, nút 12px, chip tròn), bóng nhẹ, nền trắng/xám xanh rất nhạt.
- **Màu chính:** xanh dương `#2563eb` (primary-container), chữ chính `#131b2e`, nền tối đảo ngược `#283044`. Màu trạng thái: xanh lá (thành công/đã đăng), vàng hổ phách (chờ/cần kiểm tra), đỏ (lỗi), xanh da trời (đang xử lý / tự động).
- **Font:** Plus Jakarta Sans (hỗ trợ tiếng Việt).
- **Icon:** Material Symbols Rounded.
- **Lưới:** nội dung tối đa 1200px. Trang danh sách trải rộng; trang form / đọc chữ nằm trong **cột giữa 640px** trên desktop.
- **Thành phần dùng chung:** Thẻ (card), Chip lọc, Tab dạng segmented (nền xám, tab chọn nền trắng), TextField có icon trái, Select, Switch, nút Primary (xanh đặc) / Outline / Text, Dialog (bottom-sheet trên mobile, modal giữa trên desktop), ConfirmDialog (có biến thể nguy hiểm màu đỏ), SuccessDialog, ImageViewer toàn màn hình, Skeleton loading, EmptyState (icon + câu + nút), ErrorState (thông báo + "Thử lại"), FormAlert, Pagination / "Xem thêm", **ActionBar** dính đáy màn hình (tóm tắt bên trái + nút chính bên phải).

---

## 2. Khung ứng dụng (layout chung)

### 2.1 Header (cao 60px, dính đỉnh, nền trắng mờ blur)
- **Khách (chưa đăng nhập):** Logo A51 · menu ngang (desktop): *Trang chủ / Khám phá / Công cụ* · nút **Đăng nhập** (bên phải, ẩn khi đang ở trang đăng nhập/đăng ký).
- **Đã đăng nhập:**
  - Mobile: avatar + "Xin chào, {Tên}" bên trái (bấm → Tài khoản).
  - Desktop: Logo + menu ngang bên trái; avatar + tên ở cuối bên phải.
  - Bên phải: **chip ví** (icon ví + số dư VND), **nút chuông thông báo** có badge đỏ số chưa đọc (>9 hiện "9+").
- Mỗi trang con có **thanh tiêu đề riêng** dính ngay dưới header: nút ← quay lại, tiêu đề, mô tả ngắn 1 dòng, nút hành động bên phải.

### 2.2 Bottom navigation (chỉ mobile)
4 tab: **Trang chủ** (home) · **Khám phá** (shopping_bag) · **Công cụ** (handyman) · **Tài khoản** (person).

### 2.3 Footer (chỉ desktop)
Logo + câu giới thiệu "Tạo hình ảnh chuyên nghiệp bằng AI. Chọn mẫu AI Creative, tải ảnh sản phẩm lên và nhận ảnh trong vài giây." + link: Khám phá, Công cụ, Trung tâm hỗ trợ, Điều khoản sử dụng, Chính sách quyền riêng tư.

### 2.4 Màn hình không có thanh điều hướng
Chi tiết Creative, Đăng nhập, Đăng ký, Hỗ trợ, Điều khoản, Quyền riêng tư (chỉ header). Template Builder: toàn màn hình, không header chung.

### 2.5 Quy tắc chung
- Trang cần đăng nhập → tự chuyển sang Đăng nhập, xong quay lại đúng trang.
- Trang người bán khi **chưa có cửa hàng** → EmptyState "Bạn cần tạo cửa hàng trước…" + nút **Tạo cửa hàng**.
- Mọi danh sách có: skeleton khi tải, EmptyState khi rỗng, ErrorState khi lỗi.

---

## 3. Danh sách màn hình

| # | Màn hình | Route | Nhóm |
|---|---|---|---|
| 1 | Trang chủ | `/` | Công khai |
| 2 | Danh mục | `/categories` | Công khai |
| 3 | Khám phá (marketplace) | `/explore` | Công khai |
| 4 | Chi tiết AI Creative | `/creatives/:slug` | Công khai |
| 5 | Trang nhà sáng tạo (shop) | `/creators/:username` | Công khai |
| 6 | Đăng nhập | `/login` | Xác thực |
| 7 | Đăng ký | `/register` | Xác thực |
| 8 | Tạo ảnh AI | `/create?creative=` | Người mua |
| 9 | Tài khoản | `/account` | Người mua |
| 10 | Nạp tiền vào ví | `/account/topup` | Người mua |
| 11 | Lịch sử mua hàng | `/account/history` | Người mua |
| 12 | Công cụ | `/tools` | Hub |
| 13 | Công cụ Chèn logo | `/tools/chen-logo` | Công cụ |
| 14 | Tạo / Cấu hình cửa hàng | `/seller/settings` | Người bán |
| 15 | Quản lý Creative | `/seller/creatives` | Người bán |
| 16 | Template Builder (tạo/sửa Creative) | `/seller/creatives/new`, `/:id/edit` | Người bán |
| 17 | Nhóm creative | `/seller/creative-groups` | Người bán |
| 18 | Quản lý sản phẩm | `/seller/items` | Người bán |
| 19 | Quản lý video template | `/seller/video-templates` | Người bán |
| 20 | Thêm / Sửa video template | `/seller/video-templates/new`, `/:id/edit` | Người bán |
| 21 | Quản lý worker | `/seller/workers` | Người bán |
| 22 | AI viết nội dung | `/seller/ai-content` | Người bán |
| 23 | Danh sách lô ảnh | `/batches` | Tự động hoá |
| 24 | Tạo lô ảnh (thủ công) | `/batches/new` | Tự động hoá |
| 25 | Tạo lô tự động | `/batches/auto` | Tự động hoá |
| 26 | Chi tiết lô ảnh | `/batches/:id` | Tự động hoá |
| 27 | Danh sách bài đăng | `/posts` | Đăng bài |
| 28 | Tạo bài từ ảnh đã có | `/posts/new` | Đăng bài |
| 29 | Chi tiết / Sửa bài đăng | `/posts/:id` | Đăng bài |
| 30 | Danh sách đơn GHN | `/shipping-orders` | Vận chuyển |
| 31 | Tạo đơn GHN từ ảnh | `/shipping-orders/new` | Vận chuyển |
| 32 | Chi tiết đơn GHN | `/shipping-orders/:id` | Vận chuyển |
| 33 | Trung tâm hỗ trợ | `/support` | Thông tin |
| 34 | Điều khoản sử dụng | `/terms` | Thông tin |
| 35 | Chính sách quyền riêng tư | `/privacy` | Thông tin |
| 36 | Không tìm thấy trang (404) | `*` | Hệ thống |

Popup/Dialog quan trọng (mục 4): Tạo video, Thêm/Sửa sản phẩm, Tạo/Sửa nhóm creative, Sửa nguyên liệu, Cắt ảnh, Chọn ảnh từ A51, Chọn mẫu khởi đầu (Template Builder), Xác nhận.

---

## NHÓM A — CÔNG KHAI

### Màn hình 1 — Trang chủ `/`
**Mục đích:** giới thiệu A51, dẫn người dùng vào Khám phá hoặc các tính năng tự động hoá.

**Bố cục:** Desktop: Hero 2 cột (trái chữ + tìm kiếm, phải banner). Mobile: xếp dọc (tiêu đề → banner → mô tả → tìm kiếm → nút).

**Nội dung & chức năng:**
1. **Hero**
   - Badge nhỏ: ✨ "AI Studio Thế Hệ Mới".
   - Tiêu đề H1: **"Tạo hình ảnh chuyên nghiệp bằng AI"**.
   - Mô tả: "Khám phá hàng nghìn AI Creative và biến sản phẩm của bạn thành những hình ảnh chuyên nghiệp chỉ với vài thao tác."
   - Ô tìm kiếm: placeholder "Tìm kiếm AI Creative...", icon kính lúp, nút bộ lọc (tune). Enter → `/explore?q=…`.
   - 2 nút ngang: **Khám phá Creative** (primary) · **Tạo AI Creative** (outline).
   - **Banner carousel** (ảnh quảng bá từ server, có thể không có → khi đó hero chỉ 1 cột).
2. **Khám phá theo danh mục**: tiêu đề + link "Tất cả (N)". Lưới ô danh mục (mobile 4 cột × 2 hàng, desktop 8 cột × 1 hàng), mỗi ô = icon tròn + tên. Ô cuối "Xem thêm" (…) → `/categories`. Bấm ô → `/explore?category=slug`.
3. **Agent tự động hoá**: badge 🤖 "Agent tự động hoá", tiêu đề "Để agent tạo ảnh thay bạn", phụ đề "Từ tạo ảnh hàng loạt đến đăng bài, mọi bước đều có thể tự động". Lưới 6 thẻ (1/2/3 cột), mỗi thẻ: icon vuông, tiêu đề, mô tả, link CTA ›
   - Tạo lô tự động → "Tạo lô tự động"
   - Tạo ảnh hàng loạt → "Tạo lô ảnh"
   - Tự chèn logo shop → "Thiết lập cửa hàng"
   - AI viết nội dung → "Cài đặt AI viết"
   - Tự động đăng bài → "Tạo bài đăng"
   - Worker làm việc liên tục → "Xem worker"

---

### Màn hình 2 — Danh mục `/categories`
- Thanh tiêu đề: ← · "Danh mục" · "Chọn danh mục để xem các AI Creative phù hợp".
- Lưới ô vuông (mobile 3 cột, desktop 8 cột): icon tròn lớn + tên danh mục (tối đa 2 dòng). Bấm → Khám phá lọc theo danh mục.
- Trạng thái: skeleton 9 ô, rỗng "Chưa có danh mục nào.", lỗi + Thử lại.

---

### Màn hình 3 — Khám phá `/explore`
**Mục đích:** marketplace duyệt / tìm mẫu AI Creative.

**Nội dung & chức năng:**
1. Tiêu đề "Khám phá".
2. **Ô tìm kiếm thông minh** — placeholder "Tìm theo hashtag, ví dụ: chandung":
   - Gõ → tự lọc theo hashtag sau 0,4s.
   - **Dropdown gợi ý**: danh sách hashtag khớp (#tên + số mẫu), dòng cuối "Tìm theo tên mẫu "…"". Điều khiển bằng phím ↑ ↓ Enter Esc.
   - Nút **Xoá bộ lọc** khi đang lọc.
3. **Dải danh mục cuộn ngang** (chip icon + tên, chọn → highlight, bấm lại để bỏ).
4. **Dải hashtag phổ biến** cuộn ngang.
5. **Chip sắp xếp:** Phổ biến · Mới nhất · Giá thấp · Giá cao.
6. Dòng "N kết quả".
7. **Lưới thẻ Creative** (mobile 2 cột, desktop 4–5 cột), cuộn vô hạn: ảnh bìa (giữ tỉ lệ), tên mẫu, giá "/ảnh", ⭐ đánh giá, lượt dùng, tên shop.
- Rỗng: "Không tìm thấy AI Creative phù hợp." / "Chưa có AI Creative nào gắn #x." + nút "Tìm "x" theo tên mẫu", "Xoá bộ lọc".

---

### Màn hình 4 — Chi tiết AI Creative `/creatives/:slug`
**Bố cục:** Desktop 2 cột: trái lưới ảnh mẫu, phải khối thông tin dính (sticky). Mobile: ảnh → thông tin → **thanh CTA cố định đáy**.

**Nội dung & chức năng:**
- Thanh tiêu đề: ← (mở link trực tiếp thì về trang chủ) · tên Creative.
- **Gallery ảnh mẫu** (nhiều ảnh, giữ tỉ lệ gốc), bấm → xem toàn màn hình.
- **Khối thông tin:** tên (H2), giá to "**2.000 ₫** / ảnh", ⭐ điểm (số lượt đánh giá) hoặc "Chưa có đánh giá", "N lượt dùng", danh mục, hashtag, mô tả.
- **Thẻ Nhà sáng tạo:** avatar, tên shop, nhãn "Nhà sáng tạo" → trang shop.
- **CTA:** "Tạo ảnh sử dụng mẫu này" (đã đăng nhập) / "Đăng nhập để sử dụng" (khách). Nếu thiếu tiền: dòng cảnh báo "Bạn cần 2.000 ₫ cho mỗi ảnh, số dư hiện còn …" + gợi ý nạp ví.
- Lỗi 404: "AI Creative không tồn tại hoặc đã bị gỡ."

---

### Màn hình 5 — Trang nhà sáng tạo `/creators/:username`
- Thanh tiêu đề: ← · tên shop · nút chia sẻ.
- **Ảnh bìa** full width + **avatar** tròn chồng lên mép bìa.
- Tên shop, @username, "Tham gia tháng M/YYYY", mô tả shop (dài thì "Xem thêm / Thu gọn"), link website & mạng xã hội (icon).
- **3 chỉ số:** Lượt dùng · Đánh giá (⭐) · Theo dõi.
- Mục "**AI Creative đang bán**" + "N sản phẩm", chip sắp xếp (Phổ biến / Mới nhất / Giá thấp / Giá cao), lưới thẻ Creative cuộn vô hạn.
- Rỗng: "Nhà sáng tạo này chưa có AI Creative nào đang bán." · Không tồn tại: "Không tìm thấy nhà sáng tạo này." + "Khám phá AI Creative khác".

---

## NHÓM B — XÁC THỰC

### Màn hình 6 — Đăng nhập `/login`
- Cột giữa, thẻ form. Tiêu đề "**Đăng nhập A51**", phụ đề "Tiếp tục tạo hình ảnh chuyên nghiệp bằng AI."
  - Chế độ **thêm tài khoản** (`?add=1`): "Thêm tài khoản" / "Đăng nhập tài khoản khác để chuyển qua lại nhanh."
- Nút **Đăng nhập với Google** (full width).
- Divider "hoặc đăng nhập bằng email".
- Ô Email (icon mail), ô **Mật khẩu** (icon khoá, nút hiện/ẩn).
- Nút **Đăng nhập** (loading "Đang đăng nhập...").
- Dòng "Chưa có tài khoản? **Đăng ký ngay**".
- Thông báo lỗi dạng FormAlert.

### Màn hình 7 — Đăng ký `/register`
- Tiêu đề "**Tạo tài khoản A51**", phụ đề "Tạo tài khoản để bắt đầu biến ảnh sản phẩm thành ảnh chuyên nghiệp."
- Nút Google · divider "hoặc đăng ký bằng email".
- Trường: **Họ và tên** (placeholder "Nguyễn Văn A"), **Email**, **Mật khẩu** ("Ít nhất N ký tự"), **Nhập lại mật khẩu**.
- Checkbox "Tôi đồng ý với **Điều khoản sử dụng** và **Chính sách quyền riêng tư** của A51." (link mở tab mới).
- Nút **Đăng ký** (loading "Đang tạo tài khoản..."). Dòng "Đã có tài khoản? Đăng nhập".
- Lỗi inline từng ô: họ tên < 2 ký tự, email không hợp lệ / đã đăng ký, mật khẩu ngắn, nhập lại không khớp, chưa đồng ý điều khoản.

### Thành phần: Chuyển tài khoản (AccountSwitcher)
Danh sách các tài khoản đã đăng nhập trên máy (avatar, tên, email, dấu ✓ tài khoản hiện tại), bấm để chuyển nhanh; nút "Thêm tài khoản".

---

## NHÓM C — NGƯỜI MUA

### Màn hình 8 — Tạo ảnh AI `/create?creative=slug`
**Mục đích:** nhập nguyên liệu theo form của mẫu, thanh toán, nhận ảnh.

**Nội dung & chức năng:**
1. Thanh tiêu đề: ← (về mẫu) · "Tạo ảnh".
2. **Thẻ "Mẫu đang dùng"**: thumbnail, tên mẫu, giá "/ảnh".
3. **Hướng dẫn sử dụng** (văn bản creator viết) + link "Xem video hướng dẫn trên TikTok".
4. **Thông tin tạo ảnh** — *form động* sinh từ template của creator. Các loại trường có thể có:
   - Ảnh (1 ảnh, kéo-thả / bấm chọn, xem trước, xoá), Nhiều ảnh, Bộ ảnh (mỗi ô 1 vai trò: "Ảnh chính", "Ảnh tham chiếu"…)
   - Văn bản 1 dòng, Đoạn văn, Số
   - Danh sách chọn, Chọn nhiều, Nút chọn (radio dạng thẻ), Bật/tắt
   - **Tỉ lệ khung hình** (chip: 1:1, 3:4, 4:5, 9:16, 16:9…)
   - Trường có thể hiện/ẩn theo điều kiện, có dấu * bắt buộc, có gợi ý.
5. **Tuỳ chọn:** "Số ảnh" với nút − / + ("Tối đa N ảnh mỗi lần").
6. **Bảng thanh toán:** "2.000 ₫ × 3 ảnh", **Tổng thanh toán**, Số dư hiện tại, ghi chú "Ảnh tạo lỗi được hoàn tiền tự động.", cảnh báo "Số dư không đủ, cần thêm …".
7. Nút chính: "**Tạo 3 ảnh · 6.000 ₫**" (sau lần đầu: "Tạo thêm…"; loading "Đang gửi ảnh...").
8. **Kết quả** — mỗi lần tạo là 1 khối "Lần tạo #id · 3 ảnh · 1:1 · 6.000 ₫", trạng thái "2/3 thành công" / "Hoàn tất":
   - Ô ảnh đang chờ: spinner + "Xin vui lòng chờ khoảng 2 phút..." + **đồng hồ đếm ngược mm:ss** ("Sắp xong, vui lòng chờ thêm...").
   - Ô ảnh xong: thumbnail, bấm xem lớn, nút **Tải về**.
   - Ô ảnh lỗi: lý do (vi phạm chính sách an toàn / AI không tạo được ảnh / quá thời gian) + "Đã hoàn tiền."
   - Nút "**Tạo lại N ảnh lỗi · giá**".
- Chưa chọn mẫu: EmptyState "Chọn một mẫu AI Creative để bắt đầu tạo ảnh." + "Xem các mẫu".

---

### Màn hình 9 — Tài khoản `/account`
- Thanh tiêu đề "Tài khoản".
- **Thẻ hồ sơ:** avatar lớn, tên, email; nút **Nạp ví**.
- **Danh sách thông tin** (icon + nhãn + giá trị): Số dư · Hoa hồng khả dụng · Hoa hồng đang tạm giữ · Vai trò (Thành viên / Quản trị viên) · Cửa hàng (tên shop hoặc "Chưa tạo", link tới shop).
- **Chuyển tài khoản** (AccountSwitcher).
- **Liên kết:** Trung tâm hỗ trợ · Điều khoản sử dụng · Chính sách quyền riêng tư (mobile thay cho footer).
- Nút **Đăng xuất** (màu đỏ/viền).

### Màn hình 10 — Nạp tiền vào ví `/account/topup`
- Thanh tiêu đề: ← · "Nạp tiền vào ví".
- Thẻ "Số dư hiện tại" + số tiền lớn.
- **Các bước (stepper đánh số):**
  1. "Liên hệ admin để dùng thử miễn phí" — ảnh **mã QR Zalo** (bấm mở to) + hướng dẫn quét; nút "**Liên hệ admin qua Zalo**".
  2. Chuyển khoản / chụp màn hình giao dịch gửi admin qua Zalo kèm email tài khoản; số dư được cộng sau khi admin xác nhận.
- Ghi chú cuối: "Nếu số dư chưa được cộng, hãy nhắn lại cho admin qua Zalo hoặc xem thêm tại Trung tâm hỗ trợ."

### Màn hình 11 — Lịch sử mua hàng `/account/history`
**Bố cục:** lưới thẻ ảnh trải rộng (như Khám phá).
- Thanh tiêu đề: ← · "Lịch sử mua hàng".
- **Tab segmented:** Đang hoạt động · Bị lỗi · Đã tắt.
- **Bộ lọc có ảnh** (dropdown hiển thị thumbnail): "Lọc theo creative" (Tất cả creative) · "Lọc theo sản phẩm" (Tất cả sản phẩm) · nút ✕ bỏ lọc.
- **Thẻ ảnh** (mỗi ảnh đã tạo):
  - Ảnh kết quả (bấm phóng to), badge trạng thái: Đang chờ / Đang tạo / Hoàn tất / Thất bại / Đã huỷ.
  - 2 thumbnail nhỏ có nhãn: **Creative** (mẫu đã dùng; "Mẫu đã bị gỡ" nếu gỡ) và **Sản phẩm**.
  - Thời gian, giá.
  - Hành động: **Tải về** · **Tắt ảnh** (confirm: "Ảnh sẽ chuyển sang tab Đã tắt, không tải về và không dùng để đăng bài được nữa. Không hoàn tiền.") · **Tạo lại** (confirm "Tạo lại ảnh này theo cùng mẫu và nguyên liệu? Phí tính theo giá hiện tại.") · **Bật lại** (tab Đã tắt).
  - Thẻ lỗi: icon ảnh hỏng, lý do lỗi, "**Đã hoàn 2.000 ₫**".
  - Thẻ đã tắt: làm mờ + nhãn "Đã tắt".
- Rỗng theo tab: "Bạn chưa có ảnh nào." / "Không có ảnh nào bị lỗi." / "Bạn chưa tắt ảnh nào." / "Không có ảnh nào khớp bộ lọc." + "Bỏ lọc" / "Khám phá mẫu". Phân trang ở cuối.

---

## NHÓM D — CÔNG CỤ

### Màn hình 12 — Công cụ `/tools`
- Thanh tiêu đề: "Công cụ" · "Chèn logo, tạo ảnh theo lô, đăng bài và quản lý cửa hàng".
- **Lưới công cụ** (mobile 2 cột, desktop 4): thẻ = icon vuông + tên + mô tả.
  - Chèn logo — "Cắt ảnh theo tỷ lệ, chèn logo và chữ chìm"
  - Tạo ảnh theo lô — "Chọn nhiều mẫu AI Creative, tạo nhiều ảnh một lần rồi đăng bài"
  - Đăng bài — "Đăng ảnh đã tạo trên A51 lên TikTok, Facebook, Instagram"
  - Tạo đơn GHN từ ảnh — "Tải ảnh chat với khách, AI điền sẵn đơn Giao Hàng Nhanh" *(cần cửa hàng)*
- **Mục "Quản lý"** (lưới tương tự):
  - Lịch sử mua hàng · Quản lý Creative* · Quản lý sản phẩm* · Quản lý cửa hàng · Quản lý video template* · Quản lý worker* · AI viết nội dung* (chỉ hiện khi tính năng bật)
- *Thẻ bị **khoá** khi chưa có cửa hàng: icon ổ khoá xám, mô tả thay bằng "Cần mở cửa hàng", mờ 70%, không bấm được.

### Màn hình 13 — Chèn logo `/tools/chen-logo`
**Mục đích:** xử lý ảnh ngay trên trình duyệt (không upload). **Bố cục:** desktop 2 cột (trái khung ảnh, phải bảng điều khiển); mobile xếp dọc.
- Thanh tiêu đề: ← · "Chèn logo" · mô tả.
- **Chưa có ảnh:** vùng kéo-thả lớn "Bấm để chọn ảnh hoặc kéo ảnh vào đây" + "Ảnh được xử lý ngay trên trình duyệt, không gửi đi đâu."
- **Cột trái:**
  - "Tỷ lệ khung hình": chip Gốc · 1:1 · 4:3 · 3:4 · 3:2 · 16:9 · 9:16 · 4:5 · Tuỳ chỉnh (ô Rộng : Cao + "Áp dụng").
  - **Khung cắt** nền tối, lưới 1/3, kéo để di chuyển ảnh, cuộn / 2 ngón để zoom; logo kéo được trong khung.
  - Thanh zoom: − · slider · + · Đặt lại.
  - Dòng thông số "Ảnh gốc W×H px, vùng cắt w×h px, tỷ lệ X" · nút "Chọn ảnh khác".
- **Cột phải:**
  - **Logo:** "Tải logo lên"/"Đổi logo", "Xoá logo", gợi ý "Kéo logo trong khung để đổi vị trí", slider Bo góc · Độ mờ · Kích thước.
  - **Chữ chìm chéo màn hình:** ô chữ ("Nhập chữ (để trống = tắt), ví dụ: © tenbanquyen.com"), slider Cỡ chữ · Độ mờ · Cách lần lặp · Cách hàng.
  - **Xuất ảnh:** Chiều rộng (px) (placeholder "Gốc (w)"), Định dạng (JPG/PNG/WEBP), nút **Tải về**.
- Cấu hình được nhớ cho lần sau.

---

## NHÓM E — NGƯỜI BÁN (CỬA HÀNG)

### Màn hình 14 — Tạo / Cấu hình cửa hàng `/seller/settings`
- Thanh tiêu đề: ← · "**Tạo cửa hàng**" (chưa có) hoặc "**Cấu hình cửa hàng**".
- **Chưa có cửa hàng:** thẻ "Thông tin người bán" — "Tạo profile người bán để đăng bán AI Creative. Bạn có thể đổi ảnh ngay sau đó." + form (bên dưới) + nút **Tạo cửa hàng**.
- **Đã có cửa hàng:**
  1. **Ảnh shop:** ảnh bìa (bấm để đổi) + avatar tròn chồng lên (bấm để đổi), upload ngay khi chọn; "JPG, PNG, WEBP, tối đa 5MB". Avatar cũng là **logo** chèn vào ảnh lô.
  2. Ghi chú phí: "Phí nền tảng của bạn: **X%** trên mỗi ảnh bán được. Mức phí do A51 thiết lập."
  3. **Thông tin cửa hàng:** Tên shop * ("Ví dụ: Huy Studio AI") · Username (địa chỉ trang shop, gợi ý quy tắc) · Mô tả shop (textarea) · Website · **Mạng xã hội** (nhiều ô link có icon). Nút **Lưu thông tin** → SuccessDialog "Lưu thành công".
  4. **Kết nối GHN** — "Dùng để tạo đơn Giao Hàng Nhanh từ ảnh chụp đoạn chat với khách."
     - Chưa kết nối: ô **Token GHN**, ô **ShopId** (số) + gợi ý lấy ở tài khoản GHN; nút **Kết nối GHN** (loading "Đang kiểm tra...").
     - Đã kết nối: thẻ xanh ✓ "Đã kết nối GHN" · ShopId · Token ••••1234 · nút "Đổi" · link "Tạo đơn GHN từ ảnh".

### Màn hình 15 — Quản lý Creative `/seller/creatives`
- Thanh tiêu đề: ← · "Quản lý Creative" · nút "**Nhóm creative**" · nút primary "**+ Tạo mới**".
- Ô tìm theo hashtag ("Tìm theo hashtag, ví dụ: chandung") + nút xoá.
- **Tab trạng thái:** Tất cả · Đang bán · Nháp · Tạm dừng.
- **Lưới thẻ Creative** (mobile 2, desktop 4–5, cùng hàng cao bằng nhau):
  - Ảnh bìa (giữ tỉ lệ), badge trạng thái, badge "Bị ẩn" (nếu bị admin ẩn) và lý do tạm dừng ("Bạn đã tạm dừng" / "Không còn API key AI hoạt động").
  - Tên, giá/ảnh, icon tỉ lệ khung mặc định, hashtag, "N lượt tải về".
  - Nút: **Sửa** (bút) → Template Builder · **Đăng bán / Đăng bán lại / Tạm dừng** (confirm: "Tạm dừng bán? Người mua sẽ không tạo ảnh được…").
- Rỗng: "Bạn chưa tạo AI Creative nào." + "Tạo Creative" · "Không có AI Creative nào ở trạng thái này." · "Không có AI Creative nào gắn #x."

### Màn hình 16 — Template Builder `/seller/creatives/new` · `/:id/edit`
**Mục đích:** creator thiết kế một mẫu AI Creative: thông tin bán, prompt cho AI, form người mua nhập, xem trước. **Toàn màn hình, không header chung.**

**Thanh trên cùng:** ← (về danh sách Creative) · tên Creative (hoặc "Tạo và chỉnh sửa Creative") · dòng trạng thái ("Creative đang bán: thay đổi có hiệu lực ngay khi lưu" / "Sửa Creative · lưu thay đổi trước khi đăng bán" / "Đã lưu nháp trên trình duyệt lúc HH:MM") · nút "**Mẫu mới**" · nút "**Đăng bán / Đăng bán lại**" (khi sửa) · nút primary "**Tạo Creative / Lưu thay đổi**" (loading "Đang lưu...").

**Tab chính:** **Thiết kế form** · **Xem trước** (desktop có thể hiển thị song song).

**Tab Thiết kế form — gồm các panel:**
1. **Ảnh đại diện Creative:** vùng upload "Tải lên ảnh đại diện — Bấm để chọn hoặc kéo ảnh vào đây", JPG/PNG/WEBP ≤10MB; có ảnh thì "Đổi ảnh" / xoá.
2. **Chế độ hiển thị:** switch Công khai/Riêng tư — "Mọi người thấy Creative trên marketplace." / "Chỉ bạn thấy…".
3. **Video hướng dẫn:** link TikTok (không bắt buộc).
4. **Thông tin sản phẩm:** Tiêu đề ("Bỏ trống để tự đặt MS + thời gian tạo") · Danh mục (select) · **Model AI** (select) · **Giá bán mỗi ảnh (VND) *** · **Hashtag** (nhập chip, Enter/phẩy để thêm, gợi ý).
5. **Hướng dẫn sử dụng mẫu** (textarea, "Người mua thấy hướng dẫn này khi dùng mẫu.").
6. **Prompt (chỉ dẫn cố định):** "Chỉ dẫn cố định của Creator. Người mua không thấy và không sửa được; giá trị họ nhập chỉ thay vào {{biến}}."
   - Editor lớn, chèn biến `{{key}}` từ các trường.
   - **Chip đoạn mẫu** chèn nhanh: Mục tiêu · Vai trò ảnh · Bảo toàn sản phẩm · Quy tắc ưu tiên · Bối cảnh · Góc máy & bố cục · Ánh sáng · Đầu ra.
7. **Form canvas (kéo-thả):**
   - **Bảng thành phần** "Nguyên liệu — kéo vào form bên dưới (n/max)": Ảnh · Nhiều ảnh · Bộ ảnh · Văn bản · Đoạn văn · Số · Danh sách chọn · Chọn nhiều · Nút chọn · Bật/tắt · Tỉ lệ khung hình · **Nguyên liệu ẩn** (đếm "n/max").
   - **Vùng thả** (trống: "Kéo thành phần vào đây — Ví dụ: kéo "Ảnh" để người mua tải ảnh sản phẩm…").
   - Mỗi trường là thẻ có: tay nắm kéo, nút ↑ ↓, xoá (trừ Tỉ lệ khung hình), badge "Người mua không thấy" (trường ẩn).
   - **Cấu hình trường** khi mở: Label hiển thị · Tên trường (key) · switch Bắt buộc · gợi ý · vai trò ảnh (Sản phẩm chính / Tham chiếu outfit / phong cách / bối cảnh) · định dạng ảnh, dung lượng, số ảnh min/max · danh sách lựa chọn (thêm/xoá) · tỉ lệ mặc định · **điều kiện hiển thị** (bằng / khác / đang bật / đang tắt) · với Nguyên liệu ẩn: ô tải ảnh ("Người mua không thấy ảnh này, ảnh luôn được gửi kèm tới AI").
8. **Bảng kiểm tra lỗi** (validation list: lỗi đỏ / cảnh báo vàng, bấm để nhảy tới trường lỗi).

**Tab Xem trước:**
- Panel "**Form người mua**" — hiển thị đúng như trang Tạo ảnh, điền thử được; nút "Tạo ảnh (chạy thử)", trạng thái "Dữ liệu hợp lệ…" / "Form còn lỗi…", "Xoá dữ liệu thử".
- Panel "**Prompt hoàn chỉnh**" — khối JSON (code) gửi tới model sau khi thay biến.

**Dialog "Bắt đầu Template mới"** (khi bấm Mẫu mới): chọn mẫu khởi đầu dạng thẻ — **Trống** ("Tự thêm từng trường đầu vào") · **Ảnh sản phẩm giày** ("Người mua chỉ tải 1 ảnh giày") · **Ảnh thời trang** ("Ảnh giày + ảnh outfit + yêu cầu bổ sung"). Confirm "Thay thế Template hiện tại bằng mẫu mới?".

Chưa có cửa hàng → EmptyState + "Tạo cửa hàng".

### Màn hình 17 — Nhóm creative `/seller/creative-groups`
- Thanh tiêu đề: ← · "Nhóm creative" · nút "**+ Tạo nhóm**".
- Ghi chú: "Mỗi lô tự động = 1 sản phẩm × các creative Đang bán của 1 nhóm, mỗi creative 1 ảnh. Nhóm tạo trước chạy trước. Một creative chỉ ở một nhóm."
- **Thẻ nhóm:** tên nhóm, "N creative · M đang bán dùng được" (hoặc cảnh báo "Không có creative Đang bán, nhóm bị bỏ qua"), **dải thumbnail creative** cuộn ngang (creative không đang bán bị mờ), nút Sửa / Xoá (confirm).
- Rỗng: "Chưa có nhóm creative nào."
- **Dialog Tạo/Sửa nhóm:** ô Tên nhóm · tìm creative · danh sách creative đang bán có checkbox + thumbnail (ghi chú "Đang ở nhóm "X"" nếu thuộc nhóm khác) · subtitle "Đã chọn N creative" · Huỷ / **Lưu nhóm**.

### Màn hình 18 — Quản lý sản phẩm `/seller/items`
- Thanh tiêu đề: ← · "Quản lý sản phẩm" · nút "**+ Thêm sản phẩm**".
- Hộp hướng dẫn: "Bấm "Tạo tự động" ở Lô ảnh để tạo lô (chỉ sản phẩm đang hoạt động): mỗi lô là 1 sản phẩm với các creative của 1 nhóm creative có creative trùng hashtag với sản phẩm. Sản phẩm ít lô nhất được tạo trước."
- **Tab:** Đang hoạt động · Không hoạt động.
- **Hàng/Thẻ sản phẩm:** ảnh bìa, tên ("Sản phẩm #id" nếu trống), hashtag, "N ảnh sản phẩm · Đã tạo M ảnh", **switch** "Đang hoạt động — Được tạo lô tự động" / "Đã tắt — Không được tạo lô tự động", nút **Tạo ảnh** (→ Tạo lô thủ công với sản phẩm này), Sửa, Xoá (confirm "Lô đã tạo từ sản phẩm này vẫn giữ nguyên.").
- **Dialog Thêm/Sửa sản phẩm:** Tên sản phẩm (không bắt buộc, "VD: Áo thun trắng") · Hashtag (chip) · **Ảnh sản phẩm**: danh sách ảnh, mỗi ảnh kèm ô "**Key trường nguyên liệu**" (vd `product_image` — ảnh sẽ tự điền vào trường có key trùng trong Creative) · "Thêm ảnh" · Huỷ / **Lưu sản phẩm**.

### Màn hình 19 — Quản lý video template `/seller/video-templates`
- Thanh tiêu đề: ← · "Quản lý video template" · nút "**+ Thêm template**".
- **Thẻ template:** tên, badge "Đồng bộ" (từ máy làm template, chỉ xem) / "Đã tắt", "N ảnh" (hoặc cảnh báo vàng "Chưa có số ảnh, sửa để dùng tạo video"), "Tạo lúc …", link video TikTok mẫu (preview), **switch Bật/Tắt** ("Đang bật: dùng cho bài video"), Sửa, Xoá (ẩn với template đồng bộ).
- Rỗng: "Chưa có video template nào."

### Màn hình 20 — Thêm / Sửa video template
- Thanh tiêu đề: ← · "Thêm video template" / "Sửa video template".
- Trường: **Tên template** (gợi ý "Phải trùng tên template trên máy worker (VD: StripReveal, LensPop, FlashMontage)") · **Link video TikTok mẫu** · **Số ảnh template cần** (1–max).
- Nút **Lưu**. Template đồng bộ: thông báo "…được đồng bộ từ máy làm template, không sửa được." + "Về danh sách template".

### Màn hình 21 — Quản lý worker `/seller/workers`
- Thanh tiêu đề: ← · "Quản lý worker".
- Ghi chú: "Worker do admin cấp. Bấm bút để đổi tên, bấm mũi tên xoay để tạo lại token (token cũ hết hiệu lực ngay). Online: worker kết nối trong 5 phút gần nhất."
- **Thẻ worker:** chấm trạng thái **Online (xanh) / Offline (xám)**, tên (sửa inline: ô nhập + ✓ Lưu / ✕ Huỷ), **chip chức năng** (Tạo ảnh / Đăng bài / Dựng video…), "Hoạt động lúc …" hoặc "Chưa kết nối", mô tả chức năng ("Chọn được ở trang bài đăng: đăng bài ảnh / video lên TikTok, Facebook, Instagram bằng tài khoản đăng nhập trên máy worker.").
  - **Token:** ô dạng mã ẩn ••••, nút 👁 Hiện/Ẩn, 📋 Sao chép, ⟳ Tạo lại token (confirm nguy hiểm). Không xem được token: "Token: chưa xem được, tạo token mới để dùng."
- Rỗng: "Shop chưa được gắn worker nào. Liên hệ admin để được cấp worker."

### Màn hình 22 — AI viết nội dung `/seller/ai-content`
- Thanh tiêu đề: ← · "AI viết nội dung".
- Hộp giới thiệu: "Khi tạo bài có bật **AI viết nội dung** hoặc bấm **Viết lại bằng AI** (X ₫ / lần), AI xem ảnh của bài rồi viết theo cài đặt dưới đây."
- **Độ dài:** "Tiêu đề tối đa" · "Nội dung tối đa" (ô số, "Từ min đến max ký tự").
- **Bài viết mẫu** (tối đa N): mỗi bài là thẻ "Bài mẫu 1" (Tiêu đề không bắt buộc, Nội dung *, nút Xoá); nút "**+ Thêm bài mẫu**"; trống: "Chưa có bài mẫu: AI viết 2-5 câu theo giọng bán hàng thông thường."
- **Kho hashtag:** "AI chọn tối đa 5 hashtag hợp với ảnh trong danh sách này." — ô nhập chip; nút "**Lấy N hashtag từ sản phẩm**".
- Nút **Lưu cài đặt** (thông báo "Đã lưu cài đặt.").

---

## NHÓM F — TẠO ẢNH THEO LÔ

### Màn hình 23 — Danh sách lô ảnh `/batches`
- Thanh tiêu đề: ← · "Lô ảnh" · nút "**Tạo tự động**" (outline) · "**+ Tạo lô ảnh**" (primary).
- **Banner kết quả tạo tự động** (đóng được): "Đã tạo tự động 3/5 lô, ảnh đang được tạo." + lý do dừng ("Hết số dư, lô tiếp theo cần … — Nạp ví" / "Không đủ sản phẩm / nhóm creative khác nhau để ghép thêm lô.").
- **Thẻ lô:** "Lô #id", badge xanh "**Tự động**", dòng sản phẩm · nhóm, **dải thumbnail ảnh**, trạng thái "Đang tạo 4/10" (progress) / "Đã hoàn thành", "N ảnh", "N ảnh lỗi" (đỏ), "Đã tạo N bài đăng", thời gian, nút Xoá (khoá khi đang tạo).
- Rỗng: "Chưa có lô ảnh nào. Chọn nhiều mẫu AI Creative để tạo ảnh một lần." · nút "Xem thêm lô ảnh".

### Màn hình 24 — Tạo lô ảnh (thủ công) `/batches/new` — wizard 2 bước
**Bước 1 — Chọn mẫu:** tiêu đề "Tạo lô ảnh", phụ đề "Chọn các mẫu AI Creative cho lô" (hoặc "…cho {sản phẩm}").
- **CreativePicker** — desktop 2 cột (trái: chọn mẫu, phải: mẫu đã chọn); mobile: đã chọn ở trên.
  - Tab nguồn: **Kho mẫu** · **Mẫu của tôi**.
  - Ô tìm "Tìm theo tên mẫu hoặc #hashtag", dải **Ngành hàng**, dải **Hashtag phổ biến**, (Mẫu của tôi) lọc Tất cả / Riêng tư / Công khai.
  - Lưới thẻ mẫu chọn được (checkbox), giá/ảnh hoặc "Miễn phí", mẫu nháp có chú thích "Đăng bán để dùng".
  - Cột "Mẫu đã chọn": danh sách nhỏ + nút bỏ chọn.
- ActionBar: "**N** mẫu đã chọn" · nút **Tiếp tục**.

**Bước 2 — Nhập thông tin tạo ảnh:**
- Thẻ sản phẩm (nếu vào từ sản phẩm): ảnh, tên, "Ảnh sản phẩm tự điền vào trường ảnh có key: …"; cảnh báo nếu tải ảnh lỗi hoặc mẫu không có key trùng.
- Select **Sản phẩm** ("Không theo sản phẩm" / danh sách kèm "N ảnh").
- **LogoCard:** switch "Chèn logo vào ảnh — Logo shop ở góc dưới bên phải mọi ảnh của lô" (chưa có logo/shop: hướng dẫn + link).
- **Worker tạo ảnh** (select; offline thì ảnh chờ).
- **Danh sách thẻ mẫu** (CreativeInputCard), mỗi thẻ: thumbnail, tên, giá/ảnh, badge "Thiếu N thông tin" (vàng) / "Đủ thông tin" (xanh), **bộ đếm số ảnh − n +**, nút bỏ mẫu; mở ra là form động của mẫu.
- Nút "Chọn thêm mẫu".
- ActionBar: "**12** ảnh · **24.000 ₫**" + "Còn 2 mẫu thiếu thông tin" / "Đã đủ thông tin" · nút **Tạo lô ảnh**.

### Màn hình 25 — Tạo lô tự động `/batches/auto`
- Thanh tiêu đề: ← · "Tạo lô tự động" · "Mỗi lô = 1 sản phẩm (ít ảnh nhất trước) × các creative Đang bán của 1 nhóm (ít dùng nhất trước)".
- Ô **Số lô muốn tạo** (1–max) + nút **Xem trước**.
- Tuỳ chọn **Chọn sản phẩm thủ công** (mở picker; hiển thị "Chỉ tạo từ N sản phẩm đã chọn" · "Dùng ngẫu nhiên").
- LogoCard + Worker tạo ảnh.
- **Bảng xem trước kế hoạch:** danh sách lô dự kiến — mỗi lô: ảnh + tên sản phẩm × tên nhóm, số ảnh, tiền.
- Tổng: "Tổng tiền dự kiến" · "Số dư". Cảnh báo: chỉ ghép được N lô · số dư chỉ đủ N lô đầu (+ Nạp ví) · số dư không đủ lô đầu.
- Điều kiện thiếu: hộp "Cần có creative Đang bán của bạn để tạo lô tự động. Thêm sản phẩm và nhóm creative…".
- ActionBar: "**N** lô · tổng tiền" · nút **Tạo N lô**.

### Màn hình 26 — Chi tiết lô ảnh `/batches/:id`
- Thanh tiêu đề: ← · "Lô ảnh #id" (badge Tự động, sản phẩm · nhóm). Chế độ chọn: ✕ · "Chọn ảnh cho bài đăng".
- Dòng tóm tắt: "**N** ảnh" · "N ảnh lỗi (đã hoàn tiền)" · "Đã tạo N bài đăng" · tiến độ; "Bạn có thể rời trang này, ảnh vẫn được tạo tiếp."
- **Lưới ảnh**, mỗi ô:
  - Đang tạo: spinner "Đang tạo ảnh..."; Lỗi: lý do; Đã tắt: mờ.
  - Ảnh xong: bấm phóng to; tên mẫu nhỏ.
  - **Hàng nút dưới ảnh:** ✏️ Sửa nguyên liệu · ⟳ **Tạo lại** (confirm kèm phí) · ⬆ **Tải lên** (thay ảnh bằng ảnh từ máy) · ✂️ **Cắt ảnh** · 🗑 Xoá khỏi lô.
- **Chế độ chọn ảnh để đăng:** bấm ảnh để chọn (số thứ tự trên góc, ảnh đầu = bìa), "Tối đa N ảnh, ảnh chọn đầu tiên làm ảnh bìa. Chỉ chọn được ảnh đã tạo xong."
- ActionBar: thường "**N** ảnh đã xong, sẵn sàng đăng" · **Tạo bài đăng**; khi chọn "Đã chọn n/max ảnh" · Huỷ · **Tạo bài đăng**.
- **Dialog Sửa nguyên liệu:** "Mẫu: …", form động điền sẵn thông tin lần trước (hoặc "Không còn thông tin đã nhập lần trước, hãy nhập lại.") · Huỷ · "**Tạo lại ảnh · giá**".
- **Dialog Cắt ảnh:** chip tỉ lệ (Gốc, 1:1, 4:5, 9:16…), khung cắt có lưới 1/3, zoom − / slider / + / Đặt lại, "Kéo để di chuyển… Vùng cắt w×h px", Huỷ / **Lưu**.

---

## NHÓM G — ĐĂNG BÀI

### Màn hình 27 — Danh sách bài đăng `/posts`
- Thanh tiêu đề: ← · "Danh sách bài đăng" · nút "**Tạo video**" · "**+ Tạo bài đăng**".
- Banner: "Có N bài đang chờ bạn xem lại và đăng." (vàng) / thông báo kết quả tạo video (xanh, đóng được).
- **Lọc theo worker:** chip ngang "Tất cả worker" + từng worker (chấm online/offline).
- **Danh sách bài** — desktop dạng **bảng** (Ảnh bìa · Tiêu đề · Nội dung · Trạng thái · Thao tác), mobile dạng **thẻ**:
  - Ảnh bìa + "N ảnh" / icon video; tiêu đề ("Đang chuẩn bị..." / "Bài đăng video" khi chưa có); trích nội dung; worker; "Đăng lúc …".
  - **Badge trạng thái bài:** Đang chuẩn bị · Chờ gửi (vàng) · Chờ đăng (xanh dương) · Đang đăng · Đã đăng (xanh lá).
  - **Chip nền tảng** từng kênh (TikTok/Facebook/Instagram) có trạng thái: Chờ đăng · Đang đăng · Đã đăng · Lỗi.
  - Nút thao tác theo trạng thái: Sửa · Đăng bài · Sửa / Đăng lại · Tạo lại.
- Tự cập nhật trạng thái mỗi 5 giây. Nút "Xem thêm bài đăng".
- Rỗng: "Chưa có bài đăng nào." + "Tạo bài đăng".

**Dialog "Tạo video"** — "Worker dựng video từ template + ảnh sản phẩm rồi tự đăng đúng giờ". 2 tab:
- **Tự động:** Worker dựng và đăng video · Đăng lên (chọn nền tảng) · Số bài video ("Mỗi bài trừ một lần phí AI viết nội dung, hết tiền thì dừng") · Giờ đăng bài đầu tiên · Cách nhau tối thiểu / tối đa (phút) · giải thích "Mỗi bài: template ngẫu nhiên, sản phẩm ngẫu nhiên…". Nút **Tạo lịch làm việc**.
- **Thủ công:** Worker · Nền tảng · Video template ("Tên · N ảnh") · Sản phẩm · **chọn ảnh** (tab ảnh sản phẩm / Tất cả ảnh, phải đúng số ảnh template) · Giờ đăng · ghi chú AI viết nội dung. Nút tạo.

### Màn hình 28 — Tạo bài từ ảnh đã có `/posts/new`
- Thanh tiêu đề: ← · "Tạo bài từ ảnh đã có".
- Mô tả: "Chọn ảnh cho bài đăng — Tối đa N ảnh, ảnh chọn đầu tiên làm ảnh bìa. Chỉ dùng được ảnh đã tạo trên A51. Muốn tạo mới, hãy dùng **Tạo ảnh theo lô**."
- **A51ImagePicker:** lưới ảnh đã tạo, chọn nhiều (số thứ tự), "Tải thêm ảnh"; rỗng "Bạn chưa có ảnh nào trên A51." + "Tạo ảnh mới".
- **Switch AI viết nội dung** ("AI viết tiêu đề, nội dung, hashtag (X ₫)", "AI lỗi thì được hoàn tiền").
- ActionBar: "Đã chọn n/max ảnh" · **Tạo bài đăng**.

### Màn hình 29 — Chi tiết / Sửa bài đăng `/posts/:id`
**Bố cục:** desktop 2 cột (trái ảnh, phải form); mobile dọc + ActionBar đáy.

**Trạng thái đặc biệt (thay toàn trang hoặc banner):**
- **AI đang viết:** "AI đang viết tiêu đề, nội dung, hashtag" + "Bạn có thể rời trang này. Xong, bài chuyển sang **Chờ gửi**…" + "Về danh sách bài đăng".
- **Đang đăng:** "Worker {tên} đang đăng bài…" + nút **Tạo lại** (confirm cảnh báo đăng trùng).
- **Đã đăng:** "Đã đăng xong lúc …" + chế độ chỉ xem (Giờ đăng, Tiêu đề, Nội dung, kết quả từng nền tảng kèm link).
- **Chờ đăng:** "Bài đang chờ tới giờ đăng (…), worker X sẽ nhận. Còn sửa / xoá được tới khi worker nhận bài."
- **Lỗi lần trước:** banner đỏ "Đăng lần trước không thành công. {lý do}".

**Cột trái — Ảnh:** "Ảnh  n/max · ảnh đầu làm ảnh bìa", "Kéo thả ảnh để đổi thứ tự" (desktop). Mỗi ảnh: nhãn "Ảnh bìa" / số thứ tự, nút ← → đổi chỗ, ★ đặt làm ảnh bìa, 🗑 bỏ khỏi bài; ô "+ Thêm ảnh" mở **dialog Thêm ảnh từ A51** ("Chọn thêm tối đa N ảnh" · "Thêm N ảnh"). Bài video: cảnh báo thiếu/thừa ảnh theo template ("Template X cần N ảnh, bài mới có M. Thêm K ảnh nữa…").

**Cột phải — Form:**
- **Worker làm việc** (select).
- **Video template** (bài video).
- **Nội dung** ("Không bắt buộc"): nút "✨ **Viết lại bằng AI**" (giá; "AI đang viết..."), Tiêu đề, Nội dung (textarea + đếm ký tự), Hashtag (chip, tối đa N).
- **Đăng lên:** "Chọn một hoặc nhiều nền tảng." — thẻ chọn TikTok / Facebook / Instagram (icon), dòng giới hạn mỗi nền tảng (số ảnh tối đa, số ký tự), lỗi đỏ nếu vượt, "Đã đăng — không đăng lại".
- **Giờ đăng** (datetime).
- ActionBar: tóm tắt · nút **Đăng bài / Đăng lại / Lưu thay đổi** · Xoá bài.

---

## NHÓM H — VẬN CHUYỂN (GHN)

### Màn hình 30 — Danh sách đơn GHN `/shipping-orders`
- Thanh tiêu đề: ← · "Đơn GHN" · nút "**+ Tạo đơn từ ảnh**".
- **Tab lọc:** Tất cả · Nháp · Đã gửi · Lỗi.
- **Thẻ đơn:** mã đơn, badge trạng thái (Đang đọc ảnh – xanh nhạt · Nháp – vàng · Đã gửi GHN – xanh lá · GHN từ chối – đỏ), người nhận "Tên · SĐT" (hoặc "Chưa có người nhận"), tên hàng, "Thu hộ **X ₫**", thời gian, thumbnail ảnh chat.
- Rỗng: "Chưa có đơn nào." + "Tạo đơn từ ảnh". "Xem thêm đơn".

### Màn hình 31 — Tạo đơn GHN từ ảnh `/shipping-orders/new`
- Thanh tiêu đề: ← · "Tạo đơn GHN từ ảnh".
- Chưa kết nối GHN: banner "Bạn chưa kết nối GHN." + "**Kết nối ngay**".
- **Kiểu địa chỉ người nhận** (2 thẻ radio): **Địa chỉ cũ** (Tỉnh → Quận/Huyện → Phường/Xã) · **Địa chỉ mới** (Tỉnh → Phường/Xã, sau sáp nhập 01/07/2025).
- **Ảnh chụp đoạn chat với khách:** "Tất cả ảnh là của **một đơn hàng**, tối đa N ảnh. AI sẽ đọc tên, số điện thoại, địa chỉ và tiền; bạn xem lại và sửa trước khi gửi GHN." Lưới thumbnail + nút xoá, ô "+ Thêm ảnh".
- ActionBar: "Đã chọn n/max ảnh" · **Đọc ảnh & tạo đơn nháp** (loading "Đang tải ảnh...").

### Màn hình 32 — Chi tiết đơn GHN `/shipping-orders/:id`
- Thanh tiêu đề: ← · "Đơn {mã}" · 🗑 Xoá đơn nháp.
- **Đang đọc ảnh:** thẻ xanh "AI đang đọc N ảnh... Thường mất dưới 1 phút. Bạn có thể rời trang…" + "Tạo đơn khác".
- **Lỗi GHN:** banner đỏ "GHN từ chối: … Sửa lại thông tin rồi bấm tạo đơn lần nữa."
- **Nháp:** banner "AI đã điền sẵn từ ảnh. Các ô màu vàng cần bạn kiểm tra lại." — ô AI không chắc được **tô vàng** + chú thích "AI không chắc, vui lòng kiểm tra lại".
- **Ảnh chat gốc** (desktop cột bên, bấm phóng to) để đối chiếu.
- **Form:**
  - *Người nhận:* Tên người nhận * · Số điện thoại *.
  - *Địa chỉ giao hàng:* dòng "Địa chỉ trong ảnh: …" · Tỉnh/Thành phố * · Quận/Huyện * (địa chỉ cũ) · Phường/Xã * · Số nhà, tên đường *.
  - *Hàng hoá & thu hộ:* Tên sản phẩm * · Tiền thu hộ (COD, VND) ("0 nếu khách đã chuyển khoản") · Khối lượng (gram) ("Dưới 20kg. Mặc định 2000g").
  - *Giao hàng:* Ghi chú bắt buộc (Cho xem hàng, không cho thử / Cho xem và thử hàng / Không cho xem hàng) · Ghi chú cho shipper · **Ai trả phí ship?** (thẻ radio: Shop trả ship / Khách trả ship).
- ActionBar: "Có thay đổi chưa lưu" / "Thu hộ X ₫" · **Lưu nháp** · **Tạo đơn GHN** (loading "Đang gửi GHN...").
- **Đã gửi:** thẻ xanh ✓ "Đã tạo đơn bên GHN" + bảng thông tin: Mã đơn GHN (copy) · Phí ship · Dự kiến giao · Người nhận · Địa chỉ · Thu hộ (COD) · Ai trả ship · Gửi lúc; nút "Tạo đơn khác".

---

## NHÓM I — THÔNG TIN & HỆ THỐNG

### Màn hình 33 — Trung tâm hỗ trợ `/support`
- Thanh tiêu đề: ← · "Trung tâm hỗ trợ".
- Hero: "Chúng tôi có thể giúp gì cho bạn?" + "Tìm nhanh câu trả lời hoặc liên hệ trực tiếp với đội ngũ hỗ trợ."
- **Ô tìm câu hỏi** ("Nhập câu hỏi, ví dụ: hoàn tiền, nạp ví...", tìm không dấu).
- **Lưới chủ đề** (2 cột, icon): Bắt đầu · Tạo ảnh bằng AI · Ví và thanh toán · Dành cho người bán · Tài khoản và bảo mật → nhảy tới nhóm.
- **FAQ accordion** theo nhóm (câu hỏi đóng/mở).
- Rỗng: "Không tìm thấy câu hỏi nào khớp với "…"." + "Xoá tìm kiếm".
- **Vẫn cần trợ giúp?** — mô tả (phản hồi trong 72 giờ), **QR Zalo** + nút "Hỗ trợ qua Zalo", email liên hệ.
- Link cuối: Điều khoản sử dụng · Chính sách quyền riêng tư.

### Màn hình 34 & 35 — Điều khoản sử dụng `/terms` · Chính sách quyền riêng tư `/privacy`
Trang văn bản pháp lý dạng đọc: tiêu đề, "Cập nhật lần cuối", **mục lục** (link neo), các mục đánh số (H2 + đoạn + danh sách), thông tin liên hệ cuối trang. Cột đọc 640px, chữ dễ đọc.

### Màn hình 36 — Không tìm thấy (404) / Placeholder
Icon lớn (error) + tiêu đề "Không tìm thấy trang" / "Không tìm thấy công cụ" + nút quay lại (Trang chủ / Công cụ).

---

## 4. Thành phần & trạng thái cần thiết kế riêng

| Thành phần | Ghi chú |
|---|---|
| Thẻ Creative (marketplace) | ảnh giữ tỉ lệ (masonry hoặc lưới), tên, giá/ảnh, ⭐, lượt dùng, shop |
| Thẻ Creative (quản lý) | + badge trạng thái, nút Sửa / Đăng bán / Tạm dừng |
| Ô ảnh kết quả | các trạng thái: chờ (đếm ngược), đang tạo, xong, lỗi (đã hoàn tiền), đã tắt |
| Badge trạng thái | Creative (Đang bán/Nháp/Tạm dừng/Bị ẩn), Ảnh (Đang chờ/Đang tạo/Hoàn tất/Thất bại/Đã huỷ), Bài (Đang chuẩn bị/Chờ gửi/Chờ đăng/Đang đăng/Đã đăng), Nền tảng (Chờ/Đang/Đã đăng/Lỗi), Đơn GHN (Đang đọc ảnh/Nháp/Đã gửi/GHN từ chối), Worker (Online/Offline) |
| ActionBar đáy | tóm tắt (số lượng · tiền · tình trạng) + nút chính; dính đáy cả mobile & desktop |
| Bộ đếm số ảnh | − [n] + |
| Form động | đủ 12 loại trường (mục Màn hình 8 / 16) |
| Upload ảnh | kéo-thả, xem trước, xoá, lỗi định dạng/dung lượng |
| Dialog | Xác nhận thường / nguy hiểm (đỏ), Thành công, Bottom-sheet mobile |
| ImageViewer | toàn màn hình nền tối, nút đóng |
| EmptyState / ErrorState / Skeleton | cho mọi danh sách |
| Thẻ bị khoá | ổ khoá, "Cần mở cửa hàng" |

---

## 5. Gợi ý khi đưa vào Stitch

1. Dán **mục 0 + 1 + 2** (bối cảnh, design system, layout) làm context chung cho mọi prompt.
2. Mỗi lần thiết kế 1 màn hình: dán mục "Màn hình N" tương ứng, ghi rõ **"mobile 390px"** hoặc **"desktop 1440px"**.
3. Ưu tiên thiết kế trước: Trang chủ → Khám phá → Chi tiết Creative → Tạo ảnh → Công cụ → Chi tiết lô ảnh → Chi tiết bài đăng → Template Builder.
4. Giữ nguyên chữ tiếng Việt và thuật ngữ ở mục 0 để bản thiết kế khớp với code.
