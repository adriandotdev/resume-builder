import type { CSSProperties } from "react";
import { FONTS, formatDate, formatRange, type ResumeDoc, type Section } from "@/lib/schema";

/**
 * The single semantic DOM shared by every template:
 * h1 name, h2 per section, h3 per entry, ul/li for lists, plain text only.
 * No tables, images, icons or pseudo-element text.
 */
export function ResumeBody({ doc, className, idPrefix = "r" }: { doc: ResumeDoc; className: string; idPrefix?: string }) {
  const { style } = doc;
  const vars = {
    "--r-accent": style.accent,
    "--r-font": FONTS[style.font].stack,
    "--r-size": `${style.fontSize}pt`,
    "--r-lh": String(style.lineSpacing),
  } as CSSProperties;
  const f = style.dateFormat;
  return (
    <article className={`resume ${className}`} style={vars} data-resume>
      {doc.sections.filter((s) => s.visible).map((s) => (
        <SectionView key={s.id} s={s} f={f} idPrefix={idPrefix} />
      ))}
    </article>
  );
}

function Bullets({ items }: { items: string[] }) {
  const list = items.filter((b) => b.trim());
  if (!list.length) return null;
  return <ul className="bullets">{list.map((b, i) => <li key={i}>{b}</li>)}</ul>;
}

function SectionView({ s, f, idPrefix }: { s: Section; f: ResumeDoc["style"]["dateFormat"]; idPrefix: string }) {
  if (s.type === "contact") {
    const c = s.content;
    const bits = [c.email, c.phone, c.location, ...c.links].filter((x) => x.trim());
    return (
      <header className="resume-head">
        {c.fullName && <h1>{c.fullName}</h1>}
        {c.headline && <p className="headline">{c.headline}</p>}
        {bits.length > 0 && <ul className="contact-list">{bits.map((b, i) => <li key={i}>{b}</li>)}</ul>}
      </header>
    );
  }
  const hid = `${idPrefix}-${s.id}`;
  return (
    <section className="resume-section" aria-labelledby={hid}>
      <h2 id={hid}>{s.title}</h2>
      <Body s={s} f={f} />
    </section>
  );
}

function Body({ s, f }: { s: Exclude<Section, { type: "contact" }>; f: ResumeDoc["style"]["dateFormat"] }) {
  switch (s.type) {
    case "summary":
      return <p className="summary-text">{s.content.text}</p>;
    case "experience":
      return <>{s.content.items.map((i) => (
        <div className="entry" key={i.id}>
          <div className="entry-row">
            <h3>{i.role}</h3>
            <p className="dates">{formatRange(i.start, i.end, i.current, f)}</p>
          </div>
          <p className="meta">{[i.org, i.location].filter(Boolean).join(", ")}</p>
          <Bullets items={i.bullets} />
        </div>
      ))}</>;
    case "education":
      return <>{s.content.items.map((i) => (
        <div className="entry" key={i.id}>
          <div className="entry-row">
            <h3>{i.degree}</h3>
            <p className="dates">{formatRange(i.start, i.end, false, f)}</p>
          </div>
          <p className="meta">{[i.school, i.location].filter(Boolean).join(", ")}</p>
          <Bullets items={i.details} />
        </div>
      ))}</>;
    case "skills":
      return <ul className="plain-list">{s.content.items.map((i) => (
        <li key={i.id}>{i.label && <span className="skill-label">{i.label}: </span>}{i.skills}</li>
      ))}</ul>;
    case "projects":
      return <>{s.content.items.map((i) => (
        <div className="entry" key={i.id}>
          <div className="entry-row">
            <h3>{i.name}</h3>
            <p className="dates">{formatRange(i.start, i.end, false, f)}</p>
          </div>
          {i.link && <p className="meta">{i.link}</p>}
          <Bullets items={i.bullets} />
        </div>
      ))}</>;
    case "certifications":
      return <ul className="plain-list">{s.content.items.map((i) => (
        <li key={i.id}>{[i.name, i.issuer, formatDate(i.date, f)].filter(Boolean).join(", ")}</li>
      ))}</ul>;
    case "languages":
      return <ul className="plain-list">{s.content.items.map((i) => (
        <li key={i.id}>{[i.name, i.level].filter(Boolean).join(": ")}</li>
      ))}</ul>;
    case "custom":
      return <Bullets items={s.content.items.map((i) => i.text)} />;
  }
}
