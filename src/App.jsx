import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import RequireAuth from './components/auth/RequireAuth';
import HomePage from './pages/HomePage';
import CategoriesPage from './pages/CategoriesPage';
import ExplorePage from './pages/ExplorePage';
import CreativeDetailPage from './pages/CreativeDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StoreSettingsPage from './pages/StoreSettingsPage';
import SellerProductsPage from './pages/SellerProductsPage';
import AccountPage from './pages/AccountPage';
import PurchaseHistoryPage from './pages/PurchaseHistoryPage';
import CreatePage from './pages/CreatePage';
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
          <Route path="create" element={<CreatePage />} />
          {/* Tab Người bán đã gộp vào trang Tài khoản */}
          <Route path="seller" element={<Navigate to="/account" replace />} />
          <Route path="seller/settings" element={<StoreSettingsPage />} />
          <Route path="seller/products" element={<SellerProductsPage />} />
          <Route path="seller/products/new" element={<SellerProductFormPage />} />
          <Route path="seller/products/:id/edit" element={<SellerProductFormPage />} />
          <Route path="seller/prompts/new" element={<Navigate to="/seller/products/new" replace />} />
          {/* Đường dẫn /store cũ: trang người bán đã gộp vào Tài khoản */}
          <Route path="store/*" element={<Navigate to="/account" replace />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="account/history" element={<PurchaseHistoryPage />} />
          {/* Trang Cá nhân cũ đã đổi thành Tài khoản */}
          <Route path="profile" element={<Navigate to="/account" replace />} />
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
