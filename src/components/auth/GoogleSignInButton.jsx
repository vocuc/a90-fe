import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MOCK_AUTH } from '../../api/client';
import { GOOGLE_CLIENT_ID, GOOGLE_SIGN_IN_ENABLED, loadGoogleSdk } from '../../api/googleAuth';
import { FormAlert } from '../common/Form';
import Icon from '../common/Icon';

// Nút chính chủ của Google chỉ nhận chiều rộng 200-400px
const buttonWidth = (el) => Math.min(400, Math.max(200, Math.floor(el.offsetWidth)));

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

// Dùng chung cho trang đăng nhập và đăng ký (lần đầu backend tự tạo tài khoản)
export default function GoogleSignInButton({ redirect }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [sdkError, setSdkError] = useState(null);
  const useMock = MOCK_AUTH && !GOOGLE_CLIENT_ID;

  const mutation = useMutation({
    mutationFn: loginWithGoogle,
    onSuccess: () => navigate(redirect, { replace: true }),
  });

  // Callback của Google được đăng ký một lần -> luôn gọi mutate mới nhất qua ref
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    let cancelled = false;

    loadGoogleSdk()
      .then((gis) => {
        if (cancelled || !containerRef.current) return;
        gis.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => mutateRef.current({ idToken: credential }),
          ux_mode: 'popup',
          context: 'signin',
        });
        gis.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          locale: 'vi',
          width: buttonWidth(containerRef.current),
        });
      })
      .catch((err) => !cancelled && setSdkError(err));

    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_SIGN_IN_ENABLED) return null;

  const error = sdkError ?? mutation.error;

  return (
    <div className="space-y-3">
      <div className="group relative h-12 w-full overflow-hidden rounded-xl border-2 border-outline-variant bg-white shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary-container/40 hover:border-primary-container hover:shadow-md active:scale-[0.98]">
        {/* Giao diện nút tự vẽ; cú bấm thật do nút Google trong suốt phủ bên trên nhận */}
        <div className="pointer-events-none flex h-full items-center justify-center gap-3 text-sm font-bold text-on-surface">
          {mutation.isPending ? (
            <>
              <Icon name="progress_activity" className="animate-spin text-lg" />
              Đang đăng nhập...
            </>
          ) : (
            <>
              <GoogleLogo />
              Tiếp tục với Google
            </>
          )}
        </div>

        {useMock ? (
          <button
            type="button"
            aria-label="Tiếp tục với Google (mock)"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ idToken: 'mock-google-id-token' })}
            className="absolute inset-0 focus:outline-none"
          />
        ) : (
          // Nút của Google tối đa 400x40px -> phóng to để phủ kín cả nút
          <div
            className={`absolute inset-0 flex scale-150 items-center justify-center opacity-[0.01] ${
              mutation.isPending ? 'pointer-events-none' : ''
            }`}
          >
            <div ref={containerRef} className="w-full" />
          </div>
        )}
      </div>
      {error && <FormAlert>{error.message}</FormAlert>}
    </div>
  );
}

export function AuthDivider({ label = 'hoặc' }) {
  if (!GOOGLE_SIGN_IN_ENABLED) return null;
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-outline">
      <span className="h-px flex-1 bg-outline-variant/50" />
      {label}
      <span className="h-px flex-1 bg-outline-variant/50" />
    </div>
  );
}
