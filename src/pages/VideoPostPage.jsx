import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { PostStatusBadge } from '../components/social/PostStatus';
import { VideoPostPanel, postKey } from '../components/social/VideoPostDialogs';
import { getPost, isVideoEditable, isVideoPost } from '../api/social';

/** /posts/:id/video: xem / sửa bài video (trước đây là popup ở danh sách bài đăng). */
export default function VideoPostPage() {
  useSeo({ title: 'Bài video', noindex: true });
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/posts', { replace: true }));

  // Form lấy giá trị ban đầu từ bài lúc mở trang: luôn tải bản mới nhất, không dùng bản cache cũ
  const { data: post, error, refetch, isFetchedAfterMount } = useQuery({
    queryKey: postKey(id),
    queryFn: () => getPost(id),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  // Bài ảnh có trang riêng
  const wrongType = post && !isVideoPost(post);
  useEffect(() => {
    if (wrongType) navigate(`/posts/${id}`, { replace: true });
  }, [wrongType, id, navigate]);

  const title = !post ? 'Bài video' : isVideoEditable(post) ? 'Sửa bài video' : 'Bài video';

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={goBack}
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-on-surface">{title}</h1>
          {post?.title && <p className="truncate text-xs text-on-surface-variant">{post.title}</p>}
        </div>
        {post && (
          <span className="mr-2">
            <PostStatusBadge status={post.status} />
          </span>
        )}
      </header>

      <section className="p-4 lg:py-6">
        {error ? (
          <ErrorState error={error} onRetry={error.status === 404 ? undefined : refetch} />
        ) : !post || !isFetchedAfterMount || wrongType ? (
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <VideoPostPanel key={`${post.id}-${post.status}`} post={post} onDone={goBack} />
        )}
      </section>
    </>
  );
}
