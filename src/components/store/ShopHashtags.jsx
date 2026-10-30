import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../common/Icon';
import { Skeleton, ErrorState } from '../common/Feedback';
import { FormAlert, SubmitButton } from '../common/Form';
import HashtagInput from '../template/HashtagInput';
import { hashtagSlug } from '../../utils/hashtag';
import { getShopHashtags, saveShopHashtags } from '../../api/social';

export const SHOP_HASHTAGS_KEY = ['creator', 'shop-hashtags'];

/**
 * Kho hashtag của shop (note/ai-viet-noi-dung-bai-dang.txt): AI viết nội dung bài đăng chọn tối đa 5 hashtag trong kho,
 * kho rỗng thì bài không có hashtag. Nhân viên của shop dùng chung kho này.
 * Không tự lấy hashtag sản phẩm: chủ shop bấm "Lấy hashtag từ sản phẩm" để thêm vào ô (chưa lưu tới khi bấm Lưu).
 */
export default function ShopHashtags() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: SHOP_HASHTAGS_KEY, queryFn: getShopHashtags });
  const [hashtags, setHashtags] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && hashtags === null) setHashtags(data.hashtags);
  }, [data, hashtags]);

  const mutation = useMutation({
    mutationFn: saveShopHashtags,
    onSuccess: (d) => {
      queryClient.setQueryData(SHOP_HASHTAGS_KEY, d);
      setHashtags(d.hashtags);
      setSaved(true);
    },
  });

  if (isLoading || (data && hashtags === null)) return <Skeleton className="h-28 w-full" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const change = (next) => {
    setHashtags(next);
    setSaved(false);
    mutation.reset();
  };

  const taken = new Set(hashtags.map(hashtagSlug));
  const fromProducts = data.productHashtags.filter((t) => !taken.has(hashtagSlug(t)));
  const importProducts = () => change([...hashtags, ...fromProducts].slice(0, data.max));

  const fieldError = mutation.error?.errors ? Object.values(mutation.error.errors).flat()[0] : null;
  const generalError = mutation.error && !mutation.error.errors ? mutation.error.message : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(hashtags);
      }}
      noValidate
      className="space-y-3"
    >
      <HashtagInput
        value={hashtags}
        onChange={change}
        max={data.max}
        error={fieldError}
        hint="AI chọn tối đa 5 hashtag hợp với ảnh trong danh sách này. Để trống thì bài đăng không có hashtag."
      />
      {fromProducts.length > 0 && (
        <button
          type="button"
          onClick={importProducts}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          <Icon name="playlist_add" className="text-base" />
          Lấy {fromProducts.length} hashtag từ sản phẩm
        </button>
      )}
      {generalError && <FormAlert>{generalError}</FormAlert>}
      {saved && !mutation.isPending && (
        <p className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <Icon name="check_circle" fill className="text-base" />
          Đã lưu kho hashtag.
        </p>
      )}
      <SubmitButton loading={mutation.isPending} loadingText="Đang lưu...">
        Lưu kho hashtag
      </SubmitButton>
    </form>
  );
}
