import { useState } from 'react';
import { useBoardCtx } from '../context.js';

function BoardRow({ boardMeta }) {
  const { boardId, actions } = useBoardCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(boardMeta.name);
  const active = boardMeta.id === boardId;

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
      <button
        className="icon-btn sidebar-delete"
        title="Delete board"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete board “${boardMeta.name}”? This cannot be undone.`)) actions.deleteBoard(boardMeta.id);
        }}
      >
        <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M8 2h4l.5 1.5H16V5H4V3.5h3.5L8 2zM5 6h10l-.7 11.1a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 6z"/></svg>
      </button>
    </div>
  );
}

export default function Sidebar() {
  const { boards, actions } = useBoardCtx();
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-item"><span className="sidebar-emoji">🏠</span> Home</div>
        <div className="sidebar-item"><span className="sidebar-emoji">📋</span> My work</div>
      </div>
      <div className="sidebar-divider" />
      <div className="sidebar-section">
        <div className="sidebar-heading">
          <span className="workspace-badge">M</span>
          <span>Main workspace</span>
          <button className="icon-btn add-board-btn" title="Add board" onClick={() => actions.addBoard()}>
            <svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1z"/></svg>
          </button>
        </div>
        {boards.map((b) => <BoardRow key={b.id} boardMeta={b} />)}
      </div>
    </aside>
  );
}
