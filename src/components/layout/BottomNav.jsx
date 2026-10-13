import { NavLink } from 'react-router-dom';
import Icon from '../common/Icon';
import { NAV_ITEMS } from './navItems';

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[640px] lg:hidden">
      <div className="flex gap-2 border-t border-surface-container bg-surface-bright px-4 pb-3 pt-2">
        {NAV_ITEMS.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-end gap-1 ${
                isActive ? 'text-primary' : 'text-on-surface-variant'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex h-8 items-center justify-center">
                  <Icon name={icon} fill={isActive} className="text-[24px]" />
                </span>
                <span className="text-xs font-medium tracking-[0.015em]">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
