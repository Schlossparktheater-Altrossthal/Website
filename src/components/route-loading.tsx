import { Skeleton } from "@/components/ui/skeleton";

// Ladeskelett für loading.tsx im Mitgliederbereich. Wichtig: `data-route-loading` – daran
// erkennt die Ladezeit-Messung (performance-reporter), wann eine Seite fertig ist.
//
// Jeder Bereich mit Unterseiten braucht eine eigene loading.tsx: Wechsel innerhalb eines
// Bereichs (z. B. Lager → Katalog) laufen sonst ohne sichtbare Reaktion, bis der Server fertig
// ist, weil die Ladegrenze von /mitglieder dabei nicht erneut greift.

type Variant = "cards" | "list" | "table" | "detail";

export function RouteLoading({ variant = "cards" }: { variant?: Variant }) {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      data-route-loading=""
      aria-label="Seite wird geladen"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {variant === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : variant === "table" ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : variant === "detail" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Skeleton className="h-72 rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
