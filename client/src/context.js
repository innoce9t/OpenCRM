import { createContext, useContext } from 'react';

export const BoardContext = createContext(null);
export const useBoardCtx = () => useContext(BoardContext);
