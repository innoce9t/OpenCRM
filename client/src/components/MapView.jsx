import { useMemo, useState } from 'react';
import { useBoardCtx } from '../context.js';

// Plots items that have a Location column on an equirectangular coordinate grid.
// Location values are "lat,lng" (optionally followed by "· Label"). No external
// map tiles are loaded, so this works fully offline as a coordinate plot.
function parseLoc(v) {
  if (!v) return null;
  const m = String(v).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = parseFloat(m[1]); const lng = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export default function MapView() {
  const { board, actions } = useBoardCtx();
  const locCols = board.columns.filter((c) => c.type === 'location');
  const statusCol = board.columns.find((c) => c.type === 'status');
  const [locColId, setLocColId] = useState(locCols[0]?.id);
  const [hover, setHover] = useState(null);

  const pins = useMemo(() => {
    if (!locColId) return [];
    const out = [];
    for (const g of board.groups) for (const it of g.items) {
      const loc = parseLoc(it.values[locColId]);
      if (!loc) continue;
      out.push({ item: it, x: loc.lng + 180, y: 90 - loc.lat, color: statusCol ? statusCol.labels.find((l) => l.id === it.values[statusCol.id])?.color : null });
    }
    return out;
  }, [board, locColId, statusCol]);

  if (!locCols.length) {
    return <div className="empty-state"><h2>No location column</h2><p>Add a Location column (values like <code>37.77,-122.42</code>) to plot items on the map.</p></div>;
  }

  const graticule = [];
  for (let lng = 0; lng <= 360; lng += 30) graticule.push(<line key={`v${lng}`} x1={lng} y1={0} x2={lng} y2={180} className="map-grid" />);
  for (let lat = 0; lat <= 180; lat += 30) graticule.push(<line key={`h${lat}`} x1={0} y1={lat} x2={360} y2={lat} className="map-grid" />);

  return (
    <div className="map-view">
      <div className="calendar-toolbar">
        <h2 className="calendar-title">Map</h2>
        {locCols.length > 1 && (
          <select className="calendar-select" value={locColId} onChange={(e) => setLocColId(e.target.value)}>
            {locCols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
        <span className="board-desc">{pins.length} located item{pins.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="map-wrap">
        <svg viewBox="0 0 360 180" className="map-svg" preserveAspectRatio="xMidYMid meet">
          <rect x="0" y="0" width="360" height="180" className="map-ocean" />
          {graticule}
          <line x1="0" y1="90" x2="360" y2="90" className="map-equator" />
          {pins.map(({ item, x, y, color }) => (
            <g key={item.id} className="map-pin" onClick={() => actions.openItem(item.id)}
              onMouseEnter={() => setHover(item.id)} onMouseLeave={() => setHover(null)}>
              <circle cx={x} cy={y} r={hover === item.id ? 4 : 2.6} fill={color || 'var(--primary)'} stroke="#fff" strokeWidth="0.6" />
              {hover === item.id && <text x={x} y={y - 5} className="map-label" textAnchor="middle">{item.name}</text>}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
