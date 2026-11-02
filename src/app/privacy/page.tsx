import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Resume Builder handles your data: resumes stay in your browser, and the site counts page views with Vercel Web Analytics.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="app-sheet info-page">
      <header className="info-head">
        <h1 className="app-title info-title">Privacy</h1>
        <p className="info-lede measure">Resume Builder is designed so your resume content stays on your device.</p>
      </header>

      <div className="info-main">
        <section className="info-section">
          <h2 className="info-heading">Where your data is kept</h2>
          <p className="info-body measure">Your resumes, cover letters, saved applications and version history are stored in your browser&rsquo;s local storage, on this device only. The text you type is not sent to a server.</p>
        </section>

        <section className="info-section">
          <h2 className="info-heading">Exports and backups</h2>
          <p className="info-body measure">Export JSON downloads a file to your device. You can protect that file with a passphrase, which is applied in your browser before the file is saved. Import JSON reads a file from your device and checks it before anything changes.</p>
        </section>

        <section className="info-section">
          <h2 className="info-heading">Page view analytics</h2>
          <p className="info-body measure">The site uses Vercel Web Analytics to count page views. It does not read what you type or the contents of your resume.</p>
        </section>

        <section className="info-section">
          <h2 className="info-heading">Deleting your data</h2>
          <p className="info-body measure">Clearing this site&rsquo;s data in your browser removes everything stored here. Export JSON first if you want to keep a copy.</p>
        </section>

        <p className="info-next"><Link href="/editor" className="btn btn-accent">Open the editor</Link></p>
      </div>
    </article>
  );
}
