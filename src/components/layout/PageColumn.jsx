import { Outlet } from 'react-router-dom';

// Trang dạng biểu mẫu / đọc chữ: trên desktop giữ cột hẹp ở giữa như bản mobile
export default function PageColumn() {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col">
      <Outlet />
    </div>
  );
}
