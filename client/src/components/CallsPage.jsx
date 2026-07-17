import { useEffect, useState } from 'react';
import { useBoardCtx } from '../context.js';
import { api } from '../api.js';
import { IconCallIn, IconCallOut, IconChevron, IconPhone } from './icons.jsx';

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const fmtDur = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

function CallRow({ call }) {
  const { actions } = useBoardCtx();
  const [open, setOpen] = useState(false);
  const inbound = call.direction === 'INCOMING';
  const title = call.matchedItemName || call.contact?.name || call.phone;
  const statusClass = call.status === 'MISSED' ? 'missed' : call.status === 'REJECTED' ? 'rejected' : 'completed';

  return (
    <div className={`call-row ${open ? 'open' : ''}`}>
      <button className="call-head" onClick={() => setOpen((o) => !o)}>
        <span className={`call-dir ${inbound ? 'in' : 'out'}`}>{inbound ? <IconCallIn size={17} /> : <IconCallOut size={17} />}</span>
        <span className="call-main">
          <span className="call-title">{title}</span>
          <span className="call-sub">{call.phone}{call.contact?.company ? ` · ${call.contact.company}` : ''}</span>
        </span>
        <span className="call-meta">
          <span className={`call-status ${statusClass}`}>{call.status.toLowerCase()}</span>
          <span className="call-dur">{fmtDur(call.durationSeconds)}</span>
          <span className="call-time">{timeAgo(call.at)}</span>
        </span>
        <span className={`call-caret ${open ? 'up' : ''}`}><IconChevron size={16} /></span>
      </button>

      {open && (
        <div className="call-body">
          <div className="call-facts">
            {call.agent?.agent_name && <span>Agent: <strong>{call.agent.agent_name}</strong></span>}
            {call.hasRecording && <span className="call-rec">Recording captured on device</span>}
            {call.matchedItemId
              ? <button className="link-btn" onClick={() => actions.goToBoard(call.matchedBoardId, call.matchedItemId)}>Open contact →</button>
              : <span className="call-nomatch">No matching contact</span>}
          </div>
          {call.summary && (
            <div className="call-section">
              <div className="call-section-h">AI summary</div>
              <div className="call-summary">{call.summary}</div>
            </div>
          )}
          {call.transcript && (
            <div className="call-section">
              <div className="call-section-h">Transcript</div>
              <div className="call-transcript">{call.transcript}</div>
            </div>
          )}
          {!call.summary && !call.transcript && <div className="widget-empty">No AI insights for this call.</div>}
        </div>
      )}
    </div>
  );
}

export default function CallsPage() {
  const [calls, setCalls] = useState(null);
  const load = () => api.getCalls().then(setCalls).catch(() => setCalls([]));

  useEffect(() => { load(); }, []);
  // Live-update when the dialer ingests a new call.
  useEffect(() => {
    let es;
    try {
      es = new EventSource('/api/events');
      es.onmessage = (e) => { try { if (JSON.parse(e.data).type === 'calls') load(); } catch { /* ignore */ } };
    } catch { /* SSE unsupported */ }
    return () => es?.close();
  }, []);

  return (
    <main className="board-area calls-page">
      <div className="calls-header">
        <h1 className="board-title"><IconPhone size={20} /> Calls</h1>
        <button className="btn-outline btn-sm" onClick={load}>Refresh</button>
      </div>

      {calls === null && <div className="empty-state"><h2>Loading…</h2></div>}
      {calls && calls.length === 0 && (
        <div className="empty-state">
          <h2>No calls logged yet</h2>
          <p>Point the companion dialer app at this server's <code>/api/crm/call-logs</code> endpoint with your CRM API key. Logged calls appear here and on the matching contact.</p>
        </div>
      )}
      {calls && calls.length > 0 && (
        <div className="calls-list">
          {calls.map((c) => <CallRow key={c.id} call={c} />)}
        </div>
      )}
    </main>
  );
}
