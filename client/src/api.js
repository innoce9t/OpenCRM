// Set VITE_OPENCRM_API_KEY at build time to match the server's OPENCRM_API_KEY
// when API-key auth is enabled. Left undefined in dev, where auth is off.
const API_KEY = import.meta.env.VITE_OPENCRM_API_KEY;

async function request(method, url, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (API_KEY) headers['x-api-key'] = API_KEY;
  const res = await fetch(url, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  return res.json();
}

export const api = {
  getUsers: () => request('GET', '/api/users'),
  getBoards: () => request('GET', '/api/boards'),
  getBoard: (id) => request('GET', `/api/boards/${id}`),
  createBoard: (name) => request('POST', '/api/boards', { name }),
  renameBoard: (id, name) => request('PATCH', `/api/boards/${id}`, { name }),
  deleteBoard: (id) => request('DELETE', `/api/boards/${id}`),

  addGroup: (boardId, title) => request('POST', `/api/boards/${boardId}/groups`, { title }),
  updateGroup: (boardId, groupId, patch) => request('PATCH', `/api/boards/${boardId}/groups/${groupId}`, patch),
  deleteGroup: (boardId, groupId) => request('DELETE', `/api/boards/${boardId}/groups/${groupId}`),

  addItem: (boardId, groupId, name, position) =>
    request('POST', `/api/boards/${boardId}/groups/${groupId}/items`, { name, position }),
  updateItem: (boardId, itemId, patch) => request('PATCH', `/api/boards/${boardId}/items/${itemId}`, patch),
  moveItem: (boardId, itemId, groupId) => request('POST', `/api/boards/${boardId}/items/${itemId}/move`, { groupId }),
  deleteItem: (boardId, itemId) => request('DELETE', `/api/boards/${boardId}/items/${itemId}`),

  addColumn: (boardId, type) => request('POST', `/api/boards/${boardId}/columns`, { type }),
  renameColumn: (boardId, columnId, title) => request('PATCH', `/api/boards/${boardId}/columns/${columnId}`, { title }),
  deleteColumn: (boardId, columnId) => request('DELETE', `/api/boards/${boardId}/columns/${columnId}`),
};
