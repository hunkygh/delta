import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/projects', label: 'Projects' },
  { to: '/docs', label: 'Docs' },
  { to: '/settings', label: 'Settings' }
];

export default function Navbar(): JSX.Element {
  return (
    <header className="navbar">
      <div className="navbar-brand">Delta</div>
      <nav className="navbar-nav" aria-label="Primary">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`.trim()}
            end={link.to === '/'}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
