import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function CompactTemplate({ doc, idPrefix }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-compact" idPrefix={idPrefix} />;
}
