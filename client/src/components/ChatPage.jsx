import { useEffect, useMemo, useRef, useState } from 'react';
import { useBoardCtx } from '../context.js';
import { api } from '../api.js';
import { Avatar } from './cells.jsx';
import {
  IconHash, IconMegaphone, IconBot, IconLock, IconUser, IconPaperclip, IconMic, IconVideo,
  IconTask, IconBolt, IconSend, IconPlus, IconFile, IconImage, IconArrowLeft,
} from './icons.jsx';

// The AI assistant identity (mirrors AI_USER on the server).
const AI = { id: 'ai', name: 'OpenCRM AI', initials: 'AI', color: '#6c5ce7', bot: true };

// Line icon for a channel based on its kind.
function ChannelIcon({ channel, size = 17 }) {
  if (channel.type === 'ai') return <IconBot size={size} />;
  if (channel.type === 'broadcast') return <IconMegaphone size={size} />;
  if (channel.type === 'group' && channel.private) return <IconLock size={size} />;
  return <IconHash size={size} />;
}

function useResolveUser(users) {
  return useMemo(() => (id) => (id === 'ai' ? AI : users.find((u) => u.id === id) || { id, name: 'Unknown', initials: '?', color: '#999' }), [users]);
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

function kindFromMime(mime) {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

// ---------------------------------------------------------------- messages

function MentionText({ text, users }) {
  const resolve = useResolveUser(users);
  const known = [...users.map((u) => u.name), 'ai'];
  // Highlight @Name and @ai tokens.
  const parts = text.split(/(@[\w][\w .'-]*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('@')) {
          const name = p.slice(1).trim().toLowerCase();
          const hit = name === 'ai' || users.some((u) => u.name.toLowerCase().startsWith(name) || u.name.split(' ')[0].toLowerCase() === name);
          if (hit) return <span key={i} className="mention-token">{p}</span>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function Attachment({ att }) {
  if (att.kind === 'image') return <img className="chat-img" src={att.url} alt={att.name} />;
  if (att.kind === 'video' || att.kind === 'videonote') return <video className={att.kind === 'videonote' ? 'chat-videonote' : 'chat-video'} src={att.url} controls />;
  if (att.kind === 'audio') return <audio className="chat-audio" src={att.url} controls />;
  return (
    <a className="chat-file" href={att.url} download={att.name} target="_blank" rel="noreferrer">
      <span className="chat-file-icon"><IconFile size={16} /></span>
      <span className="chat-file-name">{att.name}</span>
    </a>
  );
}

function TaskCard({ taskRef }) {
  const { boards, actions } = useBoardCtx();
  const board = boards.find((b) => b.id === taskRef.boardId);
  return (
    <button className="chat-task-card" onClick={() => taskRef.boardId && actions.goToBoard(taskRef.boardId, taskRef.itemId)}>
      <span className="chat-task-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4 4L19 7" /></svg></span>
      <span className="chat-task-body">
        <span className="chat-task-name">{taskRef.itemName || taskRef.name || 'Task'}</span>
        {board && <span className="chat-task-board">{board.name}</span>}
      </span>
    </button>
  );
}

function MessageItem({ msg, users, currentUserId, onDelete }) {
  const resolve = useResolveUser(users);
  const author = resolve(msg.userId);
  const mine = msg.userId === currentUserId;
  const isAi = msg.userId === 'ai';
  return (
    <div className={`chat-msg ${isAi ? 'ai-msg' : ''}`}>
      <Avatar user={author} size={34} />
      <div className="chat-msg-body">
        <div className="chat-msg-head">
          <strong>{author.name}</strong>
          {author.bot && <span className="bot-tag">BOT</span>}
          <span className="chat-msg-time">{timeAgo(msg.at)}</span>
          {mine && <button className="chat-msg-del" title="Delete" onClick={() => onDelete(msg.id)}>×</button>}
        </div>
        {msg.text && <div className="chat-msg-text"><MentionText text={msg.text} users={users} /></div>}
        {msg.taskRef && <TaskCard taskRef={msg.taskRef} />}
        {(msg.attachments || []).map((att, i) => <Attachment key={i} att={att} />)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- task picker

function TaskPicker({ onPick, onClose }) {
  const { boards } = useBoardCtx();
  const [boardId, setBoardId] = useState(boards[0]?.id);
  const [board, setBoard] = useState(null);
  useEffect(() => { if (boardId) api.getBoard(boardId).then(setBoard).catch(console.error); }, [boardId]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal task-picker" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Attach a task</h2><button className="icon-btn" onClick={onClose}>×</button></div>
        <select value={boardId} onChange={(e) => setBoardId(e.target.value)} className="calendar-select">
          {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="task-picker-list">
          {board?.groups.flatMap((g) => g.items).map((it) => (
            <button key={it.id} className="task-picker-item" onClick={() => onPick({ boardId, itemId: it.id, itemName: it.name })}>
              {it.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- composer

function Composer({ channel, onSent }) {
  const { users, currentUserId } = useBoardCtx();
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [plusMenu, setPlusMenu] = useState(null); // null | 'attach' | 'quick'
  const [quickReplies, setQuickReplies] = useState([]);
  const [taskPicker, setTaskPicker] = useState(false);
  const [recording, setRecording] = useState(null); // 'audio' | 'video' | null
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef(null);
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const plusRef = useRef(null);

  // Close the plus menu when clicking outside it.
  useEffect(() => {
    if (!plusMenu) return;
    const h = (e) => { if (plusRef.current && !plusRef.current.contains(e.target)) setPlusMenu(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [plusMenu]);

  useEffect(() => { api.getQuickReplies().then(setQuickReplies).catch(() => {}); }, []);

  const members = useMemo(() => {
    const base = (channel.members || []).map((id) => users.find((u) => u.id === id)).filter(Boolean);
    return [...base, AI];
  }, [channel, users]);

  const onTextChange = (e) => {
    const v = e.target.value;
    setText(v);
    const m = v.slice(0, e.target.selectionStart).match(/@([\w]*)$/);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  };

  const pickMention = (u) => {
    setText((t) => t.replace(/@([\w]*)$/, `@${u.name.split(' ')[0]} `));
    setMentions((m) => (m.includes(u.id) ? m : [...m, u.id]));
    setMentionQuery(null);
    taRef.current?.focus();
  };

  const addFiles = async (files) => {
    const next = [];
    for (const f of files) {
      if (f.size > 675 * 1024) { alert(`"${f.name}" is too large (max ~675 KB).`); continue; }
      const url = await fileToDataUrl(f);
      next.push({ name: f.name, url, mime: f.type, kind: kindFromMime(f.type) });
    }
    setAttachments((a) => [...a, ...next]);
  };

  const send = async (overrides = {}) => {
    const payload = {
      type: overrides.type || (attachments[0]?.kind) || (overrides.taskRef ? 'task' : 'text'),
      text: (overrides.text ?? text).trim(),
      mentions: [...new Set([...mentions, ...(/(^|\s)@ai(\s|$)/i.test(text) ? ['ai'] : [])])],
      attachments: overrides.attachments || attachments,
      taskRef: overrides.taskRef || null,
    };
    if (!payload.text && !payload.attachments.length && !payload.taskRef) return;
    setBusy(true);
    try {
      const res = await api.sendMessage(channel.id, payload);
      setText(''); setMentions([]); setAttachments([]); setMentionQuery(null);
      onSent(res);
    } catch (e) {
      alert(e.message.includes('413') ? 'Attachment too large.' : 'Failed to send.');
    } finally { setBusy(false); }
  };

  const startRecording = async (mode) => {
    if (!navigator.mediaDevices?.getUserMedia) { alert('Recording is not supported in this browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mode === 'video' ? { audio: true, video: true } : { audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType });
        if (blob.size > 675 * 1024) { alert('Recording too long (max ~675 KB). Try a shorter note.'); setRecording(null); return; }
        const url = await fileToDataUrl(blob);
        const kind = mode === 'video' ? 'videonote' : 'audio';
        await send({ type: kind, text: '', attachments: [{ name: `${kind}-${Date.now()}`, url, mime: rec.mimeType, kind }] });
        setRecording(null);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(mode);
    } catch { alert('Could not access microphone/camera.'); }
  };
  const stopRecording = () => recorderRef.current?.stop();

  const mentionMatches = mentionQuery !== null
    ? members.filter((u) => u.name.toLowerCase().includes(mentionQuery)).slice(0, 6)
    : [];

  return (
    <div className="chat-composer">
      {attachments.length > 0 && (
        <div className="composer-previews">
          {attachments.map((a, i) => (
            <span key={i} className="preview-chip">
              {a.kind === 'image'
                ? <img src={a.url} alt="" />
                : <span className="preview-meta">{a.kind === 'audio' ? <IconMic size={14} /> : a.kind === 'video' ? <IconVideo size={14} /> : <IconFile size={14} />} {a.name}</span>}
              <button className="preview-x" title="Remove" onClick={() => setAttachments((arr) => arr.filter((_, idx) => idx !== i))}>×</button>
            </span>
          ))}
        </div>
      )}

      {recording ? (
        <div className="recording-bar">
          <span className="rec-dot" /> Recording {recording === 'video' ? 'video note' : 'voice note'}…
          <button className="btn-primary btn-sm" onClick={stopRecording}>Stop &amp; send</button>
          <button className="btn-outline btn-sm" onClick={() => { recorderRef.current = null; setRecording(null); }}>Cancel</button>
        </div>
      ) : (
        <div className="composer-main">
          <div className="composer-tools" ref={plusRef}>
            <button className={`tool-btn plus-btn ${plusMenu ? 'open' : ''}`} title="Add attachment" onClick={() => setPlusMenu(plusMenu ? null : 'attach')}>
              <IconPlus size={20} />
            </button>
            {plusMenu === 'attach' && (
              <div className="dropdown-menu attach-menu">
                <button className="attach-option" onClick={() => { fileRef.current?.click(); setPlusMenu(null); }}><IconImage size={17} /> Photo, video or file</button>
                <button className="attach-option" onClick={() => { setPlusMenu(null); startRecording('audio'); }}><IconMic size={17} /> Voice note</button>
                <button className="attach-option" onClick={() => { setPlusMenu(null); startRecording('video'); }}><IconVideo size={17} /> Video note</button>
                <button className="attach-option" onClick={() => { setPlusMenu(null); setTaskPicker(true); }}><IconTask size={17} /> Attach task</button>
                <button className="attach-option" onClick={() => setPlusMenu('quick')}><IconBolt size={17} /> Quick reply</button>
              </div>
            )}
            {plusMenu === 'quick' && (
              <div className="dropdown-menu attach-menu">
                <button className="attach-option attach-back" onClick={() => setPlusMenu('attach')}><IconArrowLeft size={16} /> Back</button>
                {quickReplies.map((q, i) => (
                  <button key={i} className="attach-option" onClick={() => { setText((t) => (t ? t + ' ' : '') + q); setPlusMenu(null); taRef.current?.focus(); }}>{q}</button>
                ))}
                {quickReplies.length === 0 && <div className="widget-empty">No quick replies</div>}
              </div>
            )}
          </div>

          <div className="composer-input-wrap">
            {mentionMatches.length > 0 && (
              <div className="mention-autocomplete">
                {mentionMatches.map((u) => (
                  <button key={u.id} className="person-option" onMouseDown={(e) => { e.preventDefault(); pickMention(u); }}>
                    <Avatar user={u} size={22} /> {u.name}{u.bot ? ' (AI)' : ''}
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={taRef}
              className="composer-textarea"
              placeholder={channel.type === 'ai' ? 'Ask about your tasks…' : `Message ${channel.type === 'dm' ? '' : '#'}${channel.name || ''}  (use @ to mention, @ai to ask AI)`}
              value={text}
              onChange={onTextChange}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
          </div>

          <button className="btn-primary send-btn" disabled={busy} title="Send" onClick={() => send()}><IconSend size={18} /></button>
          <input ref={fileRef} type="file" hidden multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
            onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />
        </div>
      )}

      {taskPicker && <TaskPicker onClose={() => setTaskPicker(false)} onPick={(taskRef) => { setTaskPicker(false); send({ type: 'task', taskRef }); }} />}
    </div>
  );
}

// ---------------------------------------------------------------- helpers

// A channel's display name + avatar. DMs show the other participant.
function useChannelDisplay(users, currentUserId) {
  const resolve = useResolveUser(users);
  return useMemo(() => (c) => {
    if (c.type === 'dm') {
      const otherId = (c.members || []).find((id) => id !== currentUserId) || (c.members || [])[0];
      const u = resolve(otherId);
      return { name: u.name, dmUser: u };
    }
    return { name: c.name, dmUser: null };
  }, [resolve, currentUserId]);
}

// Which sidebar section a channel belongs to.
function sectionOf(c) {
  if (c.type === 'ai') return 'ai';
  if (c.type === 'dm') return 'dms';
  if (c.type === 'group' && c.private) return 'groups';
  return 'channels'; // public groups + broadcasts
}

// ---- unread tracking (client-side, via localStorage) ----
const READ_KEY = 'opencrm-chat-read';
const loadReadState = () => { try { return JSON.parse(localStorage.getItem(READ_KEY)) || {}; } catch { return {}; } };
const saveReadState = (s) => { try { localStorage.setItem(READ_KEY, JSON.stringify(s)); } catch { /* ignore */ } };

// ---------------------------------------------------------------- new channel modal

function NewChannelModal({ onClose, onCreate }) {
  const { users, currentUserId } = useBoardCtx();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('channel'); // channel | private | broadcast | dm
  const [members, setMembers] = useState(users.map((u) => u.id));
  const [dmUser, setDmUser] = useState(users.find((u) => u.id !== currentUserId)?.id);
  const toggle = (id) => setMembers((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);

  const submit = () => {
    if (kind === 'dm') {
      if (!dmUser) return;
      onCreate({ type: 'dm', name: '', members: [...new Set([currentUserId, dmUser])] });
      return;
    }
    if (!name.trim()) return;
    const map = { channel: { type: 'group' }, private: { type: 'group', private: true }, broadcast: { type: 'broadcast' } };
    onCreate({ ...map[kind], name: name.trim(), members });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>Create</h2><button className="icon-btn" onClick={onClose}>×</button></div>
        <div className="kind-tabs">
          {[['channel', 'Channel', IconHash], ['private', 'Private', IconLock], ['broadcast', 'Broadcast', IconMegaphone], ['dm', 'Direct', IconUser]].map(([k, label, Ico]) => (
            <button key={k} className={`kind-tab ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}><Ico size={15} /> {label}</button>
          ))}
        </div>

        {kind === 'dm' ? (
          <>
            <label className="settings-head">Chat with</label>
            <div className="member-pick">
              {users.filter((u) => u.id !== currentUserId).map((u) => (
                <button key={u.id} className={`person-option ${dmUser === u.id ? 'current' : ''}`} onClick={() => setDmUser(u.id)}>
                  <input type="radio" readOnly checked={dmUser === u.id} /> <Avatar user={u} size={22} /> {u.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label className="settings-head">Name</label>
            <input className="unit-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="marketing" style={{ width: '100%', margin: '0 0 10px' }} autoFocus />
            <label className="settings-head">Members</label>
            <div className="member-pick">
              {users.map((u) => (
                <button key={u.id} className={`person-option ${members.includes(u.id) ? 'current' : ''}`} onClick={() => toggle(u.id)}>
                  <input type="checkbox" readOnly checked={members.includes(u.id)} /> <Avatar user={u} size={22} /> {u.name}
                </button>
              ))}
            </div>
          </>
        )}
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={submit}>Create</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sidebar

const SECTIONS = [
  { key: 'ai', label: 'Assistant' },
  { key: 'channels', label: 'Channels' },
  { key: 'groups', label: 'Private Groups' },
  { key: 'dms', label: 'Direct Messages' },
];

function ChannelRow({ c, active, unread, display, onClick }) {
  const d = display(c);
  return (
    <button className={`chat-channel ${active ? 'active' : ''} ${unread ? 'has-unread' : ''}`} onClick={onClick}>
      {d.dmUser
        ? <span className="chat-dm-avatar"><Avatar user={d.dmUser} size={20} /></span>
        : <span className="chat-channel-icon"><ChannelIcon channel={c} size={16} /></span>}
      <span className="chat-channel-name">{d.name}</span>
      {c.type === 'broadcast' && <span className="chat-channel-tag">bcast</span>}
      {unread > 0 && <span className="chat-unread">{unread}</span>}
    </button>
  );
}

function ChatSidebar({ channels, activeId, onSelect, onNew, unreadFor, display }) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const filtered = query
    ? channels.filter((c) => display(c).name.toLowerCase().includes(query.toLowerCase()))
    : channels;

  return (
    <aside className="chat-sidebar">
      <div className="chat-search-row">
        <div className="chat-search">
          <svg viewBox="0 0 20 20" width="14" height="14"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65-1.06 1.06-3.65-3.65A5.5 5.5 0 1 1 8.5 3zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>
          <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="icon-btn chat-new-btn" title="Create channel / DM" onClick={onNew}>
          <svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6A1.5 1.5 0 0 1 14.5 13H8l-3 3v-3H5.5A1.5 1.5 0 0 1 4 11.5v-6z"/><path fill="var(--surface)" d="M10 6.5v2H8v1h2v2h1v-2h2v-1h-2v-2z"/></svg>
        </button>
      </div>

      {SECTIONS.map(({ key, label }) => {
        const items = filtered.filter((c) => sectionOf(c) === key);
        if (!items.length) return null;
        const isCollapsed = collapsed[key];
        return (
          <div key={key} className="chat-section">
            <button className="chat-section-head" onClick={() => setCollapsed((s) => ({ ...s, [key]: !s[key] }))}>
              <svg viewBox="0 0 20 20" width="12" height="12" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none' }}>
                <path fill="currentColor" d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z"/>
              </svg>
              {label}
              <span className="chat-section-count">{items.length}</span>
            </button>
            {!isCollapsed && items.map((c) => (
              <ChannelRow key={c.id} c={c} active={c.id === activeId} unread={unreadFor(c)} display={display} onClick={() => onSelect(c.id)} />
            ))}
          </div>
        );
      })}
    </aside>
  );
}

// ---------------------------------------------------------------- page

export default function ChatPage() {
  const { users, currentUserId, actions } = useBoardCtx();
  const [channels, setChannels] = useState(null); // null = loading
  const [activeId, setActiveId] = useState(null);
  const [channel, setChannel] = useState(null);
  const [creating, setCreating] = useState(false);
  const [readState, setReadState] = useState(loadReadState);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef(null);
  const resolve = useResolveUser(users);
  const display = useChannelDisplay(users, currentUserId);

  const loadChannels = () => api.getChannels().then((list) => {
    setChannels(list);
    setActiveId((cur) => cur || list[0]?.id);
    return list;
  });

  useEffect(() => { loadChannels().catch((e) => { console.error(e); setChannels([]); }); }, []);

  useEffect(() => {
    if (!activeId) { setChannel(null); return; }
    let stale = false;
    api.getChannel(activeId).then((c) => { if (!stale) setChannel(c); }).catch(console.error);
    return () => { stale = true; };
  }, [activeId]);

  // Mark the open channel read whenever its message count changes.
  useEffect(() => {
    if (!channel) return;
    setReadState((s) => {
      const next = { ...s, [channel.id]: channel.messages.length };
      saveReadState(next);
      return next;
    });
  }, [channel?.id, channel?.messages?.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [channel?.messages?.length]);

  const unreadFor = (c) => Math.max(0, (c.messageCount || 0) - (readState[c.id] || 0));

  const onSent = (res) => {
    setChannel((c) => {
      if (!c) return c;
      const msgs = [...c.messages, res.message];
      if (res.aiReply) msgs.push(res.aiReply);
      return { ...c, messages: msgs };
    });
    loadChannels().catch(() => {});
  };

  const deleteMessage = async (msgId) => {
    setChannel((c) => ({ ...c, messages: c.messages.filter((m) => m.id !== msgId) }));
    await api.deleteMessage(activeId, msgId).catch(console.error);
  };

  const createChannel = async (data) => {
    const created = await api.createChannel(data);
    setCreating(false);
    await loadChannels();
    setActiveId(created.id);
  };

  const deleteChannel = async () => {
    if (!channel || !confirm(`Delete “${display(channel).name}”?`)) return;
    setMenuOpen(false);
    await api.deleteChannel(channel.id).catch(console.error);
    const list = await loadChannels();
    setActiveId(list.filter((c) => c.id !== channel.id)[0]?.id ?? null);
  };

  const d = channel ? display(channel) : null;
  const noChannels = Array.isArray(channels) && channels.length === 0;

  return (
    <div className="chat-page">
      {channels === null ? (
        <div className="empty-state" style={{ margin: 'auto' }}><h2>Loading chat…</h2></div>
      ) : (
        <>
          <ChatSidebar
            channels={channels} activeId={activeId} onSelect={setActiveId}
            onNew={() => setCreating(true)} unreadFor={unreadFor} display={display}
          />

          <section className="chat-main">
            {noChannels ? (
              <div className="empty-state" style={{ margin: 'auto' }}>
                <h2>No channels yet</h2>
                <p>Create a channel or DM to start talking.</p>
                <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>Create channel</button>
              </div>
            ) : channel ? (
              <>
                <div className="chat-header">
                  <div className="chat-header-title">
                    {d.dmUser ? <Avatar user={d.dmUser} size={24} /> : <span className="chat-channel-icon"><ChannelIcon channel={channel} size={18} /></span>}
                    <strong>{d.name}</strong>
                    {channel.description && <span className="chat-header-desc">{channel.description}</span>}
                  </div>
                  <div className="chat-header-actions">
                    {channel.type !== 'dm' && channel.type !== 'ai' && (
                      <div className="chat-header-members" title={`${channel.members?.length || 0} members`}>
                        {(channel.members || []).slice(0, 4).map((id) => <Avatar key={id} user={resolve(id)} size={24} />)}
                        {(channel.members || []).length > 4 && <span className="avatar-more">+{channel.members.length - 4}</span>}
                      </div>
                    )}
                    <div className="chat-menu-wrap">
                      <button className="topbar-icon" title="Channel options" onClick={() => setMenuOpen(!menuOpen)}>
                        <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="4" r="1.6" fill="currentColor"/><circle cx="10" cy="10" r="1.6" fill="currentColor"/><circle cx="10" cy="16" r="1.6" fill="currentColor"/></svg>
                      </button>
                      {menuOpen && (
                        <div className="dropdown-menu chat-menu">
                          <button className="menu-option danger" onClick={deleteChannel}>Delete channel</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {channel.type === 'broadcast' && <div className="broadcast-banner"><IconMegaphone size={15} /> Broadcast — messages here reach the whole company.</div>}
                {channel.type === 'ai' && <div className="broadcast-banner ai-banner"><IconBot size={15} /> AI assistant — ask about deals, deadlines, and who owns what.</div>}

                <div className="chat-thread" ref={scrollRef}>
                  {channel.messages.map((m) => (
                    <MessageItem key={m.id} msg={m} users={users} currentUserId={currentUserId} onDelete={deleteMessage} />
                  ))}
                  {channel.messages.length === 0 && <div className="widget-empty">No messages yet. Start the conversation.</div>}
                </div>

                <Composer channel={channel} onSent={onSent} />
              </>
            ) : (
              <div className="empty-state" style={{ margin: 'auto' }}><h2>Select a conversation</h2></div>
            )}
          </section>
        </>
      )}

      {creating && <NewChannelModal onClose={() => setCreating(false)} onCreate={createChannel} />}
    </div>
  );
}
