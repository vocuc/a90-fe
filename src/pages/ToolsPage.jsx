import useSeo from '../hooks/useSeo';
import { Link } from 'react-router-dom';
import Icon from '../components/common/Icon';
import LayoutThumb from '../components/tools/LayoutThumb';
import { TOOLS } from '../components/tools/tools';

export default function ToolsPage() {
  useSeo({
    title: 'Công cụ chỉnh ảnh',
    description: 'Công cụ miễn phí trên A51: ghép 2, 3, 4 ảnh, ghép 1 ảnh dọc 2 ảnh ngang, chèn logo và chữ chìm. Xử lý ngay trên trình duyệt.',
  });

  return (
    <>
      <header className="sticky top-[60px] z-30 border-b border-surface-container bg-surface-container-lowest/90 px-4 py-3 backdrop-blur-md">
        <h1 className="text-lg font-bold text-on-surface">Công cụ</h1>
        <p className="text-xs text-on-surface-variant">Ghép ảnh, chèn logo ngay trên trình duyệt</p>
      </header>

      <section className="grid grid-cols-2 gap-3 p-4">
        {TOOLS.map((t) => (
          <Link
            key={t.slug}
            to={`/tools/${t.slug}`}
            className="group flex flex-col gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-3 transition-all hover:border-primary-container active:scale-[0.98]"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-surface-container text-primary transition-colors group-hover:bg-primary-container group-hover:text-on-primary">
              {t.type === 'collage' ? (
                <LayoutThumb tool={t} className="size-7" />
              ) : (
                <Icon name={t.icon} className="text-[26px]" />
              )}
            </span>
            <span>
              <span className="block text-sm font-bold text-on-surface">{t.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-on-surface-variant">{t.description}</span>
            </span>
          </Link>
        ))}
      </section>
    </>
  );
}
