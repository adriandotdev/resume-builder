import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function ClassicTemplate({ doc, idPrefix }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-classic" idPrefix={idPrefix} />;
}
