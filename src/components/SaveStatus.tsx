"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { EASE } from "@/lib/motion";
import { useSavedAt, usePending, useStoreStatus } from "@/lib/store";
import { formatSavedAgo } from "@/lib/ui";
import { IconTick, IconWarn } from "./icons";

export function SaveStatus() {
  const status = useStoreStatus();
  const savedAt = useSavedAt();
  const pending = usePending();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);

  let text: string;
  let tone: "ok" | "warn" | "idle" = "idle";
  if (status === "unavailable") { text = "Not saved: browser storage is blocked"; tone = "warn"; }
  else if (pending) text = "Saving…";
  else if (savedAt) { text = formatSavedAgo(savedAt, now); tone = "ok"; }
  else if (status === "restored") { text = "Loaded from this browser"; tone = "ok"; }
  else text = "Changes save in this browser";

  return (
    <p role={tone === "warn" ? "alert" : undefined} className={`flex items-start gap-1.5 text-sm ${tone === "warn" ? "font-medium text-[var(--pen-text)]" : "text-[var(--text-muted)]"}`} data-testid="save-status">
      {tone === "warn" ? <span className="shrink-0"><IconWarn size={16} /></span> : tone === "ok" ? <span className="shrink-0 text-[var(--tick-text)]"><IconTick size={16} /></span> : null}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={pending ? "saving" : tone} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14, ease: EASE }}>{text}</motion.span>
      </AnimatePresence>
    </p>
  );
}
