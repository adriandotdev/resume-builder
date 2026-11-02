import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function MinimalTemplate({ doc, idPrefix, decorative }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-minimal" idPrefix={idPrefix} decorative={decorative} />;
}
