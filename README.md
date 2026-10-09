# AI90 Frontend

React 18 + Vite + Tailwind CSS + React Router + TanStack Query + axios.
Bản thiết kế gốc: `html/index.html`.

## Chạy

```bash
npm install
cp .env.example .env   # nếu chưa có
npm run dev            # http://localhost:5173
npm run build
```

## Cấu hình (`.env`)

| Biến | Ý nghĩa |
| --- | --- |
| `VITE_API_BASE_URL` | URL gốc API. Khi dev để `/api/v1` để đi qua proxy của Vite |
| `VITE_API_PROXY_TARGET` | Backend Laravel mà proxy chuyển tới, mặc định `http://a90.local` (`D:\OSPanel\home\a90.local`) |
| `VITE_MOCK_AUTH` | `false`: đăng ký/đăng nhập gọi backend thật. `true`: dùng tài khoản giả lập |
| `VITE_MOCK_MARKETPLACE` | `false`: danh mục, Creative gọi backend thật. `true`: dùng dữ liệu giả lập (hữu ích khi backend chưa có Creative) |

Sửa `.env` hoặc `vite.config.js` xong thì Vite tự khởi động lại.

Proxy chỉ có khi `npm run dev`. Khi deploy, cấu hình web server chuyển `/api` sang backend, hoặc đặt `VITE_API_BASE_URL` là URL đầy đủ của backend (khi đó backend phải trả CORS đúng, hiện đang gửi trùng header `Access-Control-Allow-Origin`).

## Đăng nhập

- Token lưu ở `localStorage['ai90_token']`, gửi kèm header `Authorization: Bearer <token>`.
- API có dấu 🔒 bên dưới cần đăng nhập. Nếu backend trả 401 cho request có token, app tự đăng xuất.
- Trang `/create` và Người bán (`/seller`, `/seller/settings`, `/seller/products`, `/seller/products/new`, `/seller/products/:id/edit`, `/account`; link `/store/...` cũ chuyển về `/seller`, `/profile` chuyển về `/account`) yêu cầu đăng nhập; chưa đăng nhập sẽ chuyển tới `/login` rồi quay lại.
- Khi `VITE_MOCK_AUTH=true`: đăng nhập bằng `demo@ai90.vn` / `123456`, hoặc đăng ký tài khoản mới (lưu ở `localStorage['ai90_mock_users']`, xoá key này để reset).

## API xác thực (đã nối backend Laravel `a90.local`, tiền tố `/api/v1`)

| Method | Endpoint | Trả về |
| --- | --- | --- |
| POST | `/auth/register` body `{ name, email, password, password_confirmation }` | 201 `{ data: { token, expires_at, user } }`; lỗi 422 `{ message, errors }` |
| POST | `/auth/login` body `{ email, password }` | `{ data: { token, expires_at, user } }`; sai thông tin trả 422 |
| POST | `/auth/logout` 🔒 | `{ message }` |
| GET | `/auth/me` 🔒 | `{ data: user }` |

`user`: `{ id, name, email, role, credit_balance, creator_profile, created_at }`. Frontend đổi sang `{ credits, avatarUrl, ... }` trong `src/api/services.js`.

Backend chưa có API thông báo, nên số thông báo chưa đọc luôn là 0 khi dùng tài khoản thật.

## API Marketplace (đã nối backend, công khai)

| Method | Endpoint | Trả về |
| --- | --- | --- |
| GET | `/categories` | `{ data: [{ id, name, slug, icon }] }` (`icon` là tên Material Symbol) |
| GET | `/creatives?q=&category=&sort=&page=&per_page=` | `{ data: CreativeCard[], meta: { current_page, last_page, per_page, total } }` |
| GET | `/creatives/{slug}` | `{ data: CreativeCard + { description, images, options } }` |

- `sort`: `newest` | `popular` | `price_asc` | `price_desc`. `per_page` tối đa 50. `q` tối đa 100 ký tự, chỉ tìm theo tiêu đề.
- Trang chủ: "AI Creative nổi bật" = 3 Creative `popular`, "Mới ra mắt" = 4 Creative `newest` (backend chưa có cờ nổi bật / trending).
- URL trang chi tiết dùng `slug`: `/creatives/{slug}`.
- `price_per_image` hiển thị dạng `2.000 VND` (`formatVnd`, cả số dư `credit_balance` cũng hiển thị bằng VND). Creative chưa có lượt đánh giá hiển thị "Mới".
- Link ảnh là link ký số, hết hạn sau 15 phút. Ảnh lỗi/hết hạn sẽ hiện khung trống; tải lại trang để lấy link mới.
- Dữ liệu được đổi sang dạng frontend trong `mapCategory` / `mapCreative` ở `src/api/services.js`.

## Cửa hàng (Creator Studio)

Trang `/seller/settings` (cần backend thật, `VITE_MOCK_AUTH=false`):

- Chưa có profile người bán: form tạo profile người bán (`POST /creator/profile`).
- Đã có: ảnh bìa và avatar (upload ngay khi chọn, JPG/PNG/WEBP ≤ 5MB), thông tin shop (`PUT /creator/profile`: tên, username, mô tả, website, 6 mạng xã hội), xem phí nền tảng, quản lý API key AI (`/creator/api-keys`: thêm — backend gọi thử Gemini trước khi lưu, bật/tắt, xoá).
- Link không có `http(s)://` được tự thêm `https://` trước khi gửi.
- `/create?creative=<slug>`: tạo ảnh từ mẫu (nút ở trang chi tiết Creative). Tải ảnh sản phẩm lên (JPG/PNG/WEBP ≤ 10MB), chọn tỉ lệ khung hình (`options.aspect_ratios`) và số ảnh (≤ `options.max_outputs`), gửi `POST /generations` kèm `idempotency_key` (bấm lại cùng yêu cầu không bị trừ tiền 2 lần). Kết quả hỏi `GET /generations/{id}/status` mỗi 2 giây tới khi xong; ảnh xong tải về qua `GET /generations/{id}/outputs/{outputId}/download`, ảnh lỗi (đã hoàn tiền) tạo lại bằng `POST /generations/{id}/retry`. Backend xử lý ảnh bằng queue nên cần chạy `php artisan queue:work`.
- `/account`: thông tin tài khoản (`GET /auth/me`: tên, email, vai trò, số dư VND, tên cửa hàng) và nút đăng xuất (`POST /auth/logout`, về trang chủ rồi xoá phiên). Bấm avatar/tên trên header để mở.
- `/seller/products`: danh sách Creative của creator (`GET /creator/creatives`, lọc theo trạng thái), đăng bán (`POST /creator/creatives/{id}/publish`, chưa đủ điều kiện thì hiện lý do backend trả trong `context.reasons`). Hiển thị dạng lưới 2 cột, bấm vào sản phẩm để sửa.
- `/seller/products/:id/edit`: sửa Creative (`GET`/`PUT /creator/creatives/{id}`), dùng chung form với trang tạo mới (`SellerProductFormPage`). Khi lưu: cập nhật thông tin, upload ảnh mới rồi mới xoá ảnh bị bỏ (`DELETE /creator/creatives/{id}/images/{imageId}`) để Creative đang bán luôn còn ảnh.
- `/seller/products/new`: tạo Creative nháp (`POST /creator/creatives`) rồi upload lần lượt ảnh mẫu (`POST /creator/creatives/{id}/images`). Ảnh lỗi được giữ lại để tải lại, không tạo trùng Creative. Câu lệnh nhập thủ công hoặc dán JSON (`{label, value}` hoặc mảng), gửi `creative_prompt` dạng mảng `[{label, value}]` (backend lưu cột `json`, tối đa 20 câu lệnh, tiêu đề ≤ 100 / nội dung ≤ 5000 ký tự, khi gọi model ghép thành từng dòng `label: value`). Danh mục lấy từ `/categories` nên cần `VITE_MOCK_MARKETPLACE=false` để id khớp backend.
- Dữ liệu Creator Studio giữ nguyên tên trường snake_case của backend; hook ở `src/hooks/creatorQueries.js`, API ở `creatorApi` trong `src/api/services.js`.

## Cấu trúc

```
src/
  api/          client.js (axios), services.js (các endpoint), mock/ (dữ liệu giả lập)
  hooks/        queries.js (React Query hooks)
  components/   common/, layout/ (Header, BottomNav), home/ (các section trang chủ), creative/ (thẻ Creative)
  pages/        HomePage, ExplorePage, CreativeDetailPage, PlaceholderPage
```
