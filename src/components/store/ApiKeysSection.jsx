import { useState } from 'react';
import Icon from '../common/Icon';
import { ErrorState, Skeleton } from '../common/Feedback';
import { FormAlert, SubmitButton, TextField } from '../common/Form';
import {
  useAiProviders,
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  useUpdateApiKey,
} from '../../hooks/creatorQueries';

const STATUS = {
  active: { label: 'Đang hoạt động', cls: 'bg-surface-container text-primary' },
  invalid: { label: 'Key sai', cls: 'bg-error-container text-error' },
  quota_exceeded: { label: 'Hết quota', cls: 'bg-error-container text-error' },
  disabled: { label: 'Đã tắt', cls: 'bg-surface-container-high text-on-surface-variant' },
};

const formatTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

const KEY_ERRORS = {
  API_KEY_INVALID: 'API key không hợp lệ. Kiểm tra lại key, hoặc bật Generative Language API cho project của key.',
  API_KEY_VERIFY_FAILED: 'Không kiểm tra được key với nhà cung cấp AI, vui lòng thử lại.',
};
const keyErrorMessage = (err) => KEY_ERRORS[err?.code] ?? err?.message;

function AddKeyForm({ providers, onDone }) {
  const create = useCreateApiKey();
  const [providerId, setProviderId] = useState(() => providers[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');

  const fieldErrors = create.error?.errors ?? {};
  const invalid = !providerId || !label.trim() || apiKey.trim().length < 10;

  const onSubmit = (e) => {
    e.preventDefault();
    if (invalid) return;
    create.mutate(
      { provider_id: Number(providerId), label: label.trim(), api_key: apiKey.trim() },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-xl border border-outline-variant/40 p-3">
      {providers.length > 1 && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-on-surface">Nhà cung cấp AI</span>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="w-full rounded-xl border-outline-variant/40 bg-surface-container-low text-sm focus:border-primary-container focus:ring-primary-container/20"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <TextField
        label="Tên gợi nhớ"
        icon="label"
        maxLength={100}
        placeholder="Ví dụ: Key chính"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        error={fieldErrors.label && 'Tên gợi nhớ tối đa 100 ký tự.'}
      />
      <TextField
        label={`API key ${providers.find((p) => String(p.id) === String(providerId))?.name ?? ''}`}
        icon="key"
        type="password"
        autoComplete="off"
        placeholder="AIza..."
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        error={fieldErrors.api_key && 'API key cần từ 10 đến 500 ký tự.'}
        hint={
          <>
            Lấy key Gemini tại{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-semibold text-primary underline">
              aistudio.google.com/apikey
            </a>
            . Key được mã hoá và không hiển thị lại.
          </>
        }
      />
      {create.error && !create.error.errors && <FormAlert>{keyErrorMessage(create.error)}</FormAlert>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={create.isPending}
          className="h-12 flex-1 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface hover:bg-surface-container-low"
        >
          Huỷ
        </button>
        <div className="flex-[2]">
          <SubmitButton loading={create.isPending} loadingText="Đang kiểm tra key..." disabled={invalid}>
            Lưu key
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

function KeyRow({ apiKey, providerName }) {
  const update = useUpdateApiKey();
  const remove = useDeleteApiKey();
  const [notice, setNotice] = useState(null);
  const status = STATUS[apiKey.status] ?? STATUS.disabled;
  const coolingDown = apiKey.cooldown_until && new Date(apiKey.cooldown_until) > new Date();
  const busy = update.isPending || remove.isPending;
  const error = update.error || remove.error;

  const toggle = () =>
    update.mutate({ id: apiKey.id, status: apiKey.status === 'active' ? 'disabled' : 'active' });

  const onDelete = () => {
    if (!window.confirm(`Xoá key "${apiKey.label}"? Creative sẽ bị tạm dừng nếu không còn key nào hoạt động.`)) return;
    remove.mutate(apiKey.id, {
      onSuccess: (res) => {
        if (res?.paused_creatives > 0) {
          setNotice(`${res.paused_creatives} Creative đã bị tạm dừng vì không còn key hoạt động.`);
        }
      },
    });
  };

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
          <Icon name="key" className="text-[20px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface" title={apiKey.label}>
            {apiKey.label}
          </p>
          <p className="text-xs text-on-surface-variant">
            {providerName} · <span className="font-mono">{apiKey.key_hint}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`}>{status.label}</span>
            {coolingDown && (
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant">
                Tạm nghỉ đến {formatTime(apiKey.cooldown_until)}
              </span>
            )}
          </div>
          {apiKey.last_error && apiKey.status !== 'active' && (
            <p className="mt-1 line-clamp-2 text-[11px] text-error" title={apiKey.last_error}>
              {apiKey.last_error}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 pl-12">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="flex h-8 items-center gap-1 rounded-lg border border-outline-variant/40 px-3 text-xs font-semibold text-on-surface hover:bg-surface-container-low disabled:opacity-50"
        >
          {update.isPending ? (
            <Icon name="progress_activity" className="animate-spin text-sm" />
          ) : (
            <Icon name={apiKey.status === 'active' ? 'pause_circle' : 'play_circle'} className="text-sm" />
          )}
          {apiKey.status === 'active' ? 'Tắt' : 'Bật lại'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="flex h-8 items-center gap-1 rounded-lg border border-error/40 px-3 text-xs font-semibold text-error hover:bg-error-container/40 disabled:opacity-50"
        >
          <Icon name={remove.isPending ? 'progress_activity' : 'delete'} className={`text-sm ${remove.isPending ? 'animate-spin' : ''}`} />
          Xoá
        </button>
      </div>
      {error && <FormAlert>{keyErrorMessage(error)}</FormAlert>}
      {notice && <p className="text-xs text-on-surface-variant">{notice}</p>}
    </li>
  );
}

/** Quản lý API key AI của Creator. Hệ thống tự xoay vòng các key đang hoạt động khi tạo ảnh. */
export default function ApiKeysSection() {
  const keys = useApiKeys(true);
  const providers = useAiProviders(true);
  const [adding, setAdding] = useState(false);

  const providerName = (id) => providers.data?.find((p) => p.id === id)?.name ?? 'AI';
  const activeCount = keys.data?.filter((k) => k.status === 'active').length ?? 0;

  if (keys.error || providers.error) {
    const retry = () => {
      keys.refetch();
      providers.refetch();
    };
    return <ErrorState error={keys.error || providers.error} onRetry={retry} />;
  }
  if (keys.isLoading || providers.isLoading) {
    return <Skeleton className="h-28 w-full" />;
  }

  return (
    <div className="space-y-3">
      {activeCount === 0 && (
        <p className="flex items-start gap-1.5 rounded-lg bg-error-container/50 px-3 py-2 text-xs text-on-error-container">
          <Icon name="warning" className="text-sm" />
          Chưa có key nào hoạt động. Creative của bạn không thể đăng hoặc tạo ảnh cho người mua.
        </p>
      )}

      {keys.data.length > 0 && (
        <ul className="divide-y divide-surface-container overflow-hidden rounded-xl border border-outline-variant/40">
          {keys.data.map((k) => (
            <KeyRow key={k.id} apiKey={k} providerName={providerName(k.provider_id)} />
          ))}
        </ul>
      )}

      {adding ? (
        <AddKeyForm providers={providers.data} onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={!providers.data.length}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary-container text-sm font-semibold text-primary-container hover:bg-surface-container-low disabled:opacity-50"
        >
          <Icon name="add" className="text-lg" />
          Thêm API key
        </button>
      )}
      <p className="text-[11px] leading-relaxed text-on-surface-variant">
        Khi người mua tạo ảnh, hệ thống gọi AI bằng key của bạn và tự xoay vòng giữa các key đang hoạt động. Key lỗi sẽ
        được bỏ qua; nếu không còn key nào, Creative tự tạm dừng.
      </p>
    </div>
  );
}
