import { useRef, useEffect, useState } from 'react';
import { useBoardCtx } from '../context.js';
import { Avatar } from './cells.jsx';

function useClickOutside(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return ref;
}

// Animated sun <-> moon toggle (inspired by react-toggle-dark-mode): a circle
// whose radius grows while a masked circle slides in to carve a crescent, and
// rays that fade/spin out. All transitions are CSS-driven.
function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const isDark = theme === 'dark';
  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('opencrm-theme', next); } catch (e) { /* ignore */ }
    setTheme(next);
  };
  return (
    <button className="topbar-icon" title={isDark ? 'Switch to light' : 'Switch to dark'} onClick={toggle}>
      <svg className="sunmoon" width="20" height="20" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        style={{ transform: isDark ? 'rotate(40deg)' : 'rotate(90deg)' }}>
        <mask id="sunmoon-mask">
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <circle className="sunmoon-mask-c" cx={isDark ? 12 : 26} cy={isDark ? 5 : 0} r="9" fill="black" />
        </mask>
        <circle className="sunmoon-body" cx="12" cy="12" r={isDark ? 9 : 5} fill="currentColor" stroke="none" mask="url(#sunmoon-mask)" />
        <g className="sunmoon-rays" style={{ opacity: isDark ? 0 : 1 }}>
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </g>
      </svg>
    </button>
  );
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function NotificationsBell() {
  const { notifications, actions, boards, board } = useBoardCtx();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const unread = notifications.filter((n) => !n.read).length;

  const openNotif = (n) => {
    actions.markNotificationRead(n.id);
    if (n.boardId && n.boardId !== board?.id) actions.selectBoard(n.boardId);
    if (n.itemId) actions.openItem(n.itemId);
    setOpen(false);
  };

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="topbar-icon" title="Notifications" onClick={() => { setOpen(!open); if (!open) actions.refreshNotifications(); }}>
        <svg viewBox="0 0 20 20" width="20" height="20"><path fill="currentColor" d="M10 2a5 5 0 0 0-5 5v3l-1.5 3h13L15 10V7a5 5 0 0 0-5-5zm0 16a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 10 18z"/></svg>
        {unread > 0 && <span className="notif-badge">{unread}</span>}
      </button>
      {open && (
        <div className="dropdown-menu notif-menu">
          <div className="notif-head">
            <strong>Notifications</strong>
            {unread > 0 && <button className="notif-readall" onClick={() => actions.markAllNotificationsRead()}>Mark all read</button>}
          </div>
          {notifications.length === 0 && <div className="widget-empty">You're all caught up.</div>}
          {notifications.map((n) => (
            <button key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => openNotif(n)}>
              <span className="notif-text">{n.text}</span>
              <span className="notif-time">{timeAgo(n.at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { currentUser, actions } = useBoardCtx();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="user-switch" ref={ref}>
      <button className="user-switch-btn" title="Account" onClick={() => setOpen(!open)}>
        <Avatar user={currentUser} size={28} />
      </button>
      {open && (
        <div className="dropdown-menu user-menu">
          <div className="account-head">
            <Avatar user={currentUser} size={36} />
            <div className="account-info">
              <strong>{currentUser?.name}</strong>
              <span className="account-email">{currentUser?.email}</span>
              <span className={`role-chip role-${currentUser?.role}`}>{currentUser?.role}</span>
            </div>
          </div>
          <div className="settings-divider" />
          <button className="menu-option" onClick={() => { setOpen(false); actions.logout(); }}>Log out</button>
        </div>
      )}
    </div>
  );
}

export default function TopBar() {
  const { users, mobileNav, actions } = useBoardCtx();
  return (
    <header className="topbar">
      <div className="topbar-logo">
        <button className="topbar-hamburger" title="Menu" onClick={() => actions.setMobileNav(!mobileNav)}>
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
        </button>
        <span className="logo-dots"><i className="dot dot-red" /><i className="dot dot-green" /></span>
        <span className="logo-text">OpenCRM</span>
        <span className="logo-sub">work management</span>
      </div>
      <div className="topbar-right">
        <div className="avatar-stack">
          {users.slice(0, 4).map((u) => <Avatar key={u.id} user={u} size={28} />)}
          {users.length > 4 && <span className="avatar-more">+{users.length - 4}</span>}
        </div>
        <ThemeToggle />
        <NotificationsBell />
        <AccountMenu />
      </div>
    </header>
  );
}
