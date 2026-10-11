"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { QrScanner, scanFeedback, type ScanSignal } from "@/components/inventory/qr-scanner";
import { QuantityStepper } from "@/components/karten/quantity-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CloseIcon,
  QrCodeIcon,
  SearchIcon,
  WifiIcon,
  WifiOffIcon,
} from "@/components/ui/action-icons";
import { FullscreenOverlay } from "@/components/ui/fullscreen-overlay";
import { Input } from "@/components/ui/input";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import type { DoorGuest, DoorMutation, DoorSnapshot } from "@/lib/karten/checkin";
import { normalizeReservationCode } from "@/lib/karten/codes";
import {
  formatPerformanceDate,
  formatPrice,
  RESERVATION_SOURCE_LABELS,
} from "@/lib/karten/constants";
import { applyPending, doorCounters, searchGuests } from "@/lib/karten/door-state";
import type { ReservationSource } from "@prisma/client";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string; priceCents: number };
type Performance = { eventId: string; start: string; cancelled: boolean; configured: boolean };

const SYNC_INTERVAL_MS = 10_000;

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher voll oder privat – dann eben nur im Arbeitsspeicher.
  }
}

/**
 * Einlass am Vorstellungsabend: QR-Scan oder Namenssuche, teilweises Einlassen, Abendkasse.
 * Die Gästeliste und noch nicht gesendete Aktionen liegen im Gerät, damit ein Funkloch an der
 * Bühne den Einlass nicht aufhält (docs/Plan/kartenbuchung-plan.md, K12).
 */
export function DoorWorkbench({
  initialSnapshot,
  performances,
  categories,
}: {
  initialSnapshot: DoorSnapshot;
  performances: Performance[];
  categories: Category[];
}) {
  const eventId = initialSnapshot.eventId;
  const snapshotKey = `karten-einlass:${eventId}`;
  const queueKey = `karten-einlass-queue:${eventId}`;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [serverSnapshot, setServerSnapshot] = useState(initialSnapshot);
  const [queue, setQueue] = useState<DoorMutation[]>([]);
  const [online, setOnline] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [mode, setMode] = useState<"guests" | "kasse">("guests");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<DoorGuest | null>(null);
  const [admit, setAdmit] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [signal, setSignal] = useState<ScanSignal | null>(null);
  const [scanMessage, setScanMessage] = useState<{
    tone: "ok" | "warn" | "error";
    text: string;
  } | null>(null);
  const [sale, setSale] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const syncing = useRef(false);
  const rerun = useRef(false);
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const prices = useMemo(
    () => new Map(categories.map((category) => [category.id, category.priceCents])),
    [categories],
  );
  const snapshot = useMemo(
    () => applyPending(serverSnapshot, queue, prices),
    [serverSnapshot, queue, prices],
  );
  const counters = doorCounters(snapshot);
  const results = useMemo(() => searchGuests(snapshot.guests, query), [snapshot.guests, query]);

  // Gespeicherten Stand laden (z. B. nach Neuladen ohne Netz).
  useEffect(() => {
    setQueue(readStorage<DoorMutation[]>(queueKey, []));
    const stored = readStorage<DoorSnapshot | null>(snapshotKey, null);
    if (stored && stored.serverTime > initialSnapshot.serverTime) setServerSnapshot(stored);
    setOnline(navigator.onLine);
  }, [queueKey, snapshotKey, initialSnapshot.serverTime]);

  useEffect(() => writeStorage(queueKey, queue), [queueKey, queue]);
  useEffect(() => writeStorage(snapshotKey, serverSnapshot), [snapshotKey, serverSnapshot]);

  const sync = useCallback(async (): Promise<void> => {
    if (syncing.current) {
      // Läuft schon: danach sofort noch einmal, damit neue Aktionen nicht aufs Intervall warten.
      rerun.current = true;
      return;
    }
    syncing.current = true;
    try {
      do {
        rerun.current = false;
        // Doppelt gesendete Aktionen erkennt der Server an ihrer ID.
        const pending = queueRef.current;
        const response = await fetch("/api/karten/einlass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            device: navigator.userAgent.slice(0, 80),
            mutations: pending,
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as {
          results: { id: string; ok: boolean; error?: string }[];
          snapshot: DoorSnapshot;
        };
        const done = new Set(data.results.map((result) => result.id));
        const failed = data.results.filter((result) => !result.ok && result.error);
        if (failed.length) {
          setErrors((current) => [...current, ...failed.map((f) => f.error ?? "")].slice(-5));
        }
        setServerSnapshot(data.snapshot);
        setQueue((current) => current.filter((mutation) => !done.has(mutation.id)));
        setOnline(true);
        setLastSync(new Date());
      } while (rerun.current);
    } catch (error) {
      console.warn("[einlass] Sync fehlgeschlagen, wird nachgereicht", error);
      setOnline(false);
    } finally {
      syncing.current = false;
    }
  }, [eventId]);

  useEffect(() => {
    void sync();
    const timer = window.setInterval(() => void sync(), SYNC_INTERVAL_MS);
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [sync]);

  const enqueue = (mutation: DoorMutation) => {
    setQueue((current) => [...current, mutation]);
    window.setTimeout(() => void sync(), 0);
  };

  const openGuest = (guest: DoorGuest) => {
    setActive(guest);
    setAdmit(Math.max(0, guest.tickets - guest.checkedIn));
  };

  const confirmAdmit = (guest: DoorGuest, count: number) => {
    if (count !== 0) {
      enqueue({
        id: newId(),
        type: "checkin",
        reservationId: guest.id,
        delta: count,
        occurredAt: new Date().toISOString(),
      });
    }
    setActive(null);
    setQuery("");
  };

  const handleScan = (text: string) => {
    const code = normalizeReservationCode(text);
    const guest = snapshot.guests.find((entry) => entry.code === code);
    if (!guest) {
      scanFeedback("error");
      setSignal({ tone: "error", key: Date.now() });
      setScanMessage({
        tone: "error",
        text: `Code ${code || text} gehört nicht zu dieser Vorstellung.`,
      });
      return;
    }
    const remaining = guest.tickets - guest.checkedIn;
    if (remaining <= 0) {
      scanFeedback("warn");
      setSignal({ tone: "warn", key: Date.now() });
      setScanMessage({
        tone: "warn",
        text: `${guest.name}: alle ${guest.tickets} schon eingelassen.`,
      });
      return;
    }
    scanFeedback("ok");
    setSignal({ tone: "ok", key: Date.now() });
    setScanMessage(null);
    setScanning(false);
    openGuest(guest);
  };

  const saleTotal = categories.reduce(
    (sum, category) => {
      const quantity = sale[category.id] ?? 0;
      return { tickets: sum.tickets + quantity, cents: sum.cents + quantity * category.priceCents };
    },
    { tickets: 0, cents: 0 },
  );

  const selectPerformance = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("vorstellung", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={eventId} onValueChange={selectPerformance}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Vorstellung">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {performances.map((row) => (
              <SelectItem key={row.eventId} value={row.eventId} disabled={!row.configured}>
                {formatPerformanceDate(new Date(row.start))}
                {row.cancelled ? " (abgesagt)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant={online ? "success" : "warning"} className="gap-1">
          {online ? <WifiIcon /> : <WifiOffIcon />}
          {online ? "online" : "offline – wird nachgereicht"}
        </Badge>
        {queue.length > 0 ? (
          <Badge variant="warning">{queue.length} nicht gesendet</Badge>
        ) : lastSync ? (
          <span className="text-xs text-muted-foreground">
            aktualisiert{" "}
            {lastSync.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Im Saal" value={counters.inside} tone="primary" />
        <StatTile
          label="Erwartet, noch nicht da"
          value={counters.missing}
          hint={`${counters.expected} reserviert`}
        />
        <StatTile
          label="Frei"
          value={counters.free}
          hint={`von ${snapshot.capacity}`}
          tone={counters.free === 0 ? "destructive" : "success"}
        />
        <StatTile
          label="Abendkasse"
          value={counters.boxOfficeTickets}
          hint={formatPrice(snapshot.boxOfficeCents)}
        />
      </div>

      {errors.length > 0 ? (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <ul>
            {errors.map((error, index) => (
              <li key={`${error}-${index}`}>{error}</li>
            ))}
          </ul>
          <Button size="icon" variant="ghost" aria-label="Schließen" onClick={() => setErrors([])}>
            <CloseIcon />
          </Button>
        </div>
      ) : null}

      <SegmentedControl
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "guests", label: "Gäste" },
          { value: "kasse", label: "Abendkasse" },
        ]}
        aria-label="Einlass-Bereich"
        fullWidth
      />

      {mode === "guests" ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Name oder Code"
                className="h-11 pl-9 text-base"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && results.length === 1) openGuest(results[0]);
                }}
              />
            </div>
            <Button size="lg" onClick={() => setScanning(true)}>
              <QrCodeIcon /> Scannen
            </Button>
          </div>

          <Card size="flush" className="overflow-hidden">
            {results.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {query
                  ? "Niemand gefunden – an der Abendkasse verkaufen?"
                  : "Keine Reservierungen."}
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {results.map((guest) => {
                  const complete = guest.checkedIn >= guest.tickets;
                  return (
                    <li key={guest.id}>
                      <button
                        type="button"
                        onClick={() => openGuest(guest)}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40",
                          complete && "opacity-60",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{guest.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {guest.summary}
                            {guest.source !== "online" && guest.source !== "phone"
                              ? ` · ${RESERVATION_SOURCE_LABELS[guest.source as ReservationSource]}`
                              : ""}
                            {guest.note ? ` · ${guest.note}` : ""}
                          </p>
                        </div>
                        {guest.openCents > 0 ? (
                          <Badge variant="warning" size="sm">
                            {formatPrice(guest.openCents)} offen
                          </Badge>
                        ) : null}
                        <span
                          className={cn(
                            "min-w-12 text-right text-lg font-semibold tabular-nums",
                            complete ? "text-success" : guest.checkedIn > 0 ? "text-warning" : "",
                          )}
                        >
                          {guest.checkedIn}/{guest.tickets}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      ) : (
        <Card className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Verkauf vor Ort ohne Namen. Die Gäste zählen sofort als eingelassen.
          </p>
          <div className="divide-y divide-border/60">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {category.name}{" "}
                  <span className="text-sm text-muted-foreground">
                    {category.priceCents > 0 ? formatPrice(category.priceCents) : "kostenlos"}
                  </span>
                </span>
                <QuantityStepper
                  label={category.name}
                  value={sale[category.id] ?? 0}
                  onChange={(value) => setSale({ ...sale, [category.id]: value })}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-lg font-semibold tabular-nums">
              {saleTotal.cents > 0 ? `${formatPrice(saleTotal.cents)} kassieren` : ""}
            </span>
            <Button
              size="lg"
              disabled={saleTotal.tickets === 0}
              onClick={() => {
                enqueue({
                  id: newId(),
                  type: "sale",
                  items: Object.entries(sale)
                    .filter(([, quantity]) => quantity > 0)
                    .map(([categoryId, quantity]) => ({ categoryId, quantity })),
                  occurredAt: new Date().toISOString(),
                });
                setSale({});
              }}
            >
              {saleTotal.tickets} verkauft
            </Button>
          </div>
          {counters.free < saleTotal.tickets ? (
            <p className="text-sm text-warning">
              Laut Reservierungen sind nur {counters.free} Plätze frei – wer nicht kommt, gibt Platz
              frei.
            </p>
          ) : null}
        </Card>
      )}

      <ModalFormDialog
        title={active?.name ?? "Einlass"}
        open={active !== null}
        onOpenChange={(open) => (!open ? setActive(null) : undefined)}
        footer={
          active ? (
            <>
              {active.checkedIn > 0 ? (
                <Button variant="ghost" onClick={() => confirmAdmit(active, -1)}>
                  Einen austragen
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setActive(null)}>
                Abbrechen
              </Button>
              <Button
                size="lg"
                variant="success"
                disabled={admit === 0}
                onClick={() => confirmAdmit(active, admit)}
              >
                {admit} einlassen
              </Button>
            </>
          ) : null
        }
      >
        {active ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {active.summary} · <span className="font-mono">{active.code}</span>
              </p>
              {active.note ? <p className="text-sm text-warning">„{active.note}“</p> : null}
              {active.status === "pending" ? (
                <Badge variant="warning">nicht per Mail bestätigt</Badge>
              ) : null}
              {active.openCents > 0 ? (
                <p className="text-base font-semibold text-warning">
                  {formatPrice(active.openCents)} kassieren
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-3">
              <span className="text-sm">
                {active.checkedIn > 0 ? `${active.checkedIn} schon da · ` : ""}jetzt einlassen
              </span>
              <QuantityStepper
                label="Personen einlassen"
                value={admit}
                max={active.tickets - active.checkedIn}
                onChange={setAdmit}
              />
            </div>
          </div>
        ) : null}
      </ModalFormDialog>

      <FullscreenOverlay open={scanning} onClose={() => setScanning(false)} label="Tickets scannen">
        <div className="relative h-full w-full bg-black">
          <QrScanner
            variant="fullscreen"
            onScan={handleScan}
            signal={signal}
            hint="QR-Code des Tickets ins Bild halten"
            className="h-full"
          />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
            {scanMessage ? (
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  scanMessage.tone === "error"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-warning text-warning-foreground",
                )}
              >
                {scanMessage.text}
              </div>
            ) : (
              <span />
            )}
            <Button
              size="icon"
              variant="secondary"
              aria-label="Scanner schließen"
              onClick={() => setScanning(false)}
            >
              <CloseIcon />
            </Button>
          </div>
        </div>
      </FullscreenOverlay>
    </div>
  );
}
