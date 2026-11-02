import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Print review copy",
  robots: { index: false, follow: false },
  alternates: { canonical: "/print/review" },
};

export default function PrintReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
