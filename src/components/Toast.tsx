"use client";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EASE } from "@/lib/motion";

interface ToastItem { id: number; message: string; actionLabel?: string; onAction?: () => void }
interface ToastApi { show: (t: Omit<ToastItem, "id"> & { duration?: number }) => void }
const Ctx = createContext<ToastApi>({ show: () => {} });
export const useToast = () => useContext(Ctx);

/** Polite, non-blocking messages with an optional action (used for Undo). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((l) => l.filter((x) => x.id !== id));
  }, []);
  const show = useCallback<ToastApi["show"]>(({ duration = 8000, ...t }) => {
    const id = nextId.current++;
    setItems((l) => [...l.slice(-2), { ...t, id }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
  }, [dismiss]);
  useEffect(() => { const m = timers.current; return () => m.forEach((t) => clearTimeout(t)); }, []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      <MotionConfig reducedMotion="user">
      {children}
      <div className="toast-region no-print" role="status" aria-live="polite" aria-atomic="false" data-testid="toast-region">
        <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id} layout="position" className="toast" data-testid="toast"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE } }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.14, ease: EASE } }}
          >
            <span>{t.message}</span>
            {t.actionLabel && (
              <button type="button" className="btn" onClick={() => { t.onAction?.(); dismiss(t.id); }}>{t.actionLabel}</button>
            )}
            <button type="button" className="btn btn-icon" aria-label="Dismiss message" onClick={() => dismiss(t.id)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>
      </MotionConfig>
    </Ctx.Provider>
  );
}
