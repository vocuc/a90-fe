import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { PlatformStatusList, PostStatusBadge } from '../components/social/PostStatus';
import { PlanBadge } from '../components/social/PlanScript';
import CancelPostButton from '../components/social/CancelPostButton';
import { POST_STATUS, isPostLocked, isVideoPost, listPosts } from '../api/social';
import { useMe } from '../hooks/queries';
import { CreateVideoDialog, POSTS_KEY, createdMessage, formatSchedule, useShopWorkers } from '../components/social/VideoPostDialogs';

const formatTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

const generating = (post) => post.status === POST_STATUS.GENERATING;
const postTitle = (post) => (generating(post) ? 'Đang chuẩn bị...' : post.title?.trim() || (isVideoPost(post) ? 'Bài đăng video' : 'Bài đăng ảnh'));
const imageCount = (post) => post.imageCount;
const coverUrl = (post) => post.coverUrl ?? null;

// Bài ảnh / video dùng chung trang /posts/:id (note/gop-luong-dang-bai.txt)
const postUrl = (post) => `/posts/${post.id}`;

// Bài cần người dùng làm tiếp: nút gọi hành động thay cho "Xem". Chờ tới giờ: sửa; lỗi: sửa / đăng lại; worker im lặng: tạo lại
const actionLabel = (post) =>
  ({
    [POST_STATUS.QUEUED]: 'Sửa',
    [POST_STATUS.PENDING_REVIEW]: post.lastError ? 'Sửa / Đăng lại' : 'Đăng bài',
    [POST_STATUS.PUBLISHING]: 'Tạo lại',
  })[post.status] ?? 'Xem';

/** Nhãn bài video / kế hoạch + giờ đăng + worker (bài đã giao cho worker). */
function VideoInfo({ post }) {
  if (!isVideoPost(post) && !post.worker && !post.plan) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-on-surface-variant">
      {post.plan && <PlanBadge />}
      {post.plan && !post.worker && (
        <span>
          Dự kiến <b className="text-on-surface">{formatSchedule(post.scheduledAt)}</b>
        </span>
      )}
      {isVideoPost(post) && (
        <span className="inline-flex items-center gap-0.5 rounded bg-primary-fixed/40 px-1 font-bold text-primary">
          <Icon name="movie" className="text-xs" />
          Video
        </span>
      )}
      {post.worker && post.status !== POST_STATUS.PENDING_REVIEW && (
        <span>
          Đăng lúc <b className="text-on-surface">{formatSchedule(post.scheduledAt)}</b>
        </span>
      )}
      {post.worker && <span>· {post.worker.name}</span>}
    </p>
  );
}

function Cover({ post, className = '' }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-surface-container ${className}`}>
      {generating(post) && !coverUrl(post) ? (
        <span className="flex size-full animate-pulse items-center justify-center text-sky-600">
          <Icon name="auto_awesome" className="text-2xl" />
        </span>
      ) : (
        <CoverImage src={coverUrl(post)} alt="" className="size-full" />
      )}
      <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
        <Icon name={isVideoPost(post) ? 'movie' : 'photo_library'} className="text-xs" />
        {imageCount(post)}
      </span>
    </div>
  );
}

function Hashtags({ tags }) {
  if (!tags?.length) return null;
  return (
    <p className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-xs font-semibold text-primary">
      {tags.map((t) => (
        <span key={t}>#{t}</span>
      ))}
    </p>
  );
}

// Mobile: mỗi bài là một thẻ, ảnh bìa bên trái, bấm vào để xem / đăng
function PostCards({ posts }) {
  return (
    <ul className="space-y-3 lg:hidden">
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            to={postUrl(post)}
            className={`flex gap-3 rounded-2xl border p-3 transition-colors hover:bg-surface-container-low ${
              post.status === POST_STATUS.PENDING_REVIEW ? 'border-amber-200' : 'border-outline-variant/40'
            }`}
          >
            <Cover post={post} className="aspect-[3/4] w-20" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className={`line-clamp-1 text-sm font-bold ${generating(post) ? 'text-outline' : 'text-on-surface'}`}>{postTitle(post)}</p>
              <VideoInfo post={post} />
              {post.content && <p className="line-clamp-2 text-xs text-on-surface-variant">{post.content}</p>}
              <Hashtags tags={post.hashtags} />
              <PlatformStatusList platforms={post.platforms} />
              <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                <PostStatusBadge status={post.status} />
                <span className="text-[11px] text-outline">{formatTime(post.createdAt)}</span>
                {generating(post) && <CancelPostButton post={post} compact className="ml-auto" />}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Desktop: bảng nhiều cột
function PostTable({ posts }) {
  const navigate = useNavigate();
  const open = (post) => navigate(postUrl(post));
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-outline-variant/40 lg:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-container-low text-xs font-semibold text-on-surface-variant">
          <tr>
            <th className="w-[88px] px-4 py-3">Ảnh bìa</th>
            <th className="px-4 py-3">Tiêu đề</th>
            <th className="px-4 py-3">Nội dung</th>
            <th className="px-4 py-3">Hashtag</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3" aria-label="Thao tác" />
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/30">
          {posts.map((post) => (
            <tr
              key={post.id}
              onClick={() => open(post)}
              className="cursor-pointer align-top hover:bg-surface-container-low/60"
            >
              <td className="px-4 py-3">
                <Cover post={post} className="aspect-[3/4] w-14" />
              </td>
              <td className="px-4 py-3">
                <p className={`line-clamp-2 max-w-[220px] font-semibold ${generating(post) ? 'text-outline' : 'text-on-surface'}`}>
                  {postTitle(post)}
                </p>
                <p className="mt-1 text-xs text-outline">
                  {imageCount(post)} ảnh
                </p>
                <VideoInfo post={post} />
                <p className="text-xs text-outline">{formatTime(post.createdAt)}</p>
              </td>
              <td className="px-4 py-3">
                <p className="line-clamp-3 max-w-[320px] whitespace-pre-line text-xs text-on-surface-variant">{post.content || '—'}</p>
              </td>
              <td className="px-4 py-3">
                <div className="max-w-[220px]">
                  {post.hashtags?.length ? <Hashtags tags={post.hashtags} /> : <span className="text-xs text-outline">—</span>}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="space-y-1.5">
                  <PostStatusBadge status={post.status} />
                  <PlatformStatusList platforms={post.platforms} className="max-w-[240px]" />
                </div>
              </td>
              <td className="space-y-1 px-4 py-3 text-right">
                {generating(post) && <CancelPostButton post={post} compact />}
                <Link
                  to={postUrl(post)}
                  onClick={(e) => e.stopPropagation()}
                  className={`inline-flex h-8 items-center whitespace-nowrap rounded-lg px-3 text-xs font-bold ${
                    post.status === POST_STATUS.PENDING_REVIEW
                      ? 'bg-primary-container text-on-primary hover:bg-primary'
                      : 'text-primary hover:bg-surface-container'
                  }`}
                >
                  {actionLabel(post)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Chip lọc theo nguồn bài (?source=): lookbook = skill FlowKit tạo lookbook, plan = skill kế hoạch nội dung
const SOURCE_CHIPS = [
  ['plan', 'event_note', 'Kế hoạch'],
  ['lookbook', 'checkroom', 'Lookbook'],
];
const SOURCE_LABEL = { plan: 'kế hoạch', lookbook: 'lookbook' };

/**
 * Lọc bài theo nguồn (chip Kế hoạch / Lookbook), ngày đăng và worker đã giao bài (worker đăng bài của shop).
 * Không có worker thì chỉ còn chip nguồn + ngày.
 */
function WorkerFilter({ workers, value, onChange, source, onSourceChange, date, onDateChange }) {
  const chip = (active) =>
    `flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors ${
      active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-primary-fixed/60'
    }`;
  return (
    <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4" role="group" aria-label="Lọc theo worker">
      <Icon name="filter_list" className="shrink-0 text-lg text-outline" />
      {SOURCE_CHIPS.map(([key, icon, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={source === key}
          onClick={() => onSourceChange(source === key ? '' : key)}
          className={chip(source === key)}
        >
          <Icon name={icon} className="text-sm" />
          {label}
        </button>
      ))}
      <label className={`${chip(!!date)} cursor-pointer`}>
        <Icon name="calendar_month" className="text-sm" />
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          aria-label="Lọc theo ngày đăng"
          className="w-[7.5rem] border-none bg-transparent p-0 text-xs font-semibold focus:ring-0"
        />
        {date && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Bỏ lọc ngày"
            onClick={(e) => {
              e.preventDefault();
              onDateChange('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && onDateChange('')}
          >
            <Icon name="close" className="text-sm" />
          </span>
        )}
      </label>
      {!!workers?.length && (
        <button type="button" aria-pressed={!value} onClick={() => onChange('')} className={chip(!value)}>
          Tất cả worker
        </button>
      )}
      {(workers ?? []).map((w) => {
        const active = value === String(w.id);
        return (
          <button
            key={w.id}
            type="button"
            aria-pressed={active}
            title={w.online ? 'Đang online' : 'Offline'}
            onClick={() => onChange(active ? '' : String(w.id))}
            className={chip(active)}
          >
            <span className={`size-2 rounded-full ${w.online ? 'bg-emerald-500' : 'bg-outline-variant'}`} />
            {w.name}
          </button>
        );
      })}
    </div>
  );
}

const PAGE_SIZE = 20;
const POLL_INTERVAL = 5000;
// Bài chờ tới giờ (có thể vài ngày): chỉ theo dõi khi đã tới giờ, worker sắp nhận
const isRunning = (p) =>
  p.status === POST_STATUS.GENERATING ||
  isPostLocked(p) ||
  (p.status === POST_STATUS.QUEUED && new Date(p.scheduledAt ?? 0) <= new Date());

/** /posts: danh sách bài đăng ảnh / video (worker đăng lên TikTok / Facebook / Instagram). */
export default function SocialPostsPage() {
  useSeo({ title: 'Đăng bài', noindex: true });
  const navigate = useNavigate();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/tools'));

  const { data: me } = useMe();
  // Popup "Tạo video"
  const [creatingVideo, setCreatingVideo] = useState(false);
  const [notice, setNotice] = useState(null);

  // Worker đang lọc nằm trên URL (?worker=id): giữ khi tải lại / quay lại trang
  const [searchParams, setSearchParams] = useSearchParams();
  const workerId = searchParams.get('worker') ?? '';
  // ?source=lookbook | plan: chỉ bài lookbook / bài kế hoạch. ?date=YYYY-MM-DD: chỉ bài có giờ đăng trong ngày đó
  const source = SOURCE_LABEL[searchParams.get('source')] ? searchParams.get('source') : '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') ?? '') ? searchParams.get('date') : '';
  const setParam = (key, value) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const setWorkerId = (id) => setParam('worker', id);
  const setSource = (value) => setParam('source', value);
  const setDate = (value) => setParam('date', value);
  // Worker chỉ có khi đã có hồ sơ người bán (API trả 403 khi chưa có shop)
  const { data: workers } = useShopWorkers({ enabled: !!me?.creatorProfile });
  const filterWorker = workers?.find((w) => String(w.id) === workerId);

  const { data, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: [...POSTS_KEY, { workerId, source, date }],
    queryFn: ({ pageParam }) => listPosts({ page: pageParam, limit: PAGE_SIZE, workerId, source, dateFrom: date, dateTo: date }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
    // Còn bài đang chuẩn bị / chờ đăng / đang đăng thì tự cập nhật trạng thái mỗi 5 giây
    refetchInterval: (q) => (q.state.data?.pages.some((p) => p.items.some(isRunning)) ? POLL_INTERVAL : false),
  });
  const posts = data ? data.pages.flatMap((p) => p.items) : null;

  const pendingCount = posts?.filter((p) => p.status === POST_STATUS.PENDING_REVIEW).length ?? 0;

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
        <h1 className="flex-1 text-base font-bold text-on-surface">Danh sách bài đăng</h1>
        {/* Bài video có lịch (note/lap-lich-worker.txt): cần hồ sơ người bán */}
        {me?.creatorProfile && (
          <button
            type="button"
            onClick={() => setCreatingVideo(true)}
            className="flex h-8 items-center gap-1 rounded-lg border border-primary px-3 text-xs font-bold text-primary hover:bg-primary-fixed/30"
          >
            <Icon name="movie" className="text-base" />
            Tạo video
          </button>
        )}
        <Link
          to="/posts/new"
          className="mr-2 flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary hover:bg-primary"
        >
          <Icon name="add" className="text-base" />
          Tạo bài đăng
        </Link>
      </header>

      <section className="space-y-3 p-4 lg:py-6">
        <WorkerFilter
          workers={workers}
          value={workerId}
          onChange={setWorkerId}
          source={source}
          onSourceChange={setSource}
          date={date}
          onDateChange={setDate}
        />
        {notice && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <Icon name="check_circle" className="text-base" />
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Đóng" className="text-emerald-800">
              <Icon name="close" className="text-base" />
            </button>
          </p>
        )}
        {pendingCount > 0 && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <Icon name="edit_note" className="text-base" />
            Có {pendingCount} bài đang chờ bạn xem lại và đăng.
          </p>
        )}
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !posts ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : !posts.length && (workerId || source || date) ? (
          <EmptyState
            icon="filter_list_off"
            message={`${
              workerId ? `${filterWorker ? `Worker "${filterWorker.name}"` : 'Worker này'} chưa có` : 'Chưa có'
            } bài ${source ? `${SOURCE_LABEL[source]} ` : ''}nào${date ? ` đăng ngày ${date.split('-').reverse().join('/')}` : ''}.`}
          >
            <button
              type="button"
              onClick={() => {
                setSearchParams({}, { replace: true });
              }}
              className="mt-2 flex h-10 items-center gap-1 rounded-xl px-4 text-sm font-bold text-primary hover:bg-surface-container"
            >
              Xem tất cả bài đăng
            </button>
          </EmptyState>
        ) : !posts.length ? (
          <EmptyState icon="video_library" message="Chưa có bài đăng nào.">
            <Link
              to="/posts/new"
              className="mt-2 flex h-10 items-center gap-1 rounded-xl bg-primary-container px-4 text-sm font-bold text-on-primary hover:bg-primary"
            >
              <Icon name="add" className="text-lg" />
              Tạo bài đăng
            </Link>
          </EmptyState>
        ) : (
          <>
            <PostCards posts={posts} />
            <PostTable posts={posts} />
            {hasNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="mx-auto flex h-9 items-center gap-1 rounded-lg px-4 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-60"
              >
                {isFetchingNextPage && <Icon name="progress_activity" className="animate-spin text-base" />}
                Xem thêm bài đăng
              </button>
            )}
          </>
        )}
      </section>

      {creatingVideo && (
        <CreateVideoDialog
          onClose={() => setCreatingVideo(false)}
          onCreated={(result) => {
            setCreatingVideo(false);
            setNotice(createdMessage(result));
          }}
        />
      )}
    </>
  );
}
