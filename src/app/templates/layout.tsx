import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resume templates",
  description: "Browse 12 single-column resume templates that follow common ATS-safe practices, previewed live with sample data.",
  alternates: { canonical: "/templates" },
};

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
