"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "@/lib/motion";
import { IconMoon, IconSun, Logo } from "./icons";

const LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/editor", label: "Editor" },
  { href: "/applications", label: "Applications" },
] as const;

const subscribe = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
};

function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme ?? "light", () => "light");
  const dark = theme === "dark";
  const flip = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
  };
  return (
    <button type="button" className="btn btn-quiet btn-icon" onClick={flip} aria-pressed={dark} aria-label="Dark mode" title={dark ? "Switch to light mode" : "Switch to dark mode"}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? "sun" : "moon"} className="inline-flex" initial={{ opacity: 0, rotate: -60, scale: 0.8 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 60, scale: 0.8 }} transition={{ duration: 0.14, ease: EASE }}>
          {dark ? <IconSun /> : <IconMoon />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function SiteHeader() {
  const path = usePathname();
  return (
    <header data-chrome className="site-header no-print">
      <nav aria-label="Main" className="flex items-center gap-0 pl-3 pr-1 min-[360px]:gap-0.5 min-[360px]:pl-4 min-[360px]:pr-2 sm:gap-1 sm:px-6" style={{ minHeight: "var(--header-h)" }}>
        <Link href="/" className="mr-auto flex min-h-11 items-center gap-2 rounded-lg pr-2 no-underline sm:gap-2.5" aria-label="Resume Builder home">
          <Logo size={26} />
          <span className="wordmark">Resume Builder</span>
        </Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="nav-link" aria-current={path === l.href ? "page" : undefined}>
            {l.label}
            {path === l.href && <motion.span layoutId="nav-ind" className="nav-ind" transition={{ duration: 0.22, ease: EASE }} aria-hidden="true" />}
          </Link>
        ))}
        <ThemeToggle />
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const path = usePathname();
  if (path === "/editor" || path === "/print") return null;
  return (
    <footer data-chrome className="no-print px-4 pb-8 pt-16 sm:px-6 sm:pt-24">
      <div className="grid gap-2 text-[0.9375rem] text-[var(--text-muted)] sm:grid-cols-[1fr_auto_1fr] sm:items-baseline sm:gap-6">
        <p>A free, private resume builder</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6">
          <Link href="/templates" className="inline-flex min-h-11 items-center text-[var(--text)] underline-offset-4 hover:underline">Templates</Link>
          <Link href="/editor" className="inline-flex min-h-11 items-center text-[var(--text)] underline-offset-4 hover:underline">Editor</Link>
          <Link href="/applications" className="inline-flex min-h-11 items-center text-[var(--text)] underline-offset-4 hover:underline">Applications</Link>
          <Link href="/#questions" className="inline-flex min-h-11 items-center text-[var(--text)] underline-offset-4 hover:underline">Questions</Link>
        </nav>
        <p className="sm:text-right">No tracking, no uploads</p>
      </div>
    </footer>
  );
}
