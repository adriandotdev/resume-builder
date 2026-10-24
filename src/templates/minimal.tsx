import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function MinimalTemplate({ doc, idPrefix }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-minimal" idPrefix={idPrefix} />;
}
