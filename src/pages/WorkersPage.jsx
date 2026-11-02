import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { useCreatorProfile } from '../hooks/creatorQueries';
import { useConfirm } from '../components/common/ConfirmDialog';
import {
  IMAGE_WORKER_KEYS,
  WORKER_FUNCTIONS,
  WORKER_KEYS,
  listWorkers,
  regenerateWorkerToken,
  renameWorker,
} from '../api/workers';

const formatDate = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Thay một worker trong cache danh sách (sau khi đổi tên / tạo lại token), rồi tải lại các danh sách worker. */
function useUpdateWorkerCache() {
  const queryClient = useQueryClient();
  return (updated) => {
    queryClient.setQueryData(WORKER_KEYS.all, (list) => list?.map((w) => (w.id === updated.id ? updated : w)));
    queryClient.invalidateQueries({ queryKey: WORKER_KEYS.all });
    queryClient.invalidateQueries({ queryKey: IMAGE_WORKER_KEYS.all });
  };
}

const iconBtn = 'flex size-7 shrink-0 items-center justify-center rounded-md text-outline hover:bg-surface-container disabled:opacity-50';

/**
 * Token ẩn mặc định, bấm mới hiện; sao chép không cần hiện. Tạo lại token (hỏi xác nhận): token cũ hết hiệu lực ngay,
 * tạo xong hiện token mới để dán vào máy worker. Worker cũ chưa lưu token: bấm "Tạo token" để có token.
 */
function TokenRow({ worker }) {
  const { token } = worker;
  const { confirm, alert } = useConfirm();
  const updateCache = useUpdateWorkerCache();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => regenerateWorkerToken(worker.id),
    onSuccess: (updated) => {
      updateCache(updated);
      setShown(true);
    },
    onError: (err) => alert(err.message || 'Không tạo lại được token, vui lòng thử lại.'),
  });

  const regenerate = async () => {
    const ok = await confirm(
      `Tạo token mới cho worker "${worker.name}"?
Token cũ hết hiệu lực ngay: máy worker sẽ ngừng chạy cho tới khi dán token mới vào.`,
      { title: 'Tạo lại token', confirmLabel: 'Tạo token mới', danger: true },
    );
    if (ok) mutation.mutate();
  };

  const regenerateBtn = (
    <button type="button" onClick={regenerate} disabled={mutation.isPending} aria-label="Tạo lại token" title="Tạo lại token" className={iconBtn}>
      <Icon name={mutation.isPending ? 'progress_activity' : 'autorenew'} className={`text-base ${mutation.isPending ? 'animate-spin' : ''}`} />
    </button>
  );

  if (!token) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-surface-container-low px-2 py-1">
        <span className="flex-1 text-xs text-on-surface-variant">Token: chưa xem được, tạo token mới để dùng.</span>
        {regenerateBtn}
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShown(true);
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-lg bg-surface-container-low px-2 py-1">
      <span className="text-xs text-on-surface-variant">Token:</span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-on-surface">{shown ? token : '••••••••••••••••'}</code>
      <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? 'Ẩn token' : 'Hiện token'} className={iconBtn}>
        <Icon name={shown ? 'visibility_off' : 'visibility'} className="text-base" />
      </button>
      <button type="button" onClick={copy} aria-label="Sao chép token" className={iconBtn}>
        <Icon name={copied ? 'check' : 'content_copy'} className={`text-base ${copied ? 'text-primary' : ''}`} />
      </button>
      {regenerateBtn}
    </div>
  );
}

/** Tên worker + nút sửa tên (Enter lưu, Esc huỷ). Đổi xong cập nhật mọi danh sách worker (ô chọn worker tạo ảnh / đăng bài). */
function WorkerName({ worker }) {
  const updateCache = useUpdateWorkerCache();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(worker.name);

  const mutation = useMutation({
    mutationFn: (value) => renameWorker(worker.id, value),
    onSuccess: (updated) => {
      updateCache(updated);
      setEditing(false);
    },
  });

  const start = () => {
    setName(worker.name);
    mutation.reset();
    setEditing(true);
  };

  const submit = (e) => {
    e.preventDefault();
    const value = name.trim();
    if (!value || value === worker.name) {
      setEditing(false);
      return;
    }
    mutation.mutate(value);
  };

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate text-sm font-bold text-on-surface">{worker.name}</p>
        <button
          type="button"
          onClick={start}
          aria-label="Sửa tên worker"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-outline hover:bg-surface-container"
        >
          <Icon name="edit" className="text-base" />
        </button>
      </div>
    );
  }

  const fieldError = mutation.error?.errors?.name ?? mutation.error?.message;

  return (
    <form onSubmit={submit} className="space-y-1">
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          disabled={mutation.isPending}
          aria-label="Tên worker"
          className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 text-sm text-on-surface focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          aria-label="Lưu tên"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-primary hover:bg-surface-container disabled:opacity-50"
        >
          <Icon name={mutation.isPending ? 'progress_activity' : 'check'} className={`text-lg ${mutation.isPending ? 'animate-spin' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={mutation.isPending}
          aria-label="Huỷ"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-outline hover:bg-surface-container disabled:opacity-50"
        >
          <Icon name="close" className="text-lg" />
        </button>
      </div>
      {mutation.isError && <p className="text-xs text-error">{fieldError}</p>}
    </form>
  );
}

function WorkerCard({ worker }) {
  return (
    <div className="space-y-2 rounded-2xl border border-outline-variant/40 p-3">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
          <Icon name="dns" className="text-xl" />
        </span>
        <div className="min-w-0 flex-1">
          <WorkerName worker={worker} />
          <p className="flex items-center gap-1 text-xs">
            <span className={`size-2 rounded-full ${worker.online ? 'bg-emerald-500' : 'bg-outline'}`} />
            <span className={worker.online ? 'font-semibold text-emerald-700' : 'text-on-surface-variant'}>
              {worker.online ? 'Online' : 'Offline'}
            </span>
            <span className="truncate text-outline">
              · {worker.lastSeenAt ? `Hoạt động lúc ${formatDate(worker.lastSeenAt)}` : 'Chưa kết nối'}
            </span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {worker.functions.map((f) => (
          <span key={f} className="flex items-center gap-1 rounded-full bg-primary-fixed/40 px-2 py-0.5 text-xs font-semibold text-primary">
            <Icon name={WORKER_FUNCTIONS[f]?.icon ?? 'build'} className="text-sm" />
            {WORKER_FUNCTIONS[f]?.label ?? f}
          </span>
        ))}
      </div>
      {worker.functions.includes('publish') && (
        <p className="text-xs text-on-surface-variant">
          Chọn được ở trang bài đăng: đăng bài ảnh / video lên TikTok, Facebook, Instagram bằng tài khoản đăng nhập trên máy worker.
        </p>
      )}
      <TokenRow worker={worker} />
    </div>
  );
}

/**
 * /seller/workers: worker admin đã gắn cho shop (note/quan-ly-worker.txt). Xem chức năng, online / offline, token;
 * shop đổi được tên worker và tạo lại token. Thêm / gắn / bật tắt do admin làm.
 */
export default function WorkersPage() {
  useSeo({ title: 'Quản lý worker', noindex: true });
  const { hasProfile, meLoaded } = useCreatorProfile();
  const { data: workers, error, refetch } = useQuery({
    queryKey: WORKER_KEYS.all,
    queryFn: listWorkers,
    enabled: hasProfile,
    // Cập nhật online / offline
    refetchInterval: 60_000,
  });

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <Link to="/tools" aria-label="Quay lại" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
          <Icon name="arrow_back" />
        </Link>
        <h1 className="flex-1 text-base font-bold text-on-surface">Quản lý worker</h1>
      </header>

      <section className="space-y-3 p-4 lg:py-6">
        {!meLoaded ? (
          <Skeleton className="h-28 w-full" />
        ) : !hasProfile ? (
          <EmptyState icon="storefront" message="Bạn cần tạo cửa hàng trước.">
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          </EmptyState>
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !workers ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : !workers.length ? (
          <EmptyState icon="dns" message="Shop chưa được gắn worker nào. Liên hệ admin để được cấp worker." />
        ) : (
          <>
            <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
              <Icon name="info" className="text-base" />
              Worker do admin cấp. Bấm bút để đổi tên, bấm mũi tên xoay để tạo lại token (token cũ hết hiệu lực ngay). Online: worker kết nối trong 5 phút gần đây. Giữ bí mật token, ai có token đều chạy được worker.
            </p>
            <ul className="grid gap-3 lg:grid-cols-2">
              {workers.map((w) => (
                <li key={w.id}>
                  <WorkerCard worker={w} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
