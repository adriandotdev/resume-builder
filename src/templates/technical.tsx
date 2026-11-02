import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function TechnicalTemplate({ doc, idPrefix, decorative }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-technical" idPrefix={idPrefix} decorative={decorative} />;
}
