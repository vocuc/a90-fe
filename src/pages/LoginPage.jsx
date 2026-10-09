import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AuthShell, FormAlert, SubmitButton, TextField, safeRedirect } from '../components/auth/AuthForm';
import { useAuth } from '../context/AuthContext';
import { MOCK_AUTH } from '../api/client';
import { demoAccount } from '../api/mock/data';

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => navigate(redirect, { replace: true }),
  });

  if (isAuthenticated && !mutation.isPending && !mutation.isSuccess) {
    return <Navigate to={redirect} replace />;
  }

  const onSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({ email: email.trim(), password });
  };

  return (
    <AuthShell
      title="Đăng nhập A51"
      subtitle="Tiếp tục tạo hình ảnh chuyên nghiệp bằng AI."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to={`/register?redirect=${encodeURIComponent(redirect)}`} className="font-bold text-primary hover:underline">
            Đăng ký ngay
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <TextField
          label="Email"
          icon="mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ban@email.com"
        />
        <TextField
          label="Mật khẩu"
          icon="lock"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nhập mật khẩu"
        />

        {mutation.error && <FormAlert>{mutation.error.message}</FormAlert>}

        <SubmitButton
          loading={mutation.isPending}
          loadingText="Đang đăng nhập..."
          disabled={!email.trim() || !password}
        >
          Đăng nhập
        </SubmitButton>
      </form>

      {MOCK_AUTH && (
        <div className="mt-6 rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-3 text-xs text-on-surface-variant">
          <p className="mb-1 font-semibold text-on-surface">Tài khoản dùng thử (chế độ mock)</p>
          <p>
            Email: <b>{demoAccount.email}</b> · Mật khẩu: <b>{demoAccount.password}</b>
          </p>
          <button
            type="button"
            onClick={() => {
              setEmail(demoAccount.email);
              setPassword(demoAccount.password);
            }}
            className="mt-1.5 font-bold text-primary hover:underline"
          >
            Điền sẵn
          </button>
        </div>
      )}
    </AuthShell>
  );
}
