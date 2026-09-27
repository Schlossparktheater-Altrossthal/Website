"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "members-nav-history";
const MAX_ENTRIES = 30;
export const MEMBERS_HOME_PATH = "/mitglieder";

function readHistory(): string[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function writeHistory(history: string[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_ENTRIES)));
  } catch {
    // sessionStorage may be unavailable (private mode); the button then falls back to the dashboard.
  }
}

/**
 * Tracks the pages visited inside the members area (per browser tab) and
 * returns the page the back button should lead to: the previously visited
 * members page, or the dashboard when there is none. Returns null on the
 * dashboard without history, where a back button makes no sense.
 */
export function useMembersBackTarget(): string | null {
  const pathname = usePathname();
  const [target, setTarget] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pathname) return;
    const history = readHistory();
    const last = history.at(-1);
    const previous = history.at(-2);

    if (pathname === previous) {
      // Going back (via this button or the browser): drop the page we left.
      history.pop();
    } else if (pathname !== last) {
      history.push(pathname);
    }
    writeHistory(history);

    const before = history.at(-2);
    // sessionStorage is only readable after mount, so the target is synced here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTarget(before ?? (pathname === MEMBERS_HOME_PATH ? null : MEMBERS_HOME_PATH));
  }, [pathname]);

  return target;
}
