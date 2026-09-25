import { MAX_EXTRACTION_PAGES, type ExtractionPage } from "./extraction";
import { regionSchema } from "./types";

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_STEP_BYTES = 50 * 1024 * 1024;

export async function getPdfEngine() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjs;
}
export async function validatePdf(file: File) {
  if (
    !/\.pdf$/i.test(file.name) ||
    (file.type && file.type !== "application/pdf")
  )
    throw new Error("Choose a PDF drawing (.pdf).");
  if (file.size === 0 || file.size > MAX_PDF_BYTES)
    throw new Error("Choose a PDF between 1 byte and 25 MB.");
  const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (header !== "%PDF-")
    throw new Error(
      "This file is not a valid PDF. Export your drawing as PDF and try again.",
    );
  const pdfjs = await getPdfEngine();
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  });
  try {
    const document = await task.promise;
    if (document.numPages > 100)
      throw new Error("Use a drawing with 100 pages or fewer.");
    const pages = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 1, rotation: 0 });
      pages.push({
        width: viewport.width,
        height: viewport.height,
        rotation: page.rotate,
      });
    }
    return pages;
  } catch (error) {
    if (error instanceof Error && /100 pages/.test(error.message)) throw error;
    throw new Error(
      "This PDF could not be opened. It may be damaged or password protected. Try an unlocked PDF export.",
    );
  } finally {
    await task.destroy();
  }
}
export async function validateStep(file: File) {
  if (
    !/\.(step|stp)$/i.test(file.name) ||
    file.size === 0 ||
    file.size > MAX_STEP_BYTES
  )
    throw new Error(
      "Optional STEP attachments must be .step or .stp files under 50 MB.",
    );
  const header = new TextDecoder().decode(
    await file.slice(0, 512).arrayBuffer(),
  );
  if (!header.includes("ISO-10303-21;"))
    throw new Error("This attachment is not a supported STEP Part 21 file.");
}

/** Render exactly the selected pages; page coordinates match the viewer's unrotated crop box. */
export async function prepareExtractionPages(
  source: string,
  numbers: number[],
  onProgress: (message: string) => void,
): Promise<ExtractionPage[]> {
  if (numbers.length < 1 || numbers.length > MAX_EXTRACTION_PAGES)
    throw new Error("Select 1–3 pages.");
  const pdfjs = await getPdfEngine();
  const task = pdfjs.getDocument({ url: source, isEvalSupported: false });
  try {
    const pdf = await task.promise;
    const pages: ExtractionPage[] = [];
    for (const number of numbers) {
      onProgress(
        `Preparing page ${number} (${pages.length + 1}/${numbers.length})…`,
      );
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1, rotation: 0 });
      const viewport = page.getViewport({
        scale: Math.min(2, 1600 / Math.max(base.width, base.height)),
        rotation: 0,
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport, background: "white" }).promise;
      let image = canvas.toDataURL("image/jpeg", 0.85);
      if (image.length > 1_000_000)
        image = canvas.toDataURL("image/jpeg", 0.55);
      canvas.width = 0;
      canvas.height = 0;
      if (image.length > 1_000_000)
        throw new Error(
          `Page ${number} is too detailed for this prototype. Upload a smaller drawing export.`,
        );
      const text = await page.getTextContent();
      const spans: ExtractionPage["spans"] = [];
      let textTruncated = false;
      let characters = 0;
      for (const [index, item] of text.items.entries()) {
        if (!("str" in item) || !item.str.trim()) continue;
        if (spans.length >= 500 || characters + item.str.length > 40_000) {
          textTruncated = true;
          continue;
        }
        const tx = pdfjs.Util.transform(base.transform, item.transform);
        const height = Math.hypot(tx[2], tx[3]);
        const angle = Math.atan2(tx[1], tx[0]);
        const ascent = text.styles[item.fontName]?.ascent ?? 0.8;
        const topX = tx[4] + Math.sin(angle) * height * ascent;
        const topY = tx[5] - Math.cos(angle) * height * ascent;
        const points = [
          [topX, topY],
          [
            topX + Math.cos(angle) * item.width,
            topY + Math.sin(angle) * item.width,
          ],
          [topX - Math.sin(angle) * height, topY + Math.cos(angle) * height],
          [
            topX + Math.cos(angle) * item.width - Math.sin(angle) * height,
            topY + Math.sin(angle) * item.width + Math.cos(angle) * height,
          ],
        ];
        const x = Math.max(
          0,
          Math.min(...points.map((p) => p[0])) / base.width,
        );
        const y = Math.max(
          0,
          Math.min(...points.map((p) => p[1])) / base.height,
        );
        const right = Math.min(
          1,
          Math.max(...points.map((p) => p[0])) / base.width,
        );
        const bottom = Math.min(
          1,
          Math.max(...points.map((p) => p[1])) / base.height,
        );
        const region = regionSchema.safeParse({
          page: number,
          x,
          y,
          width: right - x,
          height: bottom - y,
        });
        if (!region.success) continue;
        if (item.str.length > 500) textTruncated = true;
        spans.push({
          id: `p${number}-t${index}`,
          text: item.str.slice(0, 500),
          region: region.data,
        });
        characters += item.str.length;
      }
      pages.push({ page: number, image, spans, textTruncated });
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
