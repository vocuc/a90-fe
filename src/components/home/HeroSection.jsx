import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../common/Icon';
import HomeBanner from './HomeBanner';

export default function HeroSection() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const onSubmit = (e) => {
    e.preventDefault();
    const kw = q.trim();
    navigate(kw ? `/explore?q=${encodeURIComponent(kw)}` : '/explore');
  };

  return (
    <section className="px-4 pb-4 pt-6">
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-surface-container px-3 py-1 text-xs font-semibold text-primary">
        <Icon name="auto_awesome" fill className="text-sm" />
        AI Studio Thế Hệ Mới
      </div>
      <h1 className="text-[28px] font-extrabold leading-[34px] tracking-tight text-on-surface">
        Tạo hình ảnh chuyên nghiệp bằng AI
      </h1>

      <HomeBanner />
      <p className="pt-2 text-[15px] leading-relaxed text-on-surface-variant">
        Khám phá hàng nghìn AI Creative và biến sản phẩm của bạn thành những hình ảnh chuyên nghiệp chỉ với vài thao
        tác.
      </p>

      <form onSubmit={onSubmit} className="pb-2 pt-4">
        <div className="flex w-full items-center rounded-xl border border-outline-variant/40 bg-surface-container-low px-3.5 py-1.5 transition-all focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20">
          <Icon name="search" className="mr-2 text-[22px] text-outline" />
          <input
            type="search"
            maxLength={100}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm kiếm AI Creative..."
            aria-label="Tìm kiếm AI Creative"
            className="w-full border-none bg-transparent p-0 text-sm font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-0"
          />
          <button
            type="submit"
            aria-label="Tìm kiếm"
            className="rounded-lg p-1 text-outline transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <Icon name="tune" className="text-lg" />
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2.5 pt-3">
        <Link
          to="/explore"
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary-container px-4 text-sm font-semibold text-on-primary shadow-md shadow-primary-container/25 transition-all hover:bg-primary active:scale-[0.98]"
        >
          <Icon name="explore" className="text-lg" />
          Khám phá AI Creative
        </Link>
        <Link
          to="/seller"
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-primary-container bg-surface-container-lowest px-4 text-sm font-semibold text-primary-container transition-all hover:bg-surface-container-low active:scale-[0.98]"
        >
          <Icon name="add_box" className="text-lg" />
          Tạo AI Creative
        </Link>
      </div>
    </section>
  );
}
