// Auth token, persisted so a refresh keeps you logged in.
let token = null;
try { token = localStorage.getItem('opencrm-token'); } catch { /* ignore */ }
export function setToken(t) {
  token = t || null;
  try { t ? localStorage.setItem('opencrm-token', t) : localStorage.removeItem('opencrm-token'); } catch { /* ignore */ }
}
export function getToken() { return token; }

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(`${method} ${url} → ${res.status}`);
    err.status = res.status;
    try { err.body = await res.json(); } catch { /* ignore */ }
    throw err;
  }
  return res.json();
}

export const api = {
  // auth
  login: (email, password) => request('POST', '/api/auth/login', { email, password }),
  signup: (name, email, password) => request('POST', '/api/auth/signup', { name, email, password }),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/auth/me'),
  authConfig: () => request('GET', '/api/auth/config'),
  googleLogin: (credential) => request('POST', '/api/auth/google', { credential }),
  firebaseLogin: (idToken) => request('POST', '/api/auth/firebase', { idToken }),

  // workspaces
  getWorkspaces: () => request('GET', '/api/workspaces'),
  createWorkspace: (ws) => request('POST', '/api/workspaces', ws),

  getUsers: () => request('GET', '/api/users'),
  getBoards: () => request('GET', '/api/boards'),
  getBoard: (id) => request('GET', `/api/boards/${id}`),
  createBoard: (name, workspaceId) => request('POST', '/api/boards', { name, workspaceId }),
  renameBoard: (id, name) => request('PATCH', `/api/boards/${id}`, { name }),
  shareBoard: (id, sharedWith) => request('PATCH', `/api/boards/${id}`, { sharedWith }),
  moveBoardWorkspace: (id, workspaceId) => request('PATCH', `/api/boards/${id}`, { workspaceId }),
  deleteBoard: (id) => request('DELETE', `/api/boards/${id}`),

  addGroup: (boardId, title) => request('POST', `/api/boards/${boardId}/groups`, { title }),
  updateGroup: (boardId, groupId, patch) => request('PATCH', `/api/boards/${boardId}/groups/${groupId}`, patch),
  deleteGroup: (boardId, groupId) => request('DELETE', `/api/boards/${boardId}/groups/${groupId}`),

  addItem: (boardId, groupId, name, position) =>
    request('POST', `/api/boards/${boardId}/groups/${groupId}/items`, { name, position }),
  getGroupItems: (boardId, groupId, offset, limit = 200) =>
    request('GET', `/api/boards/${boardId}/groups/${groupId}/items?offset=${offset}&limit=${limit}`),
  updateItem: (boardId, itemId, patch) => request('PATCH', `/api/boards/${boardId}/items/${itemId}`, patch),
  moveItem: (boardId, itemId, groupId) => request('POST', `/api/boards/${boardId}/items/${itemId}/move`, { groupId }),
  duplicateItem: (boardId, itemId) => request('POST', `/api/boards/${boardId}/items/${itemId}/duplicate`),
  deleteItem: (boardId, itemId) => request('DELETE', `/api/boards/${boardId}/items/${itemId}`),

  addColumn: (boardId, type) => request('POST', `/api/boards/${boardId}/columns`, { type }),
  renameColumn: (boardId, columnId, title) => request('PATCH', `/api/boards/${boardId}/columns/${columnId}`, { title }),
  updateColumn: (boardId, columnId, patch) => request('PATCH', `/api/boards/${boardId}/columns/${columnId}`, patch),
  deleteColumn: (boardId, columnId) => request('DELETE', `/api/boards/${boardId}/columns/${columnId}`),

  // updates (comments)
  addUpdate: (boardId, itemId, text, mentions) =>
    request('POST', `/api/boards/${boardId}/items/${itemId}/updates`, { text, mentions }),
  deleteUpdate: (boardId, itemId, updateId) =>
    request('DELETE', `/api/boards/${boardId}/items/${itemId}/updates/${updateId}`),

  // subitems
  addSubitem: (boardId, itemId, name) =>
    request('POST', `/api/boards/${boardId}/items/${itemId}/subitems`, { name }),
  updateSubitem: (boardId, itemId, subId, patch) =>
    request('PATCH', `/api/boards/${boardId}/items/${itemId}/subitems/${subId}`, patch),
  deleteSubitem: (boardId, itemId, subId) =>
    request('DELETE', `/api/boards/${boardId}/items/${itemId}/subitems/${subId}`),

  // activity + notifications
  getActivity: (boardId) => request('GET', `/api/boards/${boardId}/activity`),
  getNotifications: (userId) => request('GET', `/api/notifications?userId=${userId}`),
  markNotificationRead: (id) => request('POST', `/api/notifications/${id}/read`),
  markAllNotificationsRead: (userId) => request('POST', '/api/notifications/read-all', { userId }),

  // automations
  getAutomations: (boardId) => request('GET', `/api/boards/${boardId}/automations`),
  addAutomation: (boardId, auto) => request('POST', `/api/boards/${boardId}/automations`, auto),
  updateAutomation: (boardId, autoId, patch) => request('PATCH', `/api/boards/${boardId}/automations/${autoId}`, patch),
  deleteAutomation: (boardId, autoId) => request('DELETE', `/api/boards/${boardId}/automations/${autoId}`),

  // saved views
  addView: (boardId, view) => request('POST', `/api/boards/${boardId}/views`, view),
  updateView: (boardId, viewId, patch) => request('PATCH', `/api/boards/${boardId}/views/${viewId}`, patch),
  deleteView: (boardId, viewId) => request('DELETE', `/api/boards/${boardId}/views/${viewId}`),

  // chat
  getChannels: () => request('GET', '/api/channels'),
  getChannel: (id) => request('GET', `/api/channels/${id}`),
  createChannel: (channel) => request('POST', '/api/channels', channel),
  deleteChannel: (id) => request('DELETE', `/api/channels/${id}`),
  sendMessage: (channelId, payload) => request('POST', `/api/channels/${channelId}/messages`, payload),
  deleteMessage: (channelId, msgId) => request('DELETE', `/api/channels/${channelId}/messages/${msgId}`),

  getQuickReplies: () => request('GET', '/api/quick-replies'),
  addQuickReply: (text) => request('POST', '/api/quick-replies', { text }),
  deleteQuickReply: (text) => request('DELETE', '/api/quick-replies', { text }),

  aiQuery: (text) => request('POST', '/api/ai/query', { text }),
};
