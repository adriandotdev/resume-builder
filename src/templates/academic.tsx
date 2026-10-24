import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function AcademicTemplate({ doc, idPrefix }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-academic" idPrefix={idPrefix} />;
}
