import { useMemo, useState } from 'react';
import { useBoardCtx } from '../context.js';
import { Avatar, formatNumber } from './cells.jsx';

// Capacity view: how work is distributed across people. Metric is either item
// count or the sum of a number column; a per-person capacity flags overload.
export default function WorkloadView() {
  const { board, users } = useBoardCtx();
  const personCols = board.columns.filter((c) => c.type === 'person');
  const numberCols = board.columns.filter((c) => c.type === 'number');
  const [personColId, setPersonColId] = useState(personCols[0]?.id);
  const [metric, setMetric] = useState(numberCols[0] ? numberCols[0].id : 'count');
  const [capacity, setCapacity] = useState(metric === 'count' ? 8 : 100000);

  const rows = useMemo(() => {
    if (!personColId) return [];
    const items = board.groups.flatMap((g) => g.items);
    return users.map((u) => {
      const mine = items.filter((i) => i.values[personColId] === u.id);
      const value = metric === 'count'
        ? mine.length
        : mine.reduce((a, i) => a + (typeof i.values[metric] === 'number' ? i.values[metric] : 0), 0);
      return { user: u, value, items: mine };
    }).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  }, [board, users, personColId, metric]);

  if (!personCols.length) {
    return <div className="empty-state"><h2>No people column</h2><p>Add a People column to see workload distribution.</p></div>;
  }
  const unit = metric === 'count' ? '' : (numberCols.find((c) => c.id === metric)?.unit || '');
  const max = Math.max(capacity, ...rows.map((r) => r.value), 1);

  return (
    <div className="workload-view">
      <div className="calendar-toolbar">
        <h2 className="calendar-title">Workload</h2>
        {personCols.length > 1 && (
          <select className="calendar-select" value={personColId} onChange={(e) => setPersonColId(e.target.value)}>
            {personCols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
        <select className="calendar-select" value={metric} onChange={(e) => { setMetric(e.target.value); setCapacity(e.target.value === 'count' ? 8 : 100000); }}>
          <option value="count">Item count</option>
          {numberCols.map((c) => <option key={c.id} value={c.id}>Sum of {c.title}</option>)}
        </select>
        <label className="workload-cap">Capacity
          <input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 0)} />
        </label>
      </div>

      <div className="workload-rows">
        {rows.map(({ user, value }) => {
          const pct = Math.min(100, (value / max) * 100);
          const over = value > capacity;
          return (
            <div key={user.id} className="workload-row">
              <div className="workload-person"><Avatar user={user} size={30} /> <span>{user.name}</span></div>
              <div className="workload-track">
                <div className="workload-cap-line" style={{ left: `${Math.min(100, (capacity / max) * 100)}%` }} />
                <div className={`workload-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
              </div>
              <div className={`workload-value ${over ? 'over' : ''}`}>
                {metric === 'count' ? value : formatNumber(value, unit)}{over ? ' • overloaded' : ''}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="widget-empty">No assigned items yet.</div>}
      </div>
    </div>
  );
}
