import { useState } from 'react';
import Icon from '../common/Icon';

// creative_prompt là mảng JSON [{ label, value }], giới hạn theo CreativeRequest của backend
export const MAX_GROUPS = 20;
export const MAX_LABEL_LENGTH = 100;
export const MAX_VALUE_LENGTH = 5000;

const EMPTY_GROUP = { label: '', value: '' };

const JSON_PLACEHOLDER = `{"label": "Trang phục", "value": "nội dung"}

hoặc mảng:
[
  {"label": "Trang phục", "value": "nội dung 1"},
  {"label": "Giày dép", "value": "nội dung 2"}
]`;

/**
 * Parse JSON "thoáng": thử JSON chuẩn trước (giữ dấu ' trong nội dung),
 * lỗi thì bỏ cặp {{ }} bọc ngoài, cuối cùng đổi nháy đơn -> nháy kép.
 */
const parseLooseJson = (str) => {
  const s = str.trim();
  try {
    return JSON.parse(s);
  } catch {
    /* thử chế độ nới lỏng */
  }
  let t = s;
  while (t.startsWith('{{') && t.endsWith('}}')) t = t.slice(1, -1).trim();
  try {
    return JSON.parse(t);
  } catch {
    /* fallback cuối */
  }
  return JSON.parse(t.replace(/'/g, '"'));
};

// Đọc 1 object hoặc mảng object {label, value}; ném lỗi nếu JSON sai
const groupsFromJson = (raw) => {
  if (!raw.trim()) return [];
  const parsed = parseLooseJson(raw);
  return (Array.isArray(parsed) ? parsed : [parsed])
    .filter((o) => o && typeof o === 'object' && (o.label !== undefined || o.value !== undefined))
    .map((o) => ({ label: String(o.label ?? ''), value: String(o.value ?? '') }));
};

const isFilled = (g) => g.label.trim() || g.value.trim();

export const serializeInstructions = (groups) => groups.map((g) => ({ label: g.label.trim(), value: g.value.trim() }));

/** State của ô nhập câu lệnh, dùng chung giữa form và component. `initial`: câu lệnh đã lưu (trang sửa). */
export function usePromptInstructions(initial) {
  const [groups, setGroups] = useState(() =>
    initial?.length ? initial.map((g) => ({ label: String(g.label ?? ''), value: String(g.value ?? '') })) : [EMPTY_GROUP],
  );
  const [tab, setTab] = useState('manual');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState(null);

  const toManual = (next) => {
    setGroups(next.length ? next : [EMPTY_GROUP]);
    setJsonError(null);
    setTab('manual');
  };

  const switchTab = (next) => {
    if (next === tab) return;
    if (next === 'json') {
      const filled = groups.filter(isFilled);
      setJsonText(filled.length ? JSON.stringify(filled, null, 2) : '');
      setJsonError(null);
      setTab('json');
      return;
    }
    try {
      toManual(groupsFromJson(jsonText));
    } catch {
      setJsonError('JSON không hợp lệ, chưa thể chuyển. Đúng định dạng: {"label": "...", "value": "..."}');
    }
  };

  const applyJson = () => {
    try {
      const next = groupsFromJson(jsonText);
      if (!next.length) throw new Error();
      toManual(next);
    } catch {
      setJsonError('JSON không hợp lệ. Đúng định dạng: {"label": "...", "value": "..."}');
    }
  };

  /** Chốt danh sách trước khi lưu (đang ở tab JSON thì đọc JSON). Trả mảng câu lệnh, hoặc null nếu JSON sai. */
  const commit = () => {
    if (tab === 'manual') return groups;
    try {
      const next = groupsFromJson(jsonText);
      toManual(next);
      return next;
    } catch {
      setJsonError('JSON không hợp lệ. Vui lòng sửa lại trước khi lưu.');
      return null;
    }
  };

  return {
    groups,
    tab,
    jsonText,
    jsonError,
    switchTab,
    applyJson,
    commit,
    setJsonText: (v) => {
      setJsonText(v);
      setJsonError(null);
    },
    add: () => setGroups((list) => [...list, EMPTY_GROUP]),
    remove: (i) => setGroups((list) => list.filter((_, idx) => idx !== i)),
    update: (i, key, value) => setGroups((list) => list.map((g, idx) => (idx === i ? { ...g, [key]: value } : g))),
  };
}

/** Lỗi của danh sách câu lệnh, hiện sau khi người dùng bấm lưu. */
export const validateInstructions = (groups) => {
  if (!groups.length) return { list: 'Vui lòng thêm ít nhất 1 câu lệnh.' };
  const errors = {};
  if (groups.length > MAX_GROUPS) errors.list = `Tối đa ${MAX_GROUPS} câu lệnh.`;
  groups.forEach((g, i) => {
    const label = g.label.trim();
    const value = g.value.trim();
    if (!label) errors[`${i}.label`] = 'Vui lòng nhập tiêu đề.';
    else if (label.length > MAX_LABEL_LENGTH) errors[`${i}.label`] = `Tiêu đề tối đa ${MAX_LABEL_LENGTH} ký tự.`;
    if (!value) errors[`${i}.value`] = 'Vui lòng nhập nội dung.';
    else if (value.length > MAX_VALUE_LENGTH)
      errors[`${i}.value`] = `Nội dung tối đa ${MAX_VALUE_LENGTH.toLocaleString('vi-VN')} ký tự.`;
  });
  return errors;
};

const inputCls =
  'w-full rounded-lg border bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2';
const borderCls = (error) =>
  error
    ? 'border-error focus:border-error focus:ring-error/20'
    : 'border-outline-variant/40 focus:border-primary-container focus:ring-primary-container/20';

const TABS = [
  { value: 'manual', label: 'Nhập thủ công' },
  { value: 'json', label: 'Nhập nhanh bằng JSON' },
];

export default function PromptInstructions({ state, errors = {}, disabled }) {
  const { groups, tab, jsonText, jsonError } = state;

  return (
    <div className="space-y-3">
      <div role="tablist" className="flex gap-1 border-b border-surface-container">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => state.switchTab(t.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
              tab === t.value ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'manual' ? (
        <div className="space-y-3">
          {groups.length === 0 && (
            <p className="py-2 text-center text-xs text-outline">Chưa có câu lệnh nào. Bấm "Thêm câu lệnh" để bắt đầu.</p>
          )}
          {groups.map((g, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-outline-variant/40 bg-surface-container-low p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-outline">Câu lệnh #{i + 1}</span>
                <button
                  type="button"
                  onClick={() => state.remove(i)}
                  disabled={disabled}
                  aria-label={`Xoá câu lệnh ${i + 1}`}
                  className="text-outline transition-colors hover:text-error"
                >
                  <Icon name="delete" className="text-[20px]" />
                </button>
              </div>
              <div>
                <input
                  type="text"
                  value={g.label}
                  onChange={(e) => state.update(i, 'label', e.target.value)}
                  maxLength={MAX_LABEL_LENGTH}
                  placeholder="Tiêu đề, ví dụ: Trang phục"
                  aria-label={`Tiêu đề câu lệnh ${i + 1}`}
                  aria-invalid={!!errors[`${i}.label`]}
                  className={`${inputCls} ${borderCls(errors[`${i}.label`])}`}
                />
                {errors[`${i}.label`] && <p className="mt-1 text-xs text-error">{errors[`${i}.label`]}</p>}
              </div>
              <div>
                <textarea
                  rows={3}
                  value={g.value}
                  onChange={(e) => state.update(i, 'value', e.target.value)}
                  maxLength={MAX_VALUE_LENGTH}
                  placeholder="Nội dung câu lệnh..."
                  aria-label={`Nội dung câu lệnh ${i + 1}`}
                  aria-invalid={!!errors[`${i}.value`]}
                  className={`${inputCls} ${borderCls(errors[`${i}.value`])} resize-y`}
                />
                {errors[`${i}.value`] && <p className="mt-1 text-xs text-error">{errors[`${i}.value`]}</p>}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={state.add}
            disabled={disabled || state.groups.length >= MAX_GROUPS}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-outline-variant py-2.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary"
          >
            <Icon name="add" className="text-lg" />
            Thêm câu lệnh
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="prompt-json" className="block text-xs font-semibold text-on-surface">
            Dán JSON để thêm nhanh (1 object hoặc mảng object)
          </label>
          <textarea
            id="prompt-json"
            rows={8}
            value={jsonText}
            onChange={(e) => state.setJsonText(e.target.value)}
            placeholder={JSON_PLACEHOLDER}
            spellCheck={false}
            aria-invalid={!!jsonError}
            className={`${inputCls} ${borderCls(jsonError)} resize-y font-mono text-xs`}
          />
          {jsonError && <p className="text-xs text-error">{jsonError}</p>}
          <button
            type="button"
            onClick={state.applyJson}
            disabled={disabled || !jsonText.trim()}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-surface-container text-xs font-bold text-primary hover:bg-surface-container-high disabled:opacity-50"
          >
            <Icon name="data_object" className="text-lg" />
            Thêm từ JSON
          </button>
          <p className="text-[11px] text-on-surface-variant">
            JSON ở đây sẽ <b>thay thế toàn bộ</b> danh sách ở tab "Nhập thủ công" (không cộng dồn).
          </p>
        </div>
      )}

      {errors.list && <p className="text-xs text-error">{errors.list}</p>}
    </div>
  );
}
