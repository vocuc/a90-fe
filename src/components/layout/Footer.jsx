import { Link } from 'react-router-dom';
import Logo from './Logo';

const LINKS = [
  { to: '/explore', label: 'Khám phá' },
  { to: '/tools', label: 'Công cụ' },
  { to: '/support', label: 'Trung tâm hỗ trợ' },
  { to: '/terms', label: 'Điều khoản sử dụng' },
  { to: '/privacy', label: 'Chính sách quyền riêng tư' },
];

// Chỉ hiện trên desktop; mobile đã có các link này trong trang Tài khoản
export default function Footer() {
  return (
    <footer className="mt-10 hidden border-t border-surface-container bg-surface-container-low lg:block">
      <div className="mx-auto flex max-w-[1200px] items-start justify-between gap-10 px-8 py-8">
        <div className="max-w-sm space-y-2">
          <Logo />
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Tạo hình ảnh chuyên nghiệp bằng AI. Chọn mẫu AI Creative, tải ảnh sản phẩm lên và nhận ảnh trong vài giây.
          </p>
        </div>
        <nav aria-label="Liên kết cuối trang" className="grid grid-cols-2 gap-x-10 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="text-sm text-on-surface-variant hover:text-primary">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="border-t border-surface-container py-4 text-center text-xs text-outline">
        © {new Date().getFullYear()} A51. All rights reserved.
      </p>
    </footer>
  );
}
