import { useEffect, useRef, useState } from 'react';
import { useBoardCtx } from '../context.js';

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

export function StatusCell({ item, column }) {
  const { actions } = useBoardCtx();
  const [open, setOpen] = useState(false);
  const current = column.labels.find((l) => l.id === item.values[column.id]);

  return (
    <Dropdown
      open={open}
      setOpen={setOpen}
      menuClass="status-menu"
      trigger={
        <div className="status-chip" style={{ background: current?.color || '#c4c4c4' }}>
          {current?.text || ''}
          <span className="chip-fold" />
        </div>
      }
    >
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

export function CellFor({ item, column }) {
  switch (column.type) {
    case 'status': return <StatusCell item={item} column={column} />;
    case 'person': return <PersonCell item={item} column={column} />;
    case 'date': return <DateCell item={item} column={column} />;
    case 'number': return <NumberCell item={item} column={column} />;
    default: return <TextCell item={item} column={column} />;
  }
}
