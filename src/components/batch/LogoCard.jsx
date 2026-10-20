import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { Switch } from '../template/inputs';

/**
 * Ô "Logo shop" của lô: logo là ảnh đại diện của shop (Thiết lập cửa hàng), không tải riêng.
 * Bật thì worker tạo ảnh chèn logo vào mọi ảnh của lô. Chưa có shop / chưa có ảnh đại diện mà bật công tắc thì
 * công tắc giữ tắt và hiện thông báo kèm link sang tạo shop / thêm logo.
 */
export default function LogoCard({ hasShop, logoUrl, checked, onChange, error }) {
  const [notice, setNotice] = useState(null);
  const toggle = (v) => {
    if (logoUrl) {
      onChange(v);
      return;
    }
    setNotice(
      hasShop
        ? { text: 'Shop chưa có logo. Hãy thêm ảnh đại diện shop để dùng tính năng này.', link: 'Thêm logo' }
        : { text: 'Bạn phải tạo shop để sử dụng tính năng này.', link: 'Tạo shop' },
    );
  };

  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3 ${error ? 'border-error' : 'border-outline-variant/40'}`}>
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo shop" className="h-full w-full object-cover" />
        ) : (
          <Icon name="storefront" className="text-outline" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Switch
          label="Chèn logo vào ảnh"
          hint="Logo shop ở góc dưới bên phải mọi ảnh của lô"
          checked={!!logoUrl && checked}
          onChange={toggle}
        />
        {notice && !logoUrl && (
          <p className="mt-1 text-xs text-amber-700">
            {notice.text}{' '}
            <Link to="/seller/settings" className="font-bold text-primary hover:underline">
              {notice.link}
            </Link>
          </p>
        )}
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
    </div>
  );
}
