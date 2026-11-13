import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/services';
import { accountStorage, MAX_ACCOUNTS, tokenStorage, UNAUTHORIZED_EVENT } from '../api/tokenStorage';

const AuthContext = createContext(null);

// Các query gắn với người dùng, phải xoá khi đăng xuất
const USER_QUERY_KEYS = [['me'], ['notifications'], ['creator'], ['ai-models'], ['generations']];
const ME_HASH = JSON.stringify(['me']);

// Chỉ lưu thông tin cần để hiển thị trong danh sách chuyển tài khoản
const toAccount = (token, user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl ?? null,
  token,
});

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => tokenStorage.get());
  const [accounts, setAccounts] = useState(() => accountStorage.list());

  const updateAccounts = useCallback((fn) => {
    setAccounts((prev) => {
      const next = fn(prev);
      accountStorage.save(next);
      return next;
    });
  }, []);

  const forgetToken = useCallback(
    (oldToken) => updateAccounts((prev) => prev.filter((a) => a.token !== oldToken)),
    [updateAccounts],
  );

  // Mỗi lần ['me'] có dữ liệu mới -> cập nhật tài khoản hiện tại trong danh sách (mới nhất lên đầu)
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe(({ type, query }) => {
        const user = query.state.data;
        const current = tokenStorage.get();
        if (type !== 'updated' || query.queryHash !== ME_HASH || !user?.id || !current) return;
        updateAccounts((prev) => {
          const others = prev.filter((a) => a.id !== user.id && a.token !== current);
          return [toAccount(current, user), ...others].slice(0, MAX_ACCOUNTS);
        });
      }),
    [queryClient, updateAccounts],
  );

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    USER_QUERY_KEYS.forEach((queryKey) => queryClient.removeQueries({ queryKey }));
  }, [queryClient]);

  // Đổi token đang dùng; dữ liệu của tài khoản cũ được xoá và các query đang hiển thị tải lại bằng token mới
  const applyToken = useCallback(
    (newToken) => {
      const changed = tokenStorage.get() !== newToken;
      tokenStorage.set(newToken);
      setToken(newToken);
      if (changed) queryClient.resetQueries();
    },
    [queryClient],
  );

  const startSession = useCallback(
    ({ token: newToken, user }) => {
      applyToken(newToken);
      if (user) queryClient.setQueryData(['me'], user);
      return user;
    },
    [queryClient, applyToken],
  );

  const login = useCallback(
    async (credentials) => startSession(await authApi.login(credentials)),
    [startSession],
  );

  // Đăng ký xong backend trả token luôn -> đăng nhập ngay
  const register = useCallback(
    async (data) => startSession(await authApi.register(data)),
    [startSession],
  );

  const loginWithGoogle = useCallback(
    async (google) => startSession(await authApi.google(google)),
    [startSession],
  );

  const switchAccount = useCallback(
    (id) => {
      const account = accounts.find((a) => a.id === id);
      if (account) applyToken(account.token);
    },
    [accounts, applyToken],
  );

  // Chỉ xoá khỏi máy này (không phải tài khoản đang dùng)
  const removeAccount = useCallback(
    (id) => updateAccounts((prev) => prev.filter((a) => a.id !== id || a.token === tokenStorage.get())),
    [updateAccounts],
  );

  // Đăng xuất tài khoản hiện tại; còn tài khoản khác đã lưu thì chuyển sang tài khoản đó
  const logout = useCallback(async () => {
    const current = tokenStorage.get();
    try {
      await authApi.logout();
    } catch {
      // token có thể đã hết hạn sẵn -> vẫn xoá phiên phía client
    }
    forgetToken(current);
    const next = accounts.find((a) => a.token !== current);
    if (next) applyToken(next.token);
    else clearSession();
  }, [accounts, clearSession, forgetToken, applyToken]);

  // Backend báo 401 -> phiên hết hạn, bỏ tài khoản khỏi danh sách và đăng xuất phía client
  useEffect(() => {
    const onUnauthorized = () => {
      forgetToken(tokenStorage.get());
      clearSession();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [clearSession, forgetToken]);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: !!token,
      accounts,
      login,
      register,
      loginWithGoogle,
      switchAccount,
      removeAccount,
      logout,
    }),
    [token, accounts, login, register, loginWithGoogle, switchAccount, removeAccount, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return ctx;
}
