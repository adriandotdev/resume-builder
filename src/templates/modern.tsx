import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function ModernTemplate({ doc, idPrefix }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-modern" idPrefix={idPrefix} />;
}
