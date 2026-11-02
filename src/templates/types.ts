import type { ComponentType } from "react";
import type { ResumeDoc, TemplateId } from "@/lib/schema";

export interface TemplateProps { doc: ResumeDoc; idPrefix?: string; decorative?: boolean }
export interface TemplateDef { id: TemplateId; name: string; description: string; tags: string[]; Component: ComponentType<TemplateProps> }
