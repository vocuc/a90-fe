import { useEffect, useRef, useState } from 'react';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';
import { TextField } from '../common/Form';
import HashtagInput from '../template/HashtagInput';
import { saveProduct } from '../../api/autoBatch';

const KEY_PATTERN = /^[A-Za-z0-9_]+$/;
const DEFAULT_KEY = 'product_image';

let rowSeq = 0;
const newRow = (img) => ({ rid: ++rowSeq, ...img });

/** Lỗi phía trình duyệt theo dòng ảnh: { [rid]: msg } */
const validateRows = (rows) => {
  const errors = {};
  const seen = new Set();
  rows.forEach((r) => {
    const key = r.fieldKey.trim();
    if (!key) errors[r.rid] = 'Vui lòng nhập key trường nguyên liệu.';
    else if (!KEY_PATTERN.test(key)) errors[r.rid] = 'Key chỉ gồm chữ không dấu, số và dấu gạch dưới.';
    else if (seen.has(key)) errors[r.rid] = 'Mỗi key chỉ dùng cho một ảnh.';
    seen.add(key);
  });
  return errors;
};

/**
 * Thêm / sửa sản phẩm (note/auto-tao-lo.txt): tên (không bắt buộc) + các ảnh, mỗi ảnh gắn key một trường ảnh trong
 * Creative của mình. Tạo lô tự động điền ảnh vào trường có key trùng, creative không có trường nào trùng thì bỏ qua.
 * Hashtag: chỉ ghép với nhóm có creative trùng hashtag; không có hashtag thì sản phẩm không được tạo tự động.
 */
export default function ProductFormDialog({ product, onSaved, onClose }) {
  const [name, setName] = useState(product?.name ?? '');
  const [hashtags, setHashtags] = useState(product?.hashtags ?? []);
  const [rows, setRows] = useState(() => (product?.images ?? []).map((i) => newRow({ id: i.id, url: i.url, fieldKey: i.fieldKey })));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [serverErrors, setServerErrors] = useState({});

  // Thu hồi link xem trước của ảnh mới khi đóng
  const objectUrls = useRef([]);
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const addFiles = (files) => {
    setRows((prev) => {
      const used = new Set(prev.map((r) => r.fieldKey));
      const added = [...files].map((file, i) => {
        const fieldKey = !used.has(DEFAULT_KEY) && i === 0 ? DEFAULT_KEY : '';
        if (fieldKey) used.add(fieldKey);
        const url = URL.createObjectURL(file);
        objectUrls.current.push(url);
        return newRow({ file, url, fieldKey });
      });
      return [...prev, ...added];
    });
  };
  const update = (rid, patch) => setRows((prev) => prev.map((r) => (r.rid === rid ? { ...r, ...patch } : r)));
  const remove = (rid) => setRows((prev) => prev.filter((r) => r.rid !== rid));

  const rowErrors = submitted ? validateRows(rows) : {};
  const rowError = (r, i) => rowErrors[r.rid] ?? serverErrors[`images.${i}.field_key`] ?? serverErrors[`images.${i}.file`];

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    if (!rows.length) {
      setError('Vui lòng thêm ít nhất 1 ảnh.');
      return;
    }
    if (Object.keys(validateRows(rows)).length) return;
    setSaving(true);
    setServerErrors({});
    try {
      const saved = await saveProduct({
        id: product?.id,
        name: name.trim(),
        hashtags,
        images: rows.map((r) => ({ id: r.id, file: r.file, fieldKey: r.fieldKey.trim() })),
      });
      onSaved(saved);
    } catch (err) {
      setServerErrors(err?.errors ?? {});
      setError(err?.message || 'Không lưu được sản phẩm, vui lòng thử lại.');
      setSaving(false);
    }
  };

  return (
    <Dialog
      title={product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
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
            Lưu sản phẩm
          </button>
        </>
      }
    >
      <TextField
        label="Tên sản phẩm (không bắt buộc)"
        icon="sell"
        value={name}
        maxLength={255}
        onChange={(e) => setName(e.target.value)}
        placeholder="VD: Áo thun trắng"
      />

      <HashtagInput
        value={hashtags}
        onChange={setHashtags}
        error={serverErrors.hashtags ?? Object.entries(serverErrors).find(([k]) => k.startsWith('hashtags.'))?.[1]}
        hint={
          hashtags.length
            ? 'Tạo tự động chỉ dùng nhóm có creative trùng ít nhất một hashtag.'
            : 'Chưa có hashtag: sản phẩm sẽ không được tạo tự động. Nhập hashtag trùng với creative của bạn.'
        }
      />

      <div>
        <p className="text-xs font-semibold text-on-surface">Ảnh sản phẩm</p>
        <p className="mb-2 text-[11px] text-on-surface-variant">
          Mỗi ảnh nhập key của trường ảnh trong Creative (VD: product_image). Ảnh được điền vào trường có key trùng.
        </p>
        <ul className="space-y-2">
          {rows.map((r, i) => {
            const msg = rowError(r, i);
            return (
              <li key={r.rid} className={`flex items-start gap-3 rounded-xl border p-2 ${msg ? 'border-error' : 'border-outline-variant/40'}`}>
                <img src={r.url} alt="" className="size-16 shrink-0 rounded-lg bg-surface-container object-cover" />
                <div className="min-w-0 flex-1">
                  <label className="block text-[11px] font-semibold text-on-surface-variant" htmlFor={`key-${r.rid}`}>
                    Key trường nguyên liệu
                  </label>
                  <input
                    id={`key-${r.rid}`}
                    value={r.fieldKey}
                    onChange={(e) => update(r.rid, { fieldKey: e.target.value })}
                    placeholder={DEFAULT_KEY}
                    autoCapitalize="off"
                    spellCheck={false}
                    className="mt-1 h-9 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-2.5 font-mono text-sm text-on-surface focus:border-primary-container focus:outline-none"
                  />
                  {msg && <p className="mt-1 text-xs text-error">{msg}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.rid)}
                  aria-label="Bỏ ảnh"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-error hover:bg-error-container/40"
                >
                  <Icon name="delete" className="text-lg" />
                </button>
              </li>
            );
          })}
        </ul>
        <label className="mt-2 flex h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant text-sm font-bold text-primary hover:bg-surface-container-low">
          <Icon name="add_photo_alternate" className="text-lg" />
          Thêm ảnh
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-error-container/60 px-3 py-2 text-xs text-on-error-container">
          {error}
        </p>
      )}
    </Dialog>
  );
}
