"use client";

import type { InlineScriptProps } from "@/lib/ui-standards";

/**
 * Inline-Skript, das der Browser synchron beim Parsen der HTML-Antwort ausführt.
 * Einsatz: Werte vor dem ersten Paint korrigieren (Anti-Flash), z. B. den
 * Farbmodus in `src/components/theme/color-mode-script.tsx`.
 *
 * Der Server liefert `text/javascript`, damit das Skript vor dem ersten Paint
 * läuft. Im Browser rendert die Komponente `text/plain`: React kann ein dort
 * erzeugtes Skript nicht ausführen und meldet in der Konsole "Encountered a
 * script tag while rendering React component". Als inerter Datenblock
 * (`text/plain`) unterbleibt die Meldung; `suppressHydrationWarning` deckt den
 * Typ-Unterschied zwischen Server- und Client-Markup ab.
 *
 * Details: node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
export function InlineScript({ html }: InlineScriptProps) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
