import { useEffect, useRef, useState } from 'react';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';
import { TextArea, TextField } from '../common/Form';
import HashtagInput from '../template/HashtagInput';
import { PROMPT_NOTE_MAX, saveProduct } from '../../api/autoBatch';

const KEY_PATTERN = /^[A-Za-z0-9_]+$/;
// Khung "Ảnh sản phẩm" cố định (2026-11-25): bắt buộc, không xoá / đổi key. Gắn tag AI, worker phối đồ, tạo lô dùng ảnh này.
export const MAIN_KEY = 'anh_san_pham';
const OTHER_KEY_PLACEHOLDER = 'phu_kien';

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
    else if (key === MAIN_KEY) errors[r.rid] = `Key ${MAIN_KEY} dành cho khung Ảnh sản phẩm.`;
    else if (seen.has(key)) errors[r.rid] = 'Mỗi key chỉ dùng cho một ảnh.';
    seen.add(key);
  });
  return errors;
};

/**
 * Thêm / sửa sản phẩm (note/auto-tao-lo.txt): tên (không bắt buộc) + khung "Ảnh sản phẩm" cố định (key anh_san_pham,
 * bắt buộc, chỉ đổi được ảnh) + ảnh khác tuỳ chọn, mỗi ảnh gắn key một trường ảnh trong Creative của mình. Tạo lô tự động điền ảnh vào trường có key trùng, creative không có trường nào trùng thì bỏ qua.
 * Hashtag: chỉ lưu, tạo lô tự động không xét (mọi sản phẩm ghép với mọi nhóm).
 * Yêu cầu (prompt_note): backend nối vào cuối prompt của mọi Creative khi tạo ảnh cho sản phẩm.
 */
export default function ProductFormDialog({ product, onSaved, onClose }) {
  const [name, setName] = useState(product?.name ?? '');
  const [promptNote, setPromptNote] = useState(product?.promptNote ?? '');
  const [hashtags, setHashtags] = useState(product?.hashtags ?? []);
  const [main, setMain] = useState(() => {
    const img = (product?.images ?? []).find((i) => i.fieldKey === MAIN_KEY);
    return img ? { id: img.id, url: img.thumbUrl } : null;
  });
  const [rows, setRows] = useState(() =>
    (product?.images ?? []).filter((i) => i.fieldKey !== MAIN_KEY).map((i) => newRow({ id: i.id, url: i.thumbUrl, fieldKey: i.fieldKey })),
  );
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [serverErrors, setServerErrors] = useState({});

  // Thu hồi link xem trước của ảnh mới khi đóng
  const objectUrls = useRef([]);
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const previewUrl = (file) => {
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    return url;
  };
  const pickMain = (file) => file && setMain({ file, url: previewUrl(file) });
  const addFiles = (files) => setRows((prev) => [...prev, ...[...files].map((file) => newRow({ file, url: previewUrl(file), fieldKey: '' }))]);
  const update = (rid, patch) => setRows((prev) => prev.map((r) => (r.rid === rid ? { ...r, ...patch } : r)));
  const remove = (rid) => setRows((prev) => prev.filter((r) => r.rid !== rid));

  const rowErrors = submitted ? validateRows(rows) : {};
  // Ảnh gửi lên: khung Ảnh sản phẩm luôn ở vị trí 0, ảnh khác từ vị trí 1
  const rowError = (r, i) => rowErrors[r.rid] ?? serverErrors[`images.${i + 1}.field_key`] ?? serverErrors[`images.${i + 1}.file`];
  const firstError = (v) => (v ? [].concat(v)[0] : null);
  const mainError =
    (submitted && !main ? 'Vui lòng chọn ảnh sản phẩm.' : null) ?? firstError(serverErrors['images.0.file']) ?? firstError(serverErrors.images);

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    if (!main || Object.keys(validateRows(rows)).length) return;
    setSaving(true);
    setServerErrors({});
    try {
      const saved = await saveProduct({
        id: product?.id,
        name: name.trim(),
        promptNote: promptNote.trim(),
        hashtags,
        images: [
          { id: main.id, file: main.file, fieldKey: MAIN_KEY },
          ...rows.map((r) => ({ id: r.id, file: r.file, fieldKey: r.fieldKey.trim() })),
        ],
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

      <TextArea
        label="Yêu cầu cho AI (không bắt buộc và được thêm vào cuối câu lệnh)"
        value={promptNote}
        maxLength={PROMPT_NOTE_MAX}
        onChange={(e) => setPromptNote(e.target.value)}
        placeholder="VD: Giữ nguyên màu và logo trên áo, nền sáng, không thêm chữ."
        error={serverErrors.prompt_note && [].concat(serverErrors.prompt_note)[0]}
        hint="Được thêm vào cuối prompt của mọi Creative khi tạo ảnh cho sản phẩm này."
      />

      <HashtagInput
        value={hashtags}
        onChange={setHashtags}
        error={serverErrors.hashtags ?? Object.entries(serverErrors).find(([k]) => k.startsWith('hashtags.'))?.[1]}
        hint="Không bắt buộc. Nhấn Enter hoặc dấu phẩy để thêm."
      />

      <div>
        <p className="text-xs font-semibold text-on-surface">
          Ảnh sản phẩm <span className="text-error">*</span>
        </p>
        <p className="mb-2 text-[11px] text-on-surface-variant">
          Ảnh chụp rõ sản phẩm. Khung cố định, key <span className="font-mono">{MAIN_KEY}</span>: được điền vào trường cùng key
          trong Creative, dùng để AI gắn tag và phối đồ.
        </p>
        <div className={`flex items-center gap-3 rounded-xl border p-2 ${mainError ? 'border-error' : 'border-outline-variant/40'}`}>
          {main ? (
            <img src={main.url} alt="" className="size-16 shrink-0 rounded-lg bg-surface-container object-cover" />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
              <Icon name="image" className="text-2xl" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-on-surface-variant">Key trường nguyên liệu</p>
            <p className="mt-1 flex h-9 items-center gap-1 rounded-lg bg-surface-container px-2.5 font-mono text-sm text-on-surface-variant">
              <Icon name="lock" className="text-base" />
              {MAIN_KEY}
            </p>
            {mainError && <p className="mt-1 text-xs text-error">{mainError}</p>}
          </div>
          <label className="flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-sm font-bold text-primary hover:bg-surface-container-low">
            <Icon name={main ? 'sync' : 'add_photo_alternate'} className="text-lg" />
            {main ? 'Đổi ảnh' : 'Chọn ảnh'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                pickMain(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-on-surface">Ảnh khác (không bắt buộc)</p>
        <p className="mb-2 text-[11px] text-on-surface-variant">
          Mỗi ảnh nhập key của trường ảnh trong Creative (VD: {OTHER_KEY_PLACEHOLDER}). Ảnh được điền vào trường có key trùng.
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
                    placeholder={OTHER_KEY_PLACEHOLDER}
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
        <label className={`${rows.length ? 'mt-2' : ''} flex h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant text-sm font-bold text-primary hover:bg-surface-container-low`}>
          <Icon name="add_photo_alternate" className="text-lg" />
          Thêm ảnh khác
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
