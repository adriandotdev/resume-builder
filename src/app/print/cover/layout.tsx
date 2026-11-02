import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Print cover letter",
  robots: { index: false, follow: false },
  alternates: { canonical: "/print/cover" },
};

export default function PrintCoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
