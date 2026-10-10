import { MOCK_AUTH } from './client';

/*
 * Đăng nhập bằng Google qua Google Identity Services: nút của Google trả về id_token (credential),
 * frontend gửi cho backend (POST /auth/google) xác thực.
 * https://developers.google.com/identity/gsi/web/guides/overview
 *
 * Cần OAuth Client ID loại "Web application" (= VITE_GOOGLE_CLIENT_ID) trên Google Cloud Console,
 * khai báo "Authorized JavaScript origins" gồm mọi origin chạy frontend (vd. http://localhost:5173, https://a51.vn).
 */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SDK_URL = 'https://accounts.google.com/gsi/client';

// Chế độ mock không cần Google thật
export const GOOGLE_SIGN_IN_ENABLED = MOCK_AUTH || !!GOOGLE_CLIENT_ID;

let sdkPromise;

export const loadGoogleSdk = () => {
  sdkPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve(window.google.accounts.id);
    script.onerror = () => {
      sdkPromise = undefined;
      script.remove();
      reject(new Error('Không tải được Đăng nhập bằng Google. Kiểm tra mạng và thử lại.'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
};
