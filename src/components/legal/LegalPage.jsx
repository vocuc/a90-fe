import { Link, useNavigate } from 'react-router-dom';
import Icon from '../common/Icon';
import { SITE_NAME } from '../../hooks/useSeo';

// TODO: thay bằng email hỗ trợ chính thức
export const CONTACT_EMAIL = 'support@a51.vn';

// Mỗi mục: { id, title, intro?, paragraphs?, items?: [[label|null, text]], outro? }
function Section({ id, title, intro, items, paragraphs, outro }) {
  return (
    <section id={id} className="scroll-mt-32 space-y-2">
      <h2 className="text-base font-bold text-on-surface">{title}</h2>
      {intro && <p>{intro}</p>}
      {paragraphs?.map((p) => <p key={p}>{p}</p>)}
      {items && (
        <ul className="list-disc space-y-1.5 pl-5 marker:text-primary">
          {items.map(([label, text]) => (
            <li key={text}>
              {label && <span className="font-semibold text-on-surface">{label}: </span>}
              {text}
            </li>
          ))}
        </ul>
      )}
      {outro && <p>{outro}</p>}
    </section>
  );
}

// Khung chung cho các trang pháp lý (chính sách, điều khoản); mục "Liên hệ" luôn nằm cuối
export default function LegalPage({ title, icon, intro, effectiveDate, sections }) {
  const navigate = useNavigate();
  const contactId = 'lien-he';
  const contactTitle = `${sections.length + 1}. Liên hệ`;

  // Vào thẳng trang (không có lịch sử) thì quay về trang chủ
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));

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
        <h1 className="text-base font-bold text-on-surface">{title}</h1>
      </header>

      <article className="space-y-6 p-4 text-sm leading-relaxed text-on-surface-variant">
        <div className="flex items-start gap-3 rounded-2xl bg-primary-fixed/40 p-4">
          <Icon name={icon} className="text-2xl text-primary" />
          <div className="space-y-1">
            <p>{intro}</p>
            <p className="text-xs text-outline">Có hiệu lực từ ngày {effectiveDate}</p>
          </div>
        </div>

        <nav aria-label="Mục lục" className="rounded-2xl border border-outline-variant/40 p-4">
          <p className="mb-2 font-bold text-on-surface">Mục lục</p>
          <ol className="space-y-1">
            {[...sections, { id: contactId, title: contactTitle }].map(({ id, title: t }) => (
              <li key={id}>
                <a href={`#${id}`} className="text-primary hover:underline">
                  {t}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s) => (
          <Section key={s.id} {...s} />
        ))}

        <section id={contactId} className="scroll-mt-32 space-y-2">
          <h2 className="text-base font-bold text-on-surface">{contactTitle}</h2>
          <p>Mọi câu hỏi hoặc yêu cầu liên quan, vui lòng liên hệ:</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="flex items-center gap-3 rounded-2xl border border-outline-variant/40 p-4 transition-colors hover:bg-surface-container-low"
          >
            <Icon name="mail" className="text-xl text-primary" />
            <span className="flex-1 font-semibold text-on-surface">{CONTACT_EMAIL}</span>
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
          <span aria-hidden="true">·</span>
          <Link to="/" className="hover:text-primary">
            © {new Date().getFullYear()} {SITE_NAME}
          </Link>
        </p>
      </article>
    </>
  );
}
