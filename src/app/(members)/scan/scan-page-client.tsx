"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { liveQuery } from "dexie";
import { toast } from "sonner";

import { BarcodeScanner } from "@/components/scan/scanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/members/page-header";
import { PageHeaderStatus } from "@/design-system/patterns/page-header";
import { offlineDb } from "@/lib/offline/db";
import { useOfflineSyncClient } from "@/lib/offline/hooks";
import { useInventory } from "@/lib/offline/useInventory";
import type { OfflineScope, TicketRecord } from "@/lib/offline/types";
import type { SyncScopeState } from "@/lib/offline/sync-client";
import type { MembersBreadcrumbItem } from "@/lib/members-breadcrumbs";

interface ScanPageClientProps {
  breadcrumb: MembersBreadcrumbItem;
}

type Mode = "inventory" | "ticket";
type InventoryAction = "increment" | "decrement";

type InventoryFeedback =
  | { type: "success"; code: string; delta: number; itemName: string; quantity: number }
  | { type: "error"; code: string; message: string };

type TicketFeedback =
  | { type: "success"; code: string; message: string }
  | { type: "offline"; code: string; message: string }
  | { type: "error"; code: string; message: string };

const STATUS_LABELS: Record<SyncScopeState["status"], string> = {
  idle: "Bereit",
  bootstrapping: "Initialisierung",
  flushing: "Übertragung",
  pulling: "Aktualisierung",
  error: "Fehler",
};

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function shouldUseOfflineFallback(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status === 0 || error.status >= 500;
  }

  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  return false;
}

export async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    try {
      const text = await response.clone().text();
      return text || null;
    } catch {
      return null;
    }
  }
}

export function extractTicketInfo(data: unknown): {
  id?: string;
  holderName?: string;
  eventId?: string;
  status?: string;
} | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const ticket = record.ticket;

  if (!ticket || typeof ticket !== "object") {
    return null;
  }

  const ticketRecord = ticket as Record<string, unknown>;

  const id = isNonEmptyString(ticketRecord.id) ? ticketRecord.id : undefined;
  const holderName = isNonEmptyString(ticketRecord.holderName)
    ? ticketRecord.holderName
    : undefined;
  const eventId = isNonEmptyString(ticketRecord.eventId)
    ? ticketRecord.eventId
    : undefined;
  const status = isNonEmptyString(ticketRecord.status)
    ? ticketRecord.status
    : undefined;

  return { id, holderName, eventId, status };
}

export function extractMessage(data: unknown): string | null {
  if (!data) {
    return null;
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object") {
    const record = data as Record<string, unknown>;

    if (isNonEmptyString(record.message)) {
      return record.message;
    }

    if (isNonEmptyString(record.error)) {
      return record.error;
    }

    if (isNonEmptyString(record.detail)) {
      return record.detail;
    }
  }

  return null;
}

function ScopeStatusBadge({
  label,
  scope,
  pending,
}: {
  label: string;
  scope: SyncScopeState;
  pending: number;
}) {
  const hasError = isNonEmptyString(scope.lastError);
  const isSyncing = ["bootstrapping", "flushing", "pulling"].includes(scope.status);
  const tone: ComponentProps<typeof PageHeaderStatus>["state"] = hasError
    ? "error"
    : isSyncing
      ? "warning"
      : pending > 0
        ? "warning"
        : "online";

  const baseLabel = `${label}: ${STATUS_LABELS[scope.status]}`;
  const suffix = hasError
    ? ""
    : pending > 0
      ? pending === 1
        ? " (1 offen)"
        : ` (${pending} offen)`
      : "";

  return <PageHeaderStatus state={tone}>{hasError ? `${label}: Konflikt` : `${baseLabel}${suffix}`}</PageHeaderStatus>;
}

function usePendingEventCount(scope: OfflineScope, enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    const db = offlineDb;

    if (!db) {
      setCount(0);
      return;
    }

    const prefix = scope === "inventory" ? "inventory" : "ticket";

    const subscription = liveQuery(() =>
      db.eventQueue.where("type").startsWith(prefix).count(),
    ).subscribe({
      next: (value) => setCount(value),
      error: (error) => {
        console.error(`[scanner] failed to observe ${scope} event queue`, error);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [enabled, scope]);

  return count;
}

export default function ScanPageClient({ breadcrumb }: ScanPageClientProps) {
  const [mode, setMode] = useState<Mode>("inventory");
  const [inventoryAction, setInventoryAction] = useState<InventoryAction>("increment");
  const [inventoryFeedback, setInventoryFeedback] = useState<InventoryFeedback | null>(null);
  const [ticketFeedback, setTicketFeedback] = useState<TicketFeedback | null>(null);
  const [isInventoryBusy, setIsInventoryBusy] = useState(false);
  const [isTicketBusy, setIsTicketBusy] = useState(false);
  const [isManualSync, setIsManualSync] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const {
    items,
    adjustQuantity,
    bufferEntries,
    pendingCount,
    scopeState,
    isSupported,
    isReady,
    pullInventory,
    bootstrapInventory,
  } = useInventory();
  const { scopes, enqueue, flush, pull, bootstrap, isSyncing } = useOfflineSyncClient();

  const offlineReady = isSupported && isReady;
  const ticketPendingCount = usePendingEventCount("tickets", offlineReady);

  const inventoryLookup = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number }>();

    for (const item of items) {
      map.set(item.id, { name: item.name, quantity: item.quantity });
      if (isNonEmptyString(item.sku)) {
        map.set(item.sku, { name: item.name, quantity: item.quantity });
      }
    }

    return map;
  }, [items]);

  const inventoryBufferList = useMemo(() => {
    return bufferEntries
      .map((entry) => {
        const matchById = entry.itemId ? inventoryLookup.get(entry.itemId) : undefined;
        const matchBySku = entry.sku ? inventoryLookup.get(entry.sku) : undefined;
        const match = matchById ?? matchBySku;
        const label = match?.name ?? entry.sku ?? entry.itemId ?? "Unbekannt";
        const quantityAfter = entry.quantityAfter ?? match?.quantity;
        return {
          key: entry.key,
          label,
          delta: entry.delta,
          quantityAfter,
        };
      })
      .filter((entry) => entry.delta !== 0)
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [bufferEntries, inventoryLookup]);
  const handleInventoryScan = useCallback(
    async (code: string) => {
      if (!code || isInventoryBusy) {
        return;
      }

      setIsInventoryBusy(true);
      const delta = inventoryAction === "increment" ? 1 : -1;

      try {
        const result = await adjustQuantity(code, delta, { source: "scanner" });
        setInventoryFeedback({
          type: "success",
          code,
          delta,
          itemName: result.item.name,
          quantity: result.item.quantity,
        });
        toast.success(
          `${result.item.name}: Bestand ${delta > 0 ? `+${delta}` : delta} → ${result.item.quantity}`,
        );
      } catch (error) {
        const message = getErrorMessage(error);
        setInventoryFeedback({ type: "error", code, message });
        toast.error(message);
      } finally {
        setIsInventoryBusy(false);
      }
    },
    [adjustQuantity, inventoryAction, isInventoryBusy],
  );

  const handleTicketScan = useCallback(
    async (code: string) => {
      if (!code || isTicketBusy) {
        return;
      }

      setIsTicketBusy(true);
      const normalized = code.trim();

      try {
        const response = await fetch("/api/ticket/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: normalized }),
        });

        const body = await readResponseBody(response);

        if (!response.ok) {
          const message =
            extractMessage(body) ?? `Ticket konnte nicht eingecheckt werden (${response.status}).`;
          throw new HttpError(response.status, message);
        }

        const ticketInfo = extractTicketInfo(body);

        const dbForSuccess = offlineDb;

        if (offlineReady && dbForSuccess) {
          const holderName = ticketInfo?.holderName;
          const eventId = ticketInfo?.eventId ?? "pending";
          const ticketId = ticketInfo?.id ?? normalized;

          await dbForSuccess.transaction("rw", dbForSuccess.tickets, async () => {
            const updated: TicketRecord = {
              id: ticketId,
              code: normalized,
              status: "checked_in",
              holderName: holderName ?? undefined,
              eventId,
              updatedAt: new Date().toISOString(),
            };

            await dbForSuccess.tickets.put(updated);
          });
        }

        const holderSuffix = ticketInfo?.holderName ? ` für ${ticketInfo.holderName}` : "";
        const successMessage =
          extractMessage(body) ?? `Ticket erfolgreich eingecheckt${holderSuffix}.`;

        setTicketFeedback({ type: "success", code: normalized, message: successMessage });
        toast.success(`Ticket ${normalized} eingecheckt`);
      } catch (error) {
        if (shouldUseOfflineFallback(error)) {
          const dbForFallback = offlineDb;

          try {
            if (offlineReady && dbForFallback) {
              const timestamp = new Date().toISOString();
              const existing =
                (await dbForFallback.tickets.where("code").equals(normalized).first()) ||
                (await dbForFallback.tickets.get(normalized));

              const offlineRecord: TicketRecord = {
                id: existing?.id ?? normalized,
                code: normalized,
                status: "pending",
                holderName: existing?.holderName,
                eventId: existing?.eventId ?? "pending",
                updatedAt: timestamp,
              };

              await dbForFallback.tickets.put(offlineRecord);
              await enqueue({
                type: "ticket.checkin",
                payload: {
                  ticketId: offlineRecord.id,
                  code: normalized,
                  eventId: offlineRecord.eventId,
                  status: "checked_in",
                  attemptedAt: timestamp,
                  source: "scanner",
                },
                dedupeKey: `ticket:${offlineRecord.id}`,
              });

              setTicketFeedback({
                type: "offline",
                code: normalized,
                message: "Ticket-Check-in offline vorgemerkt.",
              });
              toast.info("Ticket offline vorgemerkt");
              return;
            }
          } catch (fallbackError) {
            console.error("[scanner] failed to queue offline ticket", fallbackError);
            const message = getErrorMessage(fallbackError);
            setTicketFeedback({ type: "error", code: normalized, message });
            toast.error(message);
            return;
          }
        }

        const message = getErrorMessage(error);
        setTicketFeedback({ type: "error", code: normalized, message });
        toast.error(message);
      } finally {
        setIsTicketBusy(false);
      }
    },
    [enqueue, isTicketBusy, offlineReady],
  );

  const handleScan = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) {
        return;
      }

      const now = Date.now();
      const { code: lastCode, at } = lastScanRef.current;

      if (lastCode === code && now - at < 1500) {
        return;
      }

      lastScanRef.current = { code, at: now };

      if (mode === "inventory") {
        void handleInventoryScan(code);
      } else {
        void handleTicketScan(code);
      }
    },
    [handleInventoryScan, handleTicketScan, mode],
  );

  const handleScannerError = useCallback((error: unknown) => {
    console.warn("[scanner]", error);
  }, []);

  const handleFlushQueues = useCallback(async () => {
    setIsManualSync(true);
    try {
      await Promise.all([flush("inventory"), flush("tickets")]);
      toast.success("Sync gestartet.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsManualSync(false);
    }
  }, [flush]);

  const handleForceRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([pullInventory(), pull("tickets")]);
      toast.success("Aktualisierung angestoßen.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  }, [pull, pullInventory]);

  const handleBootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    try {
      await Promise.all([bootstrapInventory(), bootstrap("tickets")]);
      toast.success("Offline-Daten aktualisiert.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsBootstrapping(false);
    }
  }, [bootstrap, bootstrapInventory]);

  const manualActionPending = isManualSync || isRefreshing || isBootstrapping;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scanner"
        description="Inventur und Ticket-Check-ins per Kamera – inklusive Offline-Puffer und Sync-Status."
        breadcrumbs={[breadcrumb]}
        status={
          <div className="flex flex-wrap gap-2">
            <ScopeStatusBadge label="Inventur" scope={scopeState} pending={pendingCount} />
            <ScopeStatusBadge label="Tickets" scope={scopes.tickets} pending={ticketPendingCount} />
          </div>
        }
        quickActions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBootstrap}
              disabled={manualActionPending || isSyncing}
            >
              Offline-Daten laden
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceRefresh}
              disabled={manualActionPending || isSyncing}
            >
              Force-Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleFlushQueues}
              disabled={manualActionPending || isSyncing}
            >
              Sync senden
            </Button>
          </div>
        }
      />

      {!offlineReady ? (
        <div className="rounded-lg border border-dashed border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          Offline-Speicher wird initialisiert. Starte einen Force-Refresh oder lade die Offline-Daten, sobald die
          Verbindung steht.
        </div>
      ) : null}

      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Live-Scanner</CardTitle>
            <TabsList>
              <TabsTrigger value="inventory">Inventur</TabsTrigger>
              <TabsTrigger value="ticket">Tickets</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="space-y-6">
            <BarcodeScanner onResult={handleScan} onError={handleScannerError} />
            <TabsContent value="inventory">
              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Inventur-Aktion</p>
                    <p className="text-xs text-muted-foreground">
                      {inventoryAction === "increment"
                        ? "Jeder Scan erhöht den Bestand um 1."
                        : "Jeder Scan reduziert den Bestand um 1."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={inventoryAction === "increment" ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setInventoryAction("increment")}
                      disabled={isInventoryBusy}
                    >
                      Zugang (+1)
                    </Button>
                    <Button
                      variant={inventoryAction === "decrement" ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setInventoryAction("decrement")}
                      disabled={isInventoryBusy}
                    >
                      Abgang (−1)
                    </Button>
                  </div>
                </div>

                {scopeState.lastError ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {scopeState.lastError}
                  </div>
                ) : null}

                {inventoryFeedback ? (
                  <div
                    className={
                      inventoryFeedback.type === "error"
                        ? "rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
                        : "rounded-lg border border-success/40 bg-success/10 p-4 text-sm text-success"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Letzter Scan</span>
                      <Badge variant="outline" className="font-mono">
                        {inventoryFeedback.code}
                      </Badge>
                    </div>
                    {inventoryFeedback.type === "success" ? (
                      <p className="mt-2 text-sm">
                        {inventoryFeedback.itemName}: Δ {inventoryFeedback.delta > 0 ? `+${inventoryFeedback.delta}` : inventoryFeedback.delta}
                        {" "}→ {inventoryFeedback.quantity}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm">{inventoryFeedback.message}</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                    Scanne einen Code, um den Bestand anzupassen.
                  </div>
                )}

                <div className="rounded-lg border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Offene Anpassungen</p>
                    <Badge variant={pendingCount > 0 ? "warning" : "muted"}>{pendingCount}</Badge>
                  </div>
                  {inventoryBufferList.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-sm">
                      {inventoryBufferList.map((entry) => (
                        <li key={entry.key} className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{entry.label}</p>
                            <p className="text-xs text-muted-foreground">
                              Δ {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                              {typeof entry.quantityAfter === "number" ? ` → Ziel: ${entry.quantityAfter}` : ""}
                            </p>
                          </div>
                          <Badge
                            variant={entry.delta > 0 ? "success" : "destructive"}
                            className="self-center"
                          >
                            {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Kein Offline-Puffer – alle Anpassungen wurden synchronisiert.
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="ticket">
              <div className="space-y-4">
                {scopes.tickets.lastError ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {scopes.tickets.lastError}
                  </div>
                ) : null}

                {ticketFeedback ? (
                  <div
                    className={
                      ticketFeedback.type === "error"
                        ? "rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
                        : ticketFeedback.type === "offline"
                          ? "rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning"
                          : "rounded-lg border border-success/40 bg-success/10 p-4 text-sm text-success"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Letzter Scan</span>
                      <Badge variant="outline" className="font-mono">
                        {ticketFeedback.code}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm">{ticketFeedback.message}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                    Scanne ein Ticket für den Check-in.
                  </div>
                )}

                <div className="rounded-lg border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Offene Check-ins</p>
                    <Badge variant={ticketPendingCount > 0 ? "warning" : "muted"}>{ticketPendingCount}</Badge>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {ticketPendingCount > 0
                      ? "Es gibt offline gespeicherte Check-ins. Sie werden beim nächsten Sync automatisch übertragen."
                      : "Keine offenen Check-ins im Offline-Puffer."}
                  </p>
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
