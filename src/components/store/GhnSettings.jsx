import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../common/Icon';
import { Skeleton, ErrorState } from '../common/Feedback';
import { FormAlert, SubmitButton, TextField } from '../common/Form';
import { getGhnSettings, saveGhnSettings } from '../../api/shipping';

export const GHN_SETTINGS_KEY = ['shipping', 'ghn-settings'];

/**
 * Kết nối GHN của shop: Token + ShopId (lấy ở trang tài khoản GHN). Backend gọi thử GHN rồi mới lưu,
 * token không bao giờ trả về FE (chỉ 4 ký tự cuối). Địa chỉ lấy hàng: địa chỉ đã đăng ký của ShopId bên GHN.
 */
export default function GhnSettings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading, error, refetch } = useQuery({ queryKey: GHN_SETTINGS_KEY, queryFn: getGhnSettings });
  const [editing, setEditing] = useState(false);
  const [token, setToken] = useState('');
  const [shopId, setShopId] = useState('');
  const [errors, setErrors] = useState({});

  const mutation = useMutation({
    mutationFn: saveGhnSettings,
    onSuccess: (s) => {
      queryClient.setQueryData(GHN_SETTINGS_KEY, s);
      setEditing(false);
      setToken('');
    },
    onError: (err) => setErrors({ token: err.errors?.token, shopId: err.errors?.shop_id }),
  });

  if (isLoading) return <Skeleton className="h-28 w-full" />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const connected = settings.hasToken && settings.shopId;
  const startEdit = () => {
    setShopId(settings.shopId ? String(settings.shopId) : '');
    setErrors({});
    mutation.reset();
    setEditing(true);
  };

  if (connected && !editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          <Icon name="check_circle" fill className="text-lg" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Đã kết nối GHN</p>
            <p>
              ShopId <b>{settings.shopId}</b> · Token ••••{settings.tokenLast4}
            </p>
          </div>
          <button type="button" onClick={startEdit} className="shrink-0 font-bold text-primary hover:underline">
            Đổi
          </button>
        </div>
        <Link
          to="/shipping-orders/new"
          className="flex h-10 w-full items-center justify-center gap-1 rounded-xl border border-outline-variant/50 text-sm font-bold text-on-surface hover:border-primary-container"
        >
          <Icon name="local_shipping" className="text-lg text-primary" />
          Tạo đơn GHN từ ảnh
        </Link>
      </div>
    );
  }

  const onSubmit = (e) => {
    e.preventDefault();
    const next = {
      token: token.trim() ? undefined : 'Vui lòng nhập Token GHN.',
      shopId: /^\d+$/.test(shopId.trim()) ? undefined : 'ShopId là một dãy số.',
    };
    setErrors(next);
    if (next.token || next.shopId) return;
    mutation.mutate({ token: token.trim(), shopId: Number(shopId.trim()) });
  };

  const generalError = mutation.error && !mutation.error.errors ? mutation.error.message : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <TextField
        label="Token GHN *"
        icon="key"
        type="password"
        autoComplete="off"
        value={token}
        onChange={(e) => {
          setToken(e.target.value);
          setErrors((er) => ({ ...er, token: undefined }));
        }}
        error={errors.token}
        hint="Token và ShopId có trong phần thông tin tài khoản GHN của bạn."
      />
      <TextField
        label="ShopId *"
        icon="store"
        inputMode="numeric"
        value={shopId}
        onChange={(e) => {
          setShopId(e.target.value.replace(/\D/g, ''));
          setErrors((er) => ({ ...er, shopId: undefined }));
        }}
        error={errors.shopId}
        hint="Địa chỉ lấy hàng là địa chỉ đã đăng ký của shop này bên GHN."
      />
      {generalError && <FormAlert>{generalError}</FormAlert>}
      <div className="flex gap-2">
        {connected && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-12 rounded-xl border border-outline-variant/50 px-4 text-sm font-bold text-on-surface hover:bg-surface-container"
          >
            Huỷ
          </button>
        )}
        <SubmitButton loading={mutation.isPending} loadingText="Đang kiểm tra...">
          Kết nối GHN
        </SubmitButton>
      </div>
    </form>
  );
}
