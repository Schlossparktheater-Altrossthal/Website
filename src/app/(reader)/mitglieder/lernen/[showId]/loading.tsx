import { Skeleton } from "@/components/ui/skeleton";

/** Ladeskelett des Lernmodus. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-16" aria-busy="true">
      <Skeleton className="h-32" />
      <Skeleton className="h-16" />
      <Skeleton className="h-48" />
    </div>
  );
}
