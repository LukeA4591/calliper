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
