import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import Footer from './Footer';
import Header from './Header';

// Mobile: một cột rộng tối đa 640px, tab dưới cùng. Desktop (lg): header có menu ngang,
// nội dung rộng tối đa 1200px, bỏ tab dưới, thêm footer.
export default function AppLayout({ showNav = true }) {
  return (
    // overflow-x-clip (không dùng overflow-x-hidden): hidden biến khung này thành vùng cuộn riêng
    // và làm các thanh sticky (header) không dính khi cuộn trang
    <div
      className={`relative mx-auto flex min-h-screen w-full max-w-[640px] flex-col overflow-x-clip bg-surface-container-lowest shadow-2xl lg:max-w-none lg:shadow-none ${
        showNav ? 'pb-24 lg:pb-0' : ''
      }`}
    >
      <Header />
      <main className="flex w-full flex-1 flex-col lg:mx-auto lg:max-w-[1200px] lg:px-4">
        <Outlet />
      </main>
      <Footer />
      {showNav && <BottomNav />}
    </div>
  );
}
