import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useSeo, { SITE_NAME } from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { EmptyState } from '../components/common/Feedback';
import { CONTACT_EMAIL } from '../components/legal/LegalPage';
import { ZALO_QR } from '../utils/contact';

// Mỗi nhóm: { id, icon, title, faqs: [[câu hỏi, câu trả lời]] }
const TOPICS = [
  {
    id: 'bat-dau',
    icon: 'rocket_launch',
    title: 'Bắt đầu',
    faqs: [
      [`${SITE_NAME} là gì?`, `${SITE_NAME} là nền tảng tạo hình ảnh bằng AI. Bạn tải ảnh sản phẩm lên, chọn một mẫu AI Creative và nhận ảnh kết quả do AI tạo ra. Người bán cũng có thể đăng mẫu của mình để bán lượt tạo ảnh.`],
      ['Làm sao để tạo tài khoản?', 'Nhấn "Đăng nhập" ở góc trên, sau đó chọn đăng ký bằng email hoặc đăng nhập nhanh bằng tài khoản Google.'],
      ['Tôi quên mật khẩu thì làm thế nào?', `Nếu bạn đăng nhập bằng Google, hãy tiếp tục dùng nút "Đăng nhập với Google". Với tài khoản email, vui lòng gửi yêu cầu tới ${CONTACT_EMAIL} để được hỗ trợ lấy lại quyền truy cập.`],
    ],
  },
  {
    id: 'tao-anh',
    icon: 'auto_awesome',
    title: 'Tạo ảnh bằng AI',
    faqs: [
      ['Quy trình tạo ảnh như thế nào?', 'Vào Khám phá hoặc trang chủ, chọn một mẫu AI Creative, tải ảnh sản phẩm lên, điền các thông tin mẫu yêu cầu rồi xác nhận. Giá mỗi lượt tạo được hiển thị trước khi bạn xác nhận.'],
      ['Ảnh tải lên cần đạt yêu cầu gì?', 'Nên dùng ảnh rõ nét, đủ sáng, sản phẩm nằm trọn trong khung và ít chi tiết thừa ở nền. Ảnh càng rõ thì kết quả càng sát với sản phẩm thật.'],
      ['Xem lại và tải ảnh đã tạo ở đâu?', 'Vào Tài khoản → Lịch sử mua hàng. Tại đây bạn có thể xem lại các lượt tạo và tải ảnh kết quả.'],
      ['Kết quả không giống như mong đợi?', 'Ảnh do AI tạo có thể khác nhau giữa các lần. Hãy thử ảnh gốc rõ hơn hoặc chọn mẫu khác phù hợp hơn với loại sản phẩm. Kiểm tra kỹ ảnh trước khi dùng cho quảng cáo.'],
    ],
  },
  {
    id: 'thanh-toan',
    icon: 'account_balance_wallet',
    title: 'Ví và thanh toán',
    faqs: [
      ['Làm sao để nạp tiền vào ví?', 'Vào Tài khoản và nhấn nút "Nạp ví" để xem hướng dẫn nạp tiền.'],
      ['Lượt tạo bị lỗi có được hoàn tiền không?', 'Lượt tạo thất bại do lỗi hệ thống có thể được tạo lại hoặc hoàn vào số dư. Lượt tạo bị từ chối do vi phạm chính sách nội dung có thể không được hoàn tiền.'],
      ['Tôi có rút số dư ra tiền mặt được không?', 'Số dư không quy đổi thành tiền mặt và không chuyển sang tài khoản khác, trừ khi pháp luật có quy định khác.'],
      ['Đã nạp tiền nhưng số dư chưa cập nhật?', `Hãy tải lại trang sau vài phút. Nếu vẫn chưa thấy, gửi email tới ${CONTACT_EMAIL} kèm email tài khoản, thời gian và ảnh chụp giao dịch để chúng tôi kiểm tra.`],
    ],
  },
  {
    id: 'nguoi-ban',
    icon: 'storefront',
    title: 'Dành cho người bán',
    faqs: [
      ['Làm sao để mở cửa hàng?', 'Vào Tài khoản → Quản lý cửa hàng, điền tên cửa hàng, ảnh đại diện và ảnh bìa. Sau khi tạo cửa hàng, mục Quản lý Creative sẽ được mở khoá.'],
      ['Làm sao để đăng mẫu AI Creative?', 'Vào Tài khoản → Quản lý Creative → tạo Creative mới. Trình tạo mẫu cho phép bạn soạn prompt, thiết kế biểu mẫu cho người mua và tải ảnh minh hoạ.'],
      ['Mẫu của tôi có bị kiểm duyệt không?', 'Có. Mẫu phải do bạn tự tạo hoặc có quyền phân phối hợp pháp, ảnh minh hoạ phải phản ánh đúng kết quả. Mẫu vi phạm có thể bị ẩn hoặc gỡ.'],
    ],
  },
  {
    id: 'tai-khoan',
    icon: 'manage_accounts',
    title: 'Tài khoản và bảo mật',
    faqs: [
      ['Tài khoản bị truy cập trái phép?', `Đổi mật khẩu (nếu dùng email), đăng xuất khỏi các thiết bị lạ và báo ngay cho chúng tôi qua ${CONTACT_EMAIL}.`],
      ['Làm sao để xoá tài khoản?', `Gửi yêu cầu xoá tài khoản từ email đăng ký tới ${CONTACT_EMAIL}. Dữ liệu cá nhân sẽ được xoá hoặc ẩn danh, trừ thông tin giao dịch cần lưu theo quy định pháp luật.`],
      ['Ảnh tôi tải lên có bị công khai không?', 'Không. Ảnh bạn tải lên và ảnh kết quả chỉ mình bạn xem được. Xem chi tiết trong Chính sách quyền riêng tư.'],
    ],
  },
];

// Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu
const normalize = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

function FaqItem({ question, answer }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-container-low [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-sm font-semibold text-on-surface">{question}</span>
        <Icon name="expand_more" className="text-xl text-outline transition-transform group-open:rotate-180" />
      </summary>
      <p className="px-4 pb-4 text-sm leading-relaxed text-on-surface-variant">{answer}</p>
    </details>
  );
}

/** /support: câu hỏi thường gặp theo chủ đề, tìm kiếm và kênh liên hệ. */
export default function SupportPage() {
  useSeo({
    title: 'Trung tâm hỗ trợ',
    description: `Câu hỏi thường gặp và kênh liên hệ hỗ trợ của ${SITE_NAME}: tạo ảnh bằng AI, ví và thanh toán, người bán, tài khoản.`,
    canonical: '/support',
  });
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Vào thẳng trang (không có lịch sử) thì quay về trang chủ
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));

  const topics = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return TOPICS;
    return TOPICS.map((t) => ({ ...t, faqs: t.faqs.filter(([qs, a]) => normalize(`${qs} ${a}`).includes(q)) })).filter(
      (t) => t.faqs.length > 0,
    );
  }, [query]);

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={goBack}
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </button>
        <h1 className="text-base font-bold text-on-surface">Trung tâm hỗ trợ</h1>
      </header>

      <div className="space-y-6 p-4">
        <section className="space-y-3 rounded-2xl bg-primary-fixed/40 p-4">
          <div className="flex items-start gap-3">
            <Icon name="support_agent" className="text-2xl text-primary" />
            <div>
              <h2 className="text-base font-bold text-on-surface">Chúng tôi có thể giúp gì cho bạn?</h2>
              <p className="text-sm text-on-surface-variant">Tìm nhanh câu trả lời hoặc liên hệ trực tiếp với đội ngũ hỗ trợ.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 focus-within:border-primary">
            <Icon name="search" className="text-xl text-outline" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập câu hỏi, ví dụ: hoàn tiền, nạp ví..."
              className="h-11 flex-1 border-0 bg-transparent p-0 text-sm text-on-surface placeholder:text-outline focus:ring-0"
            />
          </label>
        </section>

        {!query && (
          <nav aria-label="Chủ đề" className="grid grid-cols-2 gap-3">
            {TOPICS.map(({ id, icon, title }) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex flex-col items-center gap-2 rounded-2xl border border-outline-variant/40 p-3 text-center transition-colors hover:bg-surface-container-low"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary">
                  <Icon name={icon} className="text-xl" />
                </span>
                <span className="text-xs font-semibold text-on-surface">{title}</span>
              </a>
            ))}
          </nav>
        )}

        {topics.length === 0 ? (
          <EmptyState message={`Không tìm thấy câu hỏi nào khớp với "${query}".`}>
            <button type="button" onClick={() => setQuery('')} className="text-xs font-bold text-primary hover:underline">
              Xoá tìm kiếm
            </button>
          </EmptyState>
        ) : (
          topics.map(({ id, icon, title, faqs }) => (
            <section key={id} id={id} className="scroll-mt-32 space-y-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-on-surface">
                <Icon name={icon} className="text-xl text-primary" />
                {title}
              </h2>
              <div className="divide-y divide-surface-container overflow-hidden rounded-2xl border border-outline-variant/40">
                {faqs.map(([q, a]) => (
                  <FaqItem key={q} question={q} answer={a} />
                ))}
              </div>
            </section>
          ))
        )}

        <section className="space-y-2">
          <h2 className="text-base font-bold text-on-surface">Vẫn cần trợ giúp?</h2>
          <p className="text-sm text-on-surface-variant">
            Nhắn tin qua Zalo hoặc gửi email mô tả vấn đề, kèm email tài khoản và ảnh chụp màn hình (nếu có). Chúng tôi sẽ phản hồi trong vòng 72 giờ làm việc.
          </p>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant/40 p-4 sm:flex-row sm:items-start">
            <a href={ZALO_QR} target="_blank" rel="noopener" className="shrink-0" aria-label="Mở ảnh mã QR Zalo">
              <img src={ZALO_QR} alt="Mã QR Zalo hỗ trợ A51" loading="lazy" className="w-44 rounded-xl" />
            </a>
            <div className="space-y-1 text-center sm:text-left">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-on-surface sm:justify-start">
                <Icon name="chat" className="text-xl text-primary" />
                Hỗ trợ qua Zalo
              </p>
              <p className="text-sm text-on-surface-variant">
                Mở ứng dụng Zalo, chọn quét mã QR và quét mã bên cạnh để nhắn tin trực tiếp với đội ngũ hỗ trợ.
              </p>
            </div>
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-center gap-3 rounded-2xl border border-outline-variant/40 p-4 transition-colors hover:bg-surface-container-low"
          >
            <Icon name="mail" className="text-xl text-primary" />
            <span className="flex-1 text-sm font-semibold text-on-surface">{CONTACT_EMAIL}</span>
            <Icon name="chevron_right" className="text-xl text-outline" />
          </a>
        </section>

        <p className="flex justify-center gap-3 border-t border-surface-container pt-4 text-xs text-outline">
          <Link to="/terms" className="hover:text-primary">
            Điều khoản sử dụng
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/privacy" className="hover:text-primary">
            Chính sách quyền riêng tư
          </Link>
        </p>
      </div>
    </>
  );
}
