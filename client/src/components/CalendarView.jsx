import { useMemo, useState } from 'react';
import { useBoardCtx } from '../context.js';
import { matchesFilters, matchesSearch } from '../util.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ymd(d) { return d.toISOString().slice(0, 10); }

export default function CalendarView() {
  const { board, users, search, filters, actions } = useBoardCtx();
  const dateColumns = board.columns.filter((c) => c.type === 'date');
  const [dateColId, setDateColId] = useState(dateColumns[0]?.id);
  const statusColumn = board.columns.find((c) => c.type === 'status');

  const initial = useMemo(() => {
    const all = board.groups.flatMap((g) => g.items);
    const first = all.map((i) => i.values[dateColId]).find(Boolean);
    return first ? new Date(first + 'T00:00:00') : new Date();
  }, [board, dateColId]);
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const byDate = useMemo(() => {
    const map = {};
    if (!dateColId) return map;
    for (const g of board.groups) for (const item of g.items) {
      if (!matchesSearch(item, search, board.columns, users) || !matchesFilters(item, filters, board.columns, users)) continue;
      const d = item.values[dateColId];
      if (!d) continue;
      (map[d] = map[d] || []).push(item);
    }
    return map;
  }, [board, dateColId, search, filters, users]);

  if (!dateColumns.length) {
    return <div className="empty-state"><h2>No date column</h2><p>Add a Date column to use the Calendar view.</p></div>;
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const labelColor = (item) => statusColumn ? statusColumn.labels.find((l) => l.id === item.values[statusColumn.id])?.color : null;
  const today = ymd(new Date());

  return (
    <div className="calendar-view">
      <div className="calendar-toolbar">
        <button className="btn-outline" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
        <h2 className="calendar-title">{MONTHS[month]} {year}</h2>
        <button className="btn-outline" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
        <button className="btn-outline" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button>
        {dateColumns.length > 1 && (
          <select className="calendar-select" value={dateColId} onChange={(e) => setDateColId(e.target.value)}>
            {dateColumns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
      </div>
      <div className="calendar-grid calendar-dow">
        {DOW.map((d) => <div key={d} className="calendar-dow-cell">{d}</div>)}
      </div>
      <div className="calendar-grid">
        {cells.map((date, i) => {
          const key = date ? ymd(date) : `empty-${i}`;
          const items = date ? (byDate[key] || []) : [];
          return (
            <div key={key} className={`calendar-cell ${!date ? 'empty' : ''} ${date && key === today ? 'today' : ''}`}>
              {date && <div className="calendar-daynum">{date.getDate()}</div>}
              <div className="calendar-events">
                {items.map((item) => (
                  <button key={item.id} className="calendar-event" style={{ background: labelColor(item) || '#579bfc' }}
                    onClick={() => actions.openItem(item.id)} title={item.name}>{item.name}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
