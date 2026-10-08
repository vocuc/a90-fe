const TOKEN_KEY = 'ai90_token';

// localStorage có thể bị chặn (private mode...), nên mọi truy cập đều bọc try/catch
export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // bỏ qua: phiên đăng nhập chỉ sống trong bộ nhớ
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // bỏ qua
    }
  },
};

// Phát ra khi backend trả 401 cho một request có kèm token (token hết hạn / bị thu hồi)
export const UNAUTHORIZED_EVENT = 'ai90:unauthorized';
