import { Skeleton } from "@/components/ui/skeleton";

// Sofortiges Feedback beim Seitenwechsel: Ohne Ladegrenze wartet die Navigation, bis
// die Zielseite komplett serverseitig gerendert ist, und Links können nicht vorab laden.
export default function LoadingMembersPage() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Seite wird geladen">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
