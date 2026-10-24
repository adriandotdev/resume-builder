"use client";
import { useEffect, useState } from "react";
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
    <p className={`flex items-center gap-1.5 text-sm ${tone === "warn" ? "font-medium text-[var(--pen-text)]" : "text-[var(--text-muted)]"}`} data-testid="save-status">
      {tone === "warn" ? <IconWarn size={16} /> : tone === "ok" ? <span className="text-[var(--tick-text)]"><IconTick size={16} /></span> : null}
      <span>{text}</span>
    </p>
  );
}
