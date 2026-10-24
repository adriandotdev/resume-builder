"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./icons";

const LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/editor", label: "Editor" },
] as const;

export function SiteHeader() {
  const path = usePathname();
  return (
    <header data-chrome className="site-header no-print">
      <nav aria-label="Main" className="flex items-center gap-0.5 pl-4 pr-2 sm:gap-1 sm:px-6" style={{ minHeight: "var(--header-h)" }}>
        <Link href="/" className="mr-auto flex min-h-11 items-center gap-2 rounded-lg pr-2 no-underline sm:gap-2.5" aria-label="Resume Builder home">
          <Logo size={26} />
          <span className="wordmark">Resume Builder</span>
        </Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="nav-link" aria-current={path === l.href ? "page" : undefined}>{l.label}</Link>
        ))}
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
        <nav aria-label="Footer" className="flex gap-6">
          <Link href="/templates" className="text-[var(--text)] underline-offset-4 hover:underline">Templates</Link>
          <Link href="/editor" className="text-[var(--text)] underline-offset-4 hover:underline">Editor</Link>
          <Link href="/#questions" className="text-[var(--text)] underline-offset-4 hover:underline">Questions</Link>
        </nav>
        <p className="sm:text-right">No tracking, no uploads</p>
      </div>
    </footer>
  );
}
