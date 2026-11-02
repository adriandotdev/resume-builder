import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function AcademicTemplate({ doc, idPrefix, decorative }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-academic" idPrefix={idPrefix} decorative={decorative} />;
}
