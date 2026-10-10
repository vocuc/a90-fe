import useSeo from '../hooks/useSeo';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AuthShell, FormAlert, SubmitButton, TextField, safeRedirect } from '../components/auth/AuthForm';
import GoogleSignInButton, { AuthDivider } from '../components/auth/GoogleSignInButton';
import { useAuth } from '../context/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Khớp luật của backend (AuthController@register): name max 100, email max 191, password min 8
const MIN_PASSWORD = 8;
const MAX_NAME = 100;
const MAX_EMAIL = 191;

const validate = ({ name, email, password, confirm, agree }) => {
  const errors = {};
  if (name.trim().length < 2) errors.name = 'Vui lòng nhập họ tên (ít nhất 2 ký tự).';
  else if (name.trim().length > MAX_NAME) errors.name = `Họ tên tối đa ${MAX_NAME} ký tự.`;
  if (!EMAIL_RE.test(email.trim())) errors.email = 'Email không hợp lệ.';
  else if (email.trim().length > MAX_EMAIL) errors.email = `Email tối đa ${MAX_EMAIL} ký tự.`;
  if (password.length < MIN_PASSWORD) errors.password = `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`;
  if (confirm !== password) errors.confirm = 'Mật khẩu nhập lại không khớp.';
  if (!agree) errors.agree = 'Bạn cần đồng ý với điều khoản sử dụng.';
  return errors;
};

// Backend chưa có bản dịch tiếng Việt -> dịch các lỗi có thể chỉ server mới phát hiện được
const translateServerError = (field, message) => {
  if (field === 'email' && /taken/i.test(message)) return 'Email này đã được đăng ký.';
  if (field === 'email') return 'Email không hợp lệ.';
  if (field === 'password' && /confirmation/i.test(message)) return 'Mật khẩu nhập lại không khớp.';
  if (field === 'password') return `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`;
  return message;
};

// Lỗi của trường password_confirmation do backend trả ở trường password -> gom về ô "Nhập lại"
const mapServerErrors = (errors = {}) => {
  const out = {};
  for (const [field, message] of Object.entries(errors)) {
    const text = translateServerError(field, message);
    const key = field === 'password' && /confirmation/i.test(message) ? 'confirm' : field;
    out[key] = text;
  }
  return out;
};

export default function RegisterPage() {
  useSeo({ title: 'Tạo tài khoản', description: 'Tạo tài khoản A51 để bắt đầu biến ảnh sản phẩm thành ảnh chuyên nghiệp.', noindex: true });
  const { isAuthenticated, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', agree: false });
  // Chỉ hiện lỗi của ô sau khi người dùng đã rời ô đó hoặc bấm Đăng ký
  const [touched, setTouched] = useState({});
  // Lỗi theo từng ô do backend trả về (422), xoá khi người dùng sửa ô đó
  const [serverErrors, setServerErrors] = useState({});

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: () => navigate(redirect, { replace: true }),
    onError: (err) => setServerErrors(mapServerErrors(err.errors)),
  });

  if (isAuthenticated && !mutation.isPending && !mutation.isSuccess) {
    return <Navigate to={redirect} replace />;
  }

  const errors = validate(form);
  const shown = (key) => (touched[key] ? errors[key] : undefined) ?? serverErrors[key];

  const field = (key) => ({
    value: form[key],
    onChange: (e) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setServerErrors(({ [key]: _, ...rest }) => rest);
    },
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
    error: shown(key),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirm: true, agree: true });
    if (Object.keys(errors).length > 0) return;
    setServerErrors({});
    mutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      passwordConfirmation: form.confirm,
    });
  };

  // Lỗi đã hiện dưới từng ô thì không lặp lại câu tiếng Anh tổng hợp của Laravel
  const generalError = mutation.error && !mutation.error.errors ? mutation.error.message : null;

  return (
    <AuthShell
      title="Tạo tài khoản A51"
      subtitle="Tạo tài khoản để bắt đầu biến ảnh sản phẩm thành ảnh chuyên nghiệp."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-bold text-primary hover:underline">
            Đăng nhập
          </Link>
        </>
      }
    >
      <div className="mt-8">
        <GoogleSignInButton redirect={redirect} prominent />
      </div>
      <AuthDivider label="hoặc đăng ký bằng email" />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <TextField label="Họ và tên" icon="person" autoComplete="name" placeholder="Nguyễn Văn A" {...field('name')} />
        <TextField
          label="Email"
          icon="mail"
          type="email"
          autoComplete="email"
          placeholder="ban@email.com"
          {...field('email')}
        />
        <TextField
          label="Mật khẩu"
          icon="lock"
          type="password"
          autoComplete="new-password"
          placeholder={`Ít nhất ${MIN_PASSWORD} ký tự`}
          {...field('password')}
        />
        <TextField
          label="Nhập lại mật khẩu"
          icon="lock_reset"
          type="password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          {...field('confirm')}
        />

        <div>
          <label className="flex items-start gap-2.5 text-xs text-on-surface-variant">
            <input
              type="checkbox"
              checked={form.agree}
              onChange={(e) => {
                setForm((f) => ({ ...f, agree: e.target.checked }));
                setTouched((t) => ({ ...t, agree: true }));
              }}
              className="mt-0.5 size-4 rounded border-outline-variant text-primary-container focus:ring-primary-container/30"
            />
            {/* Link mở tab mới để không mất dữ liệu đang nhập */}
            <span>
              Tôi đồng ý với{' '}
              <Link to="/terms" target="_blank" rel="noopener" className="font-semibold text-primary hover:underline">
                Điều khoản sử dụng
              </Link>{' '}
              và{' '}
              <Link to="/privacy" target="_blank" rel="noopener" className="font-semibold text-primary hover:underline">
                Chính sách quyền riêng tư
              </Link> của A51.
            </span>
          </label>
          {shown('agree') && <p className="mt-1 text-xs text-error">{errors.agree}</p>}
        </div>

        {generalError && <FormAlert>{generalError}</FormAlert>}

        <SubmitButton loading={mutation.isPending} loadingText="Đang tạo tài khoản...">
          Đăng ký
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
