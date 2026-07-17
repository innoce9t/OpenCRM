import { useState } from 'react';
import { useBoardCtx } from '../context.js';
import { IconHome, IconChat, IconClipboard, IconPhone } from './icons.jsx';
import { Avatar } from './cells.jsx';

function ShareModal({ boardMeta, onClose }) {
  const { users, currentUserId, actions } = useBoardCtx();
  const [shared, setShared] = useState(boardMeta.sharedWith || []);
  const toggle = (id) => setShared((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const save = () => { actions.shareBoard(boardMeta.id, shared); onClose(); };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Share “{boardMeta.name}”</h2><button className="icon-btn" onClick={onClose}>×</button></div>
        <p className="form-sub">Guests and non-members can only see boards shared with them.</p>
        <div className="member-pick">
          {users.filter((u) => u.id !== currentUserId).map((u) => (
            <button key={u.id} className={`person-option ${shared.includes(u.id) ? 'current' : ''}`} onClick={() => toggle(u.id)}>
              <input type="checkbox" readOnly checked={shared.includes(u.id)} /> <Avatar user={u} size={22} /> {u.name}
              <span className={`role-chip role-${u.role}`}>{u.role}</span>
            </button>
          ))}
        </div>
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={save}>Save sharing</button>
      </div>
    </div>
  );
}

function BoardRow({ boardMeta }) {
  const { boardId, currentUser, actions } = useBoardCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(boardMeta.name);
  const [sharing, setSharing] = useState(false);
  const active = boardMeta.id === boardId;
  const canManage = currentUser?.role !== 'guest';

  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== boardMeta.name) actions.renameBoard(boardMeta.id, name);
    else setDraft(boardMeta.name);
  };

  return (
    <div
      className={`sidebar-board ${active ? 'active' : ''}`}
      onClick={() => actions.selectBoard(boardMeta.id)}
      onDoubleClick={() => { setDraft(boardMeta.name); setEditing(true); }}
    >
      <svg className="board-icon" viewBox="0 0 20 20" width="16" height="16">
        <rect x="2" y="3" width="16" height="3.5" rx="1" fill="currentColor" opacity="0.9" />
        <rect x="2" y="8.25" width="16" height="3.5" rx="1" fill="currentColor" opacity="0.55" />
        <rect x="2" y="13.5" width="16" height="3.5" rx="1" fill="currentColor" opacity="0.3" />
      </svg>
      {editing ? (
        <input
          className="sidebar-rename"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="sidebar-board-name" title={boardMeta.name}>{boardMeta.name}</span>
      )}
      {canManage && (
        <>
          <button className="icon-btn sidebar-share" title="Share board" onClick={(e) => { e.stopPropagation(); setSharing(true); }}>
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="15" cy="5" r="2"/><circle cx="5" cy="10" r="2"/><circle cx="15" cy="15" r="2"/><path d="M7 9l6-3M7 11l6 3"/></svg>
          </button>
          <button className="icon-btn sidebar-delete" title="Delete board"
            onClick={(e) => { e.stopPropagation(); if (confirm(`Delete board “${boardMeta.name}”? This cannot be undone.`)) actions.deleteBoard(boardMeta.id); }}>
            <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M8 2h4l.5 1.5H16V5H4V3.5h3.5L8 2zM5 6h10l-.7 11.1a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 6z"/></svg>
          </button>
        </>
      )}
      {boardMeta.sharedWith?.length > 0 && <span className="shared-dot" title={`Shared with ${boardMeta.sharedWith.length}`} />}
      {sharing && <ShareModal boardMeta={boardMeta} onClose={() => setSharing(false)} />}
    </div>
  );
}

export default function Sidebar() {
  const { boards, workspaces, currentUser, actions, page, notifications, mobileNav } = useBoardCtx();
  const unread = (notifications || []).filter((n) => !n.read).length;
  const canManage = currentUser?.role !== 'guest';

  // Group boards by workspace; anything unmatched (e.g. shared-in) goes to "Shared with me".
  const wsList = workspaces?.length ? workspaces : [{ id: '__none', name: 'Main workspace', color: '#0073ea' }];
  const wsIds = new Set(wsList.map((w) => w.id));
  const shared = boards.filter((b) => !wsIds.has(b.workspaceId));

  return (
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="sidebar-section">
        <div className={`sidebar-item ${page === 'board' ? 'active-nav' : ''}`} onClick={() => actions.setPage('board')}>
          <span className="sidebar-nav-icon"><IconHome size={17} /></span> Home
        </div>
        <div className={`sidebar-item ${page === 'chat' ? 'active-nav' : ''}`} onClick={() => actions.setPage('chat')}>
          <span className="sidebar-nav-icon"><IconChat size={17} /></span> Chat
          {unread > 0 && <span className="nav-badge">{unread}</span>}
        </div>
        <div className={`sidebar-item ${page === 'calls' ? 'active-nav' : ''}`} onClick={() => actions.setPage('calls')}>
          <span className="sidebar-nav-icon"><IconPhone size={17} /></span> Calls
        </div>
        <div className="sidebar-item"><span className="sidebar-nav-icon"><IconClipboard size={17} /></span> My work</div>
      </div>
      <div className="sidebar-divider" />

      {wsList.map((ws) => {
        const wsBoards = boards.filter((b) => b.workspaceId === ws.id);
        if (!wsBoards.length && ws.id !== wsList[0].id) return null;
        return (
          <div className="sidebar-section" key={ws.id}>
            <div className="sidebar-heading">
              <span className="workspace-badge" style={{ background: ws.color ? `linear-gradient(135deg, ${ws.color}, #a25ddc)` : undefined }}>{ws.name[0]?.toUpperCase()}</span>
              <span className="workspace-name" title={ws.name}>{ws.name}</span>
              {canManage && (
                <button className="icon-btn add-board-btn" title="Add board" onClick={() => actions.addBoard(ws.id)}>
                  <svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1z"/></svg>
                </button>
              )}
            </div>
            {wsBoards.map((b) => <BoardRow key={b.id} boardMeta={b} />)}
          </div>
        );
      })}

      {shared.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-heading"><span className="workspace-badge shared-badge">↗</span><span>Shared with me</span></div>
          {shared.map((b) => <BoardRow key={b.id} boardMeta={b} />)}
        </div>
      )}

      <div className="sidebar-footer">
        Developed by <a href="https://ahsan.live" target="_blank" rel="noreferrer">Ahsan Nawazish</a>
      </div>
    </aside>
  );
}
