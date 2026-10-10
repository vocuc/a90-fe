import useSeo, { SITE_NAME } from '../hooks/useSeo';
import LegalPage, { CONTACT_EMAIL } from '../components/legal/LegalPage';

const EFFECTIVE_DATE = '10/10/2026';

// Mỗi mục: tiêu đề + danh sách đoạn văn / gạch đầu dòng
const SECTIONS = [
  {
    id: 'chap-nhan',
    title: '1. Chấp nhận điều khoản',
    paragraphs: [
      `Khi tạo tài khoản hoặc sử dụng ${SITE_NAME}, bạn xác nhận đã đọc, hiểu và đồng ý với Điều khoản sử dụng này cùng Chính sách quyền riêng tư. Nếu không đồng ý, vui lòng ngừng sử dụng dịch vụ.`,
      `Bạn phải đủ 16 tuổi trở lên. Nếu chưa đủ 18 tuổi, bạn cần có sự đồng ý của cha mẹ hoặc người giám hộ.`,
    ],
  },
  {
    id: 'dich-vu',
    title: '2. Mô tả dịch vụ',
    intro: `${SITE_NAME} là nền tảng tạo hình ảnh bằng AI, gồm:`,
    items: [
      ['Tạo ảnh bằng AI', 'bạn tải ảnh sản phẩm lên, chọn mẫu AI Creative và nhận ảnh kết quả do mô hình AI tạo ra.'],
      ['Sàn mẫu AI Creative', 'người bán đăng các mẫu (prompt, ảnh minh hoạ, cấu hình) để người dùng khác mua lượt tạo ảnh.'],
      ['Công cụ', 'các tiện ích hỗ trợ xử lý hình ảnh được cung cấp trên website.'],
    ],
    outro: 'Chúng tôi có thể thay đổi, bổ sung hoặc ngừng một phần dịch vụ mà không cần báo trước nếu cần thiết cho vận hành.',
  },
  {
    id: 'tai-khoan',
    title: '3. Tài khoản',
    items: [
      [null, 'Bạn cần cung cấp thông tin chính xác khi đăng ký và cập nhật khi có thay đổi.'],
      [null, 'Bạn chịu trách nhiệm giữ bí mật mật khẩu và mọi hoạt động diễn ra trên tài khoản của mình.'],
      [null, 'Mỗi người chỉ nên sử dụng một tài khoản. Không mua bán, chuyển nhượng hoặc cho mượn tài khoản.'],
      [null, `Thông báo ngay cho ${SITE_NAME} nếu phát hiện tài khoản bị truy cập trái phép.`],
    ],
  },
  {
    id: 'thanh-toan',
    title: '4. Số dư và thanh toán',
    items: [
      [null, 'Giá mỗi lượt tạo ảnh được hiển thị rõ trước khi bạn xác nhận. Số tiền sẽ được trừ vào số dư tài khoản.'],
      [null, 'Lượt tạo thất bại do lỗi hệ thống có thể được tạo lại hoặc hoàn vào số dư.'],
      [null, 'Lượt tạo bị từ chối do vi phạm chính sách nội dung có thể không được hoàn tiền.'],
      [null, 'Số dư không quy đổi thành tiền mặt và không chuyển sang tài khoản khác, trừ khi pháp luật có quy định khác.'],
    ],
  },
  {
    id: 'noi-dung',
    title: '5. Nội dung của bạn',
    items: [
      ['Quyền sở hữu', 'bạn giữ quyền đối với ảnh bạn tải lên. Bạn cam kết có đầy đủ quyền hợp pháp với ảnh đó (bản quyền, hình ảnh cá nhân, nhãn hiệu).'],
      ['Ảnh kết quả', 'bạn được sử dụng ảnh do AI tạo ra cho mục đích cá nhân và thương mại, trong phạm vi pháp luật cho phép và không vi phạm quyền của bên thứ ba.'],
      ['Quyền xử lý', `bạn cấp cho ${SITE_NAME} quyền lưu trữ, xử lý và truyền nội dung cần thiết để cung cấp dịch vụ cho bạn.`],
    ],
  },
  {
    id: 'nguoi-ban',
    title: '6. Quy định đối với người bán',
    items: [
      [null, 'Mẫu AI Creative phải do bạn tự tạo hoặc có quyền phân phối hợp pháp; ảnh minh hoạ phải phản ánh đúng kết quả mẫu tạo ra.'],
      [null, 'Thông tin cửa hàng và sản phẩm phải trung thực, không gây hiểu nhầm.'],
      [null, `Khi đăng mẫu, bạn cấp cho ${SITE_NAME} quyền hiển thị, quảng bá mẫu trên nền tảng và cho phép người mua sử dụng mẫu để tạo ảnh.`],
      [null, `${SITE_NAME} có quyền kiểm duyệt, ẩn hoặc gỡ mẫu vi phạm mà không cần báo trước.`],
    ],
  },
  {
    id: 'hanh-vi-cam',
    title: '7. Hành vi bị cấm',
    intro: 'Bạn không được sử dụng dịch vụ để:',
    items: [
      [null, 'Tạo hoặc phát tán nội dung khiêu dâm, bạo lực, thù địch, xúc phạm hoặc vi phạm pháp luật Việt Nam.'],
      [null, 'Tạo hình ảnh giả mạo người thật (deepfake) nhằm lừa đảo, bôi nhọ hoặc khi chưa có sự đồng ý của họ.'],
      [null, 'Xâm phạm bản quyền, nhãn hiệu hoặc quyền riêng tư của người khác.'],
      [null, 'Lách hoặc vô hiệu hoá bộ lọc an toàn nội dung của hệ thống.'],
      [null, 'Tấn công, dò quét, thu thập dữ liệu tự động hoặc gây quá tải hệ thống.'],
      [null, 'Gian lận thanh toán, lạm dụng chương trình khuyến mãi hoặc hoàn tiền.'],
    ],
  },
  {
    id: 'so-huu-tri-tue',
    title: '8. Sở hữu trí tuệ',
    paragraphs: [
      `Tên, logo, giao diện, mã nguồn và các nội dung do ${SITE_NAME} tạo ra thuộc quyền sở hữu của ${SITE_NAME}. Bạn không được sao chép, chỉnh sửa hoặc khai thác khi chưa có sự cho phép bằng văn bản.`,
    ],
  },
  {
    id: 'mien-tru',
    title: '9. Miễn trừ và giới hạn trách nhiệm',
    items: [
      [null, 'Ảnh do AI tạo ra có thể không chính xác hoặc không đúng hoàn toàn như mong đợi. Bạn tự chịu trách nhiệm kiểm tra trước khi sử dụng, đặc biệt cho mục đích quảng cáo.'],
      [null, 'Dịch vụ được cung cấp "nguyên trạng". Chúng tôi không đảm bảo dịch vụ luôn liên tục, không lỗi.'],
      [null, `Trong phạm vi pháp luật cho phép, trách nhiệm của ${SITE_NAME} với bạn không vượt quá số tiền bạn đã thanh toán trong 3 tháng gần nhất.`],
      [null, `${SITE_NAME} không chịu trách nhiệm về nội dung do người dùng, người bán đăng tải hoặc tạo ra.`],
    ],
  },
  {
    id: 'cham-dut',
    title: '10. Tạm khoá và chấm dứt',
    paragraphs: [
      `${SITE_NAME} có quyền tạm khoá hoặc chấm dứt tài khoản vi phạm Điều khoản này. Bạn có thể ngừng sử dụng và yêu cầu xoá tài khoản bất kỳ lúc nào qua ${CONTACT_EMAIL}.`,
    ],
  },
  {
    id: 'thay-doi',
    title: '11. Thay đổi điều khoản',
    paragraphs: [
      'Chúng tôi có thể cập nhật Điều khoản này theo thời gian. Khi có thay đổi quan trọng, chúng tôi sẽ thông báo trên ứng dụng hoặc qua email. Việc bạn tiếp tục sử dụng dịch vụ sau khi cập nhật đồng nghĩa với việc bạn chấp nhận các thay đổi đó.',
    ],
  },
  {
    id: 'luat-ap-dung',
    title: '12. Luật áp dụng',
    paragraphs: [
      'Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Tranh chấp phát sinh sẽ được ưu tiên giải quyết bằng thương lượng; nếu không thành, sẽ được giải quyết tại Toà án có thẩm quyền tại Việt Nam.',
    ],
  },
];

export default function TermsOfServicePage() {
  useSeo({
    title: 'Điều khoản sử dụng',
    description: `Điều khoản sử dụng ${SITE_NAME}: quy định về tài khoản, thanh toán, nội dung, người bán và trách nhiệm khi sử dụng dịch vụ tạo ảnh bằng AI.`,
    canonical: '/terms',
  });

  return (
    <LegalPage
      title="Điều khoản sử dụng"
      icon="gavel"
      effectiveDate={EFFECTIVE_DATE}
      intro={`Chào mừng bạn đến với ${SITE_NAME}. Vui lòng đọc kỹ các điều khoản dưới đây trước khi sử dụng website và dịch vụ của chúng tôi.`}
      sections={SECTIONS}
    />
  );
}
