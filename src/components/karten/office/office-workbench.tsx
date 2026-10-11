"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { officeSearchAction } from "@/app/kartenbuero/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DownloadIcon, SearchIcon } from "@/components/ui/action-icons";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatTile } from "@/components/ui/stat-tile";
import { formatPerformanceDate } from "@/lib/karten/constants";
import { cn } from "@/lib/utils";

import { EditReservationDialog } from "./edit-reservation-dialog";
import { QuickEntry, type QuickEntryHandle } from "./quick-entry";
import { ReservationRow } from "./reservation-row";
import {
  toOfficeReservation,
  type OfficeCategory,
  type OfficePerformance,
  type OfficeReservation,
} from "./types";

type Filter = "active" | "all";

export function OfficeWorkbench({
  showId,
  performances,
  categories,
  selectedEventId,
  reservations,
}: {
  showId: string;
  performances: OfficePerformance[];
  categories: OfficeCategory[];
  selectedEventId: string | null;
  reservations: OfficeReservation[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const entryRef = useRef<QuickEntryHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [globalResults, setGlobalResults] = useState<OfficeReservation[] | null>(null);
  const [editing, setEditing] = useState<OfficeReservation | null>(null);
  const [, startSearch] = useTransition();

  const selected = performances.find((row) => row.eventId === selectedEventId) ?? null;
  const startByEvent = useMemo(
    () => new Map(performances.map((row) => [row.eventId, row.start])),
    [performances],
  );

  const selectPerformance = (eventId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (eventId) params.set("vorstellung", eventId);
    else params.delete("vorstellung");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Tastatur: „/“ sucht, „n“ springt in die Schnellerfassung.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.isContentEditable || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "n") {
        event.preventDefault();
        entryRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Suche über alle Vorstellungen (z. B. Anruf „ich hatte reserviert …“).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(() => {
      startSearch(async () => {
        const result = await officeSearchAction(showId, q);
        if (result.ok) setGlobalResults(result.data.map(toOfficeReservation));
        else toast.error(result.error);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, showId]);

  const visible = useMemo(
    () =>
      reservations.filter((entry) =>
        filter === "all" ? true : entry.status === "confirmed" || entry.status === "pending",
      ),
    [reservations, filter],
  );

  // Ohne gewählte Vorstellung: Summen über alle.
  const summary = useMemo(() => {
    if (selected) return selected;
    const configured = performances.filter((row) => row.configured && !row.cancelled);
    return {
      taken: configured.reduce((sum, row) => sum + row.taken, 0),
      capacity: configured.reduce((sum, row) => sum + row.capacity, 0),
      freeOffice: configured.reduce((sum, row) => sum + row.freeOffice, 0),
      freeOnline: configured.reduce((sum, row) => sum + row.freeOnline, 0),
    };
  }, [performances, selected]);

  const stats = useMemo(() => {
    let pending = 0;
    let unpaid = 0;
    for (const entry of reservations) {
      if (entry.status === "pending") pending += entry.seats;
      if (entry.status === "confirmed" && entry.paymentStatus === "open") unpaid += 1;
    }
    return { pending, unpaid };
  }, [reservations]);

  const refresh = () => {
    router.refresh();
    // Suchtreffer neu laden.
    if (query.trim().length >= 2) {
      void officeSearchAction(showId, query.trim()).then((result) => {
        if (result.ok) setGlobalResults(result.data.map(toOfficeReservation));
      });
    }
  };

  if (performances.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Für diese Produktion sind noch keine Vorstellungen eingerichtet.
      </p>
    );
  }

  const list = globalResults ?? visible;

  return (
    <div className="space-y-4">
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label="Vorstellungen"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedEventId === null}
          onClick={() => selectPerformance(null)}
          className={cn(
            "shrink-0 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
            selectedEventId === null
              ? "border-primary bg-primary/10"
              : "border-border/60 bg-card hover:border-primary/50",
          )}
        >
          <span className="block font-medium">Alle Vorstellungen</span>
          <span className="block text-xs tabular-nums text-muted-foreground">
            {summary.freeOffice} frei · {summary.taken}/{summary.capacity}
          </span>
        </button>
        {performances.map((row) => {
          const active = row.eventId === selectedEventId;
          return (
            <button
              key={row.eventId}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectPerformance(row.eventId)}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border/60 bg-card hover:border-primary/50",
                row.cancelled && "opacity-60",
              )}
            >
              <span className="block font-medium tabular-nums">
                {formatPerformanceDate(new Date(row.start))}
              </span>
              <span className="block text-xs tabular-nums text-muted-foreground">
                {row.cancelled
                  ? "abgesagt"
                  : !row.configured
                    ? "nicht eingerichtet"
                    : `${row.freeOffice} frei · ${row.taken}/${row.capacity}`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Belegt" value={`${summary.taken} / ${summary.capacity}`} />
        <StatTile
          label="Frei"
          value={summary.freeOffice}
          hint={`online ${summary.freeOnline}`}
          tone={summary.freeOffice === 0 ? "destructive" : "success"}
        />
        <StatTile
          label="Unbestätigt"
          value={stats.pending}
          hint="Plätze, online gehalten"
          tone={stats.pending > 0 ? "warning" : "neutral"}
        />
        <StatTile label="Noch offen zu zahlen" value={stats.unpaid} hint="Buchungen" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <QuickEntry
            key={selectedEventId ?? "alle"}
            ref={entryRef}
            performances={performances}
            defaultEventId={
              selected && selected.configured && !selected.cancelled ? selected.eventId : null
            }
            categories={categories}
            onCreated={() => router.refresh()}
          />
        </div>

        <Card size="flush" className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                type="search"
                placeholder="Name, Telefon, Mail oder Code – alle Vorstellungen ( / )"
                className="pl-9"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (event.target.value.trim().length < 2) setGlobalResults(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setQuery("");
                    setGlobalResults(null);
                  }
                }}
              />
            </div>
            {globalResults === null ? (
              <Button asChild size="sm" variant="outline">
                <a
                  href={
                    selectedEventId
                      ? `/api/karten/einlass/pdf?eventId=${encodeURIComponent(selectedEventId)}`
                      : `/api/karten/einlass/pdf?showId=${encodeURIComponent(showId)}`
                  }
                  download
                  title={
                    selectedEventId
                      ? "Einlassliste dieser Vorstellung"
                      : "Einlasslisten aller kommenden Vorstellungen, je Vorstellung neue Seite"
                  }
                >
                  <DownloadIcon /> {selectedEventId ? "Liste (PDF)" : "Listen (PDF)"}
                </a>
              </Button>
            ) : null}
            {globalResults === null ? (
              <SegmentedControl
                value={filter}
                onValueChange={setFilter}
                options={[
                  { value: "active", label: "Aktiv" },
                  { value: "all", label: "Alle" },
                ]}
                aria-label="Filter"
                size="sm"
              />
            ) : null}
          </div>
          {globalResults !== null ? (
            <p className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
              {globalResults.length} Treffer in allen Vorstellungen
            </p>
          ) : null}
          {list.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {globalResults !== null ? "Nichts gefunden." : "Noch keine Reservierungen."}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {list.map((entry) => (
                <ReservationRow
                  key={entry.id}
                  reservation={entry}
                  performanceStart={
                    globalResults !== null || selectedEventId === null
                      ? startByEvent.get(entry.eventId)
                      : null
                  }
                  allowDelete={globalResults !== null}
                  onDeleted={() =>
                    setGlobalResults((current) =>
                      current ? current.filter((item) => item.id !== entry.id) : current,
                    )
                  }
                  onEdit={() => setEditing(entry)}
                  onChanged={refresh}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {editing ? (
        <EditReservationDialog
          reservation={editing}
          performances={performances}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
