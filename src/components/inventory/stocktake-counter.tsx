"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  stocktakeProgressAction,
  submitStocktakeScansAction,
  type StocktakeScanInput,
} from "@/app/(members)/mitglieder/lager/actions/stocktakes";
import { lookupCodeAction } from "@/app/(members)/mitglieder/lager/actions/placement";
import { QrScanner, scanFeedback, type ScanSignal } from "@/components/inventory/qr-scanner";
import { ScannerShell, type ScanToast, type SheetSnap } from "@/components/inventory/scanner-shell";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CloseIcon,
  MapPinIcon,
  WifiOffIcon,
  XCircleIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  INVENTORY_BASE_PATH,
  formatInventoryDateTime,
  isLocationCode,
  parseInventoryCode,
} from "@/lib/inventory/constants";
import type { StocktakeProgress } from "@/lib/inventory/stocktake";
import { cn } from "@/lib/utils";

type Zone = { id: string; name: string; code: string };
type QueuedScan = StocktakeScanInput & { label: string };
type LogEntry = {
  key: string;
  tone: "ok" | "warn" | "error" | "pending";
  title: string;
  detail?: string;
};

const POLL_MS = 5000;

const subscribeNoop = () => () => undefined;

function queueKey(stocktakeId: string) {
  return `lager.inventur.${stocktakeId}.queue`;
}

function readQueue(stocktakeId: string): QueuedScan[] {
  try {
    const raw = window.localStorage.getItem(queueKey(stocktakeId));
    return raw ? (JSON.parse(raw) as QueuedScan[]) : [];
  } catch (error) {
    console.warn("Inventur-Puffer nicht lesbar", error);
    return [];
  }
}

function writeQueue(stocktakeId: string, queue: QueuedScan[]) {
  window.localStorage.setItem(queueKey(stocktakeId), JSON.stringify(queue));
}

function newScanId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Zählen während einer Inventur. Jeder Scan landet zuerst im Gerätespeicher und wird dann
 * gesendet – ohne Netz bleibt er dort, bis die Verbindung zurück ist. Mehrere Personen
 * zählen parallel; der Fortschritt aktualisiert sich alle paar Sekunden.
 */
export function StocktakeCounter({
  stocktakeId,
  initialProgress,
  locations,
}: {
  stocktakeId: string;
  initialProgress: StocktakeProgress;
  /** Lagerplätze nach Code – Zonen funktionieren so auch offline. */
  locations: Record<string, Zone>;
}) {
  const locationByCode = React.useMemo(() => new Map(Object.entries(locations)), [locations]);
  const [zone, setZone] = React.useState<Zone | null>(null);
  const zoneRef = React.useRef<Zone | null>(null);
  const [progress, setProgress] = React.useState(initialProgress);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [online, setOnline] = React.useState(true);
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const [bulk, setBulk] = React.useState<{
    code: string;
    name: string;
    unit: string | null;
  } | null>(null);
  const [quantity, setQuantity] = React.useState("");
  const flushing = React.useRef(false);
  const [signal, setSignal] = React.useState<ScanSignal | null>(null);
  const [scanToast, setScanToast] = React.useState<ScanToast | null>(null);
  const [snap, setSnap] = React.useState<SheetSnap>("peek");
  const hydrated = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const desktop = useMediaQuery("(min-width: 1024px)");

  const push = React.useCallback((entry: Omit<LogEntry, "key">) => {
    const tone = entry.tone === "pending" ? "warn" : entry.tone;
    if (entry.tone !== "pending") scanFeedback(entry.tone);
    setSignal({ tone, key: Date.now() });
    setScanToast({ key: Date.now(), tone, title: entry.title, detail: entry.detail });
    setLog((items) => [{ ...entry, key: newScanId() }, ...items].slice(0, 50));
  }, []);

  const refreshProgress = React.useCallback(async () => {
    const result = await stocktakeProgressAction(stocktakeId);
    if (result.ok) setProgress(result.data);
  }, [stocktakeId]);

  const flush = React.useCallback(async () => {
    if (flushing.current) return;
    const queue = readQueue(stocktakeId);
    setPendingCount(queue.length);
    if (!queue.length || !navigator.onLine) return;
    flushing.current = true;
    try {
      const batch = queue.slice(0, 200);
      const result = await submitStocktakeScansAction(
        stocktakeId,
        batch.map((scan) => ({
          clientScanId: scan.clientScanId,
          code: scan.code,
          zoneLocationId: scan.zoneLocationId,
          quantity: scan.quantity,
          scannedAt: scan.scannedAt,
        })),
      );
      if (!result.ok) {
        // Abgeschlossen oder ungültig: Puffer nicht endlos wiederholen.
        if (/abgeschlossen|nicht gefunden/i.test(result.error)) {
          writeQueue(stocktakeId, []);
          setPendingCount(0);
        }
        toast.error(result.error);
        return;
      }
      const sent = new Set(batch.map((scan) => scan.clientScanId));
      const rest = readQueue(stocktakeId).filter((scan) => !sent.has(scan.clientScanId));
      writeQueue(stocktakeId, rest);
      setPendingCount(rest.length);
      for (const outcome of result.data) {
        if (outcome.status === "unknown") {
          push({ tone: "error", title: outcome.code, detail: "Code ist nicht vergeben" });
        }
      }
      void refreshProgress();
    } catch (error) {
      console.warn("Inventur-Scans nicht gesendet", error);
    } finally {
      flushing.current = false;
    }
  }, [push, refreshProgress, stocktakeId]);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    setPendingCount(readQueue(stocktakeId).length);
    const goOnline = () => {
      setOnline(true);
      void flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = window.setInterval(() => {
      void flush();
      if (navigator.onLine && document.visibilityState === "visible") void refreshProgress();
    }, POLL_MS);
    void flush();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(timer);
    };
  }, [flush, refreshProgress, stocktakeId]);

  const enqueue = React.useCallback(
    (code: string, label: string, amount: number | null) => {
      const scan: QueuedScan = {
        clientScanId: newScanId(),
        code,
        zoneLocationId: zoneRef.current?.id ?? null,
        quantity: amount,
        scannedAt: new Date().toISOString(),
        label,
      };
      const queue = [...readQueue(stocktakeId), scan];
      writeQueue(stocktakeId, queue);
      setPendingCount(queue.length);
      void flush();
    },
    [flush, stocktakeId],
  );

  const onScan = React.useCallback(
    async (raw: string) => {
      const code = parseInventoryCode(raw);
      if (!code) {
        push({ tone: "error", title: "Kein Lager-Code", detail: raw.slice(0, 60) });
        return;
      }
      if (isLocationCode(code)) {
        const location = locationByCode.get(code);
        if (!location) {
          push({ tone: "error", title: code, detail: "Unbekannter Lagerplatz" });
          return;
        }
        zoneRef.current = location;
        setZone(location);
        push({ tone: "ok", title: `Zone: ${location.name}`, detail: "Jetzt alles hier scannen" });
        return;
      }
      if (!zoneRef.current) {
        push({
          tone: "warn",
          title: "Erst den Lagerplatz scannen",
          detail: "Sonst ist unklar, wo es lag",
        });
        return;
      }
      // Mengenartikel brauchen eine Zahl – dafür einmal nachschlagen (nur online möglich).
      if (navigator.onLine) {
        const lookup = await lookupCodeAction(code);
        if (lookup.ok && lookup.data.type === "asset" && lookup.data.kind === "bulk") {
          setQuantity("");
          setBulk({ code, name: lookup.data.name, unit: lookup.data.unit });
          return;
        }
        if (lookup.ok && lookup.data.type === "asset") {
          enqueue(code, lookup.data.name, null);
          push({ tone: "ok", title: `${code} ${lookup.data.name}` });
          return;
        }
        if (!lookup.ok) {
          push({ tone: "error", title: code, detail: lookup.error });
          return;
        }
      }
      enqueue(code, code, null);
      push({ tone: "pending", title: code, detail: "Offline gespeichert" });
    },
    [enqueue, locationByCode, push],
  );

  const confirmBulk = () => {
    if (!bulk) return;
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 0) {
      toast.error("Bitte die gezählte Menge eingeben.");
      return;
    }
    enqueue(bulk.code, bulk.name, amount);
    push({
      tone: "ok",
      title: `${bulk.code} ${bulk.name}`,
      detail: `${amount} ${bulk.unit ?? "Stk."} gezählt`,
    });
    setBulk(null);
  };

  const percent = progress.expected ? Math.round((progress.found / progress.expected) * 100) : 0;

  const zoneHint = zone ? `Zählen in ${zone.name}` : "Erst den Lagerplatz scannen";
  const bulkPanel = (
    <ResponsivePanel
      open={bulk !== null}
      onOpenChange={(open) => (!open ? setBulk(null) : undefined)}
      title="Gezählte Menge"
      description="Menge des Mengenartikels in dieser Zone"
      footer={
        <Button className="w-full" size="lg" onClick={confirmBulk} disabled={quantity === ""}>
          Speichern
        </Button>
      }
    >
      {bulk ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            confirmBulk();
          }}
        >
          <p className="text-sm text-muted-foreground">
            {bulk.code} · {bulk.name} in {zone?.name}
          </p>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder={`Anzahl (${bulk.unit ?? "Stk."})`}
            className="h-12 text-center text-lg"
            aria-label="Gezählte Menge"
            autoFocus
          />
        </form>
      ) : null}
    </ResponsivePanel>
  );

  if (!hydrated) return null;

  if (!desktop) {
    return (
      <>
        <ScannerShell
          closeHref={`${INVENTORY_BASE_PATH}/inventur/${stocktakeId}?ansicht=abgleich`}
          title="Inventur"
          context={
            <button
              type="button"
              onClick={
                zone
                  ? () => {
                      zoneRef.current = null;
                      setZone(null);
                    }
                  : undefined
              }
              className={cn(
                "flex max-w-full items-center gap-2 rounded-full px-3 py-2 text-sm font-medium shadow-md",
                zone ? "bg-primary text-primary-foreground" : "bg-background/90 text-foreground",
              )}
              aria-label={zone ? `Zone ${zone.name} zurücksetzen` : undefined}
            >
              <MapPinIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">
                {zone ? zone.name : "Lagerplatz-Etikett scannen"}
              </span>
              {zone ? <CloseIcon className="h-4 w-4 shrink-0" /> : null}
            </button>
          }
          onScan={(raw) => void onScan(raw)}
          paused={bulk !== null}
          hint={zoneHint}
          signal={signal}
          toast={scanToast}
          snap={snap}
          onSnapChange={setSnap}
          summary={
            <span className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                Gefunden {progress.found} / {progress.expected}
              </span>
              {!online || pendingCount ? (
                <span className="flex items-center gap-1 text-xs text-warning">
                  <WifiOffIcon className="h-3.5 w-3.5" />
                  {pendingCount} wartend
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{percent} %</span>
              )}
            </span>
          }
          footer={
            <div
              className="mx-2 my-1 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Fortschritt"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          }
        >
          <div className="space-y-3 px-3 pb-3">
            {!online || pendingCount ? (
              <p className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
                <WifiOffIcon className="h-4 w-4 shrink-0 text-warning" />
                {online
                  ? `${pendingCount} Scans werden gesendet …`
                  : `Offline – ${pendingCount} Scans sicher auf dem Gerät gespeichert.`}
              </p>
            ) : null}
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Gefunden</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {progress.found}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}
                      / {progress.expected}
                    </span>
                  </p>
                </div>
                <p className="text-right text-xs text-muted-foreground">
                  {progress.people} {progress.people === 1 ? "Person" : "Personen"} ·{" "}
                  {progress.scans} Scans
                </p>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {progress.zones.length ? (
                <ul className="space-y-1.5">
                  {progress.zones.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-foreground">{entry.name}</span>
                      <span
                        className={cn(
                          "shrink-0 text-xs tabular-nums",
                          entry.found >= entry.expected ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {entry.found}/{entry.expected}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="rounded-xl border border-border bg-card" aria-live="polite">
              <p className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
                Meine Scans
              </p>
              {log.length ? (
                <ul className="max-h-[40dvh] divide-y divide-border overflow-y-auto">
                  {log.map((entry) => (
                    <li key={entry.key} className="flex items-start gap-3 px-3 py-2">
                      {entry.tone === "ok" ? (
                        <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      ) : entry.tone === "error" ? (
                        <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      ) : (
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {entry.title}
                        </p>
                        {entry.detail ? (
                          <p className="text-xs text-muted-foreground">{entry.detail}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-4 text-sm text-muted-foreground">Noch nichts gescannt.</p>
              )}
            </section>

            {progress.recent.length ? (
              <section className="rounded-xl border border-border bg-card">
                <p className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
                  Zuletzt im Team
                </p>
                <ul className="divide-y divide-border">
                  {progress.recent.slice(0, 6).map((scan, index) => (
                    <li
                      key={`${scan.code}-${index}`}
                      className="px-3 py-2 text-xs text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">{scan.name ?? scan.code}</span>
                      {scan.place ? ` · ${scan.place}` : ""} · {scan.by ?? "?"} ·{" "}
                      {formatInventoryDateTime(scan.at)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </ScannerShell>
        {bulkPanel}
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3",
            zone ? "border-primary/50 bg-primary/10" : "border-dashed border-border bg-card",
          )}
        >
          <MapPinIcon
            className={cn("h-5 w-5 shrink-0", zone ? "text-primary" : "text-muted-foreground")}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Zone</p>
            <p className="truncate text-sm font-medium text-foreground">
              {zone ? zone.name : "Lagerplatz-Etikett scannen"}
            </p>
          </div>
          {zone ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                zoneRef.current = null;
                setZone(null);
              }}
              aria-label="Zone zurücksetzen"
            >
              <CloseIcon />
            </Button>
          ) : null}
        </div>
        <QrScanner
          onScan={(raw) => void onScan(raw)}
          paused={bulk !== null}
          hint={zoneHint}
          signal={signal}
        />
        {!online || pendingCount ? (
          <p className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
            <WifiOffIcon className="h-4 w-4 shrink-0 text-warning" />
            {online
              ? `${pendingCount} Scans werden gesendet …`
              : `Offline – ${pendingCount} Scans sicher auf dem Gerät gespeichert.`}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Gefunden</p>
              <p className="text-2xl font-semibold text-foreground">
                {progress.found}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  / {progress.expected}
                </span>
              </p>
            </div>
            <p className="text-right text-xs text-muted-foreground">
              {progress.people} {progress.people === 1 ? "Person" : "Personen"} · {progress.scans}{" "}
              Scans
            </p>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          {progress.zones.length ? (
            <ul className="space-y-1.5">
              {progress.zones.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-foreground">{entry.name}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      entry.found >= entry.expected ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {entry.found}/{entry.expected}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-xl border border-border bg-card" aria-live="polite">
          <p className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
            Meine Scans
          </p>
          {log.length ? (
            <ul className="max-h-[40dvh] divide-y divide-border overflow-y-auto">
              {log.map((entry) => (
                <li key={entry.key} className="flex items-start gap-3 px-3 py-2">
                  {entry.tone === "ok" ? (
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : entry.tone === "error" ? (
                    <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
                    {entry.detail ? (
                      <p className="text-xs text-muted-foreground">{entry.detail}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">Noch nichts gescannt.</p>
          )}
        </section>

        {progress.recent.length ? (
          <section className="rounded-xl border border-border bg-card">
            <p className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">
              Zuletzt im Team
            </p>
            <ul className="divide-y divide-border">
              {progress.recent.slice(0, 6).map((scan, index) => (
                <li
                  key={`${scan.code}-${index}`}
                  className="px-3 py-2 text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{scan.name ?? scan.code}</span>
                  {scan.place ? ` · ${scan.place}` : ""} · {scan.by ?? "?"} ·{" "}
                  {formatInventoryDateTime(scan.at)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {bulkPanel}
    </div>
  );
}
