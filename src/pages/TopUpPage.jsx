import { useState } from 'react';
import { Link } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { Skeleton } from '../components/common/Feedback';
import { useMe } from '../hooks/queries';
import { formatVnd } from '../utils/format';
import { BANK, ZALO_LINK, ZALO_QR } from '../utils/contact';

// Dòng thông tin chuyển khoản kèm nút sao chép
function CopyRow({ label, value, loading }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Trình duyệt chặn clipboard: người dùng tự chép tay
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-24 shrink-0 text-sm text-on-surface-variant">{label}</span>
      {loading ? (
        <Skeleton className="h-4 flex-1" />
      ) : (
        <span className="min-w-0 flex-1 break-all text-sm font-semibold text-on-surface">{value}</span>
      )}
      <button
        type="button"
        onClick={copy}
        disabled={loading}
        aria-label={`Sao chép ${label.toLowerCase()}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface-container disabled:opacity-50"
      >
        <Icon name={copied ? 'check' : 'content_copy'} className="text-lg" />
      </button>
    </div>
  );
}

function Step({ number, title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-on-primary">{number}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** /account/topup: hướng dẫn nạp ví bằng chuyển khoản rồi gửi bill cho admin qua Zalo. */
export default function TopUpPage() {
  useSeo({ title: 'Nạp tiền vào ví', noindex: true });
  const { data: me, isLoading } = useMe();
  // Nội dung chuyển khoản cố định; admin đối chiếu tài khoản qua email gửi kèm bill ở bước 2
  const transferNote = 'Nap tien A51';

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <Link
          to="/account"
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </Link>
        <h1 className="text-base font-bold text-on-surface">Nạp tiền vào ví</h1>
      </header>

      <div className="space-y-6 p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-primary-fixed/40 p-4">
          <Icon name="account_balance_wallet" className="text-2xl text-primary" />
          <span className="flex-1 text-sm text-on-surface-variant">Số dư hiện tại</span>
          {isLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <span className="text-base font-bold text-primary">{formatVnd(me?.credits)}</span>
          )}
        </div>

        <Step number={1} title="Chuyển khoản vào tài khoản ngân hàng">
          <p className="text-sm text-on-surface-variant">
            Chuyển khoản theo thông tin bên dưới. Nhớ ghi đúng nội dung chuyển khoản để được cộng tiền nhanh.
          </p>
          <div className="w-full divide-y divide-surface-container overflow-hidden rounded-2xl border border-outline-variant/40">
            <CopyRow label="Ngân hàng" value={BANK.name} />
            <CopyRow label="Số tài khoản" value={BANK.accountNumber} />
            <CopyRow label="Chủ tài khoản" value={BANK.accountName} />
            <CopyRow label="Nội dung" value={transferNote} />
          </div>
        </Step>

        <Step number={2} title="Liên hệ admin để dùng thử miễn phí">
          <p className="text-sm text-on-surface-variant">
            Chụp màn hình giao dịch thành công và gửi cho admin qua Zalo kèm email tài khoản. Số dư sẽ được cộng sau khi admin xác nhận.
          </p>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant/40 p-4 lg:flex-row lg:items-start">
            <a href={ZALO_QR} target="_blank" rel="noopener" className="shrink-0" aria-label="Mở ảnh mã QR Zalo">
              <img src={ZALO_QR} alt="Mã QR Zalo admin A51" loading="lazy" className="w-44 rounded-xl" />
            </a>
            <div className="w-full space-y-3 text-center lg:text-left">
              <p className="text-sm text-on-surface-variant">
                Mở ứng dụng Zalo, chọn quét mã QR để kết bạn với admin, hoặc liên hệ trực tiếp với admin để nạp tiền qua đường dẫn bên dưới.
              </p>
              <a
                href={ZALO_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
              >
                <Icon name="chat" className="text-lg" />
                Liên hệ admin qua Zalo
              </a>
              <p className="break-all text-xs text-outline">{ZALO_LINK}</p>
            </div>
          </div>
        </Step>

        <p className="flex items-start gap-2 rounded-2xl bg-surface-container-low p-4 text-xs leading-relaxed text-on-surface-variant">
          <Icon name="info" className="text-base text-primary" />
          <span>
            Chỉ chuyển khoản vào đúng tài khoản trên. Nếu sau khi gửi bill mà số dư chưa được cộng, hãy nhắn lại cho admin qua Zalo hoặc xem thêm tại{' '}
            <Link to="/support" className="font-semibold text-primary hover:underline">
              Trung tâm hỗ trợ
            </Link>
            .
          </span>
        </p>
      </div>
    </>
  );
}
