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

function Action({ icon, label, onClick, children }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="bulk-action" ref={ref}>
      <button className="bulk-btn" onClick={children ? () => setOpen((o) => !o) : onClick}>
        <span className="bulk-ico">{icon}</span>
        <span>{label}</span>
      </button>
      {open && children && <div className="dropdown-menu bulk-menu">{children({ close: () => setOpen(false) })}</div>}
    </div>
  );
}

export default function BulkActionBar() {
  const { board, users, selectedIds, actions } = useBoardCtx();
  if (!selectedIds.length) return null;

  const statusCol = board.columns.find((c) => c.type === 'status');
  const personCol = board.columns.find((c) => c.type === 'person');

  return (
    <div className="bulk-bar">
      <div className="bulk-count">{selectedIds.length}<span>selected</span></div>

      <Action label="Duplicate" onClick={() => actions.bulkDuplicate()}
        icon={<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M4 13V5a1.5 1.5 0 0 1 1.5-1.5H13"/></svg>} />

      <Action label="Move to" icon={<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h10M10 6l4 4-4 4"/></svg>}>
        {({ close }) => board.groups.map((g) => (
          <button key={g.id} className="menu-option" onClick={() => { actions.bulkMove(g.id); close(); }}>
            <span className="group-dot" style={{ background: g.color }} /> {g.title}
          </button>
        ))}
      </Action>

      {statusCol && (
        <Action label={statusCol.title} icon={<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="6.5"/></svg>}>
          {({ close }) => (
            <>
              {statusCol.labels.map((l) => (
                <button key={l.id} className="status-option" style={{ background: l.color }} onClick={() => { actions.bulkSetValue(statusCol.id, l.id); close(); }}>{l.text}</button>
              ))}
              <button className="status-option status-clear" onClick={() => { actions.bulkSetValue(statusCol.id, null); close(); }}>Clear</button>
            </>
          )}
        </Action>
      )}

      {personCol && (
        <Action label="Assign" icon={<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="10" cy="7" r="3"/><path d="M4 16c1-3 3.4-4.3 6-4.3s5 1.3 6 4.3"/></svg>}>
          {({ close }) => (
            <>
              {users.map((u) => (
                <button key={u.id} className="person-option" onClick={() => { actions.bulkSetValue(personCol.id, u.id); close(); }}>
                  <Avatar user={u} size={22} /> {u.name}
                </button>
              ))}
              <button className="person-option person-clear" onClick={() => { actions.bulkSetValue(personCol.id, null); close(); }}>Clear assignee</button>
            </>
          )}
        </Action>
      )}

      <Action label="Delete" onClick={() => { if (confirm(`Delete ${selectedIds.length} item(s)?`)) actions.bulkDelete(); }}
        icon={<svg viewBox="0 0 20 20" width="18" height="18"><path fill="currentColor" d="M8 2h4l.5 1.5H16V5H4V3.5h3.5L8 2zM5 6h10l-.7 11.1a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 6z"/></svg>} />

      <button className="bulk-close" title="Clear selection" onClick={() => actions.clearSelection()}>
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>
      </button>
    </div>
  );
}
