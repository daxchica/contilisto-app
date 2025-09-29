// src/types/pdfjs-dist.d.ts

declare module 'pdfjs-dist/build/pdf' {
  export * from 'pdfjs-dist/types/src/pdf';
}

declare module 'pdfjs-dist/build/pdf.worker?url' {
  const workerUrl: string;
  export default workerUrl;
}