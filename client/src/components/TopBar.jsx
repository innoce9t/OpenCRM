import { useBoardCtx } from '../context.js';
import { Avatar } from './cells.jsx';

export default function TopBar() {
  const { users } = useBoardCtx();
  return (
    <header className="topbar">
      <div className="topbar-logo">
        <span className="logo-dots"><i className="dot dot-red" /><i className="dot dot-green" /></span>
        <span className="logo-text">OpenCRM</span>
        <span className="logo-sub">work management</span>
      </div>
      <div className="topbar-right">
        <div className="avatar-stack">
          {users.slice(0, 4).map((u) => <Avatar key={u.id} user={u} size={28} />)}
          {users.length > 4 && <span className="avatar-more">+{users.length - 4}</span>}
        </div>
      </div>
    </header>
  );
}
