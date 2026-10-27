import { useEffect, useRef, useState } from 'react';
import Dialog from '../common/Dialog';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { TextField } from '../common/Form';
import { ErrorState, Skeleton } from '../common/Feedback';
import { STATUS_BADGE } from '../creative/creativeStatus';
import { useCreatorCreatives } from '../../hooks/creatorQueries';
import { saveGroup } from '../../api/autoBatch';

/**
 * Tạo / sửa nhóm creative (note/auto-tao-lo.txt): tên + creative của chính mình (mọi trạng thái, tạo lô chỉ dùng
 * creative Đang bán). Một creative chỉ ở một nhóm: creative đã ở nhóm khác hiện tên nhóm, không chọn được.
 */
export default function GroupFormDialog({ group, onSaved, onClose }) {
  const [name, setName] = useState(group?.name ?? '');
  const [selected, setSelected] = useState(() => group?.creatives.map((c) => c.id) ?? []);
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { data, isLoading, error: loadError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useCreatorCreatives(
    { q: q.trim() || undefined, limit: 30 },
    true,
  );
  const creatives = data?.pages.flatMap((p) => p.items) ?? [];

  // Cuộn tới cuối danh sách thì tải thêm
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && fetchNextPage(), { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const nameError = submitted && !name.trim() ? 'Vui lòng nhập tên nhóm.' : null;

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    if (!name.trim()) return;
    if (!selected.length) {
      setError('Vui lòng chọn ít nhất 1 creative.');
      return;
    }
    setSaving(true);
    try {
      onSaved(await saveGroup({ id: group?.id, name: name.trim(), creativeIds: selected }));
    } catch (err) {
      // errors["creative_ids.2"]: creative thứ 3 đã ở nhóm khác / không phải của mình
      const first = Object.entries(err?.errors ?? {}).find(([k]) => k.startsWith('creative_ids'));
      setError(first?.[1] ?? err?.message ?? 'Không lưu được nhóm, vui lòng thử lại.');
      setSaving(false);
    }
  };

  return (
    <Dialog
      title={group ? 'Sửa nhóm creative' : 'Tạo nhóm creative'}
      subtitle={`Đã chọn ${selected.length} creative`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            <Icon name={saving ? 'progress_activity' : 'save'} className={`text-lg ${saving ? 'animate-spin' : ''}`} />
            Lưu nhóm
          </button>
        </>
      }
    >
      <TextField label="Tên nhóm" icon="workspaces" value={name} maxLength={255} error={nameError} onChange={(e) => setName(e.target.value)} />

      <div>
        <p className="mb-1.5 text-xs font-semibold text-on-surface">Creative trong nhóm</p>
        <TextField label="" icon="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên creative" />
        <ul className="mt-2 space-y-1.5">
          {loadError ? (
            <ErrorState error={loadError} onRetry={refetch} />
          ) : isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)
          ) : !creatives.length ? (
            <p className="py-4 text-center text-xs text-on-surface-variant">Không có creative nào.</p>
          ) : (
            creatives.map((c) => {
              const otherGroup = c.group && c.group.id !== group?.id ? c.group : null;
              const checked = selected.includes(c.id);
              const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.draft;
              return (
                <li key={c.id}>
                  <label
                    className={`flex items-center gap-3 rounded-xl border p-2 ${
                      otherGroup ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-surface-container-low'
                    } ${checked ? 'border-primary-container bg-primary-container/5' : 'border-outline-variant/40'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!!otherGroup}
                      onChange={() => toggle(c.id)}
                      className="size-4 accent-primary"
                    />
                    <CoverImage src={c.cover_url} alt="" className="size-16 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-on-surface">{c.title}</span>
                      <span className="flex flex-wrap items-center gap-1 text-[11px] text-on-surface-variant">
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                        {otherGroup && <span>Đang ở nhóm "{otherGroup.name}"</span>}
                      </span>
                    </span>
                    {checked && (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-container text-[11px] font-bold text-on-primary">
                        {selected.indexOf(c.id) + 1}
                      </span>
                    )}
                  </label>
                </li>
              );
            })
          )}
        </ul>
        {isFetchingNextPage && <Skeleton className="mt-1.5 h-20" />}
        {hasNextPage && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-error-container/60 px-3 py-2 text-xs text-on-error-container">
          {error}
        </p>
      )}
    </Dialog>
  );
}
