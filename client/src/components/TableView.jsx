import { useMemo, useRef, useState, useEffect } from 'react';
import { useBoardCtx, BoardContext } from '../context.js';
import { CellFor, formatNumber, Avatar } from './cells.jsx';
import { matchesFilters, matchesSearch, sortItems, valueToText } from '../util.js';

const COLUMN_TYPES = [
  { type: 'status', label: 'Status' },
  { type: 'priority', label: 'Priority' },
  { type: 'dropdown', label: 'Dropdown' },
  { type: 'text', label: 'Text' },
  { type: 'longtext', label: 'Long text' },
  { type: 'number', label: 'Numbers' },
  { type: 'date', label: 'Date' },
  { type: 'timeline', label: 'Timeline' },
  { type: 'person', label: 'People' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'rating', label: 'Rating' },
  { type: 'email', label: 'Email' },
  { type: 'phone', label: 'Phone' },
  { type: 'link', label: 'Link' },
  { type: 'files', label: 'Files' },
  { type: 'location', label: 'Location' },
  { type: 'autonumber', label: 'Auto number' },
  { type: 'vote', label: 'Vote' },
  { type: 'button', label: 'Button' },
  { type: 'formula', label: 'Formula' },
  { type: 'connect', label: 'Connect boards' },
  { type: 'mirror', label: 'Mirror' },
  { type: 'dependency', label: 'Dependency' },
];

const LABEL_PALETTE = ['#00c875', '#fdab3d', '#e2445c', '#579bfc', '#a25ddc', '#66ccff', '#bb3354', '#7f5347', '#037f4c', '#0086c0'];

function useClickOutside(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return ref;
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
          counts[l.id] ? <span key={l.id} style={{ flex: counts[l.id], background: l.color }} /> : null
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
  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useClickOutside(() => setColorOpen(false));

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
      <div className="group-color-wrap" ref={colorRef}>
        <button className="group-color-dot" style={{ background: group.color }} onClick={() => setColorOpen(!colorOpen)} title="Change color" />
        {colorOpen && (
          <div className="dropdown-menu color-menu">
            {LABEL_PALETTE.map((c) => (
              <button key={c} className="color-swatch" style={{ background: c }} onClick={() => { actions.recolorGroup(group.id, c); setColorOpen(false); }} />
            ))}
          </div>
        )}
      </div>
      {editing ? (
        <input
          className="group-title-input" style={{ color: group.color }} value={draft} autoFocus
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        />
      ) : (
        <h3 className="group-title" onClick={() => { setDraft(group.title); setEditing(true); }}>{group.title}</h3>
      )}
      <span className="group-count">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
      <button className="icon-btn group-delete" title="Delete group"
        onClick={() => { if (confirm(`Delete group “${group.title}” and its items?`)) actions.deleteGroup(group.id); }}>
        <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M8 2h4l.5 1.5H16V5H4V3.5h3.5L8 2zM5 6h10l-.7 11.1a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 6z"/></svg>
      </button>
    </div>
  );
}

function ColumnConfig({ column }) {
  const { board, boards, actions } = useBoardCtx();
  const cfg = column.config || {};
  const set = (patch) => actions.configureColumn(column.id, { config: { ...cfg, ...patch } });
  const labelCols = board.columns.filter((c) => c.type === 'status' || c.type === 'dropdown');
  const targetCol = board.columns.find((c) => c.id === cfg.targetColumnId);
  const connectCols = board.columns.filter((c) => c.type === 'connect');

  if (column.type === 'formula') {
    return (
      <>
        <div className="settings-head">Formula</div>
        <input className="unit-input" defaultValue={cfg.expression || ''} placeholder="{Deal value} * 0.2"
          onBlur={(e) => set({ expression: e.target.value })} />
        <div className="menu-note">Reference columns by title in {'{ }'}. Supports + - * / ( ).</div>
      </>
    );
  }
  if (column.type === 'button') {
    return (
      <>
        <div className="settings-head">Button label</div>
        <input className="unit-input" defaultValue={cfg.label || 'Run'} onBlur={(e) => set({ label: e.target.value })} />
        <div className="settings-head">When clicked, set</div>
        <select className="cfg-select" value={cfg.targetColumnId || ''} onChange={(e) => set({ targetColumnId: e.target.value, targetValue: '' })}>
          <option value="">— column —</option>
          {labelCols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        {targetCol && (
          <select className="cfg-select" value={cfg.targetValue || ''} onChange={(e) => set({ targetValue: e.target.value })}>
            <option value="">— value —</option>
            {targetCol.labels.map((l) => <option key={l.id} value={l.id}>{l.text}</option>)}
          </select>
        )}
      </>
    );
  }
  if (column.type === 'connect') {
    return (
      <>
        <div className="settings-head">Connect to board</div>
        <select className="cfg-select" value={cfg.boardId || ''} onChange={(e) => set({ boardId: e.target.value })}>
          <option value="">— board —</option>
          {boards.filter((b) => b.id !== board.id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </>
    );
  }
  if (column.type === 'mirror') {
    return (
      <>
        <div className="settings-head">Mirror through</div>
        <select className="cfg-select" value={cfg.connectColumnId || ''} onChange={(e) => set({ connectColumnId: e.target.value })}>
          <option value="">— connect column —</option>
          {connectCols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <div className="menu-note">Add a Connect column first, then mirror a field from the linked items.</div>
        <input className="unit-input" defaultValue={cfg.columnId || ''} placeholder="target column id"
          onBlur={(e) => set({ columnId: e.target.value })} />
      </>
    );
  }
  return null;
}

function ColumnSettings({ column, onClose }) {
  const { actions } = useBoardCtx();
  const ref = useClickOutside(onClose);
  const hasLabels = column.type === 'status' || column.type === 'dropdown';
  const hasConfig = ['formula', 'button', 'connect', 'mirror'].includes(column.type);
  const [labels, setLabels] = useState(column.labels || []);
  const [unit, setUnit] = useState(column.unit || '');

  const saveLabels = (next) => { setLabels(next); actions.configureColumn(column.id, { labels: next }); };

  return (
    <div className="dropdown-menu col-settings" ref={ref}>
      <div className="settings-head">Sort</div>
      <button className="menu-option" onClick={() => { actions.setSorts([{ columnId: column.id, dir: 'asc' }]); onClose(); }}>↑ Sort ascending</button>
      <button className="menu-option" onClick={() => { actions.setSorts([{ columnId: column.id, dir: 'desc' }]); onClose(); }}>↓ Sort descending</button>

      {hasLabels && (
        <>
          <div className="settings-head">Labels</div>
          {labels.map((l, i) => (
            <div key={l.id} className="label-edit-row">
              <input type="color" value={l.color} onChange={(e) => { const n = [...labels]; n[i] = { ...l, color: e.target.value }; saveLabels(n); }} />
              <input className="label-text" value={l.text} onChange={(e) => { const n = [...labels]; n[i] = { ...l, text: e.target.value }; setLabels(n); }} onBlur={() => saveLabels(labels)} />
              <button className="label-x" onClick={() => saveLabels(labels.filter((x) => x.id !== l.id))}>×</button>
            </div>
          ))}
          <button className="menu-option add-label" onClick={() => saveLabels([...labels, { id: `l${Date.now().toString(36)}`, text: 'New label', color: LABEL_PALETTE[labels.length % LABEL_PALETTE.length] }])}>+ Add label</button>
        </>
      )}

      {column.type === 'number' && (
        <>
          <div className="settings-head">Unit / symbol</div>
          <input className="unit-input" value={unit} placeholder="e.g. $ or kg" onChange={(e) => setUnit(e.target.value)} onBlur={() => actions.configureColumn(column.id, { unit })} />
        </>
      )}

      {hasConfig && <ColumnConfig column={column} />}

      <div className="settings-divider" />
      <button className="menu-option danger" onClick={() => { if (confirm(`Delete column “${column.title}”?`)) actions.deleteColumn(column.id); onClose(); }}>Delete column</button>
    </div>
  );
}

function ColumnHeader({ column }) {
  const { actions, sorts } = useBoardCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [settings, setSettings] = useState(false);
  const sortDir = sorts.find((s) => s.columnId === column.id)?.dir;

  const commit = () => { setEditing(false); if (draft.trim()) actions.renameColumn(column.id, draft.trim()); };

  if (editing) {
    return (
      <input className="col-header-input" value={draft} autoFocus
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />
    );
  }
  return (
    <div className="col-header" onDoubleClick={() => { setDraft(column.title); setEditing(true); }} title="Double-click to rename">
      <span>{column.title}{sortDir ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
      <button className="icon-btn col-settings-btn" title="Column settings" onClick={() => setSettings(!settings)}>
        <svg viewBox="0 0 20 20" width="14" height="14"><circle cx="4" cy="10" r="1.6" fill="currentColor"/><circle cx="10" cy="10" r="1.6" fill="currentColor"/><circle cx="16" cy="10" r="1.6" fill="currentColor"/></svg>
      </button>
      {settings && <ColumnSettings column={column} onClose={() => setSettings(false)} />}
    </div>
  );
}

function AddColumnButton() {
  const { actions } = useBoardCtx();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="add-col" ref={ref}>
      <button className="icon-btn" title="Add column" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1z"/></svg>
      </button>
      {open && (
        <div className="dropdown-menu add-col-menu">
          {COLUMN_TYPES.map((c) => (
            <button key={c.type} className="menu-option" onClick={() => { actions.addColumn(c.type); setOpen(false); }}>{c.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddItemRow({ group, gridTemplate }) {
  const { actions } = useBoardCtx();
  const [draft, setDraft] = useState('');
  const commit = async () => { if (draft.trim()) { await actions.addItem(group.id, draft.trim()); setDraft(''); } };
  return (
    <div className="table-row add-item-row" style={{ gridTemplateColumns: gridTemplate }}>
      <div className="row-colorbar faded" style={{ background: group.color }} />
      <div className="cell-check"><input type="checkbox" disabled /></div>
      <input className="add-item-input" placeholder="+ Add item" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} onBlur={commit} />
    </div>
  );
}

function SubitemRows({ item, gridTemplate }) {
  const ctx = useBoardCtx();
  const { board, actions } = ctx;
  const subCols = board.subitemColumns || [];
  const [draft, setDraft] = useState('');
  const add = async () => { if (draft.trim()) { await actions.addSubitem(item.id, draft.trim()); setDraft(''); } };

  // Cells write through actions.setItemValue; for subitems, reroute that to the
  // subitem endpoint so the shared cell components work unchanged.
  const scoped = useMemo(() => ({
    ...ctx,
    actions: { ...actions, setItemValue: (subId, colId, val) => actions.setSubitemValue(item.id, subId, colId, val) },
  }), [ctx, actions, item.id]);

  return (
    <BoardContext.Provider value={scoped}>
    <div className="subitems-block">
      {item.subitems.map((sub) => (
        <div key={sub.id} className="table-row subitem-row" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="row-colorbar faded" />
          <div className="cell-check"><span className="subitem-elbow">↳</span></div>
          <div className="cell cell-name-wrap">
            <SubitemName sub={sub} item={item} />
          </div>
          {subCols.map((c) => (
            <div key={c.id} className={`cell cell-${c.type}`}>
              <CellFor item={sub} column={c} />
            </div>
          ))}
          <div />
        </div>
      ))}
      <div className="table-row add-item-row subitem-add" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="row-colorbar faded" />
        <div className="cell-check"><span className="subitem-elbow">↳</span></div>
        <input className="add-item-input" placeholder="+ Add subitem" value={draft}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} onBlur={add} />
      </div>
    </div>
    </BoardContext.Provider>
  );
}

// Subitems store their own values keyed by subitemColumn ids; reuse setSubitemValue
// by shadowing setItemValue through a tiny context-free wrapper on the sub object.
function SubitemName({ sub, item }) {
  const { actions } = useBoardCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const commit = () => { setEditing(false); if (draft.trim() && draft.trim() !== sub.name) actions.renameSubitem(item.id, sub.id, draft.trim()); };
  if (editing) {
    return <input className="cell-input cell-name" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />;
  }
  return (
    <>
      <div className="cell-text cell-name" onClick={() => { setDraft(sub.name); setEditing(true); }}><span>{sub.name}</span></div>
      <button className="icon-btn item-delete" title="Delete subitem" onClick={() => actions.deleteSubitem(item.id, sub.id)}>
        <svg viewBox="0 0 20 20" width="13" height="13"><path fill="currentColor" d="M8 2h4l.5 1.5H16V5H4V3.5h3.5L8 2zM5 6h10l-.7 11.1a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 6z"/></svg>
      </button>
    </>
  );
}

function ItemRow({ item, group, idx, gridTemplate, columns }) {
  const { actions, selectedIds } = useBoardCtx();
  const [expanded, setExpanded] = useState(false);
  const subCount = item.subitems?.length || 0;
  const updateCount = item.updates?.length || 0;
  const selected = selectedIds.includes(item.id);

  return (
    <>
      <div className={`table-row item-row ${selected ? 'row-selected' : ''}`} style={{ gridTemplateColumns: gridTemplate }}>
        <div className={`row-colorbar ${idx === 0 ? 'first' : ''}`} style={{ background: group.color }} />
        <div className="cell-check"><input type="checkbox" checked={selected} onChange={() => actions.toggleItemSelected(item.id)} /></div>
        <div className="cell cell-name-wrap">
          <button className={`subitem-toggle ${subCount ? 'has' : ''}`} title="Subitems"
            onClick={() => setExpanded(!expanded)}>
            <svg viewBox="0 0 20 20" width="14" height="14" style={{ transform: expanded ? 'none' : 'rotate(-90deg)' }}>
              <path fill="currentColor" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z"/>
            </svg>
          </button>
          <ItemName item={item} />
          {subCount > 0 && <span className="sub-badge" title={`${subCount} subitems`}>{subCount}</span>}
          <button className="open-item-btn" title="Open item" onClick={() => actions.openItem(item.id)}>
            <svg viewBox="0 0 20 20" width="15" height="15"><path fill="currentColor" d="M4 4h5v2H6v8h8v-3h2v5H4V4zm7 0h5v5h-2V7.4l-4.3 4.3-1.4-1.4L12.6 6H11V4z"/></svg>
            {updateCount > 0 && <span className="update-badge">{updateCount}</span>}
          </button>
        </div>
        {columns.map((c) => (
          <div key={c.id} className={`cell cell-${c.type}`}><CellFor item={item} column={c} /></div>
        ))}
        <div />
      </div>
      {expanded && <SubitemRows item={item} gridTemplate={gridTemplate} />}
    </>
  );
}

function ItemName({ item }) {
  const { actions } = useBoardCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const commit = () => { setEditing(false); if (draft.trim() && draft.trim() !== item.name) actions.renameItem(item.id, draft.trim()); };
  if (editing) {
    return <input className="cell-input cell-name" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />;
  }
  return (
    <>
      <div className="cell-text cell-name" onClick={() => { setDraft(item.name); setEditing(true); }}><span>{item.name}</span></div>
      <button className="icon-btn item-delete" title="Delete item" onClick={() => actions.deleteItem(item.id)}>
        <svg viewBox="0 0 20 20" width="13" height="13"><path fill="currentColor" d="M8 2h4l.5 1.5H16V5H4V3.5h3.5L8 2zM5 6h10l-.7 11.1a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 6z"/></svg>
      </button>
    </>
  );
}

function Group({ group }) {
  const { board, users, search, filters, sorts, actions, selectedIds } = useBoardCtx();
  const columns = board.columns;
  const gridTemplate = `6px 36px minmax(260px, 1.6fr) ${columns.map(() => 'minmax(120px, 1fr)').join(' ')} 44px`;

  const items = useMemo(() => {
    let list = group.items.filter((i) =>
      matchesSearch(i, search, columns, users) && matchesFilters(i, filters, columns, users));
    return sortItems(list, sorts, columns, users);
  }, [group.items, search, filters, sorts, columns, users]);

  return (
    <section className="group">
      <GroupHeaderRow group={group} itemCount={items.length} />
      {!group.collapsed && (
        <div className="group-table">
          <div className="table-row header-row" style={{ gridTemplateColumns: gridTemplate }}>
            <div />
            <div className="cell-check">
              <input type="checkbox"
                checked={items.length > 0 && items.every((i) => selectedIds.includes(i.id))}
                ref={(el) => { if (el) el.indeterminate = items.some((i) => selectedIds.includes(i.id)) && !items.every((i) => selectedIds.includes(i.id)); }}
                onChange={(e) => actions.setGroupSelected(items.map((i) => i.id), e.target.checked)} />
            </div>
            <div className="col-header col-header-name">Item</div>
            {columns.map((c) => <ColumnHeader key={c.id} column={c} />)}
            <AddColumnButton />
          </div>

          {items.map((item, idx) => (
            <ItemRow key={item.id} item={item} group={group} idx={idx} gridTemplate={gridTemplate} columns={columns} />
          ))}

          {group.hasMore && (
            <button className="load-more-row" onClick={() => actions.loadMoreItems(group.id, group.items.length)}>
              Load more ({(group.total || 0) - group.items.length} remaining)
            </button>
          )}

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
