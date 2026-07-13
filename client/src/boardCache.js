import { useEffect, useState } from 'react';
import { api } from './api.js';

// Small cache of full boards other than the active one, so connect/mirror
// columns can resolve item names and values from another board.
const cache = new Map(); // id -> board | null (null = loading)
const listeners = new Set();

export function useCachedBoard(id) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!id) return;
    if (!cache.has(id)) {
      cache.set(id, null);
      api.getBoard(id).then((b) => { cache.set(id, b); listeners.forEach((l) => l()); }).catch(() => cache.delete(id));
    }
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, [id]);
  return id ? cache.get(id) || null : null;
}

export function invalidateBoardCache(id) { if (id) cache.delete(id); else cache.clear(); }
