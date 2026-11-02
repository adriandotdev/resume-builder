import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editor",
  description: "Edit your resume with a live preview, check it against an ATS checklist, and save a PDF. Everything stays in your browser.",
  alternates: { canonical: "/editor" },
};

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
