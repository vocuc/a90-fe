import { useEffect, useState } from "react";
import Dialog from "../common/Dialog";
import Icon from "../common/Icon";
import { TextField } from "../common/Form";
import { ErrorState, Skeleton } from "../common/Feedback";
import { listProductShares, saveProductShares } from "../../api/autoBatch";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Chia sẻ sản phẩm cho tài khoản A51 khác theo email (chỉ chủ sản phẩm). Người được chia sẻ thấy sản phẩm ở
 * Quản lý sản phẩm và dùng để tạo ảnh / tạo lô, nhưng không sửa, xoá, bật tắt hay chia sẻ tiếp được.
 * Bấm Lưu mới ghi lên backend (ghi đè cả danh sách).
 */
export default function ProductShareDialog({ product, onSaved, onClose }) {
  const title = product.name || `Sản phẩm #${product.id}`;
  // [{ email, name? }] theo thứ tự thêm
  const [list, setList] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [email, setEmail] = useState("");
  const [inputError, setInputError] = useState(null);
  // { [email]: lỗi backend } để đánh dấu đúng dòng
  const [rowErrors, setRowErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoadError(null);
    listProductShares(product.id)
      .then((shares) =>
        setList(shares.map((s) => ({ email: s.email, name: s.name }))),
      )
      .catch(setLoadError);
  };
  useEffect(load, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => {
    const value = email.trim().toLowerCase();
    if (!value) return;
    if (!EMAIL_PATTERN.test(value)) {
      setInputError("Email không hợp lệ.");
      return;
    }
    if (list.some((s) => s.email.toLowerCase() === value)) {
      setInputError("Email này đã có trong danh sách.");
      return;
    }
    setList((prev) => [...prev, { email: value }]);
    setEmail("");
    setInputError(null);
  };

  const remove = (target) => {
    setList((prev) => prev.filter((s) => s.email !== target));
    setRowErrors(({ [target]: _, ...rest }) => rest);
  };

  const submit = async () => {
    // Email đang gõ dở mà hợp lệ thì thêm luôn, khỏi phải bấm "Thêm"
    const pending = email.trim().toLowerCase();
    let emails = list.map((s) => s.email);
    if (pending) {
      if (!EMAIL_PATTERN.test(pending)) {
        setInputError("Email không hợp lệ.");
        return;
      }
      if (!emails.some((e) => e.toLowerCase() === pending))
        emails = [...emails, pending];
    }
    setSaving(true);
    setError(null);
    setRowErrors({});
    try {
      const saved = await saveProductShares(product.id, emails);
      onSaved(saved);
    } catch (err) {
      // errors["emails.i"] -> gắn vào dòng email tương ứng
      const byRow = Object.fromEntries(
        Object.entries(err?.errors ?? {})
          .filter(([k]) => k.startsWith("emails."))
          .map(([k, msg]) => [emails[Number(k.split(".")[1])], msg]),
      );
      if (pending) {
        setList(
          emails.map((e) => list.find((s) => s.email === e) ?? { email: e }),
        );
        setEmail("");
      }
      setRowErrors(byRow);
      setError(
        Object.keys(byRow).length
          ? "Có email chưa chia sẻ được, xem bên dưới."
          : (err?.message ?? "Không lưu được, vui lòng thử lại."),
      );
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Chia sẻ sản phẩm"
      subtitle={title}
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
            disabled={saving || !list}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            <Icon
              name={saving ? "progress_activity" : "save"}
              className={`text-lg ${saving ? "animate-spin" : ""}`}
            />
            Lưu
          </button>
        </>
      }
    >
      <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
        <Icon name="info" className="text-base" />
        <span>
          Nhập email tài khoản A51 của người nhận. Họ sẽ thấy sản phẩm này trong
          Quản lý sản phẩm và dùng được để tạo ảnh, tạo lô, nhưng không sửa, xoá
          hay chia sẻ tiếp được.
        </span>
      </p>

      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="flex-1">
          <TextField
            label="Email người nhận"
            icon="mail"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="ten@gmail.com"
            value={email}
            error={inputError}
            disabled={!list}
            onChange={(e) => {
              setEmail(e.target.value);
              setInputError(null);
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!list || !email.trim()}
          className="mt-[22px] flex h-11 shrink-0 items-center gap-1 rounded-xl border border-outline-variant/60 px-3 text-sm font-bold text-on-surface hover:border-primary-container hover:text-primary disabled:opacity-50"
        >
          <Icon name="person_add" className="text-lg" />
          Thêm
        </button>
      </form>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-on-surface">
          Đang chia sẻ với {list ? `(${list.length})` : ""}
        </p>
        {loadError ? (
          <ErrorState error={loadError} onRetry={load} />
        ) : !list ? (
          <Skeleton className="h-14" />
        ) : !list.length ? (
          <p className="rounded-xl bg-surface-container-low py-4 text-center text-xs text-on-surface-variant">
            Chưa chia sẻ cho ai.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {list.map((s) => (
              <li
                key={s.email}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                  rowErrors[s.email]
                    ? "border-error/60 bg-error-container/30"
                    : "border-outline-variant/40"
                }`}
              >
                <Icon name="person" className="text-lg text-outline" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-on-surface">
                    {s.email}
                  </p>
                  {rowErrors[s.email] ? (
                    <p className="text-[11px] text-error">
                      {rowErrors[s.email]}
                    </p>
                  ) : s.name ? (
                    <p className="truncate text-[11px] text-on-surface-variant">
                      {s.name}
                    </p>
                  ) : (
                    <p className="text-[11px] text-outline">Chưa lưu</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(s.email)}
                  aria-label={`Bỏ chia sẻ ${s.email}`}
                  className="flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-error"
                >
                  <Icon name="close" className="text-lg" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-error-container/50 px-3 py-2 text-xs text-on-error-container"
        >
          <Icon name="error" className="text-base" />
          <span className="flex-1">{error}</span>
        </p>
      )}
    </Dialog>
  );
}
