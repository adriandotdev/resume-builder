import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function GraduateTemplate({ doc, idPrefix }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-graduate" idPrefix={idPrefix} />;
}
