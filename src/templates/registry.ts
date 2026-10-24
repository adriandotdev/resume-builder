import type { TemplateDef } from "./types";
import type { TemplateId } from "@/lib/schema";
import { ClassicTemplate } from "./classic";
import { ModernTemplate } from "./modern";
import { CompactTemplate } from "./compact";
import { ElegantTemplate } from "./elegant";
import { BoldTemplate } from "./bold";
import { MinimalTemplate } from "./minimal";
import { ExecutiveTemplate } from "./executive";
import { AcademicTemplate } from "./academic";
import { TechnicalTemplate } from "./technical";
import { GraduateTemplate } from "./graduate";
import { SoftlineTemplate } from "./softline";
import { LedgerTemplate } from "./ledger";

export const TEMPLATES: TemplateDef[] = [
  { id: "classic", name: "Classic", description: "Left-aligned name with a thin rule under each heading.", tags: ["simple"], Component: ClassicTemplate },
  { id: "modern", name: "Modern", description: "Accent bar beside headings and a ruled name block.", tags: ["modern"], Component: ModernTemplate },
  { id: "compact", name: "Compact", description: "Tight spacing to fit more on a single page.", tags: ["compact"], Component: CompactTemplate },
  { id: "elegant", name: "Elegant", description: "Centered name block with letter-spaced headings.", tags: ["simple", "modern"], Component: ElegantTemplate },
  { id: "bold", name: "Bold", description: "Filled accent bands behind section headings.", tags: ["bold", "modern"], Component: BoldTemplate },
  { id: "minimal", name: "Minimal", description: "Quiet headings with no rules.", tags: ["simple"], Component: MinimalTemplate },
  { id: "executive", name: "Executive", description: "Light name over a thin double rule, with sentence-case headings.", tags: ["simple", "formal"], Component: ExecutiveTemplate },
  { id: "academic", name: "Academic", description: "Dense CV layout with dates running down the left edge.", tags: ["compact", "formal"], Component: AcademicTemplate },
  { id: "technical", name: "Technical", description: "Tight and compact, with accent-colored skill labels.", tags: ["compact", "modern"], Component: TechnicalTemplate },
  { id: "graduate", name: "Graduate", description: "Roomy and friendly, with a large name and heavy headings for a first job.", tags: ["simple", "first-job"], Component: GraduateTemplate },
  { id: "softline", name: "Softline", description: "Soft accent-tinted underlines and generous spacing.", tags: ["modern", "first-job"], Component: SoftlineTemplate },
  { id: "ledger", name: "Ledger", description: "Small boxed marker and short rule on each heading, with a fine line down the entries.", tags: ["modern", "formal"], Component: LedgerTemplate },
];

export function getTemplate(id: TemplateId): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
