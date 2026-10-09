import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { bannerApi, categoryApi, creativeApi, notificationApi, userApi } from '../api/services';
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

// Link ảnh ký số hết hạn sau 15 phút -> tải lại trước đó
export const useBanners = () =>
  useQuery({ queryKey: ['banners'], queryFn: bannerApi.getAll, staleTime: 10 * 60_000, refetchInterval: 10 * 60_000 });

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: categoryApi.getAll, staleTime: 10 * 60_000 });

export const useCreatives = (params) =>
  useQuery({
    queryKey: ['creatives', 'list', params],
    queryFn: () => creativeApi.list(params),
    placeholderData: (prev) => prev,
  });

/** Danh sách Creative tải thêm theo trang (params không gồm page). */
export const useInfiniteCreatives = (params) =>
  useInfiniteQuery({
    queryKey: ['creatives', 'infinite', params],
    queryFn: ({ pageParam }) => creativeApi.list({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
  });

export const useCreative = (id) =>
  useQuery({ queryKey: ['creative', id], queryFn: () => creativeApi.getById(id), enabled: !!id });
