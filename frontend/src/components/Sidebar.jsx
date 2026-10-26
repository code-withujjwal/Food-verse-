import { NavLink } from 'react-router-dom';
import { CalendarDays, Camera, ChefHat, LayoutDashboard, Leaf, ShieldCheck, X } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/scanner', label: 'Food Scanner', icon: Camera },
  { to: '/freshness', label: 'Freshness Check', icon: Leaf },
  { to: '/kitchen', label: 'Kitchen Review', icon: ShieldCheck },
  { to: '/cooking', label: 'Cooking Assistant', icon: ChefHat },
  { to: '/planner', label: 'Meal Planner', icon: CalendarDays },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      <aside className={`sidebar${open ? ' is-open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Leaf size={20} />
          </span>
          <div>
            <strong>Food Verse AI</strong>
            <span>Multimodal food intelligence</span>
          </div>
          <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className="nav-link" onClick={onClose}>
              <Icon size={19} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="sidebar-note">AI estimates from photos and text can be wrong. Use them as guidance, not as medical or safety advice.</p>
      </aside>
      {open && <div className="scrim" onClick={onClose} aria-hidden="true" />}
    </>
  );
}
