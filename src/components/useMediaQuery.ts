"use client";
import { useSyncExternalStore } from "react";

/** Behavior-only media query (layout itself is pure CSS). false on the server. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
