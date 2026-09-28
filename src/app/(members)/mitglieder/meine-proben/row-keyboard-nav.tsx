"use client";

import type { ReactNode } from "react";

/** ↑/↓ blättert in der Desktop-Vorschau zum vorigen bzw. nächsten Termin. */
export function RowKeyboardNav({ children }: { children: ReactNode }) {
  return (
    <div
      onKeyDown={(event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        const rows = Array.from(
          event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[data-preview-row]"),
        ).filter((row) => row.offsetParent !== null);
        if (!rows.length) return;
        const current = rows.findIndex(
          (row) => row === document.activeElement || row.getAttribute("aria-current") === "true",
        );
        const next = rows[current + (event.key === "ArrowDown" ? 1 : -1)];
        if (!next) return;
        event.preventDefault();
        next.focus();
        next.click();
      }}
    >
      {children}
    </div>
  );
}
