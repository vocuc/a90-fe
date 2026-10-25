import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiModelApi, creatorApi } from '../api/services';
import { useMe } from './queries';

export const CREATOR_KEYS = {
  profile: ['creator', 'profile'],
  creatives: ['creator', 'creatives'],
  wallet: ['creator', 'wallet'],
};

// GET /creator/profile trả 403 khi chưa có hồ sơ -> chỉ gọi khi /auth/me báo đã có.
// staffOf: shop đang làm nhân viên (note/chia-se-tai-nguyen.txt), xem được sản phẩm / nhóm creative của shop đó
export const useCreatorProfile = () => {
  const { data: me } = useMe();
  const hasProfile = !!me?.creatorProfile;
  const query = useQuery({
    queryKey: CREATOR_KEYS.profile,
    queryFn: creatorApi.getProfile,
    enabled: hasProfile,
  });
  return { ...query, hasProfile, staffOf: me?.staffOf ?? null, meLoaded: !!me };
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

// Ví hoa hồng: /creator/* cần hồ sơ người bán
export const useCreatorWallet = () => {
  const { data: me } = useMe();
  return useQuery({ queryKey: CREATOR_KEYS.wallet, queryFn: creatorApi.getWallet, enabled: !!me?.creatorProfile });
};

export const useCreateProfile = () => useProfileMutation(creatorApi.createProfile);
export const useUpdateProfile = () => useProfileMutation(creatorApi.updateProfile);
export const useUploadAvatar = () => useProfileMutation(creatorApi.uploadAvatar);
export const useUploadCover = () => useProfileMutation(creatorApi.uploadCover);

/** Creative của creator, tải thêm theo trang (params không gồm page). */
export const useCreatorCreatives = (params, enabled) =>
  useInfiniteQuery({
    queryKey: [...CREATOR_KEYS.creatives, 'infinite', params],
    queryFn: ({ pageParam }) => creatorApi.listCreatives({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
    enabled,
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
export const usePauseCreative = () => useCreativeMutation(creatorApi.pauseCreative);

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

export const useAiModels = (enabled) =>
  useQuery({ queryKey: ['ai-models'], queryFn: aiModelApi.list, enabled, staleTime: 10 * 60_000 });

// Giới hạn Template Builder do admin cấu hình (số nguyên liệu ẩn tối đa...)
export const useTemplateLimits = () =>
  useQuery({ queryKey: ['creator', 'template-limits'], queryFn: creatorApi.getTemplateLimits, staleTime: 10 * 60_000 });

// Tải ảnh nguyên liệu ẩn (chưa gắn Creative; lưu Creative thì backend gắn vào)
export const useUploadCreativeAsset = () => useMutation({ mutationFn: creatorApi.uploadCreativeAsset });

// data URL của ảnh đại diện (đọc trong trình duyệt) -> File để tải lên
const dataUrlToFile = async (dataUrl) => {
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type.split('/')[1] === 'jpeg' ? 'jpg' : blob.type.split('/')[1] || 'png';
  return new File([blob], `cover.${ext}`, { type: blob.type });
};

/**
 * Lưu Creative từ Template Builder: tạo hoặc sửa thông tin, rồi đổi ảnh đại diện (ảnh đầu tiên) nếu có thay đổi.
 * cover: data URL (ảnh mới) | URL ảnh đang có | null. Ảnh mới tải lên trước, đưa lên đầu, rồi mới xoá ảnh cũ
 * (Creative đang bán phải luôn còn ảnh).
 * Ảnh lỗi không làm hỏng phần đã lưu: trả { creative, coverError } để lần bấm sau chỉ thử lại ảnh.
 */
export const useSaveTemplateCreative = () =>
  useCreativeMutation(async ({ creative, payload, cover }) => {
    const saved = creative ? await creatorApi.updateCreative(creative.id, payload) : await creatorApi.createCreative(payload);
    const images = creative?.images ?? [];
    const current = images[0];
    if (cover === (current?.url ?? null)) return { creative: saved, coverError: null };

    try {
      if (cover) {
        const image = await creatorApi.uploadCreativeImage(saved.id, await dataUrlToFile(cover));
        if (images.length)
          await creatorApi.reorderCreativeImages(saved.id, [image.id, ...images.filter((i) => i !== current).map((i) => i.id)]);
      }
      if (current) await creatorApi.deleteCreativeImage(saved.id, current.id);
      return { creative: saved, coverError: null };
    } catch (err) {
      // Tải lại để lần thử sau biết ảnh nào đã lên được
      const fresh = await creatorApi.getCreative(saved.id).catch(() => saved);
      return { creative: fresh, coverError: err.message };
    }
  });
