import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function ElegantTemplate({ doc, idPrefix, decorative }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-elegant" idPrefix={idPrefix} decorative={decorative} />;
}
