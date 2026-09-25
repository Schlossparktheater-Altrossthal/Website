"use client";

import { useCallback, useSyncExternalStore } from "react";

function getServerSnapshot() {
  return false;
}

/**
 * Lightweight media query hook that is safe for server rendering.
 * Returns whether the provided media query currently matches.
 *
 * `useSyncExternalStore` rendert beim Hydrieren zuerst den Server-Wert (`false`) und
 * wechselt danach auf den echten Wert. Ein direktes `window.matchMedia` im ersten Render
 * erzeugte auf Mobilgeräten einen Hydration-Fehler (React #418) in der Sidebar.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQueryList = window.matchMedia(query);
      if (typeof mediaQueryList.addEventListener === "function") {
        mediaQueryList.addEventListener("change", onChange);
        return () => mediaQueryList.removeEventListener("change", onChange);
      }
      mediaQueryList.addListener(onChange);
      return () => mediaQueryList.removeListener(onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
