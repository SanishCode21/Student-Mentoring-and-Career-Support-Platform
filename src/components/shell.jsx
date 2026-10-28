import { forwardRef, useEffect, useState } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { get } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from './toast.jsx';
import { ROLE_LABEL, initials } from './ui.jsx';

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-5.2-5.2',
  inbox: 'M4 5h16v14H4zM4 13h4l2 3h4l2-3h4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.7',
  calendar: 'M4 6h16v14H4zM8 3v5M16 3v5M4 11h16',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Zm4 10a2 2 0 0 0 4 0',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  book: 'M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2zM12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6',
};

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] || ICONS.home} />
    </svg>
  );
}

export const NAV = {
  student: {
    label: 'Student',
    items: [
      { label: 'Dashboard', to: '/student/dashboard', icon: 'home' },
      { label: 'Find mentors', to: '/student/mentors', icon: 'search' },
      { label: 'My requests', to: '/student/requests', icon: 'inbox' },
      { label: 'My mentorship', to: '/student/mentorships', icon: 'book' },
      { label: 'Notifications', to: '/student/notifications', icon: 'bell' },
      { label: 'Profile', to: '/student/profile', icon: 'user' },
    ],
  },
  mentor: {
    label: 'Mentor',
    items: [
      { label: 'Dashboard', to: '/mentor/dashboard', icon: 'home' },
      { label: 'Requests', to: '/mentor/requests', icon: 'inbox' },
      { label: 'My mentees', to: '/mentor/mentees', icon: 'users' },
      { label: 'Schedule', to: '/mentor/schedule', icon: 'calendar' },
      { label: 'Profile', to: '/mentor/profile', icon: 'user' },
      { label: 'Notifications', to: '/mentor/notifications', icon: 'bell' },
    ],
  },
  admin: {
    label: 'Administrator',
    items: [
      { label: 'Dashboard', to: '/admin/dashboard', icon: 'home' },
      { label: 'Users', to: '/admin/users', icon: 'users' },
      { label: 'Mentor reviews', to: '/admin/mentors', icon: 'shield' },
      { label: 'Mentorships', to: '/admin/mentorships', icon: 'book' },
      { label: 'Analytics', to: '/admin/analytics', icon: 'chart' },
    ],
  },
};

const NOTIFICATIONS_PATH = {
  student: '/student/notifications',
  mentor: '/mentor/notifications',
  admin: '/admin/dashboard',
};

const PROFILE_PATH = {
  student: '/student/profile',
  mentor: '/mentor/profile',
  admin: '/admin/dashboard',
};

const UserToggle = forwardRef(({ children, onClick, id }, ref) => (
  <button type="button" id={id} ref={ref} onClick={onClick} className="user-pill border-0">
    {children}
  </button>
));
UserToggle.displayName = 'UserToggle';

export default function AppShell() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = NAV[user?.role] || NAV.student;

  useEffect(() => {
    const refresh = () => {
      get('/notifications', { page_size: 1 })
        .then((envelope) => setUnread(envelope.meta?.unread_count ?? 0))
        .catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('notifications:refresh', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('notifications:refresh', refresh);
    };
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    get('/notifications', { page_size: 1 })
      .then((envelope) => setUnread(envelope.meta?.unread_count ?? 0))
      .catch(() => {});
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    toast.info('You have been signed out.');
  };

  return (
    <>
      <header className="topbar px-3 px-lg-4">
        <button
          type="button"
          className="icon-btn d-lg-none me-2"
          aria-label="Toggle navigation"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link to={user ? (NAV[user.role]?.items[0]?.to || '/') : '/login'} className="brand me-auto">
          <span className="brand-mark">IITM</span>
          <span className="d-none d-sm-inline">Mentoring Platform · Local demo</span>
          <span className="d-sm-none">Mentoring · Demo</span>
        </Link>

        {user && (
          <div className="d-flex align-items-center gap-2 gap-lg-3">
            <NavLink
              to={NOTIFICATIONS_PATH[user.role] || '/'}
              className="icon-btn text-decoration-none"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              title="Notifications"
            >
              <Icon name="bell" size={19} />
              {unread > 0 && <span className="badge-dot">{unread > 99 ? '99+' : unread}</span>}
            </NavLink>

            <Dropdown align="end">
              <Dropdown.Toggle as={UserToggle} id="user-menu">
                <span className="avatar-sm">{initials(user.full_name)}</span>
                <span className="d-none d-md-flex flex-column align-items-start lh-1">
                  <span className="small fw-semibold">{user.full_name}</span>
                  <span className="text-white-50" style={{ fontSize: '0.68rem' }}>{ROLE_LABEL[user.role] || user.role}</span>
                </span>
              </Dropdown.Toggle>
              <Dropdown.Menu style={{ minWidth: 230 }}>
                <Dropdown.ItemText>
                  <div className="fw-semibold">{user.full_name}</div>
                  <div className="small text-muted">{user.email}</div>
                </Dropdown.ItemText>
                <Dropdown.Divider />
                <Dropdown.Item onClick={() => navigate(PROFILE_PATH[user.role] || '/')}>
                  {user.role === 'admin' ? 'Admin dashboard' : 'My profile'}
                </Dropdown.Item>
                <Dropdown.Item onClick={handleLogout}>Sign out</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        )}
      </header>

      <div className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className="app-body">
        {user && (
          <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="section-label">{nav.label} workspace</div>
            <nav className="nav flex-column">
              {nav.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to.split('/').length <= 3}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon name={item.icon} size={17} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-foot">
              <div className="fw-semibold text-navy mb-1">IITM Mentoring</div>
              <div>Student Mentoring &amp; Career Support Platform</div>
              <div className="mt-2">Offline demo · sample data only</div>
            </div>
          </aside>
        )}

        <main className="main">
          <Outlet />
        </main>
      </div>
    </>
  );
}
