import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import Header from './Header';

export default function AppLayout({ showNav = true }) {
  return (
    // overflow-x-clip (không dùng overflow-x-hidden): hidden biến khung này thành vùng cuộn riêng
    // và làm các thanh sticky (header) không dính khi cuộn trang
    <div
      className={`relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-x-clip bg-surface-container-lowest shadow-2xl ${
        showNav ? 'pb-24' : ''
      }`}
    >
      <Header />
      <Outlet />
      {showNav && <BottomNav />}
    </div>
  );
}
