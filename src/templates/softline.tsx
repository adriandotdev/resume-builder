import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function SoftlineTemplate({ doc, idPrefix, decorative }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-softline" idPrefix={idPrefix} decorative={decorative} />;
}
