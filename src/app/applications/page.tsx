import type { Metadata } from "next";
import { ApplicationsPanel } from "@/components/ApplicationsPanel";

export const metadata: Metadata = { title: "Applications" };

export default function ApplicationsPage() {
  return <ApplicationsPanel />;
}
