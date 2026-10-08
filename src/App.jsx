import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import RequireAuth from './components/auth/RequireAuth';
import HomePage from './pages/HomePage';
import CategoriesPage from './pages/CategoriesPage';
import ExplorePage from './pages/ExplorePage';
import CreativeDetailPage from './pages/CreativeDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StorePage from './pages/StorePage';
import StoreSettingsPage from './pages/StoreSettingsPage';
import SellerProductsPage from './pages/SellerProductsPage';
import SellerProductFormPage from './pages/SellerProductFormPage';
import PlaceholderPage from './pages/PlaceholderPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="categories" element={<CategoriesPage />} />
        {/* Tab "Bộ sưu tập" cũ đã đổi thành Danh mục */}
        <Route path="collection" element={<Navigate to="/categories" replace />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route element={<RequireAuth />}>
          <Route path="create" element={<PlaceholderPage title="Tạo mới" icon="add_circle" />} />
          <Route path="seller" element={<StorePage />} />
          <Route path="seller/settings" element={<StoreSettingsPage />} />
          <Route path="seller/products" element={<SellerProductsPage />} />
          <Route path="seller/products/new" element={<SellerProductFormPage />} />
          <Route path="seller/products/:id/edit" element={<SellerProductFormPage />} />
          <Route path="seller/prompts/new" element={<Navigate to="/seller/products/new" replace />} />
          {/* Đường dẫn /store cũ đã đổi thành /seller */}
          <Route path="store/*" element={<Navigate to="/seller" replace />} />
          {/* Trang Cá nhân cũ đã gộp vào Cửa hàng */}
          <Route path="profile" element={<Navigate to="/seller" replace />} />
        </Route>
        <Route path="*" element={<PlaceholderPage title="Không tìm thấy trang" icon="error" />} />
      </Route>
      <Route element={<AppLayout showNav={false} />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="creatives/:slug" element={<CreativeDetailPage />} />
      </Route>
    </Routes>
  );
}
