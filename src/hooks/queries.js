import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { bannerApi, categoryApi, creativeApi, hashtagApi, creatorPageApi, notificationApi, userApi } from '../api/services';
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

/** Gợi ý hashtag theo tiền tố q (rỗng -> hashtag phổ biến nhất). */
export const useHashtags = (q = '', { limit = 10, enabled = true } = {}) =>
  useQuery({
    queryKey: ['hashtags', q, limit],
    queryFn: () => hashtagApi.suggest({ q, limit }),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    enabled,
  });

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
    // Đổi bộ lọc vẫn giữ danh sách cũ tới khi có kết quả mới, tránh nháy khung xám khi gõ tìm kiếm
    placeholderData: (prev) => prev,
  });

export const useCreative = (id) =>
  useQuery({ queryKey: ['creative', id], queryFn: () => creativeApi.getById(id), enabled: !!id });

// Trang công khai của nhà sáng tạo
export const useCreatorPage = (username) =>
  useQuery({
    queryKey: ['creator-page', username],
    queryFn: () => creatorPageApi.getByUsername(username),
    enabled: !!username,
  });

/** Creative đang bán của một nhà sáng tạo, tải thêm theo trang (params không gồm page). */
export const useInfiniteCreatorCreatives = (username, params) =>
  useInfiniteQuery({
    queryKey: ['creator-page', username, 'creatives', params],
    queryFn: ({ pageParam }) => creatorPageApi.listCreatives(username, { ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
    enabled: !!username,
    placeholderData: (prev) => prev,
  });
