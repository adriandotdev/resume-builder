import type { Metadata } from "next";
import Link from "next/link";
import { MAINTAINER_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "What Resume Builder is, who maintains it, and how it keeps your resume in your browser.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <article className="app-sheet info-page">
      <header className="info-head">
        <h1 className="app-title info-title">About</h1>
        <p className="info-lede measure">Resume Builder is a free resume builder. It offers single-column templates that follow common ATS-friendly practices, and you can export your resume as a PDF.</p>
      </header>

      <div className="info-main">
        <section className="info-section">
          <h2 className="info-heading">Who maintains it</h2>
          <p className="info-body measure">Resume Builder is maintained by {MAINTAINER_NAME}. <Link href="/contact" className="text-link">Contact page</Link></p>
        </section>

        <section className="info-section">
          <h2 className="info-heading">How your data is handled</h2>
          <p className="info-body measure">Your resumes are stored in your browser, on your device. The app has no database and no server-side storage for resume content. The site counts page views with Vercel Web Analytics. See the <Link href="/privacy" className="text-link">privacy page</Link> for details.</p>
        </section>

        <p className="info-next"><Link href="/editor" className="btn btn-accent">Open the editor</Link></p>
      </div>
    </article>
  );
}
