import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, MAINTAINER_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the maintainer of Resume Builder with questions, bug reports or feedback.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <article className="app-sheet info-page">
      <header className="info-head">
        <h1 className="app-title info-title">Contact</h1>
        <p className="info-lede measure">Resume Builder is maintained by {MAINTAINER_NAME}. For questions, bug reports or feedback, send an email.</p>

        {CONTACT_EMAIL && (
          <p className="info-well">
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-link">{CONTACT_EMAIL}</a>
          </p>
        )}
      </header>

      <div className="info-main">
        <section className="info-section">
          <h2 className="info-heading">Your resume</h2>
          <p className="info-body measure">Your resumes are stored only in your browser, so the maintainer cannot retrieve them. To keep a copy, export a JSON backup from the editor before you clear your browser data.</p>
        </section>

        <p className="info-next"><Link href="/about" className="text-link">About Resume Builder</Link></p>
      </div>
    </article>
  );
}
