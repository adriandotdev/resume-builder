import type { ReactNode, SVGProps } from "react";
import type { SectionType } from "@/lib/schema";

/** Inline SVG icons (24x24, stroke). No icon library, no network. */
function Svg({ children, size = 20, ...rest }: { children: ReactNode; size?: number } & Omit<SVGProps<SVGSVGElement>, "children">) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}
type P = { size?: number; className?: string };

export const IconTick = (p: P) => <Svg {...p}><path d="M4 12.5l5 5L20 6.5" /></Svg>;
export const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IconMore = (p: P) => <Svg {...p}><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></Svg>;
export const IconGrip = (p: P) => <Svg {...p}><circle cx="9" cy="6" r="1.2" fill="currentColor" /><circle cx="15" cy="6" r="1.2" fill="currentColor" /><circle cx="9" cy="12" r="1.2" fill="currentColor" /><circle cx="15" cy="12" r="1.2" fill="currentColor" /><circle cx="9" cy="18" r="1.2" fill="currentColor" /><circle cx="15" cy="18" r="1.2" fill="currentColor" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const IconUp = (p: P) => <Svg {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Svg>;
export const IconDown = (p: P) => <Svg {...p}><path d="M12 5v14M6 13l6 6 6-6" /></Svg>;
export const IconTrash = (p: P) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconMinus = (p: P) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const IconCompare = (p: P) => <Svg {...p}><path d="M9 4H5v16h4M15 4h4v16h-4M12 3v18" /></Svg>;
export const IconDownload = (p: P) => <Svg {...p}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></Svg>;
export const IconEye = (p: P) => <Svg {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>;
export const IconWarn = (p: P) => <Svg {...p}><path d="M12 4l9 16H3L12 4z" /><path d="M12 10v4M12 17.2v.1" /></Svg>;
export const IconAlert = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.2v.1" /></Svg>;
export const IconLock = (p: P) => <Svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></Svg>;
export const IconDoc = (p: P) => <Svg {...p}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></Svg>;
export const IconPalette = (p: P) => <Svg {...p}><path d="M12 3a9 9 0 100 18c1.4 0 2-.9 2-1.8 0-1.2-1-1.4-1-2.5 0-1 .8-1.7 1.8-1.7H17a4 4 0 004-4C21 6.5 17 3 12 3z" /><circle cx="7.5" cy="11" r="1" fill="currentColor" /><circle cx="10" cy="7" r="1" fill="currentColor" /><circle cx="15" cy="7.5" r="1" fill="currentColor" /></Svg>;
export const IconShield = (p: P) => <Svg {...p}><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></Svg>;
export const IconData = (p: P) => <Svg {...p}><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></Svg>;
export const IconUndo = (p: P) => <Svg {...p}><path d="M9 7L4 12l5 5M4 12h10a6 6 0 010 8" /></Svg>;
export const IconExpand = (p: P) => <Svg {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Svg>;
export const IconSun = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
export const IconMoon = (p: P) => <Svg {...p}><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></Svg>;
export const IconEdit = (p: P) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" /></Svg>;

export function Logo({ size = 28 }: { size?: number }) {
  // A page with one line run through the highlighter: the text a parser reads.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="6" y="2.5" width="20" height="27" rx="1.5" fill="#ffffff" stroke="currentColor" strokeWidth="1.8" />
      <rect x="9.5" y="13" width="13" height="5" fill="#f2d15c" />
      <path d="M10.5 8.5h11M10.5 15.5h11M10.5 22.5h7" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const SECTION_ICONS: Record<SectionType, (p: P) => ReactNode> = {
  contact: (p) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></Svg>,
  summary: (p) => <Svg {...p}><path d="M4 6h16M4 11h16M4 16h10" /></Svg>,
  experience: (p) => <Svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M3 13h18" /></Svg>,
  education: (p) => <Svg {...p}><path d="M2 9l10-5 10 5-10 5L2 9z" /><path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5M22 9v6" /></Svg>,
  skills: (p) => <Svg {...p}><path d="M14.5 6.5a4 4 0 00-5 5L4 17l3 3 5.5-5.5a4 4 0 005-5l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5z" /></Svg>,
  projects: (p) => <Svg {...p}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></Svg>,
  certifications: (p) => <Svg {...p}><circle cx="12" cy="9" r="5.5" /><path d="M8.5 14L7 21l5-3 5 3-1.5-7" /></Svg>,
  languages: (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></Svg>,
  custom: (p) => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8.5v7M8.5 12h7" /></Svg>,
};
export function SectionIcon({ type, size = 20 }: { type: SectionType; size?: number }) {
  return <>{SECTION_ICONS[type]({ size })}</>;
}
