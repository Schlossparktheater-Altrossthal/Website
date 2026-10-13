/** Ladeskelett des Lernmodus. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-16" aria-busy="true">
      <div className="h-32 animate-pulse bg-muted" />
      <div className="h-16 animate-pulse bg-muted" />
      <div className="h-48 animate-pulse bg-muted" />
    </div>
  );
}
