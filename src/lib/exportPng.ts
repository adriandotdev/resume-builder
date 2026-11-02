/** Where each page's content starts and how tall it is, in sheet px. Matches how the browser breaks the sheet when printing. */
export function pageSlices(sheetH: number, pageH: number, marginPx: number): { y: number; h: number }[] {
  const area = pageH - 2 * marginPx;
  const content = Math.max(0, sheetH - 2 * marginPx);
  if (area <= 0 || content <= area + 2) return [{ y: marginPx, h: content }];
  const out: { y: number; h: number }[] = [];
  for (let y = 0; y < content; y += area) out.push({ y: marginPx + y, h: Math.min(area, content - y) });
  return out;
}

const MAX_SIDE = 16000;

const load = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error("image failed to load"));
  img.src = url;
});

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/png"));

/** Renders the paper sheet to one PNG per page. Nothing leaves the browser. */
export async function sheetToPngs(sheet: HTMLElement, pageW: number, pageH: number, marginPx: number): Promise<Blob[]> {
  const { toPng } = await import("html-to-image");
  await document.fonts?.ready;
  const sheetH = sheet.offsetHeight;
  const slices = pageSlices(sheetH, pageH, marginPx);
  const ratio = Math.min(2, MAX_SIDE / Math.max(sheetH, pageW));
  // Scale and outline belong to the on-screen preview; the image should be the plain paper at full size.
  const url = await toPng(sheet, {
    pixelRatio: ratio, backgroundColor: "#fff", cacheBust: true, width: pageW, height: sheetH,
    style: { transform: "none", outline: "0", borderRadius: "0", margin: "0" },
  });
  const img = await load(url);
  const blobs: Blob[] = [];
  for (const s of slices) {
    const c = document.createElement("canvas");
    c.width = Math.round(pageW * ratio);
    c.height = Math.round(pageH * ratio);
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, s.y * ratio, c.width, s.h * ratio, 0, marginPx * ratio, c.width, s.h * ratio);
    blobs.push(await toBlob(c));
  }
  return blobs;
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
