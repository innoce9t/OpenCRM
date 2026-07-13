import { useEffect, useRef, useState } from 'react';
import { useBoardCtx } from '../context.js';
import { useCachedBoard } from '../boardCache.js';

export function Avatar({ user, size = 26 }) {
  if (!user) return null;
  return (
    <span
      className="avatar"
      title={user.name}
      style={{ width: size, height: size, background: user.color, fontSize: size * 0.38 }}
    >
      {user.initials}
    </span>
  );
}

function useClickOutside(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return ref;
}

// Generic dropdown cell: renders the trigger, opens a menu below it.
function Dropdown({ trigger, children, open, setOpen, menuClass = '' }) {
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="dropdown" ref={ref}>
      <div className="dropdown-trigger" onClick={() => setOpen(!open)}>{trigger}</div>
      {open && <div className={`dropdown-menu ${menuClass}`}>{children}</div>}
    </div>
  );
}

// monday-style label palette for the inline editor.
export const PRESET_COLORS = [
  '#00c875', '#00a389', '#037f4c', '#9cd326', '#cab641', '#fdab3d', '#ff7575', '#e2445c',
  '#bb3354', '#ff158a', '#ff5ac4', '#faa1f1', '#a25ddc', '#784bd1', '#5559df', '#0086c0',
  '#579bfc', '#66ccff', '#68a1bd', '#c4c4c4', '#808080', '#333333', '#7f5347', '#4eccc6',
];

// Inline rename + recolor for status/dropdown labels (opens inside the picker).
export function LabelEditor({ column, onDone }) {
  const { actions } = useBoardCtx();
  const [labels, setLabels] = useState(() => (column.labels || []).map((l) => ({ ...l })));
  const [paletteFor, setPaletteFor] = useState(null);

  const persist = (next) => actions.configureColumn(column.id, { labels: next });
  const setLocal = (i, patch) => setLabels((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const saveColor = (i, color) => { const next = labels.map((l, idx) => (idx === i ? { ...l, color } : l)); setLabels(next); persist(next); setPaletteFor(null); };
  const addLabel = () => { const next = [...labels, { id: `l${Math.random().toString(36).slice(2, 8)}`, text: 'New label', color: PRESET_COLORS[labels.length % PRESET_COLORS.length] }]; setLabels(next); persist(next); };
  const remove = (i) => { const next = labels.filter((_, idx) => idx !== i); setLabels(next); persist(next); };

  return (
    <div className="label-editor" onMouseDown={(e) => e.stopPropagation()}>
      <div className="label-editor-head">
        <button className="label-back" onClick={onDone} title="Back">
          <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5l-5 5 5 5" /></svg>
        </button>
        <span>Edit labels</span>
      </div>
      {labels.map((l, i) => (
        <div key={l.id} className="label-editor-row">
          <button className="label-swatch" style={{ background: l.color }} onClick={() => setPaletteFor(paletteFor === i ? null : i)} title="Change color" />
          <input className="label-name-input" value={l.text}
            onChange={(e) => setLocal(i, { text: e.target.value })}
            onBlur={() => persist(labels)}
            onKeyDown={(e) => { if (e.key === 'Enter') { persist(labels); e.target.blur(); } }} />
          <button className="label-row-x" onClick={() => remove(i)} title="Delete label">
            <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 6l8 8M14 6l-8 8" /></svg>
          </button>
          {paletteFor === i && (
            <div className="swatch-palette">
              {PRESET_COLORS.map((c) => (
                <button key={c} className="swatch-opt" style={{ background: c }} onClick={() => saveColor(i, c)} />
              ))}
            </div>
          )}
        </div>
      ))}
      <button className="label-add" onClick={addLabel}>+ New label</button>
    </div>
  );
}

export function StatusCell({ item, column }) {
  const { actions } = useBoardCtx();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const current = column.labels.find((l) => l.id === item.values[column.id]);

  return (
    <Dropdown
      open={open}
      setOpen={(o) => { setOpen(o); if (!o) setEditing(false); }}
      menuClass="status-menu"
      trigger={
        <div className="status-chip" style={{ background: current?.color || '#c4c4c4' }}>
          {current?.text || ''}
          <span className="chip-fold" />
        </div>
      }
    >
      {editing ? (
        <LabelEditor column={column} onDone={() => setEditing(false)} />
      ) : (
        <>
          {column.labels.map((l) => (
            <button
              key={l.id}
              className="status-option"
              style={{ background: l.color }}
              onClick={() => { actions.setItemValue(item.id, column.id, l.id); setOpen(false); }}
            >
              {l.text}
            </button>
          ))}
          <button
            className="status-option status-clear"
            onClick={() => { actions.setItemValue(item.id, column.id, null); setOpen(false); }}
          >
            Clear
          </button>
          <button className="status-edit-labels" onClick={() => setEditing(true)}>
            <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13.5 12.5 5l2.5 2.5L6.5 16H4v-2.5z" /></svg>
            Edit Labels
          </button>
        </>
      )}
    </Dropdown>
  );
}

export function PersonCell({ item, column }) {
  const { users, actions } = useBoardCtx();
  const [open, setOpen] = useState(false);
  const current = users.find((u) => u.id === item.values[column.id]);

  return (
    <Dropdown
      open={open}
      setOpen={setOpen}
      menuClass="person-menu"
      trigger={
        current
          ? <span className="person-value"><Avatar user={current} /></span>
          : <span className="person-empty"><svg viewBox="0 0 20 20" width="22" height="22"><circle cx="10" cy="7" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M4 16.5c1-3 3.4-4.3 6-4.3s5 1.3 6 4.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></span>
      }
    >
      {users.map((u) => (
        <button
          key={u.id}
          className="person-option"
          onClick={() => { actions.setItemValue(item.id, column.id, u.id); setOpen(false); }}
        >
          <Avatar user={u} size={24} /> {u.name}
        </button>
      ))}
      <button className="person-option person-clear" onClick={() => { actions.setItemValue(item.id, column.id, null); setOpen(false); }}>
        Clear assignee
      </button>
    </Dropdown>
  );
}

export function DateCell({ item, column }) {
  const { actions } = useBoardCtx();
  const value = item.values[column.id] || '';
  const inputRef = useRef(null);

  const display = value
    ? new Date(value + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="date-cell" onClick={() => inputRef.current?.showPicker?.() ?? inputRef.current?.focus()}>
      <span className={value ? '' : 'cell-placeholder'}>{display || '+'}</span>
      <input
        ref={inputRef}
        type="date"
        className="date-input"
        value={value}
        onChange={(e) => actions.setItemValue(item.id, column.id, e.target.value || null)}
      />
    </div>
  );
}

function EditableText({ value, display, onCommit, className = '', placeholder = '+', inputType = 'text' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  if (editing) {
    return (
      <input
        className={`cell-input ${className}`}
        type={inputType}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }
  return (
    <div className={`cell-text ${className}`} onClick={() => { setDraft(value); setEditing(true); }}>
      <span className={value === '' ? 'cell-placeholder' : ''}>{display ?? (value || placeholder)}</span>
    </div>
  );
}

export function TextCell({ item, column }) {
  const { actions } = useBoardCtx();
  const value = item.values[column.id] ?? '';
  return (
    <EditableText
      value={String(value)}
      onCommit={(v) => actions.setItemValue(item.id, column.id, v.trim() === '' ? null : v.trim())}
    />
  );
}

export function formatNumber(n, unit) {
  if (n === undefined || n === null || n === '') return '';
  const formatted = Number(n).toLocaleString();
  return unit ? `${unit}${formatted}` : formatted;
}

export function NumberCell({ item, column }) {
  const { actions } = useBoardCtx();
  const value = item.values[column.id];
  return (
    <EditableText
      className="cell-number"
      inputType="number"
      value={value === undefined ? '' : String(value)}
      display={value === undefined ? undefined : formatNumber(value, column.unit)}
      onCommit={(v) => {
        const n = parseFloat(v);
        actions.setItemValue(item.id, column.id, Number.isFinite(n) ? n : null);
      }}
    />
  );
}

export function NameCell({ item }) {
  const { actions } = useBoardCtx();
  return (
    <EditableText
      className="cell-name"
      value={item.name}
      onCommit={(v) => { if (v.trim()) actions.renameItem(item.id, v.trim()); }}
    />
  );
}

export function CheckboxCell({ item, column }) {
  const { actions } = useBoardCtx();
  const checked = !!item.values[column.id];
  return (
    <div className="checkbox-cell" onClick={() => actions.setItemValue(item.id, column.id, checked ? null : true)}>
      <span className={`check-box ${checked ? 'on' : ''}`}>
        {checked && <svg viewBox="0 0 20 20" width="14" height="14"><path fill="#fff" d="M8 13.2 4.8 10l-1.3 1.3L8 15.8l8.5-8.5-1.3-1.3z"/></svg>}
      </span>
    </div>
  );
}

export function RatingCell({ item, column }) {
  const { actions } = useBoardCtx();
  const value = Number(item.values[column.id]) || 0;
  return (
    <div className="rating-cell">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`star ${n <= value ? 'on' : ''}`}
          onClick={() => actions.setItemValue(item.id, column.id, n === value ? null : n)}
        >★</span>
      ))}
    </div>
  );
}

export function DropdownCell({ item, column }) {
  const { actions } = useBoardCtx();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const selected = Array.isArray(item.values[column.id]) ? item.values[column.id] : [];
  const labels = column.labels || [];
  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    actions.setItemValue(item.id, column.id, next.length ? next : null);
  };
  return (
    <Dropdown
      open={open}
      setOpen={(o) => { setOpen(o); if (!o) setEditing(false); }}
      menuClass="status-menu"
      trigger={
        <div className="dropdown-tags">
          {selected.length === 0 && <span className="cell-placeholder">+</span>}
          {selected.map((id) => {
            const l = labels.find((x) => x.id === id);
            return l ? <span key={id} className="tag-chip" style={{ background: l.color }}>{l.text}</span> : null;
          })}
        </div>
      }
    >
      {editing ? (
        <LabelEditor column={column} onDone={() => setEditing(false)} />
      ) : (
        <>
          {labels.map((l) => (
            <button
              key={l.id}
              className="status-option"
              style={{ background: l.color, opacity: selected.includes(l.id) ? 1 : 0.55 }}
              onClick={() => toggle(l.id)}
            >
              {selected.includes(l.id) ? '✓ ' : ''}{l.text}
            </button>
          ))}
          <button className="status-edit-labels" onClick={() => setEditing(true)}>
            <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13.5 12.5 5l2.5 2.5L6.5 16H4v-2.5z" /></svg>
            Edit Labels
          </button>
        </>
      )}
    </Dropdown>
  );
}

export function TimelineCell({ item, column }) {
  const { actions } = useBoardCtx();
  const [open, setOpen] = useState(false);
  const value = item.values[column.id] || {};
  const fmt = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  const label = value.start && value.end ? `${fmt(value.start)} – ${fmt(value.end)}` : '';
  const set = (patch) => {
    const next = { ...value, ...patch };
    actions.setItemValue(item.id, column.id, next.start || next.end ? next : null);
  };
  return (
    <Dropdown
      open={open}
      setOpen={setOpen}
      menuClass="timeline-menu"
      trigger={
        label
          ? <div className="timeline-bar" style={{ background: column.labels?.[0]?.color || '#579bfc' }}>{label}</div>
          : <span className="cell-placeholder">+</span>
      }
    >
      <label className="timeline-field">Start<input type="date" value={value.start || ''} onChange={(e) => set({ start: e.target.value || undefined })} /></label>
      <label className="timeline-field">End<input type="date" value={value.end || ''} onChange={(e) => set({ end: e.target.value || undefined })} /></label>
      <button className="status-clear status-option" onClick={() => { actions.setItemValue(item.id, column.id, null); setOpen(false); }}>Clear</button>
    </Dropdown>
  );
}

export function LinkishCell({ item, column, hrefPrefix = '', validate }) {
  const { actions } = useBoardCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const value = item.values[column.id] ?? '';

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    actions.setItemValue(item.id, column.id, v === '' ? null : v);
  };

  if (editing) {
    return (
      <input
        className="cell-input" value={draft} autoFocus
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }
  if (!value) {
    return <div className="cell-text" onClick={() => { setDraft(''); setEditing(true); }}><span className="cell-placeholder">+</span></div>;
  }
  const bad = validate && !validate(value);
  const href = column.type === 'link'
    ? (/^https?:\/\//.test(value) ? value : `https://${value}`)
    : `${hrefPrefix}${value}`;
  return (
    <div className="cell-text linkish">
      <a href={href} target="_blank" rel="noreferrer" className={bad ? 'link-bad' : ''} onClick={(e) => e.stopPropagation()}>{value}</a>
      <button className="icon-btn linkish-edit" title="Edit" onClick={() => { setDraft(value); setEditing(true); }}>
        <svg viewBox="0 0 20 20" width="12" height="12"><path fill="currentColor" d="M4 13.5 13.1 4.4l2.5 2.5L6.5 16H4v-2.5zM14 3.5l1.2-1.2a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 0 1 0 1.4L16.5 6 14 3.5z"/></svg>
      </button>
    </div>
  );
}

export function LongTextCell({ item, column }) {
  const { actions } = useBoardCtx();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const value = item.values[column.id] ?? '';
  const openEditor = () => { setDraft(value); setOpen(true); };
  const commit = () => { setOpen(false); actions.setItemValue(item.id, column.id, draft.trim() === '' ? null : draft.trim()); };
  return (
    <Dropdown
      open={open}
      setOpen={(o) => { if (o) openEditor(); else commit(); }}
      menuClass="longtext-menu"
      trigger={<div className="cell-text longtext-preview"><span className={value ? '' : 'cell-placeholder'}>{value || '+'}</span></div>}
    >
      <textarea className="longtext-area" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} placeholder="Write a note…" />
      <button className="btn-primary longtext-save" onClick={commit}>Save</button>
    </Dropdown>
  );
}

export function FilesCell({ item, column }) {
  const { actions } = useBoardCtx();
  const files = Array.isArray(item.values[column.id]) ? item.values[column.id] : [];
  const add = () => {
    const url = prompt('File URL (link to a document, image, etc.)');
    if (!url) return;
    const name = prompt('Display name', url.split('/').pop() || 'file') || 'file';
    actions.setItemValue(item.id, column.id, [...files, { name, url }]);
  };
  const remove = (i) => {
    const next = files.filter((_, idx) => idx !== i);
    actions.setItemValue(item.id, column.id, next.length ? next : null);
  };
  return (
    <div className="files-cell">
      {files.map((f, i) => (
        <span key={i} className="file-chip" title={f.url}>
          <a href={f.url} target="_blank" rel="noreferrer">{f.name}</a>
          <button className="file-x" onClick={() => remove(i)}>×</button>
        </span>
      ))}
      <button className="file-add" onClick={add} title="Attach file">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}

export function AutoNumberCell({ item }) {
  const { board } = useBoardCtx();
  const idx = board.groups.flatMap((g) => g.items).findIndex((i) => i.id === item.id);
  return <span className="cell-autonumber">{idx >= 0 ? idx + 1 : ''}</span>;
}

export function VoteCell({ item, column }) {
  const { actions, currentUserId } = useBoardCtx();
  const votes = Array.isArray(item.values[column.id]) ? item.values[column.id] : [];
  const voted = votes.includes(currentUserId);
  const toggle = () => {
    const next = voted ? votes.filter((v) => v !== currentUserId) : [...votes, currentUserId];
    actions.setItemValue(item.id, column.id, next.length ? next : null);
  };
  return (
    <button className={`vote-cell ${voted ? 'voted' : ''}`} onClick={toggle} title={voted ? 'Remove vote' : 'Vote'}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill={voted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.5-7 9-7 9Z" /></svg>
      {votes.length > 0 && <span>{votes.length}</span>}
    </button>
  );
}

export function ButtonCell({ item, column }) {
  const { actions } = useBoardCtx();
  const cfg = column.config || {};
  const run = () => { if (cfg.targetColumnId) actions.setItemValue(item.id, cfg.targetColumnId, cfg.targetValue || null); };
  return <button className="cell-button" onClick={run} disabled={!cfg.targetColumnId}>{cfg.label || 'Run'}</button>;
}

function evalFormula(expr, board, item) {
  if (!expr) return '';
  const s = expr.replace(/\{([^}]+)\}/g, (_, name) => {
    const col = board.columns.find((c) => c.title.toLowerCase() === name.trim().toLowerCase());
    let v = col ? item.values[col.id] : 0;
    if (typeof v !== 'number') v = parseFloat(v) || 0;
    return `(${v})`;
  });
  if (!/^[-+*/().\d\s]*$/.test(s)) return 'error';
  try { const r = Function(`"use strict";return (${s || '0'})`)(); return Number.isFinite(r) ? Math.round(r * 100) / 100 : 'error'; }
  catch { return 'error'; }
}

export function FormulaCell({ item, column }) {
  const { board } = useBoardCtx();
  const r = evalFormula(column.config?.expression, board, item);
  return <span className="cell-formula">{r === '' ? '' : r === 'error' ? '⚠' : Number(r).toLocaleString()}</span>;
}

// Multi-item picker used by connect-boards (other board) and dependency (same board).
function ItemLinkCell({ item, column, targetBoard }) {
  const { actions } = useBoardCtx();
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(item.values[column.id]) ? item.values[column.id] : [];
  const allItems = targetBoard ? targetBoard.groups.flatMap((g) => g.items) : [];
  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    actions.setItemValue(item.id, column.id, next.length ? next : null);
  };
  return (
    <Dropdown open={open} setOpen={setOpen} menuClass="link-menu"
      trigger={
        <div className="dropdown-tags">
          {selected.length === 0 && <span className="cell-placeholder">+</span>}
          {selected.map((id) => {
            const it = allItems.find((x) => x.id === id);
            return <span key={id} className="link-chip">{it ? it.name : '…'}</span>;
          })}
        </div>
      }>
      {!targetBoard && <div className="menu-note">Choose a board in column settings first.</div>}
      {allItems.map((it) => (
        <button key={it.id} className="menu-option" onClick={() => toggle(it.id)}>
          {selected.includes(it.id) ? '✓ ' : ''}{it.name}
        </button>
      ))}
    </Dropdown>
  );
}

export function ConnectCell({ item, column }) {
  const targetBoard = useCachedBoard(column.config?.boardId);
  return <ItemLinkCell item={item} column={column} targetBoard={targetBoard} />;
}

export function DependencyCell({ item, column }) {
  const { board } = useBoardCtx();
  return <ItemLinkCell item={item} column={column} targetBoard={board} />;
}

export function MirrorCell({ item, column }) {
  const { board } = useBoardCtx();
  const cfg = column.config || {};
  const connectCol = board.columns.find((c) => c.id === cfg.connectColumnId);
  const targetBoard = useCachedBoard(connectCol?.config?.boardId);
  if (!connectCol || !targetBoard) return <span className="cell-placeholder" />;
  const linkedIds = Array.isArray(item.values[connectCol.id]) ? item.values[connectCol.id] : [];
  const all = targetBoard.groups.flatMap((g) => g.items);
  const vals = linkedIds.map((id) => {
    const it = all.find((x) => x.id === id);
    if (!it) return null;
    const mc = targetBoard.columns.find((c) => c.id === cfg.columnId);
    if (!mc) return it.name;
    const v = it.values[mc.id];
    if (mc.type === 'status') return mc.labels?.find((l) => l.id === v)?.text || '';
    return typeof v === 'number' ? v.toLocaleString() : (v || '');
  }).filter(Boolean);
  return <span className="cell-mirror">{vals.join(', ')}</span>;
}

export function LocationCell({ item, column }) {
  // Stored as "lat,lng · label". Editable text; map view reads the coords.
  return <LinkishCell item={item} column={column} />;
}

export function CellFor({ item, column }) {
  switch (column.type) {
    case 'status': return <StatusCell item={item} column={column} />;
    case 'dropdown': return <DropdownCell item={item} column={column} />;
    case 'autonumber': return <AutoNumberCell item={item} column={column} />;
    case 'vote': return <VoteCell item={item} column={column} />;
    case 'button': return <ButtonCell item={item} column={column} />;
    case 'formula': return <FormulaCell item={item} column={column} />;
    case 'connect': return <ConnectCell item={item} column={column} />;
    case 'dependency': return <DependencyCell item={item} column={column} />;
    case 'mirror': return <MirrorCell item={item} column={column} />;
    case 'location': return <LocationCell item={item} column={column} />;
    case 'person': return <PersonCell item={item} column={column} />;
    case 'date': return <DateCell item={item} column={column} />;
    case 'timeline': return <TimelineCell item={item} column={column} />;
    case 'number': return <NumberCell item={item} column={column} />;
    case 'checkbox': return <CheckboxCell item={item} column={column} />;
    case 'rating': return <RatingCell item={item} column={column} />;
    case 'longtext': return <LongTextCell item={item} column={column} />;
    case 'files': return <FilesCell item={item} column={column} />;
    case 'email': return <LinkishCell item={item} column={column} hrefPrefix="mailto:" validate={(v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)} />;
    case 'phone': return <LinkishCell item={item} column={column} hrefPrefix="tel:" />;
    case 'link': return <LinkishCell item={item} column={column} />;
    default: return <TextCell item={item} column={column} />;
  }
}
