import { useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { useAiModels, usePromptTemplates } from '../../hooks/creatorQueries';
import { useCategories } from '../../hooks/queries';
import { Input, Select, borderCls, inputCls } from './inputs';
import HashtagInput from './HashtagInput';
import { MAX_PROMPT_LENGTH, MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH } from './templateSchema';

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
 * Chọn Template prompt (note/template-prompt.txt): prompt cuối = prompt Template (chỉ đọc, hiện ở đây) + prompt riêng bên dưới.
 */
function TemplatePicker({ value, onChange }) {
  const templates = usePromptTemplates();
  const selected = templates.data?.find((t) => String(t.id) === String(value));

  return (
    <div className="space-y-2 rounded-xl border border-outline-variant/40 bg-surface-container-low p-3">
      <Select
        label="Template prompt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!templates.data}
        hint={
          templates.error
            ? `Không tải được Template: ${templates.error.message}`
            : templates.data?.length === 0
              ? 'Chưa có Template nào.'
              : 'Prompt của Template đứng trước, prompt bên dưới nối tiếp phía sau, block ghim (nếu có) ở cuối cùng.'
        }
      >
        <option value="">Không dùng Template</option>
        {/* Đang tải danh sách: giữ lựa chọn hiện tại để không mất giá trị */}
        {value && !templates.data && <option value={value}>Đang tải...</option>}
        {templates.data?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </Select>
      {selected && (
        <details open className="group">
          <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-on-surface-variant">
            <Icon name="lock" className="text-sm" />
            Prompt của Template (chỉ đọc)
            <Link
              to={`/seller/prompt-templates/${selected.id}/edit`}
              target="_blank"
              className="ml-auto font-bold text-primary hover:underline"
            >
              Sửa Template
            </Link>
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-container p-2.5 font-mono text-[12px] leading-relaxed text-on-surface-variant">
            {selected.prompt || '(Template chỉ có block ghim cuối)'}
          </pre>
        </details>
      )}
      <Link to="/seller/prompt-templates/new" target="_blank" className="inline-block text-[11px] font-semibold text-primary hover:underline">
        + Tạo Template mới
      </Link>
    </div>
  );
}

/**
 * onSet: sửa title / category_id / model_id / description / hashtags của template. errors: lỗi theo path của validateTemplate.
 * stacked: xếp phần model / hướng dẫn dưới ô prompt, dùng khi đặt trong cột hẹp.
 */
export default function PromptEditor({ template, onChange, onSet, errors = {}, stacked = false }) {
  const ref = useRef(null);
  const { prompt_text: text } = template;
  const error = errors.prompt_text;
  const models = useAiModels(true);
  const categories = useCategories();
  const promptTemplates = usePromptTemplates();
  // Block ghim của Template đang chọn: đứng sau prompt riêng
  const pinned = template.prompt_template_id
    ? promptTemplates.data?.find((t) => String(t.id) === String(template.prompt_template_id))?.pinned_prompt
    : '';

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
        <TemplatePicker value={template.prompt_template_id ?? ''} onChange={(prompt_template_id) => onSet({ prompt_template_id })} />
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
          placeholder={template.prompt_template_id ? 'Prompt riêng của Creative (không bắt buộc), nối sau prompt Template.\n\nDùng {{key}} để chèn giá trị người mua nhập.' : 'Viết chỉ dẫn cố định cho model...\n\nDùng {{key}} để chèn giá trị người mua nhập (chỉ trường văn bản / lựa chọn).\nẢnh không chèn vào prompt — chúng được gửi kèm theo vai trò.'}
          aria-invalid={!!error}
          className={`${inputCls} ${borderCls(error)} min-h-[24rem] resize-y font-mono text-[13px] leading-relaxed`}
        />
        <div className="flex items-start justify-between gap-2">
          {error ? <p className="text-xs text-error">{error}</p> : <span />}
          <span className="shrink-0 text-[11px] text-outline">
            {text.length.toLocaleString('vi-VN')}/{MAX_PROMPT_LENGTH.toLocaleString('vi-VN')}
          </span>
        </div>
        {pinned && (
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant">
              <Icon name="keep" className="text-sm" />
              Block ghim cuối của Template (chỉ đọc, nối sau prompt riêng)
            </p>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-container p-2.5 font-mono text-[12px] leading-relaxed text-on-surface-variant">
              {pinned}
            </pre>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <section className="space-y-3 rounded-xl border border-outline-variant/40 p-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-outline">Thông tin sản phẩm</h3>
          <Input
            label="Tiêu đề"
            maxLength={MAX_TITLE_LENGTH}
            placeholder="Bỏ trống để tự đặt MS + thời gian tạo"
            value={template.title ?? ''}
            onChange={(e) => onSet({ title: e.target.value })}
            error={errors.title}
          />
          <Select
            label="Danh mục"
            value={template.category_id ?? ''}
            onChange={(e) => onSet({ category_id: e.target.value })}
            disabled={!categories.data}
            hint={categories.error ? `Không tải được danh mục: ${categories.error.message}` : undefined}
          >
            <option value="">Chưa chọn danh mục</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
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
          <HashtagInput value={template.hashtags ?? []} onChange={(hashtags) => onSet({ hashtags })} error={errors.hashtags} />
        </section>

        <section className="space-y-2 rounded-xl border border-outline-variant/40 p-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-outline">Hướng dẫn sử dụng mẫu</h3>
          <textarea
            value={template.description ?? ''}
            onChange={(e) => onSet({ description: e.target.value })}
            rows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            placeholder={'Hướng dẫn người mua dùng mẫu, ví dụ:\n- Chụp giày trên nền trơn, đủ sáng.\n- Mỗi lần chỉ tải 1 đôi giày.'}
            aria-label="Hướng dẫn sử dụng mẫu"
            className={`${inputCls} ${borderCls()} resize-y text-[13px] leading-relaxed`}
          />
          <p className="flex items-start justify-between gap-2 text-[11px] text-on-surface-variant">
            <span>Người mua thấy hướng dẫn này khi dùng mẫu.</span>
            <span className="shrink-0 text-outline">
              {(template.description ?? '').length.toLocaleString('vi-VN')}/{MAX_DESCRIPTION_LENGTH.toLocaleString('vi-VN')}
            </span>
          </p>
        </section>
      </aside>
    </div>
  );
}
