import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { BoardContext } from './context.js';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import BoardHeader from './components/BoardHeader.jsx';
import TableView from './components/TableView.jsx';
import KanbanView from './components/KanbanView.jsx';

export default function App() {
  const [users, setUsers] = useState([]);
  const [boards, setBoards] = useState([]);
  const [boardId, setBoardId] = useState(null);
  const [board, setBoard] = useState(null);
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');

  const refreshBoards = useCallback(async () => {
    const list = await api.getBoards();
    setBoards(list);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      const [userList, boardList] = await Promise.all([api.getUsers(), refreshBoards()]);
      setUsers(userList);
      if (boardList.length) setBoardId(boardList[0].id);
    })().catch(console.error);
  }, [refreshBoards]);

  useEffect(() => {
    if (!boardId) { setBoard(null); return; }
    let stale = false;
    api.getBoard(boardId).then((b) => { if (!stale) { setBoard(b); setSearch(''); setView('table'); } }).catch(console.error);
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

  const actions = useMemo(() => ({
    selectBoard: setBoardId,

    addBoard: async () => {
      const created = await api.createBoard('New Board');
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
      setBoard((b) => ({ ...b, groups: [...b.groups, group] }));
    },

    renameGroup: (groupId, title) => mutate(
      (b) => { const g = b.groups.find((g) => g.id === groupId); if (g) g.title = title; },
      () => api.updateGroup(boardId, groupId, { title })
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

    renameItem: (itemId, name) => mutate(
      (b) => { for (const g of b.groups) { const i = g.items.find((i) => i.id === itemId); if (i) i.name = name; } },
      () => api.updateItem(boardId, itemId, { name })
    ),

    setItemValue: (itemId, columnId, value) => mutate(
      (b) => {
        for (const g of b.groups) {
          const i = g.items.find((i) => i.id === itemId);
          if (!i) continue;
          if (value === null) delete i.values[columnId];
          else i.values[columnId] = value;
        }
      },
      () => api.updateItem(boardId, itemId, { values: { [columnId]: value } })
    ),

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

    deleteItem: (itemId) => mutate(
      (b) => { for (const g of b.groups) g.items = g.items.filter((i) => i.id !== itemId); },
      () => api.deleteItem(boardId, itemId)
    ),

    addColumn: async (type) => {
      const column = await api.addColumn(boardId, type);
      setBoard((b) => ({ ...b, columns: [...b.columns, column] }));
    },

    renameColumn: (columnId, title) => mutate(
      (b) => { const c = b.columns.find((c) => c.id === columnId); if (c) c.title = title; },
      () => api.renameColumn(boardId, columnId, title)
    ),

    deleteColumn: (columnId) => mutate(
      (b) => {
        b.columns = b.columns.filter((c) => c.id !== columnId);
        for (const g of b.groups) for (const i of g.items) delete i.values[columnId];
      },
      () => api.deleteColumn(boardId, columnId)
    ),
  }), [board, boardId, mutate, refreshBoards]);

  const ctx = useMemo(
    () => ({ users, boards, board, boardId, actions, search, view }),
    [users, boards, board, boardId, actions, search, view]
  );

  return (
    <BoardContext.Provider value={ctx}>
      <div className="app">
        <TopBar />
        <div className="app-body">
          <Sidebar />
          <main className="board-area">
            {board ? (
              <>
                <BoardHeader view={view} setView={setView} search={search} setSearch={setSearch} />
                {view === 'table' ? <TableView /> : <KanbanView />}
              </>
            ) : (
              <div className="empty-state">
                <h2>No board selected</h2>
                <p>Create a board from the sidebar to get started.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </BoardContext.Provider>
  );
}
