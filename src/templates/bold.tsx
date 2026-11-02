import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function BoldTemplate({ doc, idPrefix, decorative }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-bold" idPrefix={idPrefix} decorative={decorative} />;
}
