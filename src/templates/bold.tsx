import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function BoldTemplate({ doc, idPrefix }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-bold" idPrefix={idPrefix} />;
}
