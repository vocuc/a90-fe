import { useEffect, useId, useState } from 'react';
import Icon from '../common/Icon';
import { useHashtags } from '../../hooks/queries';
import { MAX_HASHTAGS, MAX_HASHTAG_LENGTH, cleanHashtag, hashtagError, hashtagSlug } from '../../utils/hashtag';

/**
 * Nhập hashtag cho Creative: Enter / dấu phẩy / khoảng trắng để thêm, Backspace ở ô trống để xoá cái cuối.
 * Gợi ý lấy từ GET /hashtags (hashtag đang có Creative bán). value: tên hashtag không có #.
 */
export default function HashtagInput({ value = [], onChange, error }) {
  const id = useId();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  // Gợi ý đang chọn bằng phím mũi tên; -1: chưa chọn, Enter thêm đúng chữ đang gõ
  const [active, setActive] = useState(-1);
  const [inputError, setInputError] = useState(null);

  const prefix = hashtagSlug(text);
  const full = value.length >= MAX_HASHTAGS;
  const { data } = useHashtags(prefix, { limit: 8, enabled: focused && !full });
  const taken = new Set(value.map(hashtagSlug));
  const suggestions = focused && !full ? (data ?? []).filter((h) => !taken.has(h.slug)) : [];

  useEffect(() => setActive(-1), [prefix]);

  // Thêm một hoặc nhiều hashtag (dán "a, #b c"); bỏ qua cái trùng, báo cái sai
  const add = (raw) => {
    const names = raw.split(/[\s,]+/).map(cleanHashtag).filter(Boolean);
    if (!names.length) return true;
    const next = [...value];
    const seen = new Set(next.map(hashtagSlug));
    let failed = null;
    names.forEach((name) => {
      const err = hashtagError(name);
      if (err) failed ??= err;
      else if (next.length >= MAX_HASHTAGS) failed ??= `Tối đa ${MAX_HASHTAGS} hashtag.`;
      else if (!seen.has(hashtagSlug(name))) {
        seen.add(hashtagSlug(name));
        next.push(name);
      }
    });
    if (next.length !== value.length) onChange(next);
    setInputError(failed);
    return !failed;
  };

  const commit = (raw = text) => {
    if (add(raw)) setText('');
  };

  const pick = (h) => {
    add(h.name);
    setText('');
  };

  const remove = (index) => onChange(value.filter((_, i) => i !== index));

  const onKeyDown = (e) => {
    if (suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setActive((i) =>
        e.key === 'ArrowDown' ? (i + 1) % suggestions.length : i <= 0 ? suggestions.length - 1 : i - 1,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[active]) pick(suggestions[active]);
      else commit();
    } else if (e.key === ',' || e.key === ' ') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !text && value.length) {
      remove(value.length - 1);
    } else if (e.key === 'Escape') {
      setFocused(false);
    }
  };

  const shownError = inputError ?? error;

  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center justify-between text-xs font-semibold text-on-surface">
        <span>Hashtag</span>
        <span className="font-normal text-outline">
          {value.length}/{MAX_HASHTAGS}
        </span>
      </label>
      <div className="relative">
        <div
          className={`flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border bg-surface-container-lowest px-2 py-1.5 focus-within:ring-2 ${
            shownError
              ? 'border-error focus-within:ring-error/20'
              : 'border-outline-variant/40 focus-within:border-primary-container focus-within:ring-primary-container/20'
          }`}
        >
          {value.map((name, i) => (
            <span
              key={hashtagSlug(name)}
              className="flex items-center gap-0.5 rounded-full bg-primary-fixed/60 py-0.5 pl-2 pr-1 text-xs font-semibold text-primary"
            >
              #{name}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Xoá hashtag ${name}`}
                className="flex size-4 items-center justify-center rounded-full hover:bg-primary/15"
              >
                <Icon name="close" className="text-[14px]" />
              </button>
            </span>
          ))}
          {!full && (
            <input
              id={id}
              value={text}
              maxLength={MAX_HASHTAG_LENGTH + 1}
              onChange={(e) => {
                setText(e.target.value);
                setInputError(null);
              }}
              onKeyDown={onKeyDown}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                if (!/[\s,]/.test(pasted.trim())) return;
                e.preventDefault();
                commit(text + pasted);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                if (text.trim()) commit();
              }}
              placeholder={value.length ? 'Thêm hashtag...' : 'Ví dụ: chandung, studio, thoitrang'}
              aria-invalid={!!shownError}
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls={`${id}-list`}
              className="min-w-[8rem] flex-1 border-none bg-transparent p-0.5 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-0"
            />
          )}
        </div>
        {suggestions.length > 0 && (
          <ul
            id={`${id}-list`}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-outline-variant/40 bg-surface-container-lowest py-1 shadow-lg"
          >
            {suggestions.map((h, i) => (
              <li key={h.slug} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  // Giữ focus ở ô nhập để onBlur không thêm chữ đang gõ dở
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(h)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                    i === active ? 'bg-surface-container' : ''
                  }`}
                >
                  <span className="truncate font-medium text-on-surface">#{h.name}</span>
                  <span className="shrink-0 text-[11px] text-outline">{h.count} Creative</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {shownError ? (
        <p className="mt-1 text-xs text-error">{shownError}</p>
      ) : (
        <p className="mt-1 text-[11px] text-on-surface-variant">
          Giúp người mua tìm thấy mẫu ở trang Khám phá. Nhấn Enter hoặc dấu phẩy để thêm.
        </p>
      )}
    </div>
  );
}
