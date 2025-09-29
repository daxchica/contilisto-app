// src/types/TextBlock.ts

export interface TextBlock {
  text: string;     // Texto visible del bloque
  x: number;        // Posición X (horizontal) en la página
  y: number;        // Posición Y (vertical) en la página
  width: number;    // Ancho del bloque
  height: number;   // Alto del bloque
  page: number;     // Número de página (1-indexed)
}