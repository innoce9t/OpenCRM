import { useEffect, useRef, useState } from 'react';
import { useBoardCtx } from '../context.js';
import { api } from '../api.js';

// A text-only, Notion-style page: a big title + a free-form body that autosaves.
export default function DocPage({ docId }) {
  const { actions } = useBoardCtx();
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState('saved');
  const bodyRef = useRef(null);
  const saveTimer = useRef(null);
  const pending = useRef({});

  useEffect(() => {
    let stale = false;
    api.getDoc(docId).then((d) => { if (!stale) { setDoc(d); setTitle(d.title); setContent(d.content || ''); } }).catch(console.error);
    return () => { stale = true; clearTimeout(saveTimer.current); };
  }, [docId]);

  // Auto-grow the textarea to fit its content.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [content, doc]);

  const queueSave = (patch) => {
    pending.current = { ...pending.current, ...patch }; // merge so title + body both save
    setSaved('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      actions.saveDoc(docId, pending.current);
      pending.current = {};
      setSaved('saved');
    }, 600);
  };

  const onTitle = (e) => { setTitle(e.target.value); queueSave({ title: e.target.value }); };
  const onBody = (e) => { setContent(e.target.value); queueSave({ content: e.target.value }); };

  if (!doc) return <main className="board-area doc-page"><div className="empty-state"><h2>Loading…</h2></div></main>;

  return (
    <main className="board-area doc-page">
      <div className="doc-toolbar">
        <span className={`doc-save ${saved}`}>{saved === 'saving' ? 'Saving…' : 'Saved'}</span>
        <button className="icon-btn doc-delete" title="Delete page"
          onClick={() => { if (confirm(`Delete “${title || 'Untitled'}”?`)) actions.deleteDoc(docId); }}>
          <svg viewBox="0 0 20 20" width="16" height="16"><path fill="currentColor" d="M8 2h4l.5 1.5H16V5H4V3.5h3.5L8 2zM5 6h10l-.7 11.1a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 6z"/></svg>
        </button>
      </div>
      <div className="doc-scroll">
        <div className="doc-inner">
          <textarea
            className="doc-title-input"
            value={title}
            onChange={onTitle}
            placeholder="Untitled"
            rows={1}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }}
          />
          <textarea
            ref={bodyRef}
            className="doc-body-input"
            value={content}
            onChange={onBody}
            placeholder="Start writing…"
          />
        </div>
      </div>
    </main>
  );
}
