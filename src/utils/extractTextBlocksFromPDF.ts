// src/utils/extractTextBlocksFromPDF.ts

import * as pdfjsLib from "pdfjs-dist";
import type { TextBlock } from "../types/TextBlock";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

import pdfWorker from "pdfjs-dist/build/pdf.worker?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractTextBlocksFromPDF(file: File): Promise<TextBlock[]> {
  const blocks: TextBlock[] = [];

  try{
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const content = await page.getTextContent();

      for (const item of content.items as TextItem[]) {
        if (typeof item.str !== "string" || !item.transform || !item.str.trim()) continue;

        const [a, b, c, d, e, f] = item.transform;
        const x = e;
        const y = viewport.height - f; // invert Y
        const fontHeight = Math.abs(d || 10);
        const width = item.width ?? 0;

        blocks.push ({
          text: item.str,
          x,
          y,
          width,
          height: fontHeight,
          page: pageNum,
        });
      }
    }
    return blocks;
  } catch (error) {
    console.error("Error extracting text blocks from PDF:", error);
    throw new Error("Failed to extract text blocks from PDF");
  }
}