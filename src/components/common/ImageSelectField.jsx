import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon';

/** Ảnh nhỏ của lựa chọn; không có ảnh / ảnh lỗi thì hiện biểu tượng thay thế. */
function Thumb({ src, icon, size }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (!src || broken) {
    return (
      <span className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-surface-container text-outline`}>
        <Icon name={icon} className="text-xl" />
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={`${size} shrink-0 rounded-lg bg-surface-container object-contain`} />;
}

/**
 * Ô chọn có ảnh dạng trường form (thay <select> vì <option> không hiện được ảnh), cùng kiểu với SelectField.
 * options: [{ value, label, image, description? }]; emptyLabel: lựa chọn value '' (không ảnh). onChange(value: string).
 * Hỗ trợ phím mũi tên / Enter / Esc, bấm ra ngoài thì đóng.
 */
export default function ImageSelectField({ label, value, options, onChange, emptyLabel, icon = 'image', error, hint, disabled }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const items = [{ value: '', label: emptyLabel, image: null }, ...options];
  const selected = items.find((o) => String(o.value) === String(value ?? '')) ?? items[0];

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const toggle = () => {
    if (disabled) return;
    if (!open) setActive(Math.max(0, items.indexOf(selected)));
    setOpen(!open);
  };
  const pick = (item) => {
    onChange(String(item.value));
    setOpen(false);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return toggle();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault();
      pick(items[active]);
    }
    return undefined;
  };

  const thumbOf = (item, size) =>
    item.value === '' ? (
      <span className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-outline`}>
        <Icon name="block" className="text-xl" />
      </span>
    ) : (
      <Thumb src={item.image} icon={icon} size={size} />
    );

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-on-surface">
        {label}
      </label>
      <button
        id={id}
        type="button"
        onClick={toggle}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={!!error}
        className={`flex w-full min-w-0 items-center gap-3 rounded-xl border bg-surface-container-low p-2 text-left text-sm font-medium text-on-surface focus:outline-none focus:ring-2 disabled:opacity-60 ${
          error
            ? 'border-error focus:border-error focus:ring-error/20'
            : 'border-outline-variant/40 focus:border-primary-container focus:ring-primary-container/20'
        }`}
      >
        {thumbOf(selected, 'size-12')}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{selected.label}</span>
          {selected.description && <span className="block truncate text-xs text-on-surface-variant">{selected.description}</span>}
        </span>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="shrink-0 text-xl text-outline" />
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-1 shadow-lg"
        >
          {items.map((item, i) => {
            const isSelected = item === selected;
            return (
              <li
                key={item.value || 'none'}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(item)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg p-1.5 text-sm ${i === active ? 'bg-surface-container' : ''} ${
                  isSelected ? 'font-bold text-primary' : 'font-semibold text-on-surface'
                }`}
              >
                {thumbOf(item, 'size-14')}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {item.description && <span className="block truncate text-xs font-normal text-on-surface-variant">{item.description}</span>}
                </span>
                {isSelected && <Icon name="check" className="shrink-0 text-lg" />}
              </li>
            );
          })}
        </ul>
      )}
      {error ? (
        <p className="mt-1 text-xs text-error">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-on-surface-variant">{hint}</p>
      )}
    </div>
  );
}
