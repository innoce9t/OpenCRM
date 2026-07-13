import { useMemo, useState } from 'react';
import { useBoardCtx } from '../context.js';
import { Avatar, formatNumber } from './cells.jsx';
import { matchesFilters, matchesSearch } from '../util.js';

// Kanban groups items by the board's first status column.
export default function KanbanView() {
  const { board, users, search, filters, actions } = useBoardCtx();
  const [dragOver, setDragOver] = useState(null);

  const statusColumn = board.columns.find((c) => c.type === 'status');
  const numberColumn = board.columns.find((c) => c.type === 'number');
  const personColumn = board.columns.find((c) => c.type === 'person');

  const lanes = useMemo(() => {
    if (!statusColumn) return [];
    const all = board.groups.flatMap((g) => g.items).filter((i) =>
      matchesSearch(i, search, board.columns, users) && matchesFilters(i, filters, board.columns, users));
    const byLabel = statusColumn.labels.map((label) => ({
      label,
      items: all.filter((i) => i.values[statusColumn.id] === label.id),
    }));
    const unset = all.filter((i) => !statusColumn.labels.some((l) => l.id === i.values[statusColumn.id]));
    return [...byLabel, { label: { id: '__none', text: 'No status', color: '#c4c4c4' }, items: unset }];
  }, [board, statusColumn, search, filters, users]);

  if (!statusColumn) {
    return <div className="empty-state"><h2>No status column</h2><p>Add a Status column to use the Kanban view.</p></div>;
  }

  const onDrop = (e, labelId) => {
    e.preventDefault();
    setDragOver(null);
    const itemId = e.dataTransfer.getData('text/plain');
    if (itemId) actions.setItemValue(itemId, statusColumn.id, labelId === '__none' ? null : labelId);
  };

  return (
    <div className="kanban">
      {lanes.map(({ label, items }) => (
        <div
          key={label.id}
          className={`kanban-lane ${dragOver === label.id ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(label.id); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => onDrop(e, label.id)}
        >
          <div className="lane-header" style={{ background: label.color }}>
            <span>{label.text}</span>
            <span className="lane-count">{items.length}</span>
          </div>
          <div className="lane-cards">
            {items.map((item) => {
              const owner = personColumn && users.find((u) => u.id === item.values[personColumn.id]);
              const amount = numberColumn ? item.values[numberColumn.id] : undefined;
              return (
                <div
                  key={item.id}
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
                  onClick={() => actions.openItem(item.id)}
                >
                  <div className="card-name">{item.name}</div>
                  <div className="card-meta">
                    {typeof amount === 'number' && <span className="card-amount">{formatNumber(amount, numberColumn.unit)}</span>}
                    {owner && <Avatar user={owner} size={24} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
