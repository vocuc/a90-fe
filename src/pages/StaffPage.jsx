import { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { BatchStatusBadge } from '../components/batch/BatchStatus';
import { useCreatorProfile } from '../hooks/creatorQueries';
import { BATCH_SOURCE } from '../api/batches';
import { STAFF_KEYS, addStaff, listStaff, listStaffBatches, removeStaff } from '../api/staff';

const PAGE_SIZE = 20;

const formatTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

function AddStaffForm() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await addStaff(email.trim());
      setEmail('');
      await queryClient.invalidateQueries({ queryKey: STAFF_KEYS.staff });
    } catch (err) {
      setError(err?.errors?.email || err?.message || 'Không thêm được nhân viên, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-1">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email tài khoản A51 của nhân viên"
          aria-label="Email nhân viên"
          maxLength={255}
          className={`h-10 min-w-0 flex-1 rounded-xl border bg-surface-container-lowest px-3 text-sm focus:border-primary-container focus:ring-primary-container ${
            error ? 'border-error' : 'border-outline-variant/60'
          }`}
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="flex h-10 shrink-0 items-center gap-1 rounded-xl bg-primary-container px-4 text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
        >
          <Icon name={loading ? 'progress_activity' : 'person_add'} className={`text-lg ${loading ? 'animate-spin' : ''}`} />
          Thêm
        </button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </form>
  );
}

function StaffRow({ staff }) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    if (!window.confirm(`Gỡ ${staff.user.name} khỏi shop? Nhân viên mất quyền dùng tài nguyên shop ngay, lô đã tạo vẫn giữ nguyên.`)) return;
    setRemoving(true);
    try {
      await removeStaff(staff.id);
      await queryClient.invalidateQueries({ queryKey: STAFF_KEYS.staff });
    } catch (err) {
      window.alert(err?.message || 'Không gỡ được nhân viên, vui lòng thử lại.');
      setRemoving(false);
    }
  };

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-sm font-bold text-on-surface-variant">
        {staff.user.name?.[0]?.toUpperCase() ?? '?'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-on-surface">{staff.user.name}</span>
        <span className="block truncate text-xs text-on-surface-variant">{staff.user.email}</span>
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={removing}
        aria-label={`Gỡ ${staff.user.name}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-error hover:bg-error-container/40 disabled:opacity-50"
      >
        <Icon name={removing ? 'progress_activity' : 'person_remove'} className={`text-lg ${removing ? 'animate-spin' : ''}`} />
      </button>
    </li>
  );
}

function StaffBatchCard({ batch }) {
  return (
    <div className="relative flex gap-3 rounded-2xl border border-outline-variant/40 p-3 transition-colors hover:bg-surface-container-low">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-container">
        <CoverImage src={batch.coverUrl} alt="" className="size-full" />
        <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
          <Icon name="photo_library" className="text-xs" />
          {batch.imageCount}
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/seller/staff/batches/${batch.id}`}
            className="text-sm font-bold text-on-surface after:absolute after:inset-0 after:rounded-2xl"
          >
            Lô #{batch.id}
          </Link>
          <BatchStatusBadge batch={batch} />
        </div>
        <p className="flex items-center gap-1 text-xs text-on-surface-variant">
          <Icon name="person" className="text-sm" />
          <span className="truncate">{batch.user?.name ?? 'Nhân viên'}</span>
        </p>
        {batch.source === BATCH_SOURCE.AUTO && (
          <p className="flex min-w-0 items-center gap-1 text-xs text-on-surface-variant">
            <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">Tự động</span>
            <span className="truncate">
              {[batch.product && (batch.product.name || `Sản phẩm #${batch.product.id}`), batch.group?.name].filter(Boolean).join(' · ')}
            </span>
          </p>
        )}
        <p className="text-xs text-on-surface-variant">
          {formatTime(batch.createdAt)}
          {batch.postCount > 0 && <span className="text-primary"> · Đã tạo {batch.postCount} bài đăng</span>}
        </p>
      </div>
    </div>
  );
}

function StaffBatches({ staff }) {
  // '' = tất cả (gồm cả nhân viên đã gỡ)
  const [userId, setUserId] = useState('');
  const { data, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: [...STAFF_KEYS.batches, userId],
    queryFn: ({ pageParam }) => listStaffBatches({ userId, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
  });
  const batches = data ? data.pages.flatMap((p) => p.items) : null;
  const filters = [{ value: '', label: 'Tất cả' }, ...(staff ?? []).map((s) => ({ value: s.user.id, label: s.user.name }))];

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-on-surface">Lô ảnh của nhân viên</h2>
      <p className="text-xs text-on-surface-variant">Lô nhân viên tạo bằng sản phẩm, nhóm creative hoặc mẫu của shop. Bạn chỉ xem được.</p>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setUserId(f.value)}
            aria-pressed={userId === f.value}
            className={`flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-bold transition-colors ${
              userId === f.value
                ? 'border-primary-container bg-primary-container text-on-primary'
                : 'border-outline-variant/60 text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !batches ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : !batches.length ? (
        <EmptyState icon="burst_mode" message="Chưa có lô ảnh nào." />
      ) : (
        <>
          <ul className="grid gap-3 xl:grid-cols-2">
            {batches.map((b) => (
              <li key={b.id}>
                <StaffBatchCard batch={b} />
              </li>
            ))}
          </ul>
          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mx-auto flex h-9 items-center gap-1 rounded-lg px-4 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-60"
            >
              {isFetchingNextPage && <Icon name="progress_activity" className="animate-spin text-base" />}
              Xem thêm lô ảnh
            </button>
          )}
        </>
      )}
    </section>
  );
}

/**
 * /seller/staff: chủ shop quản lý nhân viên (note/chia-se-tai-nguyen.txt). Thêm bằng email là thành nhân viên ngay,
 * gỡ thì nhân viên mất quyền ngay. Nhân viên dùng sản phẩm / nhóm creative / mẫu của shop, tiền trừ ví nhân viên.
 * Bên dưới (desktop: bên phải) là lô nhân viên tạo bằng tài nguyên shop, chủ shop chỉ xem.
 */
export default function StaffPage() {
  useSeo({ title: 'Nhân viên', noindex: true });
  const { hasProfile, meLoaded } = useCreatorProfile();
  const { data: staff, error, refetch } = useQuery({ queryKey: STAFF_KEYS.staff, queryFn: listStaff, enabled: hasProfile });

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <Link to="/account" aria-label="Quay lại" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
          <Icon name="arrow_back" />
        </Link>
        <h1 className="flex-1 text-base font-bold text-on-surface">Nhân viên</h1>
      </header>

      <div className="p-4 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-8 lg:py-6">
        {!meLoaded ? (
          <Skeleton className="h-24 w-full" />
        ) : !hasProfile ? (
          <EmptyState icon="storefront" message="Bạn cần tạo cửa hàng trước khi thêm nhân viên.">
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          </EmptyState>
        ) : (
          <>
            <section className="space-y-3 lg:sticky lg:top-[136px]">
              <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
                <Icon name="info" className="text-base" />
                <span>
                  Nhân viên dùng sản phẩm, nhóm creative và mẫu của shop để tạo ảnh, tiền trừ vào ví của nhân viên. Mỗi người chỉ
                  thuộc một shop; tài khoản đã có shop không thêm được.
                </span>
              </p>
              <AddStaffForm />
              {error ? (
                <ErrorState error={error} onRetry={refetch} />
              ) : !staff ? (
                <Skeleton className="h-32 w-full" />
              ) : !staff.length ? (
                <EmptyState icon="groups" message="Chưa có nhân viên nào." />
              ) : (
                <ul className="divide-y divide-surface-container overflow-hidden rounded-2xl border border-outline-variant/40">
                  {staff.map((s) => (
                    <StaffRow key={s.id} staff={s} />
                  ))}
                </ul>
              )}
            </section>
            <div className="mt-6 lg:mt-0">
              <StaffBatches staff={staff} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
