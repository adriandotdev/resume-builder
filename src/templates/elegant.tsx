import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function ElegantTemplate({ doc, idPrefix }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-elegant" idPrefix={idPrefix} />;
}
