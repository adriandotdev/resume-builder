"use client";
import { createEmptyItem, type CertItem, type CustomItem, type EducationItem, type ExperienceItem, type LanguageItem, type ProjectItem, type Section, type SkillGroup } from "@/lib/schema";
import { BulletsField, ItemsEditor, TextArea, TextField } from "./fields";

const full = "@md:col-span-2";

export function SectionEditor({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  switch (section.type) {
    case "contact": {
      const c = section.content;
      const set = (p: Partial<typeof c>) => onChange({ ...section, content: { ...c, ...p } });
      return (
        <div className="grid gap-3 @md:grid-cols-2">
          <TextField label="Full name" autoComplete="name" value={c.fullName} onChange={(v) => set({ fullName: v })} />
          <TextField label="Headline (job title)" autoComplete="organization-title" value={c.headline} onChange={(v) => set({ headline: v })} />
          <TextField label="Email" type="email" autoComplete="email" value={c.email} onChange={(v) => set({ email: v })} />
          <TextField label="Phone" type="tel" autoComplete="tel" value={c.phone} onChange={(v) => set({ phone: v })} />
          <TextField label="Location" value={c.location} onChange={(v) => set({ location: v })} />
          <TextArea label="Links (one per line)" rows={2} value={c.links.join("\n")} onChange={(v) => set({ links: v.split("\n") })} />
        </div>
      );
    }
    case "summary":
      return <TextArea label="Summary" rows={5} value={section.content.text} onChange={(v) => onChange({ ...section, content: { text: v } })} />;
    case "experience":
      return (
        <ItemsEditor<ExperienceItem> sectionId={section.id} items={section.content.items} onChange={(items) => onChange({ ...section, content: { items } })} emptyText="No jobs yet. Add your most recent role first, then work backwards." makeEmpty={() => createEmptyItem("experience") as ExperienceItem} addLabel="Add experience" itemLabel={(i, n) => i.role || i.org || `Experience ${n + 1}`}
          render={(i, u) => (<>
            <TextField label="Job title" value={i.role} onChange={(v) => u({ role: v })} />
            <TextField label="Employer" value={i.org} onChange={(v) => u({ org: v })} />
            <TextField label="Location" value={i.location} onChange={(v) => u({ location: v })} />
            <TextField label="Start (YYYY-MM)" value={i.start} onChange={(v) => u({ start: v })} />
            <TextField label="End (YYYY-MM)" value={i.end} onChange={(v) => u({ end: v })} />
            <label className="check-row"><input type="checkbox" checked={i.current} onChange={(e) => u({ current: e.target.checked })} /> I currently work here</label>
            <div className={full}><BulletsField label="Achievements" value={i.bullets} onChange={(v) => u({ bullets: v })} /></div>
          </>)} />
      );
    case "education":
      return (
        <ItemsEditor<EducationItem> sectionId={section.id} items={section.content.items} onChange={(items) => onChange({ ...section, content: { items } })} emptyText="No education yet. Add your highest or most recent degree first." makeEmpty={() => createEmptyItem("education") as EducationItem} addLabel="Add education" itemLabel={(i, n) => i.degree || i.school || `Education ${n + 1}`}
          render={(i, u) => (<>
            <TextField label="Degree" value={i.degree} onChange={(v) => u({ degree: v })} />
            <TextField label="School" value={i.school} onChange={(v) => u({ school: v })} />
            <TextField label="Location" value={i.location} onChange={(v) => u({ location: v })} />
            <span />
            <TextField label="Start (YYYY-MM)" value={i.start} onChange={(v) => u({ start: v })} />
            <TextField label="End (YYYY-MM)" value={i.end} onChange={(v) => u({ end: v })} />
            <div className={full}><BulletsField label="Details" value={i.details} onChange={(v) => u({ details: v })} /></div>
          </>)} />
      );
    case "skills":
      return (
        <ItemsEditor<SkillGroup> sectionId={section.id} items={section.content.items} onChange={(items) => onChange({ ...section, content: { items } })} emptyText="No skills yet. Group them, for example “Tools” or “Languages”, so they are easy to scan." makeEmpty={() => createEmptyItem("skills") as SkillGroup} addLabel="Add skill group" itemLabel={(i, n) => i.label || `Skill group ${n + 1}`}
          render={(i, u) => (<>
            <TextField label="Group label" value={i.label} onChange={(v) => u({ label: v })} />
            <TextField label="Skills (comma separated)" value={i.skills} onChange={(v) => u({ skills: v })} />
          </>)} />
      );
    case "projects":
      return (
        <ItemsEditor<ProjectItem> sectionId={section.id} items={section.content.items} onChange={(items) => onChange({ ...section, content: { items } })} emptyText="No projects yet. Add one or two that show the work you want to be hired for." makeEmpty={() => createEmptyItem("projects") as ProjectItem} addLabel="Add project" itemLabel={(i, n) => i.name || `Project ${n + 1}`}
          render={(i, u) => (<>
            <TextField label="Name" value={i.name} onChange={(v) => u({ name: v })} />
            <TextField label="Link" value={i.link} onChange={(v) => u({ link: v })} />
            <TextField label="Start (YYYY-MM)" value={i.start} onChange={(v) => u({ start: v })} />
            <TextField label="End (YYYY-MM)" value={i.end} onChange={(v) => u({ end: v })} />
            <div className={full}><BulletsField label="Highlights" value={i.bullets} onChange={(v) => u({ bullets: v })} /></div>
          </>)} />
      );
    case "certifications":
      return (
        <ItemsEditor<CertItem> sectionId={section.id} items={section.content.items} onChange={(items) => onChange({ ...section, content: { items } })} emptyText="No certifications yet. Add the ones a job post asks for." makeEmpty={() => createEmptyItem("certifications") as CertItem} addLabel="Add certification" itemLabel={(i, n) => i.name || `Certification ${n + 1}`}
          render={(i, u) => (<>
            <TextField label="Name" value={i.name} onChange={(v) => u({ name: v })} />
            <TextField label="Issuer" value={i.issuer} onChange={(v) => u({ issuer: v })} />
            <TextField label="Date (YYYY-MM)" value={i.date} onChange={(v) => u({ date: v })} />
          </>)} />
      );
    case "languages":
      return (
        <ItemsEditor<LanguageItem> sectionId={section.id} items={section.content.items} onChange={(items) => onChange({ ...section, content: { items } })} emptyText="No languages yet. Add each one with your level." makeEmpty={() => createEmptyItem("languages") as LanguageItem} addLabel="Add language" itemLabel={(i, n) => i.name || `Language ${n + 1}`}
          render={(i, u) => (<>
            <TextField label="Language" value={i.name} onChange={(v) => u({ name: v })} />
            <TextField label="Level" value={i.level} onChange={(v) => u({ level: v })} />
          </>)} />
      );
    case "custom":
      return (
        <ItemsEditor<CustomItem> sectionId={section.id} items={section.content.items} onChange={(items) => onChange({ ...section, content: { items } })} emptyText="No lines yet. Add anything that does not fit another section, such as awards or volunteering." makeEmpty={() => createEmptyItem("custom") as CustomItem} addLabel="Add line" itemLabel={(i, n) => i.text.slice(0, 30) || `Line ${n + 1}`}
          render={(i, u) => (<div className={full}><TextField label="Text" value={i.text} onChange={(v) => u({ text: v })} /></div>)} />
      );
  }
}
