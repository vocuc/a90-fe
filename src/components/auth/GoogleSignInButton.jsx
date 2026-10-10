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
export default function GoogleSignInButton({ redirect, prominent = false }) {
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
          theme: prominent ? 'filled_blue' : 'outline',
          shape: prominent ? 'pill' : 'rectangular',
          size: 'large',
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
  }, [prominent]);

  if (!GOOGLE_SIGN_IN_ENABLED) return null;

  const error = sdkError ?? mutation.error;

  return (
    <div
      className={
        prominent
          ? 'space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-md shadow-primary/10'
          : 'space-y-3'
      }
    >
      {prominent && (
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary">
          <Icon name="bolt" fill className="text-base" />
          Nhanh nhất · chỉ một chạm
        </p>
      )}
      <div className="relative">
        {MOCK_AUTH && !GOOGLE_CLIENT_ID ? (
          <button
            type="button"
            onClick={() => mutation.mutate({ idToken: 'mock-google-id-token' })}
            className={
              prominent
                ? 'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a73e8] text-sm font-bold text-white shadow-md hover:bg-[#1765cc]'
                : 'flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-outline-variant bg-white text-sm font-semibold text-on-surface hover:bg-surface-container-low'
            }
          >
            Tiếp tục với Google (mock)
          </button>
        ) : (
          <div ref={containerRef} className="flex min-h-11 w-full justify-center" />
        )}

        {mutation.isPending && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-surface/80 text-sm font-semibold text-on-surface">
            <Icon name="progress_activity" className="animate-spin text-lg" />
            Đang đăng nhập...
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
