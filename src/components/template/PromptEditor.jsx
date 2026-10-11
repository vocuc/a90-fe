import { useRef } from 'react';
import { useAiModels } from '../../hooks/creatorQueries';
import { Input, Select, borderCls, inputCls } from './inputs';
import { MAX_PROMPT_LENGTH, MAX_TITLE_LENGTH, MAX_USAGE_GUIDE_LENGTH } from './templateSchema';

// Khung prompt khuyến nghị (§5.2)
const SECTIONS = [
  { label: 'Mục tiêu', text: 'MỤC TIÊU\nTạo ảnh ...' },
  { label: 'Vai trò ảnh', text: 'VAI TRÒ ẢNH ĐẦU VÀO\n1. Ảnh sản phẩm: nguồn sản phẩm chính.' },
  {
    label: 'Bảo toàn sản phẩm',
    text: 'BẢO TOÀN SẢN PHẨM\n- Giữ nguyên kiểu dáng, màu sắc, chất liệu, logo và tỉ lệ.\n- Không thêm, xóa hoặc thiết kế lại chi tiết sản phẩm.',
  },
  { label: 'Quy tắc ưu tiên', text: 'QUY TẮC ƯU TIÊN\n- Khi các ảnh mâu thuẫn về sản phẩm, ưu tiên ảnh sản phẩm chính.' },
  { label: 'Bối cảnh', text: 'BỐI CẢNH\nMôi trường, đạo cụ, nền ...' },
  { label: 'Góc máy & bố cục', text: 'GÓC MÁY VÀ BỐ CỤC\nCận cảnh / toàn thân, góc chụp, vị trí chủ thể ...' },
  { label: 'Ánh sáng', text: 'ÁNH SÁNG VÀ CHẤT LƯỢNG\nÁnh sáng studio mềm, độ chân thực cao ...' },
  { label: 'Đầu ra', text: 'ĐẦU RA\nTạo ảnh hoàn chỉnh theo tỉ lệ đã cấu hình. Không thêm chữ, watermark hoặc logo không có trong ảnh gốc.' },
];

/**
 * onSet: sửa title / model_id / price_per_image / usage_guide của template. errors: lỗi theo path của validateTemplate.
 * stacked: xếp phần model, giá / hướng dẫn dưới ô prompt, dùng khi đặt trong cột hẹp.
 */
export default function PromptEditor({ template, onChange, onSet, errors = {}, stacked = false }) {
  const ref = useRef(null);
  const { prompt_text: text } = template;
  const error = errors.prompt_text;
  const models = useAiModels(true);

  // Chèn tại con trỏ rồi đặt lại con trỏ sau đoạn vừa chèn
  const insert = (snippet, block = false) => {
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    let piece = snippet;
    if (block) {
      const before = text.slice(0, start);
      piece = `${before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''}${snippet}\n`;
    }
    onChange(text.slice(0, start) + piece + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + piece.length, start + piece.length);
    });
  };

  return (
    <div className={`grid gap-4 ${stacked ? '' : 'lg:grid-cols-[1fr_280px]'}`}>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => insert(s.text, true)}
              className="rounded-full border border-outline-variant/50 px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant hover:border-primary-container hover:text-primary"
            >
              + {s.label}
            </button>
          ))}
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          rows={22}
          maxLength={MAX_PROMPT_LENGTH}
          spellCheck={false}
          placeholder={'Viết chỉ dẫn cố định cho model...\n\nDùng {{key}} để chèn giá trị người mua nhập (chỉ trường văn bản / lựa chọn).\nẢnh không chèn vào prompt — chúng được gửi kèm theo vai trò.'}
          aria-invalid={!!error}
          className={`${inputCls} ${borderCls(error)} min-h-[24rem] resize-y font-mono text-[13px] leading-relaxed`}
        />
        <div className="flex items-start justify-between gap-2">
          {error ? <p className="text-xs text-error">{error}</p> : <span />}
          <span className="shrink-0 text-[11px] text-outline">
            {text.length.toLocaleString('vi-VN')}/{MAX_PROMPT_LENGTH.toLocaleString('vi-VN')}
          </span>
        </div>
      </div>

      <aside className="space-y-4">
        <section className="space-y-3 rounded-xl border border-outline-variant/40 p-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-outline">Thông tin sản phẩm</h3>
          <Input
            label="Tiêu đề *"
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Ví dụ: Ảnh giày studio nền trắng"
            value={template.title ?? ''}
            onChange={(e) => onSet({ title: e.target.value })}
            error={errors.title}
          />
          <Select
            label="AI model *"
            value={template.model_id ?? ''}
            onChange={(e) => onSet({ model_id: e.target.value })}
            disabled={!models.data}
            error={errors.model_id}
            hint={
              models.isLoading
                ? 'Đang tải danh sách model...'
                : models.error
                  ? `Không tải được danh sách model: ${models.error.message}`
                  : models.data?.length === 0
                    ? 'Hiện chưa có model AI nào hoạt động.'
                    : undefined
            }
          >
            <option value="">Chọn model</option>
            {models.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.provider.name})
              </option>
            ))}
          </Select>
          <Input
            label="Giá bán mỗi ảnh (VND) *"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="Ví dụ: 2000"
            value={template.price_per_image ?? ''}
            onChange={(e) => onSet({ price_per_image: e.target.value })}
            error={errors.price_per_image}
          />
        </section>

        <section className="space-y-2 rounded-xl border border-outline-variant/40 p-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-outline">Hướng dẫn sử dụng mẫu</h3>
          <textarea
            value={template.usage_guide ?? ''}
            onChange={(e) => onSet({ usage_guide: e.target.value })}
            rows={6}
            maxLength={MAX_USAGE_GUIDE_LENGTH}
            placeholder={'Hướng dẫn người mua dùng mẫu, ví dụ:\n- Chụp giày trên nền trơn, đủ sáng.\n- Mỗi lần chỉ tải 1 đôi giày.'}
            aria-label="Hướng dẫn sử dụng mẫu"
            className={`${inputCls} ${borderCls()} resize-y text-[13px] leading-relaxed`}
          />
          <p className="flex items-start justify-between gap-2 text-[11px] text-on-surface-variant">
            <span>Người mua thấy hướng dẫn này khi dùng mẫu.</span>
            <span className="shrink-0 text-outline">
              {(template.usage_guide ?? '').length.toLocaleString('vi-VN')}/{MAX_USAGE_GUIDE_LENGTH.toLocaleString('vi-VN')}
            </span>
          </p>
        </section>
      </aside>
    </div>
  );
}
