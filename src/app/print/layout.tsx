import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Print",
  robots: { index: false, follow: false },
  alternates: { canonical: "/print" },
};

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return children;
}
