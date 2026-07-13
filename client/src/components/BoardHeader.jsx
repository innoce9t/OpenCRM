import { useState } from 'react';
import { useBoardCtx } from '../context.js';
import FilterSortBar from './FilterSortBar.jsx';
import AutomationsPanel from './AutomationsPanel.jsx';

const VIEWS = [
  { id: 'table', label: 'Main table', icon: <path fill="currentColor" d="M3 4h14v3H3V4zm0 4.5h14v3H3v-3zM3 13h14v3H3v-3z"/> },
  { id: 'kanban', label: 'Kanban', icon: <path fill="currentColor" d="M3 3h4v14H3V3zm5.5 0h4v9h-4V3zM14 3h4v12h-4V3z"/> },
  { id: 'calendar', label: 'Calendar', icon: <path fill="currentColor" d="M4 3h1.5v1.5h9V3H16v1.5h1a1 1 0 0 1 1 1V17a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1h1V3zm-.5 5V16h13V8h-13z"/> },
  { id: 'timeline', label: 'Timeline', icon: <path fill="currentColor" d="M3 5h9v3H3V5zm3 5h11v3H6v-3zM3 15h7v3H3v-3z"/> },
  { id: 'dashboard', label: 'Dashboard', icon: <path fill="currentColor" d="M3 3h6v7H3V3zm8 0h6v4h-6V3zM3 12h6v5H3v-5zm8-1h6v6h-6v-6z"/> },
  { id: 'form', label: 'Form', icon: <path fill="currentColor" d="M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 4v2h8V7H6zm0 4v2h8v-2H6z"/> },
  { id: 'workload', label: 'Workload', icon: <path fill="currentColor" d="M3 13h3v4H3v-4zm5.5-6h3v10h-3V7zM14 10h3v7h-3v-7z"/> },
  { id: 'map', label: 'Map', icon: <path fill="currentColor" d="M10 2a5 5 0 0 0-5 5c0 3.6 5 11 5 11s5-7.4 5-11a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/> },
];

export default function BoardHeader({ view, setView, search, setSearch }) {
  const { board, actions } = useBoardCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [automations, setAutomations] = useState(false);

  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== board.name) actions.renameBoard(board.id, name);
  };

  return (
    <div className="board-header">
      <div className="board-title-row">
        {editing ? (
          <input className="board-title-input" value={draft} autoFocus
            onChange={(e) => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />
        ) : (
          <h1 className="board-title" title="Click to rename" onClick={() => { setDraft(board.name); setEditing(true); }}>{board.name}</h1>
        )}
        {board.description && <span className="board-desc">{board.description}</span>}
      </div>

      <div className="board-toolbar">
        <div className="view-tabs">
          {VIEWS.map((v) => (
            <button key={v.id} className={`view-tab ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
              <svg viewBox="0 0 20 20" width="15" height="15">{v.icon}</svg>
              {v.label}
            </button>
          ))}
        </div>

        <div className="toolbar-right">
          <div className="search-box">
            <svg viewBox="0 0 20 20" width="15" height="15"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65-1.06 1.06-3.65-3.65A5.5 5.5 0 1 1 8.5 3zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>
            <input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={async () => {
            const group = board.groups.find((g) => !g.collapsed) || board.groups[0];
            if (group) await actions.addItem(group.id, 'New Item', 'top');
          }}>
            New item
            <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1z"/></svg>
          </button>
        </div>
      </div>

      <FilterSortBar onOpenAutomations={() => setAutomations(true)} />
      {automations && <AutomationsPanel onClose={() => setAutomations(false)} />}
    </div>
  );
}
