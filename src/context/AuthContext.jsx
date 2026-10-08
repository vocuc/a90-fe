import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/services';
import { tokenStorage, UNAUTHORIZED_EVENT } from '../api/tokenStorage';

const AuthContext = createContext(null);

// Các query gắn với người dùng, phải xoá khi đăng xuất
const USER_QUERY_KEYS = [['me'], ['notifications'], ['creator'], ['ai-models']];

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => tokenStorage.get());

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    USER_QUERY_KEYS.forEach((queryKey) => queryClient.removeQueries({ queryKey }));
  }, [queryClient]);

  const startSession = useCallback(
    ({ token: newToken, user }) => {
      tokenStorage.set(newToken);
      setToken(newToken);
      if (user) queryClient.setQueryData(['me'], user);
      return user;
    },
    [queryClient],
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

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // token có thể đã hết hạn sẵn -> vẫn xoá phiên phía client
    }
    clearSession();
  }, [clearSession]);

  // Backend báo 401 -> phiên hết hạn, đăng xuất phía client
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, clearSession);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, clearSession);
  }, [clearSession]);

  const value = useMemo(
    () => ({ token, isAuthenticated: !!token, login, register, logout }),
    [token, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return ctx;
}
