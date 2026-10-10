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

// Dùng chung cho trang đăng nhập và đăng ký (lần đầu backend tự tạo tài khoản)
export default function GoogleSignInButton({ redirect }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [sdkError, setSdkError] = useState(null);

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
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'center',
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
      <div className="relative">
        {MOCK_AUTH && !GOOGLE_CLIENT_ID ? (
          <button
            type="button"
            onClick={() => mutation.mutate({ idToken: 'mock-google-id-token' })}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-outline-variant bg-white text-sm font-semibold text-on-surface hover:bg-surface-container-low"
          >
            Tiếp tục với Google (mock)
          </button>
        ) : (
          <div ref={containerRef} className="flex min-h-11 w-full justify-center" />
        )}

        {mutation.isPending && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-surface/80 text-sm font-semibold text-on-surface">
            <Icon name="progress_activity" className="animate-spin text-lg" />
            Đang đăng nhập...
          </div>
        )}
      </div>
      {error && <FormAlert>{error.message}</FormAlert>}
    </div>
  );
}

export function AuthDivider() {
  if (!GOOGLE_SIGN_IN_ENABLED) return null;
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-outline">
      <span className="h-px flex-1 bg-outline-variant/50" />
      hoặc
      <span className="h-px flex-1 bg-outline-variant/50" />
    </div>
  );
}
