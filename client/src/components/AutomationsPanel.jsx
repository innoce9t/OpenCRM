import { useState } from 'react';
import { useBoardCtx } from '../context.js';

// Human-readable summary of one automation rule.
function describe(auto, board, users) {
  const col = board.columns.find((c) => c.id === auto.trigger?.columnId);
  const label = col?.labels?.find((l) => l.id === auto.trigger?.labelId);
  const when = col && label ? `When ${col.title} becomes “${label.text}”` : 'When…';
  const a = auto.action || {};
  let then = '…';
  if (a.type === 'notify') then = `notify ${a.userId === '__owner' ? 'the item owner' : (users.find((u) => u.id === a.userId)?.name || 'someone')}`;
  else if (a.type === 'set') {
    const sc = board.columns.find((c) => c.id === a.columnId);
    const sl = sc?.labels?.find((l) => l.id === a.value);
    then = `set ${sc?.title || '?'} to “${sl?.text || a.value}”`;
  } else if (a.type === 'move') then = `move to ${board.groups.find((g) => g.id === a.groupId)?.title || '?'}`;
  else if (a.type === 'slack') then = 'send a Slack message';
  else if (a.type === 'webhook') then = 'call a webhook';
  return `${when}, ${then}.`;
}

function Builder({ onDone }) {
  const { board, users, actions } = useBoardCtx();
  const statusCols = board.columns.filter((c) => c.type === 'status' || c.type === 'dropdown');
  const [triggerCol, setTriggerCol] = useState(statusCols[0]?.id || '');
  const triggerColObj = board.columns.find((c) => c.id === triggerCol);
  const [triggerLabel, setTriggerLabel] = useState(triggerColObj?.labels?.[0]?.id || '');
  const [actionType, setActionType] = useState('notify');
  const [notifyUser, setNotifyUser] = useState('__owner');
  const [setCol, setSetCol] = useState(statusCols[0]?.id || '');
  const setColObj = board.columns.find((c) => c.id === setCol);
  const [setVal, setSetVal] = useState(setColObj?.labels?.[0]?.id || '');
  const [moveGroup, setMoveGroup] = useState(board.groups[0]?.id || '');
  const [webhookUrl, setWebhookUrl] = useState('');

  const save = async () => {
    let action;
    if (actionType === 'notify') action = { type: 'notify', userId: notifyUser };
    else if (actionType === 'set') action = { type: 'set', columnId: setCol, value: setVal };
    else if (actionType === 'move') action = { type: 'move', groupId: moveGroup };
    else if (actionType === 'webhook') action = { type: 'webhook', url: webhookUrl.trim() };
    else if (actionType === 'slack') action = { type: 'slack', url: webhookUrl.trim() };
    if ((actionType === 'webhook' || actionType === 'slack') && !webhookUrl.trim()) return;
    await actions.addAutomation({ enabled: true, trigger: { columnId: triggerCol, labelId: triggerLabel }, action });
    onDone();
  };

  if (!statusCols.length) return <p className="widget-empty">Add a Status or Dropdown column first to build automations.</p>;

  return (
    <div className="auto-builder">
      <div className="auto-line">
        <span className="auto-kw">When</span>
        <select value={triggerCol} onChange={(e) => { setTriggerCol(e.target.value); const c = board.columns.find((x) => x.id === e.target.value); setTriggerLabel(c?.labels?.[0]?.id || ''); }}>
          {statusCols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <span className="auto-kw">becomes</span>
        <select value={triggerLabel} onChange={(e) => setTriggerLabel(e.target.value)}>
          {triggerColObj?.labels?.map((l) => <option key={l.id} value={l.id}>{l.text}</option>)}
        </select>
      </div>
      <div className="auto-line">
        <span className="auto-kw">then</span>
        <select value={actionType} onChange={(e) => setActionType(e.target.value)}>
          <option value="notify">notify</option>
          <option value="set">set a column</option>
          <option value="move">move to group</option>
          <option value="slack">send to Slack</option>
          <option value="webhook">call a webhook</option>
        </select>
        {actionType === 'notify' && (
          <select value={notifyUser} onChange={(e) => setNotifyUser(e.target.value)}>
            <option value="__owner">the item owner</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        {actionType === 'set' && (
          <>
            <select value={setCol} onChange={(e) => { setSetCol(e.target.value); const c = board.columns.find((x) => x.id === e.target.value); setSetVal(c?.labels?.[0]?.id || ''); }}>
              {statusCols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <span className="auto-kw">to</span>
            <select value={setVal} onChange={(e) => setSetVal(e.target.value)}>
              {setColObj?.labels?.map((l) => <option key={l.id} value={l.id}>{l.text}</option>)}
            </select>
          </>
        )}
        {actionType === 'move' && (
          <select value={moveGroup} onChange={(e) => setMoveGroup(e.target.value)}>
            {board.groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        )}
        {(actionType === 'webhook' || actionType === 'slack') && (
          <input className="auto-url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={actionType === 'slack' ? 'Slack incoming webhook URL' : 'https://your-endpoint.example/hook'} />
        )}
      </div>
      {(actionType === 'webhook' || actionType === 'slack') && (
        <div className="menu-note">{actionType === 'slack' ? 'Create an Incoming Webhook in Slack and paste its URL.' : 'Works with Zapier/Make catch hooks — receives a JSON payload.'}</div>
      )}
      <div className="auto-builder-actions">
        <button className="btn-outline btn-sm" onClick={onDone}>Cancel</button>
        <button className="btn-primary btn-sm" onClick={save}>Create automation</button>
      </div>
    </div>
  );
}

export default function AutomationsPanel({ onClose }) {
  const { board, users, actions } = useBoardCtx();
  const [building, setBuilding] = useState(false);
  const autos = board.automations || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal automations-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Automations</h2>
          <button className="icon-btn" onClick={onClose}>
            <svg viewBox="0 0 20 20" width="18" height="18"><path fill="currentColor" d="M5.7 4.3 10 8.6l4.3-4.3 1.4 1.4L11.4 10l4.3 4.3-1.4 1.4L10 11.4l-4.3 4.3-1.4-1.4L8.6 10 4.3 5.7z"/></svg>
          </button>
        </div>

        <div className="automations-list">
          {autos.length === 0 && !building && <div className="widget-empty">No automations yet. Rules run automatically when a status changes.</div>}
          {autos.map((auto) => (
            <div key={auto.id} className={`automation-row ${auto.enabled ? '' : 'disabled'}`}>
              <label className="switch">
                <input type="checkbox" checked={auto.enabled} onChange={(e) => actions.updateAutomation(auto.id, { enabled: e.target.checked })} />
                <span className="slider" />
              </label>
              <span className="automation-desc">{describe(auto, board, users)}</span>
              <button className="icon-btn danger" title="Delete" onClick={() => actions.deleteAutomation(auto.id)}>
                <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M8 2h4l.5 1.5H16V5H4V3.5h3.5L8 2zM5 6h10l-.7 11.1a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 6z"/></svg>
              </button>
            </div>
          ))}
        </div>

        {building
          ? <Builder onDone={() => setBuilding(false)} />
          : <button className="btn-primary" onClick={() => setBuilding(true)}>+ Add automation</button>}
      </div>
    </div>
  );
}
