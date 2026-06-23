// src/types/meta-pixel.d.ts
// Extends the Window interface so TypeScript knows about window.fbq
// injected by the Meta Pixel snippet in index.html.

declare global {
  interface Window {
    fbq?: (
      method: "track" | "trackCustom" | "init" | "set",
      event: string,
      params?: object
    ) => void;
    _fbq?: unknown;
  }
}

export {};
