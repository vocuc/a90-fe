import { Link } from 'react-router-dom';
import Icon from '../common/Icon';

// Giới thiệu các chức năng tự động hoá tạo ảnh của agent (thay cho mục "AI Creative nổi bật" / "Mới ra mắt")
const FEATURES = [
  {
    icon: 'auto_mode',
    title: 'Tạo lô tự động',
    desc: 'Chỉ cần nhập số lô, agent tự ghép sản phẩm với nhóm Creative phù hợp và tạo ảnh lần lượt cho bạn.',
    to: '/batches/auto',
    cta: 'Tạo lô tự động',
  },
  {
    icon: 'photo_library',
    title: 'Tạo ảnh hàng loạt',
    desc: 'Một sản phẩm, nhiều Creative: tạo cả lô ảnh chuyên nghiệp chỉ trong một lần bấm.',
    to: '/batches/new',
    cta: 'Tạo lô ảnh',
  },
  {
    icon: 'branding_watermark',
    title: 'Tự chèn logo shop',
    desc: 'Logo cửa hàng được chèn sẵn vào từng ảnh ngay khi tạo, không cần chỉnh sửa thủ công.',
    to: '/seller/settings',
    cta: 'Thiết lập cửa hàng',
  },
  {
    icon: 'edit_note',
    title: 'AI viết nội dung',
    desc: 'AI tự viết tiêu đề, nội dung và chọn hashtag từ kho của shop cho mỗi bài đăng.',
    to: '/seller/ai-content',
    cta: 'Cài đặt AI viết',
  },
  {
    icon: 'send',
    title: 'Tự động đăng bài',
    desc: 'Ghép ảnh vừa tạo thành bài đăng, agent đưa lên các kênh mạng xã hội của bạn.',
    to: '/posts/new',
    cta: 'Tạo bài đăng',
  },
  {
    icon: 'smart_toy',
    title: 'Worker làm việc liên tục',
    desc: 'Các worker riêng của shop nhận việc và xử lý tự động, bạn chỉ cần theo dõi kết quả.',
    to: '/seller/workers',
    cta: 'Xem worker',
  },
];

export default function AgentFeaturesSection() {
  return (
    <section className="px-4 py-4">
      <div className="mb-3.5">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-surface-container px-3 py-1 text-xs font-semibold text-primary">
          <Icon name="smart_toy" fill className="text-sm" />
          Agent tự động hoá
        </div>
        <h2 className="text-lg font-bold text-on-surface">Để agent tạo ảnh thay bạn</h2>
        <p className="text-xs text-on-surface-variant">Từ tạo ảnh hàng loạt đến đăng bài, mọi bước đều có thể tự động</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {FEATURES.map((f) => (
          <Link
            key={f.to}
            to={f.to}
            className="group flex flex-col rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 transition-all hover:border-primary-container/40 hover:shadow-md active:scale-[0.99]"
          >
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary-container/10 text-primary">
              <Icon name={f.icon} className="text-2xl" />
            </div>
            <h3 className="mb-1 text-[15px] font-bold text-on-surface">{f.title}</h3>
            <p className="mb-3 flex-1 text-xs leading-relaxed text-on-surface-variant">{f.desc}</p>
            <span className="flex items-center text-xs font-bold text-primary group-hover:underline">
              {f.cta} <Icon name="chevron_right" className="ml-0.5 text-sm" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
