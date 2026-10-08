import { useQuery } from '@tanstack/react-query';
import { categoryApi, creativeApi, notificationApi, userApi } from '../api/services';
import { useAuth } from '../context/AuthContext';

// Chỉ gọi các API cá nhân khi đã đăng nhập
export const useMe = () => {
  const { isAuthenticated } = useAuth();
  return useQuery({ queryKey: ['me'], queryFn: userApi.getMe, enabled: isAuthenticated });
};

export const useUnreadCount = () => {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationApi.getUnreadCount,
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });
};

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: categoryApi.getAll, staleTime: 10 * 60_000 });

export const useCreatives = (params) =>
  useQuery({
    queryKey: ['creatives', 'list', params],
    queryFn: () => creativeApi.list(params),
    placeholderData: (prev) => prev,
  });

export const useCreative = (id) =>
  useQuery({ queryKey: ['creative', id], queryFn: () => creativeApi.getById(id), enabled: !!id });
