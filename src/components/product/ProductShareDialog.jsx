import { useEffect, useState } from 'react';
import Dialog from '../common/Dialog';
import CoverImage from '../common/CoverImage';
import Icon from '../common/Icon';
import { TextField } from '../common/Form';
import { ErrorState, Skeleton } from '../common/Feedback';
import { bulkShareProducts, listAllProducts } from '../../api/autoBatch';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACTIONS = [
  { value: 'share', label: 'Chia sẻ', icon: 'share' },
  { value: 'unshare', label: 'Bỏ chia sẻ', icon: 'person_remove' },
];

/**
 * Chia sẻ / bỏ chia sẻ hàng loạt (nút "Chia sẻ" cạnh "Thêm sản phẩm"): chọn sản phẩm của mình (hoặc tất cả) + email
 * tài khoản A51. Người được chia sẻ thấy sản phẩm ở Quản lý sản phẩm và dùng để tạo ảnh / tạo lô, không sửa / xoá được.
 * Chỉ thêm / bớt các email nhập ở đây, người đang được chia sẻ khác giữ nguyên.
 */
export default function ProductShareDialog({ onSaved, onClose }) {
  const [products, setProducts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [action, setAction] = useState('share');
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState([]);
  const [emails, setEmails] = useState([]);
  const [email, setEmail] = useState('');
  const [inputError, setInputError] = useState(null);
  // { [email]: lỗi backend } để đánh dấu đúng dòng
  const [rowErrors, setRowErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  const load = () => {
    setLoadError(null);
    listAllProducts()
      .then((items) => setProducts(items.filter((p) => p.isOwner)))
      .catch(setLoadError);
  };
  useEffect(load, []);

  // Đang "Chọn tất cả" mà bỏ 1 sản phẩm -> chuyển sang chọn từng sản phẩm, trừ sản phẩm đó
  const toggle = (id) => {
    if (all) {
      setAll(false);
      setSelected(products.filter((x) => x.id !== id).map((x) => x.id));
      return;
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const isPicked = (id) => all || selected.includes(id);
  const pickedCount = all ? (products?.length ?? 0) : selected.length;

  // Thêm email đang gõ vào danh sách; trả danh sách mới (null nếu email sai)
  const addPending = () => {
    const value = email.trim().toLowerCase();
    if (!value) return emails;
    if (!EMAIL_PATTERN.test(value)) {
      setInputError('Email không hợp lệ.');
      return null;
    }
    const next = emails.includes(value) ? emails : [...emails, value];
    setEmails(next);
    setEmail('');
    setInputError(null);
    return next;
  };

  const removeEmail = (target) => {
    setEmails((prev) => prev.filter((e) => e !== target));
    setRowErrors(({ [target]: _, ...rest }) => rest);
  };

  const submit = async () => {
    setError(null);
    setDone(null);
    const list = addPending();
    if (!list) return;
    if (!pickedCount) {
      setError('Vui lòng chọn sản phẩm.');
      return;
    }
    if (!list.length) {
      setInputError('Vui lòng nhập email người nhận.');
      return;
    }
    setSaving(true);
    setRowErrors({});
    try {
      const { productCount } = await bulkShareProducts({ action, emails: list, all, productIds: selected });
      setDone(
        `${action === 'share' ? 'Đã chia sẻ' : 'Đã bỏ chia sẻ'} ${productCount} sản phẩm ${
          action === 'share' ? 'cho' : 'với'
        } ${list.length} tài khoản.`,
      );
      setEmails([]);
      load(); // cập nhật số tài khoản đang chia sẻ của từng sản phẩm
      onSaved();
    } catch (err) {
      const byRow = Object.fromEntries(
        Object.entries(err?.errors ?? {})
          .filter(([k]) => k.startsWith('emails.'))
          .map(([k, msg]) => [list[Number(k.split('.')[1])], msg]),
      );
      setRowErrors(byRow);
      setError(
        Object.keys(byRow).length
          ? 'Có email chưa đúng, xem bên dưới.'
          : (err?.errors?.product_ids ?? err?.message ?? 'Không lưu được, vui lòng thử lại.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const current = ACTIONS.find((a) => a.value === action);

  return (
    <Dialog
      title="Chia sẻ sản phẩm"
      subtitle={`Đã chọn ${pickedCount} sản phẩm · ${emails.length} email`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !products}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-on-primary disabled:opacity-50 ${
              action === 'share' ? 'bg-primary-container hover:bg-primary' : 'bg-error hover:opacity-90'
            }`}
          >
            <Icon name={saving ? 'progress_activity' : current.icon} className={`text-lg ${saving ? 'animate-spin' : ''}`} />
            {current.label}
          </button>
        </>
      }
    >
      <div role="tablist" aria-label="Thao tác" className="flex gap-1 rounded-xl bg-surface-container-low p-1">
        {ACTIONS.map((a) => (
          <button
            key={a.value}
            type="button"
            role="tab"
            aria-selected={action === a.value}
            onClick={() => {
              setAction(a.value);
              setDone(null);
            }}
            className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-lg text-xs font-bold transition-colors ${
              action === a.value ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Icon name={a.icon} className="text-base" />
            {a.label}
          </button>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
        <Icon name="info" className="text-base" />
        <span>
          {action === 'share'
            ? 'Người nhận sẽ thấy các sản phẩm đã chọn trong Quản lý sản phẩm và dùng được để tạo ảnh, tạo lô, nhưng không sửa hay xoá được.'
            : 'Các email dưới đây sẽ không còn thấy và dùng các sản phẩm đã chọn. Người khác đang được chia sẻ giữ nguyên.'}
        </span>
      </p>

      {/* Email người nhận */}
      <div>
        <form
          className="flex items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addPending();
          }}
        >
          <div className="flex-1">
            <TextField
              label="Email tài khoản A51"
              icon="mail"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="ten@gmail.com"
              value={email}
              error={inputError}
              onChange={(e) => {
                setEmail(e.target.value);
                setInputError(null);
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!email.trim()}
            className="mt-[22px] flex h-11 shrink-0 items-center gap-1 rounded-xl border border-outline-variant/60 px-3 text-sm font-bold text-on-surface hover:border-primary-container hover:text-primary disabled:opacity-50"
          >
            <Icon name="person_add" className="text-lg" />
            Thêm
          </button>
        </form>
        {emails.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {emails.map((e) => (
              <li
                key={e}
                title={rowErrors[e]}
                className={`flex max-w-full items-center gap-1 rounded-full py-1 pl-3 pr-1 text-xs font-semibold ${
                  rowErrors[e] ? 'bg-error-container/60 text-on-error-container' : 'bg-surface-container text-on-surface'
                }`}
              >
                <span className="truncate">{e}</span>
                <button
                  type="button"
                  onClick={() => removeEmail(e)}
                  aria-label={`Bỏ ${e}`}
                  className="flex size-5 items-center justify-center rounded-full hover:bg-surface-container-high"
                >
                  <Icon name="close" className="text-sm" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {Object.entries(rowErrors).map(([e, msg]) => (
          <p key={e} className="mt-1 text-[11px] text-error">
            {msg}
          </p>
        ))}
      </div>

      {/* Sản phẩm */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-on-surface">Sản phẩm</p>
          {products?.length > 0 && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-primary">
              <input
                type="checkbox"
                checked={all}
                onChange={(e) => {
                  setAll(e.target.checked);
                  setSelected([]);
                }}
                className="size-4 rounded border-outline-variant text-primary focus:ring-primary"
              />
              Chọn tất cả ({products.length})
            </label>
          )}
        </div>
        {loadError ? (
          <ErrorState error={loadError} onRetry={load} />
        ) : !products ? (
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !products.length ? (
          <p className="rounded-xl bg-surface-container-low py-4 text-center text-xs text-on-surface-variant">Bạn chưa có sản phẩm nào.</p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {products.map((p) => (
              <li key={p.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2 ${
                    isPicked(p.id) ? 'border-primary-container bg-primary-fixed/30' : 'border-outline-variant/40 hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isPicked(p.id)}
                    onChange={() => toggle(p.id)}
                    className="size-4 shrink-0 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <CoverImage src={p.coverUrl} alt="" className="size-12 shrink-0 rounded-lg bg-surface-container !object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{p.name || `Sản phẩm #${p.id}`}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      {p.shareCount > 0 ? `Đang chia sẻ cho ${p.shareCount} tài khoản` : 'Chưa chia sẻ'}
                      {!p.isActive && ' · Đã tắt'}
                    </p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-error-container/50 px-3 py-2 text-xs text-on-error-container">
          <Icon name="error" className="text-base" />
          <span className="flex-1">{error}</span>
        </p>
      )}
      {done && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-primary-fixed/50 px-3 py-2 text-xs text-on-surface">
          <Icon name="check_circle" className="text-base text-primary" />
          <span className="flex-1">{done}</span>
        </p>
      )}
    </Dialog>
  );
}
