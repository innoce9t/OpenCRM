import { useRef, useEffect, useState } from 'react';
import { useBoardCtx } from '../context.js';
import { FILTER_OPS, labelText } from '../util.js';

function useClickOutside(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return ref;
}

const OPS_FOR = (type) => {
  if (type === 'status' || type === 'person' || type === 'dropdown') return ['is', 'is_not', 'is_empty', 'is_not_empty'];
  if (type === 'checkbox') return ['is'];
  return ['contains', 'is_empty', 'is_not_empty'];
};

function valueControl(col, value, onChange, users) {
  if (col.type === 'checkbox') {
    return (
      <select value={value ?? 'true'} onChange={(e) => onChange(e.target.value)}>
        <option value="true">checked</option>
        <option value="false">unchecked</option>
      </select>
    );
  }
  if (col.type === 'status' || col.type === 'dropdown') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {col.labels.map((l) => <option key={l.id} value={l.id}>{l.text}</option>)}
      </select>
    );
  }
  if (col.type === 'person') {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    );
  }
  return <input value={value ?? ''} placeholder="value" onChange={(e) => onChange(e.target.value)} />;
}

function FilterPopover({ onClose }) {
  const { board, users, filters, actions } = useBoardCtx();
  const ref = useClickOutside(onClose);
  const columns = board.columns;

  const addFilter = () => {
    const col = columns[0];
    actions.setFilters([...filters, { columnId: col.id, op: OPS_FOR(col.type)[0], value: '' }]);
  };
  const update = (i, patch) => actions.setFilters(filters.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  const remove = (i) => actions.setFilters(filters.filter((_, idx) => idx !== i));

  return (
    <div className="dropdown-menu filter-popover" ref={ref}>
      {filters.length === 0 && <div className="widget-empty">No filters yet.</div>}
      {filters.map((f, i) => {
        const col = columns.find((c) => c.id === f.columnId) || columns[0];
        const showValue = f.op !== 'is_empty' && f.op !== 'is_not_empty';
        return (
          <div key={i} className="filter-line">
            <select value={f.columnId} onChange={(e) => { const c = columns.find((x) => x.id === e.target.value); update(i, { columnId: c.id, op: OPS_FOR(c.type)[0], value: '' }); }}>
              {columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <select value={f.op} onChange={(e) => update(i, { op: e.target.value })}>
              {OPS_FOR(col.type).map((op) => <option key={op} value={op}>{FILTER_OPS[op]}</option>)}
            </select>
            {showValue && valueControl(col, f.value, (v) => update(i, { value: v }), users)}
            <button className="label-x" onClick={() => remove(i)}>×</button>
          </div>
        );
      })}
      <div className="filter-popover-actions">
        <button className="menu-option" onClick={addFilter}>+ Add condition</button>
        {filters.length > 0 && <button className="menu-option danger" onClick={() => actions.setFilters([])}>Clear all</button>}
      </div>
    </div>
  );
}

function SortPopover({ onClose }) {
  const { board, sorts, actions } = useBoardCtx();
  const ref = useClickOutside(onClose);
  const columns = board.columns;
  const sort = sorts[0];

  return (
    <div className="dropdown-menu sort-popover" ref={ref}>
      <div className="filter-line">
        <select value={sort?.columnId || ''} onChange={(e) => actions.setSorts(e.target.value ? [{ columnId: e.target.value, dir: sort?.dir || 'asc' }] : [])}>
          <option value="">None</option>
          {columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        {sort && (
          <select value={sort.dir} onChange={(e) => actions.setSorts([{ ...sort, dir: e.target.value }])}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        )}
      </div>
      {sorts.length > 0 && <button className="menu-option danger" onClick={() => actions.setSorts([])}>Clear sort</button>}
    </div>
  );
}

function ViewsMenu({ onClose }) {
  const { board, view, filters, sorts, actions } = useBoardCtx();
  const ref = useClickOutside(onClose);
  const save = async () => {
    const name = prompt('Name this view');
    if (name) await actions.saveView(name);
  };
  return (
    <div className="dropdown-menu views-menu" ref={ref}>
      <div className="settings-head">Saved views</div>
      {(board.views || []).length === 0 && <div className="widget-empty">None saved</div>}
      {(board.views || []).map((v) => (
        <div key={v.id} className="view-row">
          <button className="menu-option" onClick={() => { actions.applyView(v); onClose(); }}>{v.name} <small>({v.type})</small></button>
          <button className="label-x" onClick={() => actions.deleteView(v.id)}>×</button>
        </div>
      ))}
      <div className="settings-divider" />
      <button className="menu-option add-label" onClick={save}>+ Save current view</button>
    </div>
  );
}

export default function FilterSortBar({ onOpenAutomations }) {
  const { filters, sorts } = useBoardCtx();
  const [open, setOpen] = useState(null); // 'filter' | 'sort' | 'views'

  return (
    <div className="filtersort-bar">
      <div className="fs-btn-wrap">
        <button className={`fs-btn ${filters.length ? 'active' : ''}`} onClick={() => setOpen(open === 'filter' ? null : 'filter')}>
          <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M3 5h14l-5.5 6.5V16l-3 1.5v-6L3 5z"/></svg>
          Filter{filters.length ? ` (${filters.length})` : ''}
        </button>
        {open === 'filter' && <FilterPopover onClose={() => setOpen(null)} />}
      </div>

      <div className="fs-btn-wrap">
        <button className={`fs-btn ${sorts.length ? 'active' : ''}`} onClick={() => setOpen(open === 'sort' ? null : 'sort')}>
          <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M6 4v9l-2.5-2.5L2 12l5 5 5-5-1.5-1.5L8 13V4H6zm7 1h6v2h-6V5zm0 4h4v2h-4V9zm0 4h2v2h-2v-2z"/></svg>
          Sort{sorts.length ? ' (1)' : ''}
        </button>
        {open === 'sort' && <SortPopover onClose={() => setOpen(null)} />}
      </div>

      <div className="fs-btn-wrap">
        <button className="fs-btn" onClick={() => setOpen(open === 'views' ? null : 'views')}>
          <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M3 4h14v2H3V4zm0 5h14v2H3V9zm0 5h9v2H3v-2z"/></svg>
          Views
        </button>
        {open === 'views' && <ViewsMenu onClose={() => setOpen(null)} />}
      </div>

      <button className="fs-btn" onClick={onOpenAutomations}>
        <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M11 2 4 11h4l-1 7 7-9h-4l1-7z"/></svg>
        Automate
      </button>
    </div>
  );
}
