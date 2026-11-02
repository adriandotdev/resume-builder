import type { Metadata } from "next";
import { ApplicationsPanel } from "@/components/ApplicationsPanel";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
  alternates: { canonical: "/applications" },
};

export default function ApplicationsPage() {
  return <ApplicationsPanel />;
}
