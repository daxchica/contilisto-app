// ============================================================================
// src/utils/extractTextBlocksFromPDF.ts
// FINAL — Extrae texto desde PDFs usando pdfjs-dist
// ============================================================================

import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/build/pdf.worker";

// ============================================================
// TYPES
// ============================================================
export interface TextBlock {
  page: number;
  text: string;
}

export interface ExtractedPDFText {
  fullText: string;
  pages: TextBlock[];
}

// ============================================================
// MAIN FUNCTION
// ============================================================
export async function extractTextBlocksFromPDF(
  base64: string
): Promise<ExtractedPDFText> {
  if (!base64) throw new Error("No base64 provided to extractTextBlocksFromPDF");

  const pdfData = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  try {
    // Load PDF
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;

    const pages: TextBlock[] = [];
    let fullCollectedText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const strings = content.items
        .map((item: any) => item.str)
        .filter(Boolean);

      const pageText = strings.join(" ").trim();

      pages.push({
        page: pageNum,
        text: pageText,
      });

      fullCollectedText += "\n" + pageText;
    }

    return {
      fullText: fullCollectedText.trim(),
      pages,
    };
  } catch (err) {
    console.error("❌ Error extracting text from PDF:", err);
    throw new Error("Failed to extract text from PDF");
  }
}