// src/hooks/usePixelPageView.ts
// Fires a Meta Pixel PageView on every react-router route change.
// Mount once inside a component that lives inside <BrowserRouter>.

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/utils/metaPixel";

export function usePixelPageView(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    trackPageView();
  }, [pathname]);
}
