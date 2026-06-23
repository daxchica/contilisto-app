// src/utils/metaPixel.ts
// Central wrapper for all Meta Pixel (fbq) calls.
// Every function checks window.fbq before calling to avoid errors when the
// script hasn't loaded yet (e.g. blocked by an ad-blocker, or during SSR).

type FbqFn = NonNullable<Window["fbq"]>;

/** Returns the fbq function if available, null otherwise. */
function getFbq(): FbqFn | null {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    if (import.meta.env.DEV) {
      console.warn("[MetaPixel] fbq not available — event skipped");
    }
    return null;
  }
  return window.fbq;
}

/** Standard PageView — call on every route change in a SPA. */
export function trackPageView(): void {
  getFbq()?.("track", "PageView");
}

/** Standard Lead — call when a user submits a registration form. */
export function trackLead(params?: object): void {
  getFbq()?.("track", "Lead", params);
}

/** Standard CompleteRegistration — call after successful account creation. */
export function trackCompleteRegistration(params?: object): void {
  getFbq()?.("track", "CompleteRegistration", params);
}

/** Standard Subscribe — call after a paid plan is activated. */
export function trackSubscribe(params?: object): void {
  getFbq()?.("track", "Subscribe", params);
}

/**
 * Custom event — use trackCustom (not track) for non-standard event names.
 * Example: trackCustomEvent("ClickCrearCuenta", { plan: "estudiante" })
 */
export function trackCustomEvent(eventName: string, params?: object): void {
  getFbq()?.("trackCustom", eventName, params);
}

/**
 * Generic standard event — kept for backwards compatibility with existing
 * callers that use trackEvent() directly.
 */
export function trackEvent(eventName: string, params?: object): void {
  getFbq()?.("track", eventName, params);
}
