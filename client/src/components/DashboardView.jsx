import { useMemo } from 'react';
import { useBoardCtx } from '../context.js';
import { formatNumber } from './cells.jsx';

function BarChart({ title, data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="widget">
      <div className="widget-title">{title}</div>
      <div className="bar-chart">
        {data.length === 0 && <div className="widget-empty">No data</div>}
        {data.map((d) => (
          <div key={d.key} className="bar-row">
            <div className="bar-label" title={d.label}>{d.label}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color || '#0073ea' }}>
                <span className="bar-value">{d.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ title, data, unit }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  let acc = 0;
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className="widget">
      <div className="widget-title">{title}</div>
      <div className="donut-wrap">
        {total === 0 ? <div className="widget-empty">No data</div> : (
          <>
            <svg viewBox="0 0 140 140" className="donut">
              {data.map((d) => {
                const frac = d.value / total;
                const dash = frac * C;
                const el = (
                  <circle key={d.key} cx="70" cy="70" r={R} fill="none" stroke={d.color} strokeWidth="18"
                    strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" />
                );
                acc += dash;
                return el;
              })}
              <text x="70" y="74" textAnchor="middle" className="donut-center">{unit ? formatNumber(total, unit) : total}</text>
            </svg>
            <div className="donut-legend">
              {data.map((d) => (
                <div key={d.key} className="legend-row">
                  <span className="legend-dot" style={{ background: d.color }} />
                  <span className="legend-label">{d.label}</span>
                  <span className="legend-value">{d.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardView() {
  const { board, users } = useBoardCtx();

  const stats = useMemo(() => {
    const items = board.groups.flatMap((g) => g.items);
    const statusCol = board.columns.find((c) => c.type === 'status');
    const numberCol = board.columns.find((c) => c.type === 'number');
    const personCol = board.columns.find((c) => c.type === 'person');

    const byStatus = statusCol ? statusCol.labels.map((l) => ({
      key: l.id, label: l.text, color: l.color,
      value: items.filter((i) => i.values[statusCol.id] === l.id).length,
    })).filter((d) => d.value) : [];

    const byPerson = personCol ? users.map((u) => ({
      key: u.id, label: u.name, color: u.color,
      value: items.filter((i) => i.values[personCol.id] === u.id).length,
    })).filter((d) => d.value) : [];

    const numberTotal = numberCol ? items.reduce((a, i) => a + (typeof i.values[numberCol.id] === 'number' ? i.values[numberCol.id] : 0), 0) : null;

    // Value grouped by status (e.g. pipeline $ per stage) if both exist.
    const valueByStatus = (statusCol && numberCol) ? statusCol.labels.map((l) => ({
      key: l.id, label: l.text, color: l.color,
      value: items.filter((i) => i.values[statusCol.id] === l.id).reduce((a, i) => a + (typeof i.values[numberCol.id] === 'number' ? i.values[numberCol.id] : 0), 0),
    })).filter((d) => d.value) : [];

    return { count: items.length, groups: board.groups.length, byStatus, byPerson, numberTotal, numberCol, statusCol, personCol, valueByStatus };
  }, [board, users]);

  return (
    <div className="dashboard-view">
      <div className="kpi-row">
        <div className="kpi-tile">
          <div className="kpi-value">{stats.count}</div>
          <div className="kpi-label">Total items</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-value">{stats.groups}</div>
          <div className="kpi-label">Groups</div>
        </div>
        {stats.numberCol && (
          <div className="kpi-tile">
            <div className="kpi-value">{formatNumber(stats.numberTotal, stats.numberCol.unit)}</div>
            <div className="kpi-label">Total {stats.numberCol.title}</div>
          </div>
        )}
        {stats.statusCol && (
          <div className="kpi-tile">
            <div className="kpi-value">{stats.byStatus.find((d) => /done|won/i.test(d.label))?.value ?? 0}</div>
            <div className="kpi-label">Completed</div>
          </div>
        )}
      </div>

      <div className="widget-grid">
        {stats.statusCol && <DonutChart title={`By ${stats.statusCol.title}`} data={stats.byStatus} />}
        {stats.valueByStatus.length > 0 && <BarChart title={`${stats.numberCol.title} by ${stats.statusCol.title}`} data={stats.valueByStatus} />}
        {stats.personCol && <BarChart title={`Items by ${stats.personCol.title}`} data={stats.byPerson} />}
      </div>
    </div>
  );
}
