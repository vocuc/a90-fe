const FONT_STACK = {
  'Be Vietnam Pro': "'Be Vietnam Pro', system-ui, sans-serif",
  Montserrat: "Montserrat, system-ui, sans-serif",
  Roboto: 'Roboto, system-ui, sans-serif',
  Lexend: 'Lexend, system-ui, sans-serif',
  Nunito: 'Nunito, system-ui, sans-serif',
};

/**
 * Xem trước chữ chèn lên ảnh theo style template (bản xem trước bằng CSS; ảnh thật do worker chèn).
 * size: % chiều rộng ảnh -> dùng container query (cqw).
 */
export default function TextOverlayPreview({ image, text, style, className = '' }) {
  if (!style) return null;
  const position = { top: 'top-[8%]', middle: 'top-1/2 -translate-y-1/2', bottom: 'bottom-[10%]' }[style.position] ?? 'top-[8%]';
  const box = style.background === 'box';
  const stroke = style.stroke?.width_px
    ? { WebkitTextStroke: `${Math.max(1, style.stroke.width_px / 4)}px ${style.stroke.color}`, paintOrder: 'stroke fill' }
    : {};

  return (
    <div className={`relative overflow-hidden rounded-xl bg-surface-container @container ${className}`} style={{ aspectRatio: '3 / 4' }}>
      {image && <img src={image} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />}
      <div
        className={`absolute inset-x-[6%] ${position} ${style.align === 'left' ? 'text-left' : 'text-center'}`}
        // Giới hạn số dòng như worker (max_lines): cắt phần thừa theo chiều cao dòng
        style={{ fontSize: `${style.size}cqw`, lineHeight: 1.5, maxHeight: `${1.5 * style.max_lines}em`, overflow: 'hidden' }}
      >
        {/* inline + box-decoration clone: mỗi dòng 1 ô nền riêng như ảnh worker chèn */}
        <span
          style={{
            fontFamily: FONT_STACK[style.font] ?? 'system-ui',
            fontWeight: style.weight,
            color: style.color,
            background: box ? style.box_color ?? '#FFFFFF' : 'transparent',
            borderRadius: box ? style.box_radius : 0,
            padding: box ? '0.1em 0.4em' : 0,
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
            ...stroke,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
}
