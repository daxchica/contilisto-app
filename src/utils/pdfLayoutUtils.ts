// src/utils/pdfLayoutUtils.ts

import * as pdfjsLib from "pdfjs-dist";
import type { TextBlock } from "../types/InvoiceLayoutTypes";
import "../pdfWorker"; // Asegúrate de que el worker está correctamente importado

/**
 * Extrae bloques de texto con coordenadas x, y desde un archivo PDF.
 * @param file - Archivo PDF tipo File (desde input o drop)
 * @returns Arreglo de bloques con texto y posición: { str, x, y }
 */
export async function extractTextBlocksFromPDF(file: File): Promise<TextBlock[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const blocks: TextBlock[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    
    for (const item of content.items as any[]) {
      const str = item.str?.trim?.();
      const transform = item.transform;
      
      if (str && transform?.length >= 5) {
        const x = transform[4];
        const y = transform[5];
        blocks.push({ str, x, y });
      }
    }
  }

  // Orden opcional: de arriba hacia abajo, luego de izquierda a derecha
  return blocks.sort((a, b) => b.y - a.y || a.x - b.x);
}