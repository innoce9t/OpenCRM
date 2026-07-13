import { useMemo, useState } from 'react';
import { useBoardCtx } from '../context.js';
import { matchesFilters, matchesSearch } from '../util.js';

const DAY = 86400000;
const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// Gantt-style timeline. Uses timeline columns first; a plain date column is
// drawn as a single-day marker so date-only boards still render something useful.
export default function TimelineView() {
  const { board, users, search, filters, actions } = useBoardCtx();
  const timelineCols = board.columns.filter((c) => c.type === 'timeline');
  const dateCols = board.columns.filter((c) => c.type === 'date');
  const statusColumn = board.columns.find((c) => c.type === 'status');
  const source = timelineCols[0] || dateCols[0];
  const [colId, setColId] = useState(source?.id);
  const activeCol = board.columns.find((c) => c.id === colId) || source;

  const rows = useMemo(() => {
    if (!activeCol) return [];
    const out = [];
    for (const g of board.groups) for (const item of g.items) {
      if (!matchesSearch(item, search, board.columns, users) || !matchesFilters(item, filters, board.columns, users)) continue;
      const v = item.values[activeCol.id];
      let start, end;
      if (activeCol.type === 'timeline') { start = v?.start; end = v?.end || v?.start; }
      else { start = v; end = v; }
      if (!start) continue;
      out.push({ item, group: g, start: new Date(start + 'T00:00:00'), end: new Date((end || start) + 'T00:00:00') });
    }
    return out;
  }, [board, activeCol, search, filters, users]);

  if (!source) {
    return <div className="empty-state"><h2>No timeline or date column</h2><p>Add a Timeline (or Date) column to use this view.</p></div>;
  }
  if (!rows.length) {
    return <div className="empty-state"><h2>Nothing to plot</h2><p>No items have a value in “{activeCol.title}”.</p></div>;
  }

  const min = new Date(Math.min(...rows.map((r) => r.start)));
  const max = new Date(Math.max(...rows.map((r) => r.end)));
  min.setDate(min.getDate() - 2);
  max.setDate(max.getDate() + 2);
  const span = Math.max(1, Math.round((max - min) / DAY));

  // Weekly gridlines.
  const ticks = [];
  for (let t = new Date(min); t <= max; t.setDate(t.getDate() + 7)) {
    ticks.push({ left: ((t - min) / DAY / span) * 100, label: fmt(new Date(t)) });
  }
  const labelColor = (item) => (statusColumn && statusColumn.labels.find((l) => l.id === item.values[statusColumn.id])?.color) || '#579bfc';

  return (
    <div className="timeline-view">
      <div className="calendar-toolbar">
        <h2 className="calendar-title">Timeline</h2>
        {(timelineCols.length + dateCols.length) > 1 && (
          <select className="calendar-select" value={colId} onChange={(e) => setColId(e.target.value)}>
            {[...timelineCols, ...dateCols].map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
        <span className="board-desc">{fmt(min)} – {fmt(max)}</span>
      </div>

      <div className="gantt">
        <div className="gantt-axis">
          {ticks.map((t, i) => <span key={i} className="gantt-tick" style={{ left: `${t.left}%` }}>{t.label}</span>)}
        </div>
        <div className="gantt-body">
          {ticks.map((t, i) => <span key={i} className="gantt-gridline" style={{ left: `${t.left}%` }} />)}
          {rows.map(({ item, start, end }) => {
            const left = ((start - min) / DAY / span) * 100;
            const width = Math.max(1.5, ((end - start + DAY) / DAY / span) * 100);
            return (
              <div key={item.id} className="gantt-row">
                <div className="gantt-label" title={item.name}>{item.name}</div>
                <div className="gantt-track">
                  <button className="gantt-bar" style={{ left: `${left}%`, width: `${width}%`, background: labelColor(item) }}
                    onClick={() => actions.openItem(item.id)} title={`${item.name}: ${fmt(start)} – ${fmt(end)}`}>
                    <span className="gantt-bar-label">{item.name}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
