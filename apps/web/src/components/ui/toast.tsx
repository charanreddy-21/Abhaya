'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToastTone = 'ok' | 'warn' | 'danger' | 'info';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone, duration?: number) => void;
  dismiss: (id: string) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info', duration = 4000) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev.slice(-4), { id, message, tone, duration }]);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
    },
    [dismiss],
  );

  useEffect(() => () => { timers.current.forEach((t) => clearTimeout(t)); }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-label="Notifications">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast tone-bg-${t.tone}`}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.22 }}
              layout
            >
              <span className={`toast-icon tone-${t.tone}`}>
                {t.tone === 'ok'     && <CheckCircle2 size={16} />}
                {t.tone === 'warn'   && <AlertTriangle size={16} />}
                {t.tone === 'danger' && <XCircle size={16} />}
                {t.tone === 'info'   && <Info size={16} />}
              </span>
              <span className="toast-message">{t.message}</span>
              <button
                className="toast-dismiss"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                type="button"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
