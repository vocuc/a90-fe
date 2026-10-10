// Hình minh hoạ bố cục ghép ảnh, vẽ từ chính hàm layout của công cụ
export default function LayoutThumb({ tool, className = '' }) {
  const W = 100;
  const H = 100;
  const boxes = Object.values(tool.layout(W, H));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className={className}>
      {boxes.map((b, i) => (
        <rect key={i} x={b.x + 2} y={b.y + 2} width={b.w - 4} height={b.h - 4} rx="4" fill="currentColor" />
      ))}
    </svg>
  );
}
