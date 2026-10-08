import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiModelApi, creatorApi } from '../api/services';
import { useMe } from './queries';

export const CREATOR_KEYS = {
  profile: ['creator', 'profile'],
  apiKeys: ['creator', 'api-keys'],
  creatives: ['creator', 'creatives'],
};

// GET /creator/profile trả 403 khi chưa có hồ sơ -> chỉ gọi khi /auth/me báo đã có
export const useCreatorProfile = () => {
  const { data: me } = useMe();
  const hasProfile = !!me?.creatorProfile;
  const query = useQuery({
    queryKey: CREATOR_KEYS.profile,
    queryFn: creatorApi.getProfile,
    enabled: hasProfile,
  });
  return { ...query, hasProfile, meLoaded: !!me };
};

// Hồ sơ đổi -> cập nhật cache hồ sơ và tải lại /auth/me (header, trang Cửa hàng dùng creator_profile trong đó)
const useProfileMutation = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (profile) => {
      queryClient.setQueryData(CREATOR_KEYS.profile, profile);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
};

export const useCreateProfile = () => useProfileMutation(creatorApi.createProfile);
export const useUpdateProfile = () => useProfileMutation(creatorApi.updateProfile);
export const useUploadAvatar = () => useProfileMutation(creatorApi.uploadAvatar);
export const useUploadCover = () => useProfileMutation(creatorApi.uploadCover);

export const useCreatorCreatives = (params, enabled) =>
  useQuery({
    queryKey: [...CREATOR_KEYS.creatives, params],
    queryFn: () => creatorApi.listCreatives(params),
    enabled,
    placeholderData: (prev) => prev,
  });

export const useCreatorCreative = (id, enabled) =>
  useQuery({
    queryKey: [...CREATOR_KEYS.creatives, 'detail', String(id)],
    queryFn: () => creatorApi.getCreative(id),
    enabled,
  });

// Đổi trạng thái Creative -> tải lại danh sách và hồ sơ (creative_count)
const useCreativeMutation = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CREATOR_KEYS.creatives });
      queryClient.invalidateQueries({ queryKey: CREATOR_KEYS.profile });
    },
  });
};

export const usePublishCreative = () => useCreativeMutation(creatorApi.publishCreative);

/**
 * Tạo Creative rồi upload lần lượt ảnh mẫu.
 * Truyền `creative` (đã tạo ở lần trước) để chỉ upload lại các ảnh lỗi, tránh tạo trùng.
 * Trả { creative, failed: File[] }.
 */
export const useCreateCreative = () =>
  useCreativeMutation(async ({ payload, images, creative }) => {
    const created = creative ?? (await creatorApi.createCreative(payload));
    const failed = [];
    for (const file of images) {
      try {
        await creatorApi.uploadCreativeImage(created.id, file);
      } catch {
        failed.push(file);
      }
    }
    return { creative: created, failed };
  });

/**
 * Lưu thông tin Creative, upload ảnh mới rồi mới xoá ảnh bị bỏ (Creative đang bán phải luôn còn ảnh).
 * Trả { creative, uploaded: [{ file, image }], failed: File[], failedRemovals: imageId[] }.
 */
export const useUpdateCreative = () =>
  useCreativeMutation(async ({ id, payload, images, removed }) => {
    const creative = await creatorApi.updateCreative(id, payload);
    const uploaded = [];
    const failed = [];
    for (const file of images) {
      try {
        uploaded.push({ file, image: await creatorApi.uploadCreativeImage(id, file) });
      } catch {
        failed.push(file);
      }
    }
    const failedRemovals = [];
    for (const imageId of removed) {
      try {
        await creatorApi.deleteCreativeImage(id, imageId);
      } catch {
        failedRemovals.push(imageId);
      }
    }
    return { creative, uploaded, failed, failedRemovals };
  });

export const useApiKeys = (enabled) =>
  useQuery({ queryKey: CREATOR_KEYS.apiKeys, queryFn: creatorApi.listApiKeys, enabled });

// Cùng key với useAiProviders để dùng chung cache
export const useAiModels = (enabled) =>
  useQuery({ queryKey: ['ai-models'], queryFn: aiModelApi.list, enabled, staleTime: 10 * 60_000 });

// Provider lấy từ danh sách model đang hoạt động (backend chưa có API riêng cho provider)
export const useAiProviders = (enabled) =>
  useQuery({
    queryKey: ['ai-models'],
    queryFn: aiModelApi.list,
    enabled,
    staleTime: 10 * 60_000,
    select: (models) => {
      const byId = new Map();
      models.forEach((m) => byId.set(m.provider.id, m.provider));
      return [...byId.values()];
    },
  });

const useApiKeyMutation = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CREATOR_KEYS.apiKeys }),
  });
};

export const useCreateApiKey = () => useApiKeyMutation(creatorApi.createApiKey);
export const useUpdateApiKey = () => useApiKeyMutation(({ id, ...body }) => creatorApi.updateApiKey(id, body));
export const useDeleteApiKey = () => useApiKeyMutation(creatorApi.deleteApiKey);
