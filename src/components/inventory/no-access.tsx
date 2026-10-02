export function NoInventoryAccess({ manage = false }: { manage?: boolean }) {
  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border/60 bg-background/80 p-4 text-sm text-destructive">
        {manage
          ? "Diesen Bereich dürfen nur Personen öffnen, die das Lager verwalten."
          : "Kein Zugriff auf das Lager. Das Recht „Lager nutzen“ vergibt die Rechteverwaltung."}
      </div>
    </div>
  );
}
