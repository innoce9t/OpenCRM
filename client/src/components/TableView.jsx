import { useMemo, useState } from 'react';
import { useBoardCtx } from '../context.js';
import { CellFor, formatNumber } from './cells.jsx';

const COLUMN_TYPES = [
  { type: 'status', label: 'Status' },
  { type: 'priority', label: 'Priority' },
  { type: 'text', label: 'Text' },
  { type: 'number', label: 'Numbers' },
  { type: 'date', label: 'Date' },
  { type: 'person', label: 'People' },
];

function matchesSearch(item, search, users) {
  if (!search) return true;
  const q = search.toLowerCase();
  if (item.name.toLowerCase().includes(q)) return true;
  return Object.values(item.values).some((v) => {
    if (typeof v === 'string' && v.toLowerCase().includes(q)) return true;
    const user = users.find((u) => u.id === v);
    return user && user.name.toLowerCase().includes(q);
  });
}

function StatusSummary({ items, column }) {
  const counts = {};
  let total = 0;
  for (const item of items) {
    const v = item.values[column.id];
    if (!v) continue;
    counts[v] = (counts[v] || 0) + 1;
    total++;
  }
  if (!total) return <div className="summary-cell" />;
  return (
    <div className="summary-cell">
      <div className="status-strip" title={column.labels.map((l) => counts[l.id] ? `${l.text}: ${counts[l.id]}` : null).filter(Boolean).join(' · ')}>
        {column.labels.map((l) =>
          counts[l.id] ? (
            <span key={l.id} style={{ flex: counts[l.id], background: l.color }} />
          ) : null
        )}
      </div>
    </div>
  );
}

function NumberSummary({ items, column }) {
  const nums = items.map((i) => i.values[column.id]).filter((v) => typeof v === 'number');
  if (!nums.length) return <div className="summary-cell" />;
  const sum = nums.reduce((a, b) => a + b, 0);
  return (
    <div className="summary-cell summary-number">
      <span>{formatNumber(sum, column.unit)}</span>
      <small>sum</small>
    </div>
  );
}

function GroupHeaderRow({ group, itemCount }) {
  const { actions } = useBoardCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    setEditing(false);
    if (draft.trim()) actions.renameGroup(group.id, draft.trim());
  };

  return (
    <div className="group-title-row" style={{ color: group.color }}>
      <button className="collapse-btn" onClick={() => actions.toggleGroup(group.id)} title={group.collapsed ? 'Expand' : 'Collapse'}>
        <svg viewBox="0 0 20 20" width="18" height="18" style={{ transform: group.collapsed ? 'rotate(-90deg)' : 'none' }}>
          <path fill="currentColor" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z"/>
        </svg>
      </button>
      {editing ? (
        <input
          className="group-title-input"
          style={{ color: group.color }}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        />
      ) : (
        <h3 className="group-title" onClick={() => { setDraft(group.title); setEditing(true); }}>{group.title}</h3>
      )}
      <span className="group-count">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
      <button
        className="icon-btn group-delete"
        title="Delete group"
        onClick={() => { if (confirm(`Delete group “${group.title}” and its items?`)) actions.deleteGroup(group.id); }}
      >
        <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M8 2h4l.5 1.5H16V5H4V3.5h3.5L8 2zM5 6h10l-.7 11.1a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 6z"/></svg>
      </button>
    </div>
  );
}

function ColumnHeader({ column }) {
  const { actions } = useBoardCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    setEditing(false);
    if (draft.trim()) actions.renameColumn(column.id, draft.trim());
  };

  if (editing) {
    return (
      <input
        className="col-header-input"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }
  return (
    <div className="col-header" onDoubleClick={() => { setDraft(column.title); setEditing(true); }} title="Double-click to rename">
      <span>{column.title}</span>
      <button
        className="icon-btn col-delete"
        title="Delete column"
        onClick={() => { if (confirm(`Delete column “${column.title}”?`)) actions.deleteColumn(column.id); }}
      >
        <svg viewBox="0 0 20 20" width="12" height="12"><path fill="currentColor" d="M5.7 4.3 10 8.6l4.3-4.3 1.4 1.4L11.4 10l4.3 4.3-1.4 1.4L10 11.4l-4.3 4.3-1.4-1.4L8.6 10 4.3 5.7l1.4-1.4z"/></svg>
      </button>
    </div>
  );
}

function AddColumnButton() {
  const { actions } = useBoardCtx();
  const [open, setOpen] = useState(false);
  return (
    <div className="add-col">
      <button className="icon-btn" title="Add column" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1z"/></svg>
      </button>
      {open && (
        <div className="dropdown-menu add-col-menu" onMouseLeave={() => setOpen(false)}>
          {COLUMN_TYPES.map((c) => (
            <button key={c.type} className="menu-option" onClick={() => { actions.addColumn(c.type); setOpen(false); }}>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddItemRow({ group, gridTemplate }) {
  const { actions } = useBoardCtx();
  const [draft, setDraft] = useState('');
  const commit = async () => {
    if (draft.trim()) {
      await actions.addItem(group.id, draft.trim());
      setDraft('');
    }
  };
  return (
    <div className="table-row add-item-row" style={{ gridTemplateColumns: gridTemplate }}>
      <div className="row-colorbar faded" style={{ background: group.color }} />
      <div className="cell-check"><input type="checkbox" disabled /></div>
      <input
        className="add-item-input"
        placeholder="+ Add item"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        onBlur={commit}
      />
    </div>
  );
}

function Group({ group }) {
  const { board, users, search, actions } = useBoardCtx();
  const columns = board.columns;

  const gridTemplate = `6px 36px minmax(240px, 1.6fr) ${columns.map(() => 'minmax(120px, 1fr)').join(' ')} 44px`;
  const items = group.items.filter((i) => matchesSearch(i, search, users));

  return (
    <section className="group">
      <GroupHeaderRow group={group} itemCount={items.length} />
      {!group.collapsed && (
        <div className="group-table">
          <div className="table-row header-row" style={{ gridTemplateColumns: gridTemplate }}>
            <div />
            <div className="cell-check"><input type="checkbox" disabled /></div>
            <div className="col-header col-header-name">Item</div>
            {columns.map((c) => <ColumnHeader key={c.id} column={c} />)}
            <AddColumnButton />
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className="table-row item-row" style={{ gridTemplateColumns: gridTemplate }}>
              <div className={`row-colorbar ${idx === 0 ? 'first' : ''}`} style={{ background: group.color }} />
              <div className="cell-check"><input type="checkbox" /></div>
              <div className="cell cell-name-wrap">
                <CellNameWithActions item={item} onDelete={() => actions.deleteItem(item.id)} />
              </div>
              {columns.map((c) => (
                <div key={c.id} className={`cell cell-${c.type}`}>
                  <CellFor item={item} column={c} />
                </div>
              ))}
              <div />
            </div>
          ))}

          <AddItemRow group={group} gridTemplate={gridTemplate} />

          <div className="table-row summary-row" style={{ gridTemplateColumns: gridTemplate }}>
            <div /><div /><div />
            {columns.map((c) => {
              if (c.type === 'status') return <StatusSummary key={c.id} items={items} column={c} />;
              if (c.type === 'number') return <NumberSummary key={c.id} items={items} column={c} />;
              return <div key={c.id} className="summary-cell" />;
            })}
            <div />
          </div>
        </div>
      )}
    </section>
  );
}

function CellNameWithActions({ item, onDelete }) {
  const { actions } = useBoardCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== item.name) actions.renameItem(item.id, draft.trim());
  };

  if (editing) {
    return (
      <input
        className="cell-input cell-name"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }
  return (
    <>
      <div className="cell-text cell-name" onClick={() => { setDraft(item.name); setEditing(true); }}>
        <span>{item.name}</span>
      </div>
      <button className="icon-btn item-delete" title="Delete item" onClick={onDelete}>
        <svg viewBox="0 0 20 20" width="13" height="13"><path fill="currentColor" d="M8 2h4l.5 1.5H16V5H4V3.5h3.5L8 2zM5 6h10l-.7 11.1a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 6z"/></svg>
      </button>
    </>
  );
}

export default function TableView() {
  const { board, actions } = useBoardCtx();
  const groups = useMemo(() => board.groups, [board]);

  return (
    <div className="table-view">
      {groups.map((g) => <Group key={g.id} group={g} />)}
      <button className="btn-outline add-group-btn" onClick={() => actions.addGroup()}>
        <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1z"/></svg>
        Add new group
      </button>
    </div>
  );
}
