import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import PageColumn from './components/layout/PageColumn';
import RequireAuth from './components/auth/RequireAuth';
import HomePage from './pages/HomePage';
import CategoriesPage from './pages/CategoriesPage';
import ExplorePage from './pages/ExplorePage';
import CreatorPage from './pages/CreatorPage';
import CreativeDetailPage from './pages/CreativeDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StoreSettingsPage from './pages/StoreSettingsPage';
import SellerProductsPage from './pages/SellerProductsPage';
import AccountPage from './pages/AccountPage';
import PurchaseHistoryPage from './pages/PurchaseHistoryPage';
import CreatePage from './pages/CreatePage';
import PlaceholderPage from './pages/PlaceholderPage';
import ToolsPage from './pages/ToolsPage';
import ToolDetailPage from './pages/ToolDetailPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import TemplateBuilderPage from './pages/TemplateBuilderPage';
import SupportPage from './pages/SupportPage';
import TopUpPage from './pages/TopUpPage';
import TikTokPostPage from './pages/TikTokPostPage';
import TikTokPostsPage from './pages/TikTokPostsPage';
import TikTokNewPage from './pages/TikTokNewPage';

export default function App() {
  return (
    <Routes>
      {/* Desktop: trang danh sách trải rộng; trang biểu mẫu / đọc chữ nằm trong PageColumn (cột 640px ở giữa) */}
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="tools" element={<ToolsPage />} />
        {/* Danh mục không còn là tab, chỉ vào từ nút "Xem tất cả" ở trang chủ */}
        <Route path="categories" element={<CategoriesPage />} />
        {/* Tab "Bộ sưu tập" cũ đã đổi thành Danh mục */}
        <Route path="collection" element={<Navigate to="/categories" replace />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="creators/:username" element={<CreatorPage />} />
        <Route element={<PageColumn />}>
          <Route path="tools/:slug" element={<ToolDetailPage />} />
          <Route path="*" element={<PlaceholderPage title="Không tìm thấy trang" icon="error" />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="seller/products" element={<SellerProductsPage />} />
          {/* TikTok (note/nghiep-vu-dang-bai-tiktik.txt). Trang rộng, tự chia cột trên desktop */}
          <Route path="tiktok" element={<TikTokPostsPage />} />
          <Route path="tiktok/new" element={<TikTokNewPage />} />
          <Route path="tiktok/post/:id" element={<TikTokPostPage />} />
          {/* Trang đăng bài cũ không có id: về danh sách */}
          <Route path="tiktok/post" element={<Navigate to="/tiktok" replace />} />
          {/* Tab Người bán đã gộp vào trang Tài khoản */}
          <Route path="seller" element={<Navigate to="/account" replace />} />
          <Route path="seller/prompts/new" element={<Navigate to="/seller/products/new" replace />} />
          {/* Đường dẫn /store cũ: trang người bán đã gộp vào Tài khoản */}
          <Route path="store/*" element={<Navigate to="/account" replace />} />
          {/* Trang Cá nhân cũ đã đổi thành Tài khoản */}
          <Route path="profile" element={<Navigate to="/account" replace />} />
          <Route element={<PageColumn />}>
            <Route path="create" element={<CreatePage />} />
            <Route path="seller/settings" element={<StoreSettingsPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="account/history" element={<PurchaseHistoryPage />} />
            <Route path="account/topup" element={<TopUpPage />} />
          </Route>
        </Route>
      </Route>
      <Route element={<AppLayout showNav={false} />}>
        <Route path="creatives/:slug" element={<CreativeDetailPage />} />
        <Route element={<PageColumn />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="privacy" element={<PrivacyPolicyPage />} />
          <Route path="terms" element={<TermsOfServicePage />} />
          <Route path="support" element={<SupportPage />} />
        </Route>
      </Route>
      {/* Tạo/sửa sản phẩm bằng Template Builder: toàn màn hình, ngoài AppLayout */}
      <Route element={<RequireAuth />}>
        <Route path="seller/products/new" element={<TemplateBuilderPage />} />
        <Route path="seller/products/:id/edit" element={<TemplateBuilderPage />} />
      </Route>
      <Route path="template-builder" element={<Navigate to="/seller/products/new" replace />} />
    </Routes>
  );
}
