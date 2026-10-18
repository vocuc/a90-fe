/*
 * Template đầu vào + Prompt Template của một AI Creative (đặc tả AI90 §4, §5, Phụ lục A/B).
 *
 * Field: { key, label, type, description, required, default_value, validation, options,
 *          prompt_mapping: { role }, visibility_rule: { field, operator, value } | null, enabled, slots? }
 * Nguyên liệu ẩn (hidden_image): thêm asset_id (ảnh Creator đã tải lên) + asset_url (chỉ để xem lại);
 * người mua không thấy, ảnh luôn được gửi kèm tới model.
 * sort_order lấy theo thứ tự trong mảng khi xuất JSON.
 * Backend vẫn phải validate lại toàn bộ; kiểm tra ở đây chỉ để Creator thấy lỗi sớm.
 */

import { MAX_HASHTAGS, hashtagError } from '../../utils/hashtag';

export const SCHEMA_VERSION = 1;
export const MAX_FIELDS = 20;
export const MAX_PROMPT_LENGTH = 10_000;
export const MAX_TITLE_LENGTH = 150;
// Hướng dẫn sử dụng mẫu = description của Creative (backend tối đa 5000)
export const MAX_DESCRIPTION_LENGTH = 5_000;
// Khớp backend: setting generation.input_max_size_kb = 10240
export const MAX_FILE_MB = 10;
export const MAX_FILES_PER_FIELD = 10;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MIME_LABEL = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WEBP' };

export const KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

// Loại trường backend xử lý được khi tạo ảnh (CreativeTemplate::TYPES)
export const SUPPORTED_TYPES = ['image', 'text', 'textarea', 'number', 'select', 'radio', 'multi_select', 'toggle', 'aspect_ratio', 'hidden_image'];

// Số nguyên liệu ẩn tối đa khi chưa tải được cấu hình của admin (backend: generation.max_hidden_images)
export const DEFAULT_MAX_HIDDEN_IMAGES = 5;

// Link video hướng dẫn: chỉ nhận TikTok (tiktok.com và các tên miền con như www., m., vt., vm.)
export const isTiktokUrl = (value) => {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && /(^|\.)tiktok\.com$/i.test(url.hostname) && url.pathname.length > 1;
  } catch {
    return false;
  }
};
// {{ten_bien}} trong prompt
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export const FIELD_TYPES = {
  image: { label: 'Ảnh', icon: 'image', hint: 'Một ảnh', group: 'image' },
  image_list: { label: 'Nhiều ảnh', icon: 'photo_library', hint: 'Nhiều ảnh cùng vai trò', group: 'image' },
  image_set: { label: 'Bộ ảnh', icon: 'collections', hint: 'Mỗi ô ảnh một vai trò riêng', group: 'image' },
  text: { label: 'Văn bản', icon: 'short_text', hint: 'Một dòng chữ', group: 'text' },
  textarea: { label: 'Đoạn văn', icon: 'notes', hint: 'Nhiều dòng', group: 'text' },
  number: { label: 'Số', icon: 'pin', hint: 'Giá trị số trong giới hạn', group: 'text' },
  select: { label: 'Danh sách chọn', icon: 'arrow_drop_down_circle', hint: 'Chọn một phương án', group: 'choice' },
  multi_select: { label: 'Chọn nhiều', icon: 'checklist', hint: 'Chọn nhiều phương án', group: 'choice' },
  radio: { label: 'Nút chọn', icon: 'radio_button_checked', hint: 'Chọn một, hiển thị trực quan', group: 'choice' },
  toggle: { label: 'Bật/tắt', icon: 'toggle_on', hint: 'Tùy chọn có/không', group: 'choice' },
  aspect_ratio: { label: 'Tỉ lệ khung hình', icon: 'aspect_ratio', hint: 'Người mua bấm chọn tỉ lệ ảnh', group: 'choice' },
  hidden_image: { label: 'Nguyên liệu ẩn', icon: 'visibility_off', hint: 'Ảnh bạn tải lên, người mua không thấy, luôn gửi kèm tới AI', group: 'hidden' },
};

// Tỉ lệ khung hình Creator có thể cho người mua chọn
// Tên trường cố định của trường tỉ lệ khung hình (ngoại lệ của KEY_PATTERN)
export const ASPECT_RATIO_KEY = 'aspectRatio';

export const ASPECT_RATIOS = ['1:1', '9:16', '16:9', '3:4', '4:3', '2:3', '3:2', '4:5', '5:4', '21:9'];
const ratioOption = (r) => ({ value: r, label: r });

export const isImageType = (type) => FIELD_TYPES[type]?.group === 'image';
export const isHiddenType = (type) => type === 'hidden_image';
// Ảnh gửi kèm tới model (người mua tải hoặc nguyên liệu ẩn): không chèn vào prompt như chữ
const isAttachmentType = (type) => isImageType(type) || isHiddenType(type);

/** Các trường người mua thấy (bỏ nguyên liệu ẩn). */
export const buyerFields = (fields) => fields.filter((f) => !isHiddenType(f.type));
export const hasOptions = (type) => ['select', 'multi_select', 'radio', 'aspect_ratio'].includes(type);

// Vai trò ảnh khi gửi tới model (Phụ lục B). keywords: dùng để cảnh báo prompt chưa hướng dẫn cách dùng ảnh
export const IMAGE_ROLES = {
  primary_product: { label: 'Sản phẩm chính', keywords: ['sản phẩm'] },
  outfit_reference: { label: 'Tham chiếu outfit', keywords: ['outfit', 'trang phục'] },
  style_reference: { label: 'Tham chiếu phong cách', keywords: ['phong cách', 'style'] },
  background_reference: { label: 'Tham chiếu bối cảnh', keywords: ['bối cảnh', 'nền', 'background'] },
};

// Vai trò của trường không phải ảnh
export const VALUE_ROLES = {
  prompt_variable: { label: 'Biến trong prompt', hint: 'Chèn vào prompt qua {{key}}' },
  user_instruction: { label: 'Yêu cầu của người mua', hint: 'Dữ liệu không đáng tin, không được đè quy tắc của Creative' },
};

export const VISIBILITY_OPERATORS = {
  equals: 'bằng',
  not_equals: 'khác',
  is_on: 'đang bật / có giá trị',
  is_off: 'đang tắt / trống',
};
export const operatorNeedsValue = (op) => op === 'equals' || op === 'not_equals';

const defaultValidation = (type) => {
  switch (type) {
    case 'image':
      return { min_files: 1, max_files: 1, max_size_mb: MAX_FILE_MB, allowed_types: [...IMAGE_MIME_TYPES] };
    case 'image_list':
      return { min_files: 1, max_files: 4, max_size_mb: MAX_FILE_MB, allowed_types: [...IMAGE_MIME_TYPES] };
    case 'image_set':
      return { max_size_mb: MAX_FILE_MB, allowed_types: [...IMAGE_MIME_TYPES] };
    case 'text':
      return { max_length: 200 };
    case 'textarea':
      return { max_length: 1000 };
    case 'number':
      return { min: 1, max: 10, step: 1 };
    case 'multi_select':
      return { min_selected: 0, max_selected: null };
    default:
      return {};
  }
};

const defaultOptions = () => [
  { value: 'option_1', label: 'Lựa chọn 1' },
  { value: 'option_2', label: 'Lựa chọn 2' },
];

/** Key chưa dùng dạng `${base}_n` */
export const uniqueKey = (base, fields) => {
  const keys = new Set(fields.map((f) => f.key));
  if (!keys.has(base)) return base;
  let n = 2;
  while (keys.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
};

const BASE_KEY = {
  image: 'image',
  image_list: 'images',
  image_set: 'image_set',
  text: 'text',
  textarea: 'additional_instructions',
  number: 'number',
  select: 'choice',
  multi_select: 'choices',
  radio: 'option',
  toggle: 'toggle',
  aspect_ratio: 'aspect_ratio',
  hidden_image: 'asset',
};

let uid = 0;
// id nội bộ cho React key, không gửi lên backend
export const newUid = () => `f${Date.now().toString(36)}${(uid++).toString(36)}`;

export function createField(type, fields = []) {
  const meta = FIELD_TYPES[type];
  const field = {
    _id: newUid(),
    // Tên cố định (mỗi mẫu chỉ có 1 trường tỉ lệ)
    key: type === 'aspect_ratio' ? ASPECT_RATIO_KEY : uniqueKey(BASE_KEY[type], fields),
    label: meta.label,
    type,
    description: '',
    required: isImageType(type) || type === 'aspect_ratio',
    default_value: type === 'toggle' ? false : type === 'multi_select' ? [] : type === 'aspect_ratio' ? '1:1' : '',
    validation: defaultValidation(type),
    options: type === 'aspect_ratio' ? [ratioOption('1:1')] : hasOptions(type) ? defaultOptions() : [],
    prompt_mapping: { role: isImageType(type) ? 'primary_product' : type === 'textarea' ? 'user_instruction' : 'prompt_variable' },
    visibility_rule: null,
    enabled: true,
  };
  if (type === 'image_set') {
    field.slots = [
      { key: 'main', label: 'Ảnh chính', role: 'primary_product', required: true },
      { key: 'reference', label: 'Ảnh tham chiếu', role: 'style_reference', required: false },
    ];
    delete field.prompt_mapping;
  }
  if (type === 'hidden_image') {
    field.required = false;
    field.asset_id = null;
    field.asset_url = null;
    delete field.prompt_mapping;
  }
  return field;
}

// Trường tỉ lệ chỉ cho 1 tỉ lệ: bản nháp cũ nhiều tỉ lệ thì giữ tỉ lệ mặc định
const oneRatio = (f) => {
  if (f.options.length <= 1) return f;
  const r = f.options.some((o) => o.value === f.default_value) ? f.default_value : f.options[0].value;
  return { ...f, options: [ratioOption(r)], default_value: r };
};

/** Mẫu nào cũng phải có trường tỉ lệ khung hình (bắt buộc, không xoá được): thiếu thì thêm vào cuối. */
export const withRatioField = (template) =>
  template.fields.some((f) => f.type === 'aspect_ratio')
    ? { ...template, fields: template.fields.map((f) => (f.type === 'aspect_ratio' ? oneRatio({ ...f, required: true, enabled: true }) : f)) }
    : { ...template, fields: [...template.fields, createField('aspect_ratio', template.fields)] };

/** Đổi kiểu trường: giữ key/label/mô tả, đặt lại phần phụ thuộc kiểu. */
export function changeFieldType(field, type, fields) {
  const next = createField(type, fields.filter((f) => f._id !== field._id));
  return { ...next, _id: field._id, key: field.key, label: field.label, description: field.description, visibility_rule: field.visibility_rule };
}

export const emptyTemplate = () => ({
  name: '',
  template_key: '',
  fields: [],
  prompt_text: '',
  title: '',
  model_id: '',
  price_per_image: '',
  category_id: '',
  description: '',
  video_url: '',
  hashtags: [],
  // Mặc định private: chỉ Creator thấy, chưa hiện trên marketplace
  is_public: false,
});

// ---------------- Prompt ----------------

export const extractVariables = (text) => [...new Set([...(text ?? '').matchAll(VARIABLE_PATTERN)].map((m) => m[1]))];

/** Các vai trò ảnh đang được dùng trong Template, theo thứ tự field. */
export const imageAttachments = (fields) =>
  fields.flatMap((f) => {
    if (f.enabled === false || !isImageType(f.type)) return [];
    if (f.type === 'image_set') return f.slots.map((s) => ({ field: f, key: `${f.key}.${s.key}`, label: s.label, role: s.role }));
    return [{ field: f, key: f.key, label: f.label, role: f.prompt_mapping?.role }];
  });

const displayValue = (field, value) => {
  if (field.type === 'toggle') return value ? 'Có' : 'Không';
  if (hasOptions(field.type)) {
    const label = (v) => field.options.find((o) => o.value === v)?.label ?? v;
    return Array.isArray(value) ? value.map(label).join(', ') : label(value);
  }
  return value == null ? '' : String(value);
};

// Giữ nguyên tên trường Creator đặt; ô ảnh trong bộ ảnh: field.slot -> field_slot
const requestKey = (key) => key.replace(/\./g, '_');

// Mặc định 1:1 như trang tạo sản phẩm; model không hỗ trợ 1:1 thì lấy tỉ lệ đầu tiên
export const pickDefaultRatio = (ratios = []) => (ratios.includes('1:1') ? '1:1' : (ratios[0] ?? null));

/**
 * Mô phỏng Prompt Engine (§7): JSON gửi tới model.
 * Mỗi trường ảnh thành một khoá đúng tên trường (nhiều ảnh -> mảng), {{key}} trong prompt thay bằng giá trị người mua nhập.
 * Ảnh trong bản thử chưa tải lên S3 nên chỉ ghi tên file thay cho URL.
 * values: { [key]: value }, ảnh: { [key]: File[] } (image_set: { [slotKey]: File[] }). model: phần tử của /ai-models.
 */
export function buildRequestJson(template, values, model) {
  const { fields, prompt_text } = template;
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const out = {};
  fields.forEach((f) => {
    // Nguyên liệu ẩn: ảnh Creator đã tải lên, luôn gửi kèm
    if (isHiddenType(f.type)) {
      out[requestKey(f.key)] = f.asset_id ? '(URL ảnh nguyên liệu ẩn)' : null;
      return;
    }
    if (!isFieldVisible(f, values, byKey)) return;
    imageAttachments([f]).forEach((a) => {
      const [fieldKey, slotKey] = a.key.split('.');
      const raw = values[fieldKey];
      const urls = ((slotKey ? raw?.[slotKey] : raw) ?? []).map((file) => `(URL sau khi tải lên: ${file.name})`);
      out[requestKey(a.key)] = a.field.type === 'image_list' ? urls : (urls[0] ?? null);
    });
  });
  const text = (prompt_text ?? '').replace(VARIABLE_PATTERN, (_, key) => {
    const field = byKey[key];
    if (!field || isAttachmentType(field.type) || !isFieldVisible(field, values, byKey)) return '';
    return displayValue(field, values[key]).trim();
  });
  out.prompt = text.replace(/\n{3,}/g, '\n\n').trim();
  // Tỉ lệ người mua bấm chọn; mẫu không có trường tỉ lệ thì dùng mặc định của model
  const ratioField = fields.find((f) => f.type === 'aspect_ratio' && isFieldVisible(f, values, byKey));
  out.aspectRatio = (ratioField && values[ratioField.key]) || pickDefaultRatio(model?.supported_aspect_ratios);
  out.modelDisplayName = model?.name ?? null;
  return out;
}

// ---------------- Điều kiện hiển thị ----------------

const isEmptyValue = (v) => v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0);

export function isFieldVisible(field, values, byKey) {
  // input_schema backend trả về không kèm "enabled": thiếu thì coi là đang bật
  if (field.enabled === false) return false;
  const rule = field.visibility_rule;
  if (!rule?.field) return true;
  const source = byKey?.[rule.field];
  // Trường điều kiện bị ẩn thì trường phụ thuộc cũng ẩn
  if (source && !isFieldVisible(source, values, byKey)) return false;
  const v = values[rule.field];
  switch (rule.operator) {
    case 'equals':
      return Array.isArray(v) ? v.includes(rule.value) : String(v ?? '') === String(rule.value ?? '');
    case 'not_equals':
      return Array.isArray(v) ? !v.includes(rule.value) : String(v ?? '') !== String(rule.value ?? '');
    case 'is_off':
      return isEmptyValue(v);
    default:
      return !isEmptyValue(v);
  }
}

// ---------------- Kiểm tra trước khi lưu/publish ----------------

/**
 * Trả { errors: { [path]: msg }, issues: [{ level: 'error'|'warning', message, fieldId? }] }.
 * path: 'title', 'prompt_text', `${_id}.key`, `${_id}.options`...
 * maxHiddenImages: số nguyên liệu ẩn tối đa admin cho phép.
 */
export function validateTemplate(template, { maxHiddenImages = DEFAULT_MAX_HIDDEN_IMAGES } = {}) {
  const { fields, prompt_text } = template;
  const errors = {};
  const issues = [];
  const add = (level, message, fieldId, path) => {
    issues.push({ level, message, fieldId });
    if (level === 'error' && path && !errors[path]) errors[path] = message;
  };

  if (!fields.length) add('error', 'Template cần ít nhất 1 trường đầu vào.');
  if (fields.length > MAX_FIELDS) add('error', `Tối đa ${MAX_FIELDS} trường.`);
  if (fields.filter((f) => f.type === 'aspect_ratio').length > 1) add('error', 'Chỉ được có 1 trường tỉ lệ khung hình.');
  if (!fields.some((f) => f.enabled && isImageType(f.type)))
    add('warning', 'Template chưa có trường ảnh nào — người mua sẽ không gửi được ảnh sản phẩm.');
  const hiddenCount = fields.filter((f) => isHiddenType(f.type)).length;
  if (hiddenCount > maxHiddenImages)
    add('error', maxHiddenImages > 0 ? `Tối đa ${maxHiddenImages} nguyên liệu ẩn.` : 'Hiện chưa cho phép dùng nguyên liệu ẩn.');

  const keyCount = fields.reduce((m, f) => m.set(f.key, (m.get(f.key) ?? 0) + 1), new Map());
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));

  fields.forEach((f, index) => {
    const name = `"${f.label || f.key || `Trường #${index + 1}`}"`;
    const p = (k) => `${f._id}.${k}`;
    const v = f.validation ?? {};

    if (!SUPPORTED_TYPES.includes(f.type))
      add('error', `${name}: loại "${FIELD_TYPES[f.type]?.label ?? f.type}" chưa dùng được khi tạo ảnh, hãy xoá trường này.`, f._id);

    if (!f.key) add('error', `${name}: chưa nhập tên trường.`, f._id, p('key'));
    else if (f.type !== 'aspect_ratio' && !KEY_PATTERN.test(f.key))
      add('error', `${name}: tên trường chỉ gồm chữ thường không dấu, số, dấu _ và bắt đầu bằng chữ (2–50 ký tự).`, f._id, p('key'));
    else if (keyCount.get(f.key) > 1) add('error', `Tên trường "${f.key}" bị trùng.`, f._id, p('key'));
    if (!f.label.trim()) add('error', `Trường #${index + 1}: chưa nhập label hiển thị.`, f._id, p('label'));

    if (isHiddenType(f.type) && !f.asset_id) add('error', `${name}: chưa tải ảnh nguyên liệu.`, f._id, p('asset_id'));

    if (isImageType(f.type)) {
      if (!v.allowed_types?.length) add('error', `${name}: chọn ít nhất 1 định dạng ảnh.`, f._id, p('allowed_types'));
      if (!(v.max_size_mb > 0 && v.max_size_mb <= MAX_FILE_MB))
        add('error', `${name}: dung lượng mỗi ảnh từ 1 đến ${MAX_FILE_MB}MB.`, f._id, p('max_size_mb'));
    }
    if (f.type === 'image_list') {
      if (!(v.max_files >= 1 && v.max_files <= MAX_FILES_PER_FIELD))
        add('error', `${name}: số ảnh tối đa từ 1 đến ${MAX_FILES_PER_FIELD}.`, f._id, p('max_files'));
      else if (v.min_files > v.max_files) add('error', `${name}: số ảnh tối thiểu lớn hơn tối đa.`, f._id, p('min_files'));
    }
    if (f.type === 'image_set') {
      if (!f.slots?.length) add('error', `${name}: bộ ảnh cần ít nhất 1 ô ảnh.`, f._id, p('slots'));
      const slotKeys = new Set();
      f.slots?.forEach((s, i) => {
        if (!KEY_PATTERN.test(s.key) || slotKeys.has(s.key))
          add('error', `${name}: key ô ảnh #${i + 1} không hợp lệ hoặc bị trùng.`, f._id, p(`slots.${i}.key`));
        slotKeys.add(s.key);
        if (!s.label.trim()) add('error', `${name}: ô ảnh #${i + 1} chưa có tên.`, f._id, p(`slots.${i}.label`));
        if (!s.role) add('error', `${name}: ô ảnh #${i + 1} chưa gắn vai trò.`, f._id, p(`slots.${i}.role`));
      });
    }
    if ((f.type === 'text' || f.type === 'textarea') && !(v.max_length > 0))
      add('error', `${name}: nhập độ dài tối đa.`, f._id, p('max_length'));
    if (f.type === 'number' && v.min != null && v.max != null && Number(v.min) > Number(v.max))
      add('error', `${name}: giá trị nhỏ nhất lớn hơn lớn nhất.`, f._id, p('min'));

    if (hasOptions(f.type)) {
      const values = f.options.map((o) => o.value.trim());
      if (f.type === 'aspect_ratio') {
        if (!f.options.length) add('error', `${name}: chọn ít nhất 1 tỉ lệ.`, f._id, p('options'));
      } else if (f.options.length < 2) add('error', `${name}: cần ít nhất 2 lựa chọn.`, f._id, p('options'));
      else if (values.some((x) => !x) || f.options.some((o) => !o.label.trim()))
        add('error', `${name}: lựa chọn chưa đủ giá trị và nhãn.`, f._id, p('options'));
      else if (new Set(values).size !== values.length) add('error', `${name}: giá trị lựa chọn bị trùng.`, f._id, p('options'));
    }

    const rule = f.visibility_rule;
    if (rule) {
      const source = byKey[rule.field];
      const sourceIndex = fields.findIndex((x) => x.key === rule.field);
      if (!source || source._id === f._id)
        add('error', `${name}: điều kiện hiển thị trỏ tới trường không hợp lệ.`, f._id, p('visibility'));
      else if (sourceIndex > index)
        add('error', `${name}: trường điều kiện phải nằm phía trên.`, f._id, p('visibility'));
      else if (isAttachmentType(source.type))
        add('error', `${name}: không dùng trường ảnh làm điều kiện.`, f._id, p('visibility'));
      else if (operatorNeedsValue(rule.operator) && !String(rule.value ?? '').trim())
        add('error', `${name}: chưa chọn giá trị cho điều kiện hiển thị.`, f._id, p('visibility'));
      if (f.required && source)
        add('warning', `${name}: bắt buộc nhưng chỉ hiện theo điều kiện — chỉ bắt buộc khi đang hiện.`, f._id);
    }
  });

  // ---- Thông tin sản phẩm ----
  if (!(template.title ?? '').trim()) add('error', 'Chưa nhập tiêu đề.', null, 'title');
  if (!template.model_id) add('error', 'Chưa chọn AI model.', null, 'model_id');
  const price = template.price_per_image ?? '';
  if (price === '') add('error', 'Chưa nhập giá bán mỗi ảnh.', null, 'price_per_image');
  else if (!Number.isInteger(Number(price)) || Number(price) < 0)
    add('error', 'Giá bán phải là số nguyên từ 0 trở lên.', null, 'price_per_image');
  const videoUrl = (template.video_url ?? '').trim();
  if (videoUrl && !isTiktokUrl(videoUrl))
    add('error', 'Link video hướng dẫn phải là link TikTok (https://www.tiktok.com/... hoặc https://vt.tiktok.com/...).', null, 'video_url');
  const hashtags = template.hashtags ?? [];
  const hashtagMessage =
    hashtags.length > MAX_HASHTAGS ? `Tối đa ${MAX_HASHTAGS} hashtag.` : hashtags.map(hashtagError).find(Boolean);
  if (hashtagMessage) add('error', hashtagMessage, null, 'hashtags');

  // ---- Prompt ----
  const prompt = prompt_text ?? '';
  if (!prompt.trim()) add('error', 'Chưa viết Prompt Template.', null, 'prompt_text');
  else if (prompt.length > MAX_PROMPT_LENGTH)
    add('error', `Prompt tối đa ${MAX_PROMPT_LENGTH.toLocaleString('vi-VN')} ký tự.`, null, 'prompt_text');

  const used = extractVariables(prompt);
  used.forEach((key) => {
    const field = byKey[key];
    if (!field) add('error', `Prompt dùng biến {{${key}}} chưa khai báo trong Template.`, null, 'prompt_text');
    else if (isAttachmentType(field.type))
      add('error', `{{${key}}} là trường ảnh — ảnh được gửi dạng image part, không chèn vào prompt như chữ.`, field._id, 'prompt_text');
    else if (!field.enabled) add('warning', `Prompt dùng {{${key}}} nhưng trường này đang tắt.`, field._id);
  });
  // Trường chỉ dùng làm điều kiện hiển thị thì không cần có trong prompt
  const ruleSources = new Set(fields.map((f) => f.visibility_rule?.field).filter(Boolean));
  fields.forEach((f) => {
    if (!f.enabled || isAttachmentType(f.type) || used.includes(f.key) || ruleSources.has(f.key)) return;
    add('warning', `Trường "${f.label}" chưa được dùng trong prompt (thêm {{${f.key}}}).`, f._id);
  });

  return { errors, issues };
}

// ---------------- Xuất / nhập JSON ----------------

const cleanField = ({ _id, ...f }, index) => {
  const out = {
    key: f.key,
    label: f.label.trim(),
    type: f.type,
    description: f.description?.trim() || undefined,
    required: !!f.required,
    sort_order: index + 1,
    validation: f.validation,
    enabled: f.enabled,
  };
  if (hasOptions(f.type)) out.options = f.options.map((o) => ({ value: o.value.trim(), label: o.label.trim() }));
  if (f.type === 'image_set') out.slots = f.slots;
  else if (isHiddenType(f.type)) {
    out.asset_id = f.asset_id ?? null;
    // Chỉ để xem lại trong nháp, backend bỏ qua
    out.asset_url = f.asset_url ?? null;
  } else out.prompt_mapping = f.prompt_mapping;
  if (!isAttachmentType(f.type) && !isEmptyValue(f.default_value)) out.default_value = f.default_value;
  if (f.visibility_rule?.field) out.visibility_rule = f.visibility_rule;
  return out;
};

// Tên Template không còn ô nhập riêng: dùng tên cũ nếu có, không thì lấy tiêu đề sản phẩm
const templateName = (t) => (t.name?.trim() || t.title?.trim() || '');

export const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Dạng gửi backend: Template schema (§4.4) + Prompt Template (Phụ lục B). */
export function toPayload(template) {
  const fields = template.fields;
  const variables = fields
    .filter((f) => !isAttachmentType(f.type))
    .map((f) => ({
      key: f.key,
      type: f.type === 'number' ? 'number' : hasOptions(f.type) || f.type === 'toggle' ? 'enum' : 'text',
      required: !!f.required,
      ...(f.validation?.max_length ? { max_length: f.validation.max_length } : {}),
    }));
  return {
    schema_json: {
      schema_version: SCHEMA_VERSION,
      template_key: template.template_key || slugify(templateName(template)) || 'template',
      name: templateName(template),
      fields: fields.map(cleanField),
    },
    title: (template.title ?? '').trim(),
    model_id: template.model_id ? Number(template.model_id) : null,
    price_per_image: (template.price_per_image ?? '') === '' ? null : Number(template.price_per_image),
    category_id: template.category_id || null,
    description: (template.description ?? '').trim(),
    video_url: (template.video_url ?? '').trim(),
    hashtags: template.hashtags ?? [],
    is_public: !!template.is_public,
    prompt_template: {
      prompt_text: template.prompt_text,
      variables,
      image_roles: [...new Set(imageAttachments(fields).map((a) => a.role))],
      rules: {
        unknown_variables: 'reject',
        missing_required_variables: 'reject',
        buyer_can_override_prompt: false,
        buyer_can_override_model: false,
        buyer_can_override_price: false,
      },
    },
  };
}

// Nháp/Creative cũ lưu max_size_mb = 20 (trước khi hạ theo backend) mà giao diện không có ô sửa: ép về giới hạn hiện tại
const clampValidation = (type, v) => {
  if (!isImageType(type)) return v;
  const mb = Number(v.max_size_mb);
  return { ...v, max_size_mb: mb > 0 ? Math.min(mb, MAX_FILE_MB) : MAX_FILE_MB };
};

/** Đọc lại từ payload/JSON đã lưu; ném lỗi nếu sai cấu trúc. */
export function fromPayload(data) {
  const schema = data?.schema_json ?? data;
  if (!schema || !Array.isArray(schema.fields)) throw new Error('JSON không có mảng "fields".');
  const fields = [...schema.fields]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((f) => {
      if (!FIELD_TYPES[f.type]) throw new Error(`Kiểu trường "${f.type}" không được hỗ trợ.`);
      const base = createField(f.type);
      return {
        ...base,
        ...f,
        _id: newUid(),
        ...(f.type === 'aspect_ratio' ? { key: ASPECT_RATIO_KEY } : {}),
        label: String(f.label ?? ''),
        description: String(f.description ?? ''),
        validation: clampValidation(f.type, { ...base.validation, ...f.validation }),
        options: hasOptions(f.type) ? (f.options ?? []).map((o) => ({ value: String(o.value), label: String(o.label) })) : [],
        default_value: f.default_value ?? base.default_value,
        visibility_rule: f.visibility_rule ?? null,
        enabled: f.enabled !== false,
      };
    });
  return {
    name: String(schema.name ?? ''),
    template_key: String(schema.template_key ?? ''),
    fields,
    prompt_text: String(data?.prompt_template?.prompt_text ?? data?.prompt_text ?? ''),
    title: String(data?.title ?? ''),
    model_id: data?.model_id == null ? '' : String(data.model_id),
    price_per_image: data?.price_per_image == null ? '' : String(data.price_per_image),
    category_id: data?.category_id == null ? '' : String(data.category_id),
    // Nháp cũ lưu hướng dẫn ở usage_guide
    description: String(data?.description ?? data?.usage_guide ?? ''),
    video_url: String(data?.video_url ?? ''),
    hashtags: Array.isArray(data?.hashtags) ? data.hashtags.map(String) : [],
    is_public: data?.is_public === true,
  };
}

// ---------------- Creative trên backend ----------------

/** Dữ liệu gửi POST/PUT /creator/creatives. */
export function toCreativePayload(template) {
  const trimmed = (v) => (v ?? '').trim() || null;
  return {
    title: (template.title ?? '').trim(),
    model_id: Number(template.model_id),
    price_per_image: Number(template.price_per_image),
    category_id: template.category_id ? Number(template.category_id) : null,
    description: trimmed(template.description),
    video_url: trimmed(template.video_url),
    hashtags: template.hashtags ?? [],
    is_public: !!template.is_public,
    input_schema: toPayload(template).schema_json.fields,
    prompt_template: template.prompt_text,
  };
}

/** GET /creator/creatives/{id} -> template để sửa. */
export function fromCreative(creative) {
  const config = creative.config ?? {};
  const info = {
    title: creative.title ?? '',
    model_id: creative.model_id == null ? '' : String(creative.model_id),
    price_per_image: creative.price_per_image == null ? '' : String(creative.price_per_image),
    category_id: creative.category_id == null ? '' : String(creative.category_id),
    description: creative.description ?? '',
    video_url: creative.video_url ?? '',
    hashtags: creative.hashtags?.map((h) => h.name) ?? [],
    is_public: creative.is_public === true,
  };

  const template = fromPayload({ schema_json: { name: creative.title, fields: config.input_schema ?? [] } });
  return withRatioField({ ...template, ...info, prompt_text: config.prompt_template ?? '' });
}
