import { useState } from 'react';
import { useBoardCtx } from '../context.js';

// A form-style item intake. Fill fields, submit, and a new item is created in
// the chosen group. Mirrors monday.com's Form view (in-app, not a public URL).
const SUPPORTED = new Set(['text', 'longtext', 'email', 'phone', 'link', 'number', 'rating', 'date', 'status', 'dropdown', 'person', 'checkbox']);

function Field({ column, users, value, onChange }) {
  const common = { className: 'form-input', value: value ?? '', onChange: (e) => onChange(e.target.value) };
  switch (column.type) {
    case 'longtext': return <textarea {...common} rows={3} />;
    case 'number': case 'rating': return <input type="number" {...common} />;
    case 'date': return <input type="date" {...common} />;
    case 'email': return <input type="email" {...common} />;
    case 'checkbox': return <input type="checkbox" className="form-check" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
    case 'status': case 'dropdown':
      return (
        <select {...common}>
          <option value="">—</option>
          {column.labels.map((l) => <option key={l.id} value={l.id}>{l.text}</option>)}
        </select>
      );
    case 'person':
      return (
        <select {...common}>
          <option value="">—</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      );
    default: return <input type="text" {...common} />;
  }
}

export default function FormView() {
  const { board, users, actions } = useBoardCtx();
  const fields = board.columns.filter((c) => SUPPORTED.has(c.type));
  const [groupId, setGroupId] = useState(board.groups[0]?.id);
  const [name, setName] = useState('');
  const [values, setValues] = useState({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const item = await actions.addItem(groupId, name.trim());
      for (const [k, v] of Object.entries(values)) {
        if (v === '' || v === undefined || v === null || v === false) continue;
        const col = board.columns.find((c) => c.id === k);
        const val = col?.type === 'number' || col?.type === 'rating' ? Number(v) : v;
        await actions.setItemValue(item.id, k, val);
      }
      setName(''); setValues({}); setDone(true);
    } finally { setBusy(false); }
  };

  return (
    <div className="form-view">
      <div className="form-card">
        <h2 className="form-title">{board.name}</h2>
        <p className="form-sub">Fill in the details to add a new item.</p>

        {done && (
          <div className="form-success">
            Submitted. <button className="link-btn" onClick={() => setDone(false)}>Add another</button>
          </div>
        )}

        <label className="form-field">
          <span className="form-label">Add to group</span>
          <select className="form-input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {board.groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">Item name <span className="req">*</span></span>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp deal" />
        </label>

        {fields.map((c) => (
          <label key={c.id} className="form-field">
            <span className="form-label">{c.title}</span>
            <Field column={c} users={users} value={values[c.id]} onChange={(v) => setValues((s) => ({ ...s, [c.id]: v }))} />
          </label>
        ))}

        <button className="btn-primary form-submit" disabled={!name.trim() || busy} onClick={submit}>
          {busy ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
