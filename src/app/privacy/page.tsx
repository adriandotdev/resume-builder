import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Resume Builder handles your data: resumes stay in your browser, and the site counts page views with Vercel Web Analytics.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="app-sheet">
      <h1 className="app-title">Privacy</h1>
      <p className="mt-3 max-w-prose leading-relaxed">Resume Builder is designed so your resume content stays on your device.</p>

      <h2 className="mt-8 text-lg font-semibold">Where your data is kept</h2>
      <p className="mt-3 max-w-prose leading-relaxed">Your resumes, cover letters, saved applications and version history are stored in your browser&rsquo;s local storage, on this device only. The text you type is not sent to a server.</p>

      <h2 className="mt-8 text-lg font-semibold">Exports and backups</h2>
      <p className="mt-3 max-w-prose leading-relaxed">Export JSON downloads a file to your device. You can protect that file with a passphrase, which is applied in your browser before the file is saved. Import JSON reads a file from your device and checks it before anything changes.</p>

      <h2 className="mt-8 text-lg font-semibold">Page view analytics</h2>
      <p className="mt-3 max-w-prose leading-relaxed">The site uses Vercel Web Analytics to count page views. It does not read what you type or the contents of your resume.</p>

      <h2 className="mt-8 text-lg font-semibold">Deleting your data</h2>
      <p className="mt-3 max-w-prose leading-relaxed">Clearing this site&rsquo;s data in your browser removes everything stored here. Export JSON first if you want to keep a copy.</p>

      <p className="mt-8"><Link href="/editor" className="text-link">Open the editor</Link></p>
    </article>
  );
}
