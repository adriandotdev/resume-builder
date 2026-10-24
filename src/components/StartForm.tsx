"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { resumeStore, useResumeDoc } from "@/lib/store";
import { patchStyle } from "@/lib/ops";
import { isEmptyDoc, isPristineSample } from "@/lib/ui";
import { createDefaultDoc, PAGE_SIZES, type PageSizeId } from "@/lib/schema";

/**
 * The editor's first step, open on the landing page. It only ever fills in a
 * sample or empty resume; a resume the visitor already wrote is never replaced.
 */
export function StartForm() {
  const doc = useResumeDoc();
  const router = useRouter();
  const [name, setName] = useState("");
  const [size, setSize] = useState<PageSizeId>("a4");
  const contact = doc.sections.find((s) => s.type === "contact");
  const ownName = contact?.type === "contact" ? contact.content.fullName.trim() : "";
  // Anything other than the untouched sample or an empty resume is the visitor's own work.
  const hasOwn = !isPristineSample(doc) && !isEmptyDoc(doc);

  const start = (e: FormEvent) => {
    e.preventDefault();
    const typed = name.trim();
    if (typed) {
      // A blank resume with the visitor's name, keeping the template and style they already chose.
      const prev = resumeStore.getState();
      const blank = createDefaultDoc();
      resumeStore.setDoc({
        ...blank,
        style: { ...prev.style, pageSize: size },
        sections: blank.sections.map((s) => (s.type === "contact" ? { ...s, content: { ...s.content, fullName: typed } } : s)),
      });
    } else {
      resumeStore.update((d) => patchStyle(d, { pageSize: size }));
    }
    resumeStore.flush();
    router.push("/editor");
  };

  if (hasOwn) {
    return (
      <div className="start-card" data-ui>
        <h3 className="start-title">Your resume</h3>
        <p className="mt-2 text-[var(--text-muted)]">{ownName ? <><strong className="font-semibold text-[var(--text)]">{ownName}</strong> is saved in this browser.</> : "A resume is saved in this browser."} Pick up where you left off.</p>
        <Link href="/editor" className="btn btn-primary btn-lg mt-6 w-full">Continue editing</Link>
      </div>
    );
  }

  return (
    <form className="start-card" data-ui onSubmit={start} aria-labelledby="start-title">
      <h3 id="start-title" className="start-title">New resume</h3>
      <div className="field mt-5">
        <label htmlFor="start-name">Your full name</label>
        <input id="start-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
        <span className="field-hint">Leave it empty to start from the sample and type over it.</span>
      </div>
      <fieldset className="mt-5 min-w-0">
        <legend className="mb-1.5 text-sm font-semibold">Paper size</legend>
        <div className="seg">
          {(Object.keys(PAGE_SIZES) as PageSizeId[]).map((k) => (
            <label key={k} className="seg-opt">
              <input type="radio" name="start-size" value={k} checked={size === k} onChange={() => setSize(k)} />
              <span>{PAGE_SIZES[k].label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" className="btn btn-primary btn-lg mt-7 w-full">Start your resume</button>
    </form>
  );
}
