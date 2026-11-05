import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generationApi } from '../api/services';
import { toFetchUrl } from '../utils/remoteFile';

// Ảnh nhỏ để hiển thị; ảnh gốc (image_url) chỉ tải khi phóng to hoặc tải về
export const thumbOf = (output) => output.thumb_url || output.image_url;

// Generation xong (kể cả lỗi một phần) thì ngừng hỏi trạng thái
export const FINAL_STATUSES = ['completed', 'failed', 'cancelled'];
const POLL_INTERVAL = 2000;

// Tạo ảnh trừ tiền ngay -> tải lại số dư (/auth/me)
const useGenerationMutation = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
};

export const useCreateGeneration = () => useGenerationMutation(generationApi.create);
export const useRetryGeneration = () => useGenerationMutation(generationApi.retry);

/** Tạo lại ảnh lỗi từ Lịch sử mua hàng: tải lại số dư và lịch sử (ảnh lỗi cũ rời tab "Bị lỗi"). */
export const useRetryFromHistory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generationApi.retry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['generations'] });
    },
  });
};

/** Hỏi trạng thái mỗi 2 giây tới khi xong; xong thì tải lại số dư (ảnh lỗi được hoàn tiền). */
export const useGenerationStatus = (id) => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['generations', id, 'status'],
    queryFn: () => generationApi.status(id),
    refetchInterval: (q) => (FINAL_STATUSES.includes(q.state.data?.status) ? false : POLL_INTERVAL),
  });
  const done = FINAL_STATUSES.includes(query.data?.status);
  useEffect(() => {
    if (done) queryClient.invalidateQueries({ queryKey: ['me'] });
  }, [done, queryClient]);
  return query;
};

/** Lịch sử tạo ảnh (mua hàng) của tài khoản, tải thêm theo trang. filters: { creativeId, productId } (bỏ trống = tất cả). */
export const useGenerationHistory = (limit = 10, tab, { creativeId, productId } = {}) =>
  useInfiniteQuery({
    queryKey: ['generations', 'history', limit, tab ?? 'all', creativeId ?? null, productId ?? null],
    queryFn: ({ pageParam }) => generationApi.list({ page: pageParam, limit, tab, creativeId, productId }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
  });

/** Lựa chọn cho bộ lọc lịch sử mua: creative đã mua, sản phẩm của mình có lô ảnh. */
export const useGenerationFilters = () =>
  useQuery({ queryKey: ['generations', 'filters'], queryFn: generationApi.filters, staleTime: 60_000 });

/** Tắt ảnh đã tạo (không hoàn tiền): ảnh biến khỏi lịch sử và các nơi chọn ảnh. */
export const useDisableOutput = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ generationId, outputId }) => generationApi.disableOutput(generationId, outputId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generations'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });
};

/** Bật lại ảnh đã tắt: ảnh về tab "Đang hoạt động", lô ảnh hết làm mờ. */
export const useEnableOutput = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ generationId, outputId }) => generationApi.enableOutput(generationId, outputId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generations'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });
};

const clickLink = (href, filename) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
};


/*
 * Lấy link tải có ký số rồi lưu ảnh về máy.
 * Trình duyệt bỏ qua thuộc tính download với link khác origin, còn disk local không gửi
 * Content-Disposition: attachment -> tải ảnh về dạng blob rồi lưu. Không tải được (CORS...) thì mở link như cũ.
 */
export const useDownloadOutput = () =>
  useMutation({
    mutationFn: async ({ generationId, outputId }) => {
      const { url, filename } = await generationApi.download(generationId, outputId);
      try {
        const res = await fetch(toFetchUrl(url));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const objectUrl = URL.createObjectURL(await res.blob());
        clickLink(objectUrl, filename);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
      } catch {
        clickLink(url, filename);
      }
    },
  });
