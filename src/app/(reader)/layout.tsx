/**
 * Vollbild-Layout für App-artige Ansichten ohne Webseiten-Kopf, Seitenleiste und untere Leiste
 * (Skript-Leser, docs/Plan/skript-plan.md). Anmeldung prüft die jeweilige Seite.
 */
export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
