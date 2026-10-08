import { useEffect, useState } from 'react';
import Icon from '../common/Icon';
import { FormAlert, SubmitButton, TextArea, TextField } from '../common/Form';
import { useCreateProfile, useUpdateProfile } from '../../hooks/creatorQueries';

// Khớp luật của backend (Creator\ProfileController@rules)
const USERNAME_RE = /^[a-z0-9_.-]+$/;
const MAX_DESCRIPTION = 2000;
export const SOCIAL_NETWORKS = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@...' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@...' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/...' },
  { key: 'threads', label: 'Threads', placeholder: 'https://threads.net/@...' },
];

const toForm = (profile) => {
  // Backend trả social_links là {} hoặc [] khi trống
  const links = profile?.social_links && !Array.isArray(profile.social_links) ? profile.social_links : {};
  return {
    shop_name: profile?.shop_name ?? '',
    username: profile?.username ?? '',
    description: profile?.description ?? '',
    website: profile?.website ?? '',
    social_links: Object.fromEntries(SOCIAL_NETWORKS.map(({ key }) => [key, links[key] ?? ''])),
  };
};

// Người dùng hay gõ "facebook.com/abc" -> tự thêm https:// cho backend (rule url cần có giao thức)
const withScheme = (value) => {
  const v = value.trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

const isUrl = (value) => {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
  } catch {
    return false;
  }
};

const validate = (form) => {
  const errors = {};
  if (!form.shop_name.trim()) errors.shop_name = 'Vui lòng nhập tên shop.';
  else if (form.shop_name.trim().length > 100) errors.shop_name = 'Tên shop tối đa 100 ký tự.';
  if (form.username.length < 3 || form.username.length > 50) errors.username = 'Username dài từ 3 đến 50 ký tự.';
  else if (!USERNAME_RE.test(form.username)) errors.username = 'Username chỉ gồm chữ thường không dấu, số và . _ -';
  if (form.website && !isUrl(withScheme(form.website))) errors.website = 'Link website không hợp lệ.';
  SOCIAL_NETWORKS.forEach(({ key, label }) => {
    const v = form.social_links[key];
    if (v && !isUrl(withScheme(v))) errors[`social_links.${key}`] = `Link ${label} không hợp lệ.`;
  });
  return errors;
};

// Backend chưa có bản dịch tiếng Việt cho lỗi validate
const translateServerError = (field, message) => {
  if (field === 'username') {
    if (/taken/i.test(message)) return 'Username này đã có người dùng, hãy chọn tên khác.';
    if (/format|invalid/i.test(message)) return 'Username chỉ gồm chữ thường không dấu, số và . _ -';
    if (/at least|least/i.test(message)) return 'Username cần ít nhất 3 ký tự.';
  }
  if (field === 'website' || field.startsWith('social_links')) return 'Link không hợp lệ.';
  if (field === 'shop_name' && /required/i.test(message)) return 'Vui lòng nhập tên shop.';
  return message;
};

const toPayload = (form) => {
  const links = Object.fromEntries(
    Object.entries(form.social_links)
      .map(([k, v]) => [k, withScheme(v)])
      .filter(([, v]) => v),
  );
  return {
    shop_name: form.shop_name.trim(),
    username: form.username,
    description: form.description.trim() || null,
    website: withScheme(form.website) || null,
    social_links: links,
  };
};

/** Form tạo profile người bán (profile = null) hoặc sửa thông tin cửa hàng. */
export default function ShopInfoForm({ profile, onCreated }) {
  const creating = !profile;
  const createMutation = useCreateProfile();
  const updateMutation = useUpdateProfile();
  const mutation = creating ? createMutation : updateMutation;
  const [form, setForm] = useState(() => toForm(profile));
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [saved, setSaved] = useState(false);

  // Hồ sơ được tải lại (vd. sau khi upload ảnh): chỉ nạp vào form khi người dùng chưa sửa gì
  useEffect(() => {
    if (profile && !dirty) setForm(toForm(profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (!saved) return undefined;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  const errors = validate(form);
  const shown = (key) => (touched[key] ? errors[key] : undefined) ?? serverErrors[key];

  const change = (key, value) => {
    setForm((f) =>
      key.startsWith('social_links.')
        ? { ...f, social_links: { ...f.social_links, [key.split('.')[1]]: value } }
        : { ...f, [key]: value },
    );
    setServerErrors(({ [key]: _, ...rest }) => rest);
    setDirty(true);
    setSaved(false);
  };

  const field = (key, value) => ({
    value,
    onChange: (e) => change(key, e.target.value),
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
    error: shown(key),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    const all = Object.fromEntries(
      ['shop_name', 'username', 'website', ...SOCIAL_NETWORKS.map(({ key }) => `social_links.${key}`)].map((k) => [k, true]),
    );
    setTouched(all);
    if (Object.keys(errors).length) return;
    setServerErrors({});
    mutation.mutate(toPayload(form), {
      onSuccess: (p) => {
        setForm(toForm(p));
        setTouched({});
        setDirty(false);
        if (creating) onCreated?.(p);
        else setSaved(true);
      },
      onError: (err) =>
        setServerErrors(
          Object.fromEntries(Object.entries(err.errors ?? {}).map(([k, m]) => [k, translateServerError(k, m)])),
        ),
    });
  };

  const generalError = mutation.error && !mutation.error.errors ? mutation.error.message : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <TextField
        label="Tên shop *"
        icon="storefront"
        maxLength={100}
        placeholder="Ví dụ: Huy Studio AI"
        {...field('shop_name', form.shop_name)}
      />
      <TextField
        label="Username *"
        icon="alternate_email"
        maxLength={50}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="huy-studio"
        hint="Dùng làm địa chỉ trang shop. Chữ thường không dấu, số và . _ -"
        {...field('username', form.username)}
        onChange={(e) => change('username', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
      />
      <TextArea
        label="Mô tả shop"
        rows={4}
        maxLength={MAX_DESCRIPTION}
        placeholder="Giới thiệu phong cách ảnh, sản phẩm bạn chuyên làm..."
        {...field('description', form.description)}
      />
      <TextField
        label="Website"
        icon="language"
        type="url"
        inputMode="url"
        placeholder="https://..."
        {...field('website', form.website)}
      />

      <fieldset className="space-y-3">
        <legend className="mb-1.5 text-xs font-semibold text-on-surface">Mạng xã hội</legend>
        {SOCIAL_NETWORKS.map(({ key, label, placeholder }) => (
          <TextField
            key={key}
            label={label}
            icon="link"
            type="url"
            inputMode="url"
            placeholder={placeholder}
            {...field(`social_links.${key}`, form.social_links[key])}
          />
        ))}
      </fieldset>

      {generalError && <FormAlert>{generalError}</FormAlert>}
      {saved && (
        <p role="status" className="flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-2 text-xs text-primary">
          <Icon name="check_circle" className="text-sm" />
          Đã lưu thông tin cửa hàng.
        </p>
      )}

      <SubmitButton loading={mutation.isPending} loadingText="Đang lưu...">
        {creating ? 'Tạo cửa hàng' : 'Lưu thông tin'}
      </SubmitButton>
    </form>
  );
}
