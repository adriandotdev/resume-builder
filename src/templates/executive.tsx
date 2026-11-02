import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function ExecutiveTemplate({ doc, idPrefix, decorative }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-executive" idPrefix={idPrefix} decorative={decorative} />;
}
