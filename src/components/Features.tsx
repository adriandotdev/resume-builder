import type { CSSProperties } from "react";
import Link from "next/link";
import { FeatureStory } from "./FeatureStory";
import { GROUPS } from "./featureData";
import type { AtsCheck } from "@/lib/ats";

const total = GROUPS.reduce((n, g) => n + g.items.length, 0);

export function Features({ checks }: { checks: AtsCheck[] }) {
  return (
    <section id="features" className="feat" aria-labelledby="feat-h">
      <div className="feat-intro" data-reveal>
        <h2 id="feat-h" className="display feat-h">Everything in the editor</h2>
        <p className="feat-sub">{total} features, from the first line you type to the PDF you send. All of it runs in this browser.</p>
      </div>

      <FeatureStory checks={checks} />

      <div className="feat-static">
      {GROUPS.map((g) => (
        <div key={g.id} className="feat-group" data-reveal aria-labelledby={`feat-${g.id}`}>
          <div className="feat-head">
            <h3 id={`feat-${g.id}`} className="display feat-title">{g.title}</h3>
            <p className="feat-lead">{g.lead}</p>
          </div>
          <ul className="feat-list">
            {g.items.map((it, i) => (
              <li key={it.name} style={{ "--i": i } as CSSProperties}><strong>{it.name}</strong> {it.text}</li>
            ))}
          </ul>
        </div>
      ))}
      </div>

      <p className="feat-end" data-reveal>
        <Link href="/templates" className="text-link">Browse the templates</Link>
        <Link href="/editor" className="text-link">Open the editor</Link>
      </p>
    </section>
  );
}
