"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setFreeTicketAllowanceAction } from "@/app/(members)/mitglieder/karten/einstellungen/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type FreeTicketRow = {
  userId: string;
  name: string;
  override: number | null;
  total: number;
  used: number;
};

export function FreeTicketsCard({
  showId,
  rows,
  defaultQuantity,
}: {
  showId: string;
  rows: FreeTicketRow[];
  defaultQuantity: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((row) => row.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);
  const usedTotal = rows.reduce((sum, row) => sum + row.used, 0);

  const save = (userId: string, quantity: number | null) =>
    startTransition(async () => {
      const result = await setFreeTicketAllowanceAction(showId, userId, quantity);
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Freikarten</h2>
          <p className="text-sm text-muted-foreground">
            {rows.length} Mitwirkende · {usedTotal} Freikarten angemeldet · Standard{" "}
            {defaultQuantity} pro Person. Abweichungen hier eintragen.
          </p>
        </div>
        <Input
          type="search"
          placeholder="Person suchen"
          className="w-full sm:w-56"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Keine Mitwirkenden gefunden.
        </p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-border/60 overflow-y-auto rounded-md border border-border/60">
          {filtered.map((row) => (
            <li key={row.userId} className="flex min-h-12 items-center gap-3 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {row.used} angemeldet
              </span>
              {row.override !== null ? (
                <Badge variant="info" size="sm">
                  abweichend
                </Badge>
              ) : null}
              <Input
                type="number"
                min={0}
                className="w-20"
                aria-label={`Freikarten für ${row.name}`}
                defaultValue={row.total}
                disabled={pending}
                onBlur={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  if (!Number.isFinite(value) || value === row.total) return;
                  save(row.userId, value === defaultQuantity ? null : value);
                }}
              />
              {row.override !== null ? (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => save(row.userId, null)}
                >
                  Standard
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
