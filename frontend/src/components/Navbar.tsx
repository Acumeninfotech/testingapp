import { NavLink } from 'react-router-dom';
import './Navbar.css';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/assessment', label: 'Start Assessment' },
  { to: '/assessment/universities', label: 'University Explorer' },
];

export function Navbar() {
  return (
    <nav className="navbar-applysmart">
      <div className="navbar-inner">
        <a
          href="https://www.medibrainuk.co.uk"
          className="navbar-brand-group"
          aria-label="MediBrain UK"
        >
          <img
            src="/images/MediBrain-UK-Logo.png"
            alt="MediBrain UK"
            className="navbar-logo"
          />
          <span className="navbar-tagline">
            Apply<em>Smart</em>
          </span>
        </a>

        <ul className="navbar-nav">
          {NAV_LINKS.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `navbar-link${isActive ? ' navbar-link--active' : ''}`
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
