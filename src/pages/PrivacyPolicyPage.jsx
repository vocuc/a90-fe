import useSeo, { SITE_NAME } from '../hooks/useSeo';
import LegalPage, { CONTACT_EMAIL } from '../components/legal/LegalPage';

const EFFECTIVE_DATE = '10/10/2026';

// Mỗi mục: tiêu đề + danh sách đoạn văn / gạch đầu dòng
const SECTIONS = [
  {
    id: 'thu-thap',
    title: '1. Thông tin chúng tôi thu thập',
    intro: 'Chúng tôi chỉ thu thập những thông tin cần thiết để vận hành dịch vụ, bao gồm:',
    items: [
      ['Thông tin tài khoản', 'họ tên, địa chỉ email và mật khẩu (được mã hoá một chiều, chúng tôi không thể đọc được) khi bạn đăng ký.'],
      ['Thông tin từ Google', 'khi bạn đăng nhập bằng Google, chúng tôi nhận họ tên, email, ảnh đại diện và mã định danh tài khoản Google. Chúng tôi không nhận được mật khẩu Google của bạn.'],
      ['Hình ảnh bạn tải lên', 'ảnh sản phẩm bạn gửi để tạo ảnh bằng AI, cùng với các ảnh kết quả được tạo ra.'],
      ['Thông tin cửa hàng', 'nếu bạn là người bán: tên cửa hàng, ảnh đại diện, ảnh bìa, nội dung và hình ảnh các mẫu AI Creative bạn đăng.'],
      ['Lịch sử giao dịch', 'số dư, các lượt tạo ảnh đã mua, thời gian và số tiền giao dịch.'],
      ['Dữ liệu kỹ thuật', 'địa chỉ IP, loại trình duyệt, thiết bị và nhật ký truy cập phục vụ bảo mật và khắc phục lỗi.'],
    ],
  },
  {
    id: 'muc-dich',
    title: '2. Mục đích sử dụng thông tin',
    items: [
      [null, 'Tạo và quản lý tài khoản, xác thực khi bạn đăng nhập.'],
      [null, 'Xử lý ảnh bạn tải lên để tạo ảnh bằng AI theo mẫu bạn chọn và trả kết quả cho bạn.'],
      [null, 'Ghi nhận giao dịch, trừ số dư và hiển thị lịch sử mua hàng.'],
      [null, 'Hiển thị cửa hàng và sản phẩm của người bán trên sàn.'],
      [null, 'Gửi thông báo liên quan đến tài khoản và giao dịch.'],
      [null, 'Phát hiện, ngăn chặn gian lận, lạm dụng và nội dung vi phạm chính sách.'],
      [null, 'Cải thiện chất lượng dịch vụ dựa trên số liệu thống kê tổng hợp.'],
    ],
    outro: 'Chúng tôi không bán thông tin cá nhân của bạn và không dùng ảnh bạn tải lên để quảng cáo khi chưa có sự đồng ý của bạn.',
  },
  {
    id: 'chia-se',
    title: '3. Chia sẻ thông tin',
    intro: 'Thông tin của bạn chỉ được chia sẻ trong các trường hợp sau:',
    items: [
      ['Nhà cung cấp mô hình AI', 'ảnh bạn tải lên được gửi tới nhà cung cấp mô hình AI để xử lý tạo ảnh. Các đối tác này chỉ được sử dụng dữ liệu cho mục đích xử lý yêu cầu của bạn.'],
      ['Nhà cung cấp hạ tầng', 'dịch vụ lưu trữ, máy chủ, thanh toán và gửi email hỗ trợ chúng tôi vận hành hệ thống.'],
      ['Người dùng khác', 'thông tin công khai của cửa hàng (tên, ảnh đại diện, sản phẩm) được hiển thị cho mọi người trên sàn. Ảnh bạn tạo ra không được công khai.'],
      ['Cơ quan nhà nước', 'khi có yêu cầu hợp pháp theo quy định của pháp luật Việt Nam.'],
    ],
  },
  {
    id: 'luu-tru',
    title: '4. Lưu trữ và bảo mật',
    items: [
      [null, 'Dữ liệu được truyền qua kết nối mã hoá (HTTPS) và lưu trên máy chủ có kiểm soát truy cập.'],
      [null, 'Mã đăng nhập được lưu trong bộ nhớ trình duyệt (localStorage) để giữ phiên đăng nhập; bạn có thể xoá bằng cách đăng xuất.'],
      [null, 'Thông tin tài khoản được lưu trong suốt thời gian tài khoản còn hoạt động. Ảnh tải lên và ảnh kết quả được lưu để bạn tải lại trong lịch sử mua hàng.'],
      [null, 'Khi tài khoản bị xoá, dữ liệu cá nhân sẽ được xoá hoặc ẩn danh, trừ thông tin giao dịch cần lưu theo quy định pháp luật về kế toán, thuế.'],
    ],
    outro: 'Không có hệ thống nào an toàn tuyệt đối. Nếu phát hiện sự cố rò rỉ dữ liệu, chúng tôi sẽ thông báo cho bạn và cơ quan có thẩm quyền theo quy định.',
  },
  {
    id: 'quyen',
    title: '5. Quyền của bạn',
    intro: 'Theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân, bạn có quyền:',
    items: [
      [null, 'Được biết và truy cập dữ liệu cá nhân chúng tôi đang lưu về bạn.'],
      [null, 'Yêu cầu chỉnh sửa thông tin không chính xác.'],
      [null, 'Rút lại sự đồng ý và yêu cầu xoá tài khoản cùng dữ liệu cá nhân.'],
      [null, 'Yêu cầu hạn chế hoặc phản đối việc xử lý dữ liệu.'],
      [null, 'Khiếu nại nếu cho rằng quyền của mình bị xâm phạm.'],
    ],
    outro: `Để thực hiện các quyền trên, vui lòng liên hệ ${CONTACT_EMAIL}. Chúng tôi sẽ phản hồi trong vòng 72 giờ làm việc.`,
  },
  {
    id: 'tre-em',
    title: '6. Trẻ em',
    paragraphs: [
      `${SITE_NAME} không dành cho người dưới 16 tuổi. Chúng tôi không cố ý thu thập thông tin của trẻ em; nếu phát hiện, chúng tôi sẽ xoá tài khoản và dữ liệu liên quan.`,
    ],
  },
  {
    id: 'thay-doi',
    title: '7. Thay đổi chính sách',
    paragraphs: [
      'Chúng tôi có thể cập nhật chính sách này theo thời gian. Khi có thay đổi quan trọng, chúng tôi sẽ thông báo trên ứng dụng hoặc qua email. Việc bạn tiếp tục sử dụng dịch vụ sau khi chính sách được cập nhật đồng nghĩa với việc bạn chấp nhận các thay đổi đó.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  useSeo({
    title: 'Chính sách quyền riêng tư',
    description: `Chính sách quyền riêng tư của ${SITE_NAME}: thông tin chúng tôi thu thập, cách sử dụng, chia sẻ, bảo vệ dữ liệu và quyền của bạn.`,
    canonical: '/privacy',
  });

  return (
    <LegalPage
      title="Chính sách quyền riêng tư"
      icon="shield_person"
      effectiveDate={EFFECTIVE_DATE}
      intro={`${SITE_NAME} tôn trọng và cam kết bảo vệ quyền riêng tư của bạn. Chính sách này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ thông tin khi bạn sử dụng website và dịch vụ của ${SITE_NAME}.`}
      sections={SECTIONS}
    />
  );
}
