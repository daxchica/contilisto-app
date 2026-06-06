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

/**
 * Extract plain text from all pages of a PDF preserving line structure.
 *
 * pdfjs gives each text "item" with an [a,b,c,d,x,y] transform where y is the
 * baseline position (PDF coordinate — origin at bottom-left, y increases up).
 * Items on the same visual line share approximately the same y value.
 *
 * We group items by rounded y, sort lines top-to-bottom (descending y), and
 * join items within a line with a space — producing proper newline-separated
 * output that regex-based parsers can work with reliably.
 *
 * Returns the full text with original casing (callers lowercase as needed).
 * On any error returns an empty string so callers can fall through gracefully.
 */
export async function extractPdfText(base64: string): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    if (pdfjsLib?.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    }

    const buffer  = base64ToUint8Array(base64);
    const pdfDoc  = await pdfjsLib.getDocument({ data: buffer }).promise;
    const allLines: string[] = [];

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page    = await pdfDoc.getPage(p);
      const content = await page.getTextContent();

      // Group text items by their rounded y-coordinate.
      // Items within ±2 units share the same visual line.
      const byY = new Map<number, string[]>();

      for (const item of content.items as any[]) {
        const str = (item.str ?? "").trim();
        if (!str) continue;

        // transform = [a, b, c, d, x, y]  — y is baseline in PDF units
        const rawY = typeof item.transform?.[5] === "number" ? item.transform[5] : 0;
        const key  = Math.round(rawY / 3) * 3; // bucket to 3-unit rows

        if (!byY.has(key)) byY.set(key, []);
        byY.get(key)!.push(str);
      }

      // Sort lines top-to-bottom: larger y = higher on the page
      const sorted = [...byY.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, words]) => words.join(" ").trim())
        .filter(Boolean);

      allLines.push(...sorted);
    }

    return allLines.join("\n");
  } catch {
    return "";
  }
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