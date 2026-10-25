import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { Switch } from '../template/inputs';
import { staffApi } from '../../api/services';

/**
 * Logo chèn vào ảnh của lô: ảnh đại diện shop; nhân viên của shop (không có shop riêng, note/chia-se-tai-nguyen.txt)
 * dùng logo tự tải lên.
 */
export const batchLogoUrl = (me) => me?.avatarUrl ?? (me?.staffOf ? me.logoUrl : null);

/**
 * Ô "Logo shop" của lô: logo là ảnh đại diện của shop (Thiết lập cửa hàng), không tải riêng.
 * Nhân viên của shop tải logo ngay tại ô này (lưu cho tài khoản, lần sau tự hiện sẵn, đổi được).
 * Bật thì worker tạo ảnh chèn logo vào mọi ảnh của lô. Chưa có shop / chưa có ảnh đại diện mà bật công tắc thì
 * công tắc giữ tắt và hiện thông báo kèm link sang tạo shop / thêm logo (nhân viên: nút tải logo).
 */
export default function LogoCard({ hasShop, isStaff, logoUrl, checked, onChange, error }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [notice, setNotice] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const toggle = (v) => {
    if (logoUrl) {
      onChange(v);
      return;
    }
    setNotice(
      isStaff
        ? { text: 'Hãy tải logo lên để dùng tính năng này.' }
        : hasShop
          ? { text: 'Shop chưa có logo. Hãy thêm ảnh đại diện shop để dùng tính năng này.', link: 'Thêm logo' }
          : { text: 'Bạn phải tạo shop để sử dụng tính năng này.', link: 'Tạo shop' },
    );
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await staffApi.uploadLogo(file);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setNotice(null);
      onChange(true);
    } catch (err) {
      setUploadError(err?.errors?.image || err?.message || 'Không tải được logo, vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
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
          hint={isStaff ? 'Logo của bạn ở góc dưới bên phải mọi ảnh của lô' : 'Logo shop ở góc dưới bên phải mọi ảnh của lô'}
          checked={!!logoUrl && checked}
          onChange={toggle}
        />
        {notice && !logoUrl && (
          <p className="mt-1 text-xs text-amber-700">
            {notice.text}{' '}
            {notice.link && (
              <Link to="/seller/settings" className="font-bold text-primary hover:underline">
                {notice.link}
              </Link>
            )}
          </p>
        )}
        {isStaff && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-1 flex items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-60"
            >
              <Icon name={uploading ? 'progress_activity' : 'upload'} className={`text-sm ${uploading ? 'animate-spin' : ''}`} />
              {logoUrl ? 'Đổi logo' : 'Tải logo lên'}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
          </>
        )}
        {uploadError && <p className="mt-1 text-xs text-error">{uploadError}</p>}
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
    </div>
  );
}
