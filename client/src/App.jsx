import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, setToken, getToken } from './api.js';
import { BoardContext } from './context.js';
import LoginPage from './components/LoginPage.jsx';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import BoardHeader from './components/BoardHeader.jsx';
import TableView from './components/TableView.jsx';
import KanbanView from './components/KanbanView.jsx';
import CalendarView from './components/CalendarView.jsx';
import TimelineView from './components/TimelineView.jsx';
import DashboardView from './components/DashboardView.jsx';
import FormView from './components/FormView.jsx';
import WorkloadView from './components/WorkloadView.jsx';
import MapView from './components/MapView.jsx';
import ItemPanel from './components/ItemPanel.jsx';
import BulkActionBar from './components/BulkActionBar.jsx';
import ChatPage from './components/ChatPage.jsx';

export default function App() {
  const [users, setUsers] = useState([]);
  const [boards, setBoards] = useState([]);
  const [boardId, setBoardId] = useState(null);
  const [board, setBoard] = useState(null);
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [openItemId, setOpenItemId] = useState(null);
  const [filters, setFilters] = useState([]);
  const [sorts, setSorts] = useState([]);
  const [page, setPage] = useState('board'); // 'board' | 'chat'
  const [selectedIds, setSelectedIds] = useState([]);
  const [mobileNav, setMobileNav] = useState(false); // sidebar drawer on small screens

  const refreshBoards = useCallback(async () => {
    const list = await api.getBoards();
    setBoards(list);
    return list;
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!currentUserId) return;
    try { setNotifications(await api.getNotifications(currentUserId)); } catch (e) { console.error(e); }
  }, [currentUserId]);

  // Restore an existing session on load.
  useEffect(() => {
    if (!getToken()) { setAuthChecked(true); return; }
    api.me()
      .then(({ user }) => { setAuthUser(user); setCurrentUserId(user.id); })
      .catch(() => setToken(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const onAuthed = useCallback((user) => { setAuthUser(user); setCurrentUserId(user.id); }, []);

  // Load data once authenticated.
  useEffect(() => {
    if (!authUser) return;
    (async () => {
      const [userList, boardList, ws] = await Promise.all([api.getUsers(), refreshBoards(), api.getWorkspaces().catch(() => [])]);
      setUsers(userList);
      setWorkspaces(ws);
      if (boardList.length) setBoardId(boardList[0].id);
    })().catch(console.error);
  }, [authUser, refreshBoards]);

  useEffect(() => { refreshNotifications(); }, [refreshNotifications]);

  // Live sync: refetch the active board / notifications when the server signals
  // a change from another client. Debounced so bursts collapse into one refetch.
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;
  useEffect(() => {
    let es;
    let t = null;
    try {
      es = new EventSource('/api/events');
      es.onmessage = (e) => {
        let ev; try { ev = JSON.parse(e.data); } catch { return; }
        if (ev.type === 'board' && ev.id === boardIdRef.current) {
          clearTimeout(t);
          t = setTimeout(() => { api.getBoard(boardIdRef.current).then(setBoard).catch(() => {}); }, 350);
        } else if (ev.type === 'meta') {
          refreshNotifications();
        }
      };
    } catch { /* SSE unsupported */ }
    return () => { clearTimeout(t); es?.close(); };
  }, [refreshNotifications]);

  useEffect(() => {
    if (!boardId) { setBoard(null); return; }
    let stale = false;
    api.getBoard(boardId).then((b) => {
      if (!stale) { setBoard(b); setSearch(''); setView('table'); setFilters([]); setSorts([]); setOpenItemId(null); setSelectedIds([]); }
    }).catch(console.error);
    return () => { stale = true; };
  }, [boardId]);

  // Apply a local mutation optimistically, then run the API call.
  // If the server rejects it, reload the board to resync.
  const mutate = useCallback((localFn, apiCall) => {
    setBoard((prev) => {
      const next = structuredClone(prev);
      localFn(next);
      return next;
    });
    apiCall().catch((err) => {
      console.error(err);
      api.getBoard(boardId).then(setBoard).catch(console.error);
    });
  }, [boardId]);

  const findItem = useCallback((b, itemId) => {
    for (const g of b.groups) { const i = g.items.find((x) => x.id === itemId); if (i) return i; }
    return null;
  }, []);

  const actions = useMemo(() => ({
    selectBoard: (id) => { setBoardId(id); setMobileNav(false); },

    setPage: (p) => { setPage(p); setMobileNav(false); },
    setMobileNav,
    goToBoard: (boardId, itemId) => {
      setPage('board');
      if (boardId) setBoardId(boardId);
      if (itemId) setOpenItemId(itemId);
    },

    logout: async () => {
      try { await api.logout(); } catch { /* ignore */ }
      setToken(null); setAuthUser(null); setCurrentUserId(null);
      setBoards([]); setBoard(null); setBoardId(null); setNotifications([]); setPage('board');
    },

    shareBoard: (id, sharedWith) => {
      setBoards((list) => list.map((b) => (b.id === id ? { ...b, sharedWith } : b)));
      if (board?.id === id) setBoard((b) => ({ ...b, sharedWith }));
      api.shareBoard(id, sharedWith).catch(console.error);
    },

    openItem: setOpenItemId,
    closeItem: () => setOpenItemId(null),

    setFilters,
    setSorts,

    refreshNotifications,
    markNotificationRead: async (id) => {
      setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
      await api.markNotificationRead(id).catch(console.error);
    },
    markAllNotificationsRead: async () => {
      setNotifications((list) => list.map((n) => ({ ...n, read: true })));
      await api.markAllNotificationsRead(currentUserId).catch(console.error);
    },

    addBoard: async (workspaceId) => {
      const created = await api.createBoard('New Board', typeof workspaceId === 'string' ? workspaceId : undefined);
      await refreshBoards();
      setBoardId(created.id);
      return created;
    },

    renameBoard: (id, name) => {
      if (id === boardId) setBoard((b) => ({ ...b, name }));
      setBoards((list) => list.map((b) => (b.id === id ? { ...b, name } : b)));
      api.renameBoard(id, name).catch(console.error);
    },

    deleteBoard: async (id) => {
      await api.deleteBoard(id);
      const list = await refreshBoards();
      if (id === boardId) setBoardId(list[0]?.id ?? null);
    },

    addGroup: async () => {
      const group = await api.addGroup(boardId, 'New Group');
      setBoard((b) => ({ ...b, groups: [...b.groups, { ...group, items: group.items || [] }] }));
    },

    renameGroup: (groupId, title) => mutate(
      (b) => { const g = b.groups.find((g) => g.id === groupId); if (g) g.title = title; },
      () => api.updateGroup(boardId, groupId, { title })
    ),

    recolorGroup: (groupId, color) => mutate(
      (b) => { const g = b.groups.find((g) => g.id === groupId); if (g) g.color = color; },
      () => api.updateGroup(boardId, groupId, { color })
    ),

    toggleGroup: (groupId) => {
      const g = board.groups.find((g) => g.id === groupId);
      if (!g) return;
      mutate(
        (b) => { const gg = b.groups.find((x) => x.id === groupId); if (gg) gg.collapsed = !gg.collapsed; },
        () => api.updateGroup(boardId, groupId, { collapsed: !g.collapsed })
      );
    },

    deleteGroup: (groupId) => mutate(
      (b) => { b.groups = b.groups.filter((g) => g.id !== groupId); },
      () => api.deleteGroup(boardId, groupId)
    ),

    addItem: async (groupId, name, position = 'bottom') => {
      const item = await api.addItem(boardId, groupId, name, position);
      setBoard((b) => {
        const next = structuredClone(b);
        const g = next.groups.find((g) => g.id === groupId);
        if (g) position === 'top' ? g.items.unshift(item) : g.items.push(item);
        return next;
      });
      return item;
    },

    loadMoreItems: async (groupId, offset) => {
      const { items } = await api.getGroupItems(boardId, groupId, offset);
      setBoard((b) => {
        const next = structuredClone(b);
        const g = next.groups.find((g) => g.id === groupId);
        if (g) {
          const seen = new Set(g.items.map((i) => i.id));
          g.items.push(...items.filter((i) => !seen.has(i.id)));
          g.hasMore = g.items.length < (g.total || g.items.length);
        }
        return next;
      });
    },

    renameItem: (itemId, name) => mutate(
      (b) => { for (const g of b.groups) { const i = g.items.find((i) => i.id === itemId); if (i) i.name = name; } },
      () => api.updateItem(boardId, itemId, { name })
    ),

    setItemValue: (itemId, columnId, value) => {
      mutate(
        (b) => {
          for (const g of b.groups) {
            const i = g.items.find((i) => i.id === itemId);
            if (!i) continue;
            if (value === null) delete i.values[columnId];
            else i.values[columnId] = value;
          }
        },
        () => api.updateItem(boardId, itemId, { values: { [columnId]: value } })
          .then(async () => {
            // Automations may have moved the item or created notifications.
            const fresh = await api.getBoard(boardId);
            setBoard(fresh);
            refreshNotifications();
          })
      );
    },

    moveItem: (itemId, groupId) => mutate(
      (b) => {
        for (const g of b.groups) {
          const idx = g.items.findIndex((i) => i.id === itemId);
          if (idx === -1) continue;
          const [item] = g.items.splice(idx, 1);
          b.groups.find((x) => x.id === groupId)?.items.push(item);
          return;
        }
      },
      () => api.moveItem(boardId, itemId, groupId)
    ),

    deleteItem: (itemId) => {
      if (openItemId === itemId) setOpenItemId(null);
      setSelectedIds((s) => s.filter((x) => x !== itemId));
      mutate(
        (b) => { for (const g of b.groups) g.items = g.items.filter((i) => i.id !== itemId); },
        () => api.deleteItem(boardId, itemId)
      );
    },

    duplicateItem: async (itemId) => {
      const copy = await api.duplicateItem(boardId, itemId);
      setBoard((b) => {
        const next = structuredClone(b);
        for (const g of next.groups) {
          const idx = g.items.findIndex((i) => i.id === itemId);
          if (idx !== -1) { g.items.splice(idx + 1, 0, copy); break; }
        }
        return next;
      });
      return copy;
    },

    // ---- selection + bulk actions
    toggleItemSelected: (id) => setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
    setGroupSelected: (ids, on) => setSelectedIds((s) => {
      const set = new Set(s);
      ids.forEach((i) => (on ? set.add(i) : set.delete(i)));
      return [...set];
    }),
    clearSelection: () => setSelectedIds([]),

    bulkDelete: () => {
      const ids = selectedIds;
      if (!ids.length) return;
      setSelectedIds([]);
      if (openItemId && ids.includes(openItemId)) setOpenItemId(null);
      mutate(
        (b) => { for (const g of b.groups) g.items = g.items.filter((i) => !ids.includes(i.id)); },
        () => Promise.all(ids.map((id) => api.deleteItem(boardId, id)))
      );
    },
    bulkMove: (groupId) => {
      const ids = selectedIds;
      if (!ids.length) return;
      setSelectedIds([]);
      mutate(
        (b) => {
          const moving = [];
          for (const g of b.groups) {
            for (let i = g.items.length - 1; i >= 0; i--) if (ids.includes(g.items[i].id)) moving.unshift(g.items.splice(i, 1)[0]);
          }
          b.groups.find((g) => g.id === groupId)?.items.push(...moving);
        },
        () => Promise.all(ids.map((id) => api.moveItem(boardId, id, groupId)))
      );
    },
    bulkSetValue: (columnId, value) => {
      const ids = selectedIds;
      if (!ids.length) return;
      mutate(
        (b) => { for (const g of b.groups) for (const i of g.items) if (ids.includes(i.id)) { if (value === null) delete i.values[columnId]; else i.values[columnId] = value; } },
        () => Promise.all(ids.map((id) => api.updateItem(boardId, id, { values: { [columnId]: value } })))
      );
    },
    bulkDuplicate: async () => {
      const ids = selectedIds;
      setSelectedIds([]);
      for (const id of ids) { try { await actions.duplicateItem(id); } catch (e) { console.error(e); } }
    },

    addColumn: async (type) => {
      const column = await api.addColumn(boardId, type);
      setBoard((b) => ({ ...b, columns: [...b.columns, column] }));
    },

    renameColumn: (columnId, title) => mutate(
      (b) => { const c = b.columns.find((c) => c.id === columnId); if (c) c.title = title; },
      () => api.renameColumn(boardId, columnId, title)
    ),

    configureColumn: (columnId, patch) => mutate(
      (b) => { const c = b.columns.find((c) => c.id === columnId); if (c) Object.assign(c, patch); },
      () => api.updateColumn(boardId, columnId, patch)
    ),

    deleteColumn: (columnId) => mutate(
      (b) => {
        b.columns = b.columns.filter((c) => c.id !== columnId);
        for (const g of b.groups) for (const i of g.items) delete i.values[columnId];
      },
      () => api.deleteColumn(boardId, columnId)
    ),

    // ---- updates (comments)
    addUpdate: async (itemId, text, mentions) => {
      const update = await api.addUpdate(boardId, itemId, text, mentions);
      setBoard((b) => {
        const next = structuredClone(b);
        const i = findItem(next, itemId);
        if (i) (i.updates = i.updates || []).push(update);
        return next;
      });
      refreshNotifications();
      return update;
    },
    deleteUpdate: (itemId, updateId) => mutate(
      (b) => { const i = findItem(b, itemId); if (i) i.updates = (i.updates || []).filter((u) => u.id !== updateId); },
      () => api.deleteUpdate(boardId, itemId, updateId)
    ),

    // ---- subitems
    addSubitem: async (itemId, name) => {
      const sub = await api.addSubitem(boardId, itemId, name);
      setBoard((b) => {
        const next = structuredClone(b);
        const i = findItem(next, itemId);
        if (i) (i.subitems = i.subitems || []).push(sub);
        return next;
      });
      return sub;
    },
    setSubitemValue: (itemId, subId, columnId, value) => mutate(
      (b) => {
        const i = findItem(b, itemId);
        const s = i?.subitems?.find((s) => s.id === subId);
        if (!s) return;
        if (value === null) delete s.values[columnId]; else s.values[columnId] = value;
      },
      () => api.updateSubitem(boardId, itemId, subId, { values: { [columnId]: value } })
    ),
    renameSubitem: (itemId, subId, name) => mutate(
      (b) => { const s = findItem(b, itemId)?.subitems?.find((s) => s.id === subId); if (s) s.name = name; },
      () => api.updateSubitem(boardId, itemId, subId, { name })
    ),
    deleteSubitem: (itemId, subId) => mutate(
      (b) => { const i = findItem(b, itemId); if (i) i.subitems = i.subitems.filter((s) => s.id !== subId); },
      () => api.deleteSubitem(boardId, itemId, subId)
    ),

    // ---- automations
    addAutomation: async (auto) => {
      const created = await api.addAutomation(boardId, auto);
      setBoard((b) => ({ ...b, automations: [...(b.automations || []), created] }));
      return created;
    },
    updateAutomation: (autoId, patch) => mutate(
      (b) => { const a = b.automations.find((a) => a.id === autoId); if (a) Object.assign(a, patch); },
      () => api.updateAutomation(boardId, autoId, patch)
    ),
    deleteAutomation: (autoId) => mutate(
      (b) => { b.automations = b.automations.filter((a) => a.id !== autoId); },
      () => api.deleteAutomation(boardId, autoId)
    ),

    // ---- saved views
    saveView: async (name) => {
      const created = await api.addView(boardId, { name, type: view, filters, sorts });
      setBoard((b) => ({ ...b, views: [...(b.views || []), created] }));
      return created;
    },
    applyView: (v) => { setView(v.type || 'table'); setFilters(v.filters || []); setSorts(v.sorts || []); },
    deleteView: (viewId) => mutate(
      (b) => { b.views = b.views.filter((v) => v.id !== viewId); },
      () => api.deleteView(boardId, viewId)
    ),
  }), [board, boardId, mutate, refreshBoards, refreshNotifications, currentUserId, openItemId, view, filters, sorts, findItem, page, selectedIds]);

  const currentUser = useMemo(() => authUser || users.find((u) => u.id === currentUserId), [authUser, users, currentUserId]);
  const openItem = useMemo(() => (board && openItemId ? findItem(board, openItemId) : null), [board, openItemId, findItem]);

  const ctx = useMemo(
    () => ({ users, boards, board, boardId, actions, search, view, currentUserId, currentUser, workspaces, notifications, openItemId, filters, sorts, page, selectedIds, mobileNav }),
    [users, boards, board, boardId, actions, search, view, currentUserId, currentUser, workspaces, notifications, openItemId, filters, sorts, page, selectedIds, mobileNav]
  );

  const renderView = () => {
    switch (view) {
      case 'kanban': return <KanbanView />;
      case 'calendar': return <CalendarView />;
      case 'timeline': return <TimelineView />;
      case 'dashboard': return <DashboardView />;
      case 'form': return <FormView />;
      case 'workload': return <WorkloadView />;
      case 'map': return <MapView />;
      default: return <TableView />;
    }
  };

  if (!authChecked) return <div className="app-loading">Loading…</div>;
  if (!authUser) return <LoginPage onAuthed={onAuthed} />;

  return (
    <BoardContext.Provider value={ctx}>
      <div className="app">
        <TopBar />
        <div className={`app-body ${mobileNav ? 'nav-open' : ''}`}>
          {mobileNav && <div className="nav-backdrop" onClick={() => setMobileNav(false)} />}
          <Sidebar />
          {page === 'chat' ? (
            <ChatPage />
          ) : (
            <>
              <main className="board-area">
                {board ? (
                  <>
                    <BoardHeader view={view} setView={setView} search={search} setSearch={setSearch} />
                    {renderView()}
                  </>
                ) : (
                  <div className="empty-state">
                    <h2>No board selected</h2>
                    <p>Create a board from the sidebar to get started.</p>
                  </div>
                )}
              </main>
              {openItem && <ItemPanel item={openItem} />}
              <BulkActionBar />
            </>
          )}
        </div>
      </div>
    </BoardContext.Provider>
  );
}
