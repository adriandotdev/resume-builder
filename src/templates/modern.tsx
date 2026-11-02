import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function ModernTemplate({ doc, idPrefix, decorative }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-modern" idPrefix={idPrefix} decorative={decorative} />;
}
