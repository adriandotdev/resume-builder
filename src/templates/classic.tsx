import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function ClassicTemplate({ doc, idPrefix, decorative }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-classic" idPrefix={idPrefix} decorative={decorative} />;
}
