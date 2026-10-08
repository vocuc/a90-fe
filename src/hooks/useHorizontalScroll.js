import { useCallback, useEffect, useState } from 'react';

const DRAG_THRESHOLD = 5;

/**
 * Cho một dải cuộn ngang (đã ẩn thanh cuộn) cuộn được bằng chuột trên máy tính:
 * - Lăn chuột dọc -> cuộn ngang. Tới đầu/cuối dải thì trả lại cho trang cuộn dọc.
 * - Nhấn giữ chuột rồi kéo -> cuộn ngang. Đã kéo thì không tính là click vào phần tử con.
 * Cảm ứng và touchpad (cuộn ngang sẵn) giữ nguyên hành vi của trình duyệt.
 *
 * Dùng: const ref = useHorizontalScroll(); <div ref={ref} className="overflow-x-auto">...
 */
export default function useHorizontalScroll() {
  const [el, setEl] = useState(null);
  const ref = useCallback((node) => setEl(node), []);

  useEffect(() => {
    if (!el) return undefined;

    const onWheel = (e) => {
      // Touchpad đang cuộn ngang sẵn, hoặc giữ Ctrl để zoom -> để trình duyệt tự xử lý
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft >= max - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    let pointerId = null;
    let startX = 0;
    let startScroll = 0;
    let dragged = false;

    const onPointerDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      dragged = false;
    };

    const onPointerMove = (e) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      if (!dragged && Math.abs(dx) < DRAG_THRESHOLD) return;
      if (!dragged) {
        dragged = true;
        el.setPointerCapture(pointerId);
        el.style.cursor = 'grabbing';
        el.style.userSelect = 'none';
      }
      el.scrollLeft = startScroll - dx;
    };

    const endDrag = (e) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      el.style.cursor = '';
      el.style.userSelect = '';
      // Click (nếu có) được phát ngay sau pointerup; sau đó bỏ cờ để lần bấm thật tiếp theo không bị chặn
      if (dragged) setTimeout(() => (dragged = false), 0);
    };

    // Chặn click sinh ra sau khi kéo, để không mở danh mục ngoài ý muốn
    const onClickCapture = (e) => {
      if (!dragged) return;
      dragged = false;
      e.preventDefault();
      e.stopPropagation();
    };

    // Ngăn trình duyệt kéo thả link/ảnh thay vì cuộn
    const onDragStart = (e) => e.preventDefault();

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('click', onClickCapture, true);
    el.addEventListener('dragstart', onDragStart);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('click', onClickCapture, true);
      el.removeEventListener('dragstart', onDragStart);
    };
  }, [el]);

  return ref;
}
