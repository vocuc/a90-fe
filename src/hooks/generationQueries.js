import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generationApi } from '../api/services';

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

/** Lịch sử tạo ảnh (mua hàng) của tài khoản, tải thêm theo trang. */
export const useGenerationHistory = (limit = 10) =>
  useInfiniteQuery({
    queryKey: ['generations', 'history', limit],
    queryFn: ({ pageParam }) => generationApi.list({ page: pageParam, limit }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
  });

const clickLink = (href, filename) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// Khi dev, ảnh trên disk local đi qua proxy /media của Vite (cùng origin, chữ ký là tương đối nên vẫn hợp lệ)
const toFetchUrl = (url) => {
  const u = new URL(url, window.location.href);
  return import.meta.env.DEV && u.pathname.startsWith('/media/') ? u.pathname + u.search : url;
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
