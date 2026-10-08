import { Link } from 'react-router-dom';
import Icon from '../components/common/Icon';

// backTo: đường dẫn nút quay lại trên thanh tiêu đề (trang con)
export default function PlaceholderPage({ title, icon = 'construction', backTo }) {
  return (
    <>
      {backTo && (
        <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
          <Link
            to={backTo}
            aria-label="Quay lại"
            className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
          >
            <Icon name="arrow_back" />
          </Link>
          <h1 className="text-base font-bold text-on-surface">{title}</h1>
        </header>
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Icon name={icon} className="text-5xl text-primary" />
        {!backTo && <h1 className="text-lg font-bold text-on-surface">{title}</h1>}
        <p className="text-sm text-on-surface-variant">Trang này đang được phát triển.</p>
      </div>
    </>
  );
}
