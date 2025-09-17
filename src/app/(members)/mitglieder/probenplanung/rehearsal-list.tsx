"use client";

import { useMemo, useState } from "react";
import { RehearsalCardWithActions } from "./rehearsal-card-with-actions";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { Button } from "@/components/ui/button";

type UserLite = { id: string; name: string | null; email: string | null };
type AttendanceLite = { status: string; user: UserLite };
type RecipientLite = { user: UserLite };
type NotificationLite = { recipients: RecipientLite[] };

export type RehearsalLite = {
  id: string;
  title: string;
  start: string; // ISO
  location: string;
  attendance: AttendanceLite[];
  notifications: NotificationLite[];
};

export function RehearsalList({ initial }: { initial: RehearsalLite[] }) {
  const [query, setQuery] = useState("");
  const [onlyUpcoming, setOnlyUpcoming] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const filtered = useMemo(() => {
    const now = new Date();
    const q = query.trim().toLowerCase();
    return initial.filter((r) => {
      if (onlyUpcoming && new Date(r.start) < now) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q)
      );
    });
  }, [initial, query, onlyUpcoming]);

  // Group by month
  const groups = useMemo(() => {
    const m = new Map<string, RehearsalLite[]>();
    for (const r of filtered) {
      const key = format(new Date(r.start), "yyyy-MM");
      const arr = m.get(key) ?? [];
      arr.push(r);
      m.set(key, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const handleExpandAll = () => {
    setExpandAll(true);
  };
  const handleCollapseAll = () => {
    setExpandAll(false);
    setResetKey((n) => n + 1); // remount to collapse
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card/60 p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Suchen (Titel, Ort)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={onlyUpcoming}
                onChange={(e) => setOnlyUpcoming(e.target.checked)}
              />
              Nur kommende
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCollapseAll}>Alle zuklappen</Button>
            <Button size="sm" onClick={handleExpandAll}>Alle aufklappen</Button>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Treffer.</p>
      ) : (
        groups.map(([key, list]) => (
          <section key={`${key}-${resetKey}`} className="space-y-3">
            <h2 className="sticky top-24 z-10 -mx-1 bg-background/70 px-1 text-lg font-semibold backdrop-blur supports-[backdrop-filter]:bg-background/50">
              {format(new Date(key + "-01T00:00:00"), "MMMM yyyy", { locale: de })}
            </h2>
            <div className="space-y-4">
              {list.map((r) => (
                <RehearsalCardWithActions
                  key={`${r.id}-${resetKey}`}
                  rehearsal={{
                    ...r,
                    start: new Date(r.start) as any,
                  } as any}
                  forceOpen={expandAll}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

