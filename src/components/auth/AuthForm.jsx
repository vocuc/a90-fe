import { Link } from 'react-router-dom';
import Icon from '../common/Icon';

// Chỉ cho phép chuyển hướng nội bộ, tránh open redirect qua ?redirect=https://...
export const safeRedirect = (value) =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : '/';

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-4">
      <Link
        to="/"
        aria-label="Về trang chủ"
        className="-ml-2 flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
      >
        <Icon name="arrow_back" />
      </Link>

      <div className="mt-6">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-container text-on-primary shadow-md shadow-primary-container/25">
          <Icon name="auto_awesome" fill />
        </div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-on-surface">{title}</h1>
        <p className="pt-1 text-sm text-on-surface-variant">{subtitle}</p>
      </div>

      {children}

      {footer && <p className="mt-6 text-center text-sm text-on-surface-variant">{footer}</p>}
    </div>
  );
}

// Các ô nhập dùng chung, giữ export ở đây để trang đăng nhập/đăng ký không phải đổi import
export { FormAlert, SubmitButton, TextField } from '../common/Form';
