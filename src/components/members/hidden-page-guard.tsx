"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { isMemberPageHidden } from "@/lib/members-page-visibility";

/**
 * Das Layout sperrt ausgeblendete Seiten beim Laden; bei Client-Navigation wird
 * das Layout nicht neu gerendert, deshalb prüft dieser Wächter jeden Pfadwechsel.
 */
export function HiddenPageGuard({ visibility }: { visibility: Record<string, boolean> }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname && isMemberPageHidden(pathname, visibility)) {
      router.replace("/mitglieder");
    }
  }, [pathname, router, visibility]);

  return null;
}
