import { Link } from 'react-router-dom';
import Icon from '../common/Icon';

export default function CreatorBanner() {
  return (
    <section className="mb-4 px-4 py-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-container via-primary to-secondary p-5 text-on-primary shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-surface-container-lowest/10 blur-xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 size-32 rounded-full bg-surface-container-lowest/10 blur-lg" />
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-surface-container-lowest/20 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
            <Icon name="monetization_on" className="text-sm" />
            Dành cho Nhà Sáng Tạo
          </div>
          <h3 className="mb-2 text-xl font-extrabold leading-snug tracking-tight">Tạo AI Creative của riêng bạn</h3>
          <p className="mb-4 text-xs leading-relaxed text-on-primary/90">
            Biến prompt và workflow AI của bạn thành một Creative và kiếm tiền từ mỗi lượt sử dụng.
          </p>
          <Link
            to="/seller"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-surface-container-lowest px-4 text-sm font-bold text-primary shadow transition-all hover:bg-surface-bright active:scale-[0.98]"
          >
            <Icon name="rocket_launch" className="text-lg" />
            Bắt đầu tạo AI Creative
          </Link>
        </div>
      </div>
    </section>
  );
}
