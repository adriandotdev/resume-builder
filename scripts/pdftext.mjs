// PDF text-layer extractor (pdftotext is NOT installed; uses pdfjs-dist). Prints pages, size, and text in content-stream order.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs";
const file = process.argv[2];
const data = new Uint8Array(fs.readFileSync(file));
const pdf = await getDocument({ data, useSystemFonts: true }).promise;
let out = [];
for (let i = 1; i <= pdf.numPages; i++) {
  const p = await pdf.getPage(i);
  const vp = p.getViewport({ scale: 1 });
  if (i === 1) console.error(`pages=${pdf.numPages} size=${(vp.width / 72 * 25.4).toFixed(1)}x${(vp.height / 72 * 25.4).toFixed(1)}mm`);
  const tc = await p.getTextContent();
  let line = "", lastY = null;
  for (const it of tc.items) {
    if (!("str" in it)) continue;
    const y = it.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) { out.push(line); line = ""; }
    line += (line && it.str && !line.endsWith(" ") && !it.str.startsWith(" ") ? " " : "") + it.str;
    lastY = y;
  }
  out.push(line);
}
console.log(out.filter((l) => l.trim()).join("\n"));
