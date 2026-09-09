'use client';

import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';

const UIContext = createContext(null);

/**
 * Toasts and the shared confirmation dialog.
 *
 * Deliberately separate from any data provider: these are pure UI
 * concerns, and keeping them independent means screens that read from
 * Supabase and screens still on mock data can both use them.
 */
export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message, type = 'info', options = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type, description: options.description }]);
      timers.current.set(id, setTimeout(() => removeToast(id), options.duration ?? 4000));
      return id;
    },
    [removeToast],
  );

  const [confirmState, setConfirmState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    setConfirmState({ tone: 'default', confirmLabel: 'Confirm', cancelLabel: 'Cancel', ...options });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const resolveConfirm = useCallback((result) => {
    setConfirmState(null);
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
  }, []);

  const value = useMemo(
    () => ({ toasts, addToast, removeToast, confirm, confirmState, resolveConfirm }),
    [toasts, addToast, removeToast, confirm, confirmState, resolveConfirm],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
