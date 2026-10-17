"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { DIRECTION_HOME_PATH, isDirectionViewPathAllowed } from "@/lib/regie/paths";

/**
 * Regie-Ansicht: Das Layout leitet beim Laden um; bei Client-Navigation wird das Layout
 * nicht neu gerendert, deshalb prüft dieser Wächter jeden Pfadwechsel.
 */
export function DirectionViewGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname && !isDirectionViewPathAllowed(pathname)) {
      router.replace(DIRECTION_HOME_PATH);
    }
  }, [pathname, router]);

  return null;
}
