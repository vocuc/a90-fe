// Mục điều hướng chính: tab dưới cùng trên mobile, menu ngang trên header ở desktop.
// Desktop không cần mục Tài khoản vì avatar / nút Đăng nhập đã nằm ở góc phải header.
export const NAV_ITEMS = [
  { to: '/', label: 'Trang chủ', icon: 'home', end: true },
  { to: '/explore', label: 'Khám phá', icon: 'shopping_bag' },
  { to: '/tools', label: 'Công cụ', icon: 'handyman' },
  { to: '/account', label: 'Tài khoản', icon: 'person', mobileOnly: true },
];
