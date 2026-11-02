import { ResumeBody } from "./ResumeBody";
import type { TemplateProps } from "./types";

export function LedgerTemplate({ doc, idPrefix, decorative }: TemplateProps) {
  return <ResumeBody doc={doc} className="tpl-ledger" idPrefix={idPrefix} decorative={decorative} />;
}
