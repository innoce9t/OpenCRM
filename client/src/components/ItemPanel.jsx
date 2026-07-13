import { useMemo, useState } from 'react';
import { useBoardCtx, BoardContext } from '../context.js';
import { CellFor, Avatar } from './cells.jsx';

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function UpdatesTab({ item }) {
  const { users, actions, currentUser } = useBoardCtx();
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const post = async () => {
    if (!text.trim()) return;
    await actions.addUpdate(item.id, text.trim(), mentions);
    setText(''); setMentions([]);
  };

  const toggleMention = (id) => setMentions((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);

  return (
    <div className="panel-updates">
      <div className="update-composer">
        <Avatar user={currentUser} size={30} />
        <div className="composer-body">
          <textarea placeholder="Write an update…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="composer-actions">
            <div className="mention-picker">
              <button className="btn-outline btn-sm" onClick={() => setPickerOpen(!pickerOpen)}>@ Notify {mentions.length ? `(${mentions.length})` : ''}</button>
              {pickerOpen && (
                <div className="dropdown-menu">
                  {users.map((u) => (
                    <button key={u.id} className="person-option" onClick={() => toggleMention(u.id)}>
                      <input type="checkbox" readOnly checked={mentions.includes(u.id)} />
                      <Avatar user={u} size={22} /> {u.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-primary btn-sm" onClick={post} disabled={!text.trim()}>Update</button>
          </div>
        </div>
      </div>

      <div className="updates-feed">
        {(item.updates || []).slice().reverse().map((u) => {
          const author = users.find((x) => x.id === u.userId);
          return (
            <div key={u.id} className="update-item">
              <Avatar user={author} size={30} />
              <div className="update-body">
                <div className="update-head">
                  <strong>{author?.name || 'Someone'}</strong>
                  <span className="update-time">{timeAgo(u.at)}</span>
                  <button className="icon-btn update-del" title="Delete" onClick={() => actions.deleteUpdate(item.id, u.id)}>×</button>
                </div>
                <div className="update-text">{u.text}</div>
                {u.mentions?.length > 0 && (
                  <div className="update-mentions">
                    {u.mentions.map((m) => <span key={m} className="mention-chip">@{users.find((x) => x.id === m)?.name || m}</span>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {(!item.updates || item.updates.length === 0) && <div className="widget-empty">No updates yet. Start the conversation.</div>}
      </div>
    </div>
  );
}

function SubitemsTab({ item }) {
  const ctx = useBoardCtx();
  const { board, actions } = ctx;
  const subCols = board.subitemColumns || [];
  const [draft, setDraft] = useState('');
  const add = async () => { if (draft.trim()) { await actions.addSubitem(item.id, draft.trim()); setDraft(''); } };

  const scoped = useMemo(() => ({
    ...ctx,
    actions: { ...actions, setItemValue: (subId, colId, val) => actions.setSubitemValue(item.id, subId, colId, val) },
  }), [ctx, actions, item.id]);

  return (
    <BoardContext.Provider value={scoped}>
      <div className="panel-subitems">
        <table className="subitem-table">
          <thead>
            <tr><th>Subitem</th>{subCols.map((c) => <th key={c.id}>{c.title}</th>)}<th /></tr>
          </thead>
          <tbody>
            {item.subitems.map((sub) => (
              <tr key={sub.id}>
                <td className="subitem-name-cell">{sub.name}</td>
                {subCols.map((c) => <td key={c.id} className={`cell cell-${c.type}`}><CellFor item={sub} column={c} /></td>)}
                <td><button className="icon-btn item-delete-static" onClick={() => actions.deleteSubitem(item.id, sub.id)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="subitem-add-inline">
          <input placeholder="+ Add subitem" value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }} onBlur={add} />
        </div>
      </div>
    </BoardContext.Provider>
  );
}

function ActivityTab({ item }) {
  const { board, users } = useBoardCtx();
  const entries = (board.activity || []).filter((a) => a.itemId === item.id);
  if (!entries.length) return <div className="widget-empty">No activity recorded for this item.</div>;
  return (
    <div className="panel-activity">
      {entries.map((a) => {
        const actor = users.find((u) => u.id === a.actorId);
        return (
          <div key={a.id} className="activity-row">
            <Avatar user={actor} size={24} />
            <span className="activity-text"><strong>{actor?.name || 'Someone'}</strong> {a.text}</span>
            <span className="activity-time">{timeAgo(a.at)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ItemPanel({ item }) {
  const { board, actions } = useBoardCtx();
  const [tab, setTab] = useState('updates');
  const columns = board.columns;

  return (
    <aside className="item-panel">
      <div className="panel-header">
        <input className="panel-title" value={item.name} onChange={(e) => actions.renameItem(item.id, e.target.value)} />
        <button className="icon-btn panel-close" onClick={actions.closeItem} title="Close">
          <svg viewBox="0 0 20 20" width="18" height="18"><path fill="currentColor" d="M5.7 4.3 10 8.6l4.3-4.3 1.4 1.4L11.4 10l4.3 4.3-1.4 1.4L10 11.4l-4.3 4.3-1.4-1.4L8.6 10 4.3 5.7z"/></svg>
        </button>
      </div>

      <div className="panel-fields">
        {columns.map((c) => (
          <div key={c.id} className="panel-field">
            <div className="panel-field-label">{c.title}</div>
            <div className={`panel-field-value cell cell-${c.type}`}><CellFor item={item} column={c} /></div>
          </div>
        ))}
      </div>

      <div className="panel-tabs">
        <button className={`panel-tab ${tab === 'updates' ? 'active' : ''}`} onClick={() => setTab('updates')}>Updates {item.updates?.length ? `(${item.updates.length})` : ''}</button>
        <button className={`panel-tab ${tab === 'subitems' ? 'active' : ''}`} onClick={() => setTab('subitems')}>Subitems {item.subitems?.length ? `(${item.subitems.length})` : ''}</button>
        <button className={`panel-tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>Activity</button>
      </div>

      <div className="panel-tab-body">
        {tab === 'updates' && <UpdatesTab item={item} />}
        {tab === 'subitems' && <SubitemsTab item={item} />}
        {tab === 'activity' && <ActivityTab item={item} />}
      </div>
    </aside>
  );
}
