import { useState } from 'react';
import { useBoardCtx } from '../context.js';

export default function BoardHeader({ view, setView, search, setSearch }) {
  const { board, actions } = useBoardCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== board.name) actions.renameBoard(board.id, name);
  };

  return (
    <div className="board-header">
      <div className="board-title-row">
        {editing ? (
          <input
            className="board-title-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          />
        ) : (
          <h1 className="board-title" title="Click to rename" onClick={() => { setDraft(board.name); setEditing(true); }}>
            {board.name}
          </h1>
        )}
        {board.description && <span className="board-desc">{board.description}</span>}
      </div>

      <div className="board-toolbar">
        <div className="view-tabs">
          <button className={`view-tab ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>
            <svg viewBox="0 0 20 20" width="15" height="15"><path fill="currentColor" d="M3 4h14v3H3V4zm0 4.5h14v3H3v-3zM3 13h14v3H3v-3z"/></svg>
            Main table
          </button>
          <button className={`view-tab ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}>
            <svg viewBox="0 0 20 20" width="15" height="15"><path fill="currentColor" d="M3 3h4v14H3V3zm5.5 0h4v9h-4V3zM14 3h4v12h-4V3z"/></svg>
            Kanban
          </button>
        </div>

        <div className="toolbar-right">
          <div className="search-box">
            <svg viewBox="0 0 20 20" width="15" height="15"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65-1.06 1.06-3.65-3.65A5.5 5.5 0 1 1 8.5 3zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>
            <input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button
            className="btn-primary"
            onClick={async () => {
              const group = board.groups.find((g) => !g.collapsed) || board.groups[0];
              if (group) await actions.addItem(group.id, 'New Item', 'top');
            }}
          >
            New item
            <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
