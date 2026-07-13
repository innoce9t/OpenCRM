// Shared helpers for reading/normalizing column values, searching, filtering,
// and sorting. Kept view-agnostic so the table, kanban, calendar, timeline and
// dashboard all rank/format values the same way.

export function labelText(column, id) {
  return column.labels?.find((l) => l.id === id)?.text ?? '';
}

// A human-readable string for a cell — used by search and text filters.
export function valueToText(item, column, users) {
  const v = item.values[column.id];
  if (v === undefined || v === null || v === '') return '';
  switch (column.type) {
    case 'status': return labelText(column, v);
    case 'dropdown': return (Array.isArray(v) ? v : [v]).map((id) => labelText(column, id)).join(', ');
    case 'person': return users.find((u) => u.id === v)?.name ?? '';
    case 'checkbox': return v ? 'checked' : '';
    case 'rating': return `${v}`;
    case 'timeline': return [v.start, v.end].filter(Boolean).join(' – ');
    case 'files': return (Array.isArray(v) ? v : []).map((f) => f.name).join(', ');
    default: return String(v);
  }
}

// A value usable for ordering. Numbers stay numeric; everything else compares as text.
function sortKey(item, column, users) {
  const v = item.values[column.id];
  if (column.type === 'number' || column.type === 'rating') return typeof v === 'number' ? v : -Infinity;
  if (column.type === 'checkbox') return v ? 1 : 0;
  if (column.type === 'date') return v || '';
  if (column.type === 'timeline') return v?.start || '';
  return valueToText(item, column, users).toLowerCase();
}

export function sortItems(items, sorts, columns, users) {
  if (!sorts || !sorts.length) return items;
  const cols = Object.fromEntries(columns.map((c) => [c.id, c]));
  return [...items].sort((a, b) => {
    for (const s of sorts) {
      const col = cols[s.columnId];
      if (!col) continue;
      const ka = sortKey(a, col, users);
      const kb = sortKey(b, col, users);
      if (ka < kb) return s.dir === 'desc' ? 1 : -1;
      if (ka > kb) return s.dir === 'desc' ? -1 : 1;
    }
    return 0;
  });
}

export const FILTER_OPS = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

function matchesOne(item, filter, column, users) {
  const raw = item.values[column.id];
  const isEmpty = raw === undefined || raw === null || raw === '' ||
    (Array.isArray(raw) && raw.length === 0);
  switch (filter.op) {
    case 'is_empty': return isEmpty;
    case 'is_not_empty': return !isEmpty;
    case 'is':
      if (column.type === 'person' || column.type === 'status') return raw === filter.value;
      if (column.type === 'dropdown') return Array.isArray(raw) && raw.includes(filter.value);
      if (column.type === 'checkbox') return (filter.value === 'true') === !!raw;
      return valueToText(item, column, users).toLowerCase() === String(filter.value).toLowerCase();
    case 'is_not':
      return !matchesOne(item, { ...filter, op: 'is' }, column, users);
    case 'contains':
      return valueToText(item, column, users).toLowerCase().includes(String(filter.value || '').toLowerCase());
    default: return true;
  }
}

export function matchesFilters(item, filters, columns, users) {
  if (!filters || !filters.length) return true;
  const cols = Object.fromEntries(columns.map((c) => [c.id, c]));
  return filters.every((f) => {
    const col = cols[f.columnId];
    if (!col) return true;
    return matchesOne(item, f, col, users);
  });
}

export function matchesSearch(item, search, columns, users) {
  if (!search) return true;
  const q = search.toLowerCase();
  if (item.name.toLowerCase().includes(q)) return true;
  return columns.some((c) => valueToText(item, c, users).toLowerCase().includes(q));
}
