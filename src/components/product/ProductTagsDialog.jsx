import { useState } from 'react';
import Dialog from '../common/Dialog';
import Icon from '../common/Icon';
import { TextField } from '../common/Form';
import TagPicker, { SourceBadge } from './TagPicker';
import { mapProduct } from '../../api/autoBatch';
import { LABEL_MAX, TAG_FIELDS, updateProductTags } from '../../api/productTags';

const same = (a, b) => JSON.stringify([].concat(a ?? []).sort()) === JSON.stringify([].concat(b ?? []).sort());

/**
 * Sửa tag sản phẩm (note/xay-kenh-tiktok/chu-de-va-tag-san-pham.txt mục 2). Chỉ gửi trường đã đổi: trường đó thành
 * "Shop sửa" và AI không ghi đè nữa; xoá hết giá trị = trả lại cho AI gắn.
 */
export default function ProductTagsDialog({ product, onSaved, onClose }) {
  const [label, setLabel] = useState(product.aiLabel ?? '');
  const [tags, setTags] = useState(product.tags ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const sources = product.tagSources ?? {};

  const submit = async () => {
    const changedTags = Object.fromEntries(
      TAG_FIELDS.filter((f) => !same(tags[f.key], product.tags?.[f.key])).map((f) => [f.key, tags[f.key] ?? null]),
    );
    const labelChanged = label.trim() !== (product.aiLabel ?? '');
    if (!labelChanged && !Object.keys(changedTags).length) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await updateProductTags(product.id, { aiLabel: labelChanged ? label.trim() : undefined, tags: changedTags });
      onSaved(mapProduct(data));
    } catch (err) {
      setError(err?.errors?.tags || err?.errors?.ai_label || err?.message || 'Không lưu được tag, vui lòng thử lại.');
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Tag sản phẩm"
      subtitle={product.name || `Sản phẩm #${product.id}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="flex h-11 items-center rounded-xl px-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container">
            Huỷ
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container text-sm font-bold text-on-primary hover:bg-primary disabled:opacity-50"
          >
            <Icon name={saving ? 'progress_activity' : 'save'} className={`text-lg ${saving ? 'animate-spin' : ''}`} />
            Lưu tag
          </button>
        </>
      }
    >
      <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
        <Icon name="info" className="text-base" />
        <span>
          Tag giúp kế hoạch kênh TikTok chọn đúng sản phẩm theo chủ đề (VD bài "Top 5 đôi đi chúc Tết"). Trường bạn sửa sẽ
          được giữ nguyên, AI không ghi đè. Bỏ trống một trường để AI gắn lại.
        </span>
      </p>
      <div>
        <TextField
          label={
            <span className="flex items-center gap-1.5">
              Nhãn ngắn <SourceBadge source={sources.ai_label} />
            </span>
          }
          value={label}
          maxLength={LABEL_MAX}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="VD: Cao gót mũi nhọn đỏ"
          hint="Kiểu + đặc điểm nổi bật + màu, không tên hãng. In lên ảnh bài Top N."
        />
      </div>
      <TagPicker value={tags} onChange={setTags} sources={sources} />
      {error && (
        <p role="alert" className="rounded-xl bg-error-container/60 px-3 py-2 text-xs text-on-error-container">
          {error}
        </p>
      )}
    </Dialog>
  );
}
