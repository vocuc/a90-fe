import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Icon from '../common/Icon';
import { useConfirm } from '../common/ConfirmDialog';
import { PLANNER_TOKEN_KEY, createPlannerToken, getPlannerToken } from '../../api/planner';

const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'chưa dùng';

/**
 * Trang Tài khoản: "Tạo token kế hoạch" cho skill kế hoạch nội dung (src/api/planner.js). Token chỉ hiện 1 lần ngay sau
 * khi tạo; tạo lại thì token cũ hết hiệu lực.
 */
export default function PlannerTokenCard() {
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const { data } = useQuery({ queryKey: PLANNER_TOKEN_KEY, queryFn: getPlannerToken });
  const [token, setToken] = useState(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: createPlannerToken,
    onSuccess: (res) => {
      setToken(res.token);
      setCopied(false);
      queryClient.invalidateQueries({ queryKey: PLANNER_TOKEN_KEY });
    },
  });

  const onCreate = async () => {
    if (data?.exists) {
      const ok = await confirm('Tạo token mới? Token kế hoạch cũ sẽ hết hiệu lực ngay, phải cập nhật lại trong .env của skill.', {
        confirmLabel: 'Tạo token mới',
        danger: true,
      });
      if (!ok) return;
    }
    create.mutate();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
      <div className="flex items-start gap-3">
        <Icon name="key" className="text-xl text-outline" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-on-surface">Token kế hoạch nội dung</p>
          <p className="text-xs text-on-surface-variant">
            Dán vào <code>A51_TOKEN</code> trong .env của skill kế hoạch nội dung. Token chỉ gọi được API kế hoạch.{' '}
            <Link to="/plan-contexts" className="font-semibold text-primary hover:underline">
              Quản lý bối cảnh
            </Link>
          </p>
          {data?.exists && (
            <p className="mt-1 text-[11px] text-outline">
              Đã tạo {formatTime(data.createdAt)} · Lần dùng gần nhất: {formatTime(data.lastUsedAt)}
            </p>
          )}
        </div>
      </div>

      {token && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Chép token ngay: token chỉ hiện một lần này.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-2 py-1.5 font-mono text-[11px] text-on-surface">{token}</code>
            <button
              type="button"
              onClick={copy}
              className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-3 font-bold text-white hover:bg-amber-700"
            >
              <Icon name={copied ? 'check' : 'content_copy'} className="text-base" />
              {copied ? 'Đã chép' : 'Chép'}
            </button>
          </div>
        </div>
      )}

      {create.error && <p className="text-xs text-error">{create.error.message}</p>}

      <button
        type="button"
        onClick={onCreate}
        disabled={create.isPending}
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-primary text-sm font-bold text-primary hover:bg-primary-fixed/30 disabled:opacity-50"
      >
        <Icon name={create.isPending ? 'progress_activity' : 'add_link'} className={`text-lg ${create.isPending ? 'animate-spin' : ''}`} />
        {data?.exists ? 'Tạo lại token kế hoạch' : 'Tạo token kế hoạch'}
      </button>
    </section>
  );
}
