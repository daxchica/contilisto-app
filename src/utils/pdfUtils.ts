// utils/pdfUtils.ts
// Browser + Node safe (NO Buffer in browser)

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/^data:application\/pdf;base64,/, "").trim();

  // Browser
  if (typeof atob === "function") {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // Node / Netlify fallback
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const buf = require("buffer").Buffer.from(clean, "base64");
  return new Uint8Array(buf);
}

export async function getPdfPageCount(base64: string): Promise<number> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // ✅ CRITICAL: set workerSrc for Vite/Netlify
  // This prevents: "GlobalWorkerOptions.workerSrc not specified"
  if (pdfjsLib?.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }

  const buffer = base64ToUint8Array(base64);

  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    // disableWorker: true,
  });

  const doc = await loadingTask.promise;
  return doc.numPages || 1;
}