import { Link } from 'react-router-dom';
import Icon from '../common/Icon';

export default function Logo({ className = '' }) {
  return (
    <Link to="/" className={`flex shrink-0 items-center gap-2 ${className}`} aria-label="A51 - Trang chủ">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary-container text-on-primary">
        <Icon name="auto_awesome" fill className="text-[20px]" />
      </div>
      <span className="text-lg font-extrabold tracking-tight text-on-surface">A51</span>
    </Link>
  );
}
