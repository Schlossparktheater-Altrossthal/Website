"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addToCheckoutAction,
  createCheckoutAction,
  returnAssetAction,
} from "@/app/(members)/mitglieder/lager/actions/checkouts";
import {
  batchPlaceAction,
  lookupCodeAction,
} from "@/app/(members)/mitglieder/lager/actions/placement";
import { AssetThumb } from "@/components/inventory/asset-thumb";
import { DefectDialog } from "@/components/inventory/defect-dialog";
import { InspectionDialog } from "@/components/inventory/inspection-dialog";
import { QrScanner, scanFeedback, type ScanSignal } from "@/components/inventory/qr-scanner";
import {
  ScannerShell,
  ScanToneIcon,
  type ScanToast,
  type SheetSnap,
} from "@/components/inventory/scanner-shell";
import { ToneBadge } from "@/components/inventory/tone-badge";
import {
  AlertTriangleIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  CloseIcon,
  InfoIcon,
  MapPinIcon,
  PackageIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ASSET_STATUS_LABELS,
  ASSET_STATUS_TONES,
  INSPECTION_STATE_LABELS,
  INSPECTION_STATE_TONES,
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
  inventoryLocationPath,
  parseInventoryCode,
} from "@/lib/inventory/constants";
import type { ScanResult } from "@/lib/inventory/scan";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => undefined;

/** Erst nach dem Hydrieren wissen wir, ob Handy oder Desktop – vorher keine Kamera starten. */
function useHydrated() {
  return React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export type ScanMode = "lookup" | "store" | "checkout" | "return" | "inspect";

const MODES: { value: ScanMode; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    value: "lookup",
    label: "Info",
    hint: "Scannen zeigt das Objekt",
    icon: <SearchIcon className="h-5 w-5" />,
  },
  {
    value: "store",
    label: "Einlagern",
    hint: "Erst Lagerplatz oder Kiste scannen, dann die Objekte",
    icon: <MapPinIcon className="h-5 w-5" />,
  },
  {
    value: "checkout",
    label: "Ausgeben",
    hint: "Ausgabe wählen, dann alles scannen, was mitgeht",
    icon: <ArrowRightIcon className="h-5 w-5" />,
  },
  {
    value: "return",
    label: "Zurück",
    hint: "Scannen bucht zurück – egal aus welcher Ausgabe",
    icon: <ArrowLeftRightIcon className="h-5 w-5" />,
  },
  {
    value: "inspect",
    label: "Prüftag",
    hint: "Geräte sammeln und gemeinsam als geprüft eintragen",
    icon: <ShieldCheckIcon className="h-5 w-5" />,
  },
];

type AssetHit = Extract<ScanResult, { type: "asset" }>;
type Target = { type: "location" | "container"; id: string; code: string; label: string };

type LogEntry = {
  key: string;
  tone: "ok" | "warn" | "error";
  title: string;
  detail?: string;
  href?: string;
};

type PendingQuantity = { asset: AssetHit; purpose: "store" | "checkout" };

export function ScanWorkbench({
  initialMode,
  initialTarget,
  initialCheckoutId,
  openCheckouts,
}: {
  initialMode: ScanMode;
  initialTarget: Target | null;
  initialCheckoutId: string | null;
  openCheckouts: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<ScanMode>(initialMode);
  const [target, setTarget] = React.useState<Target | null>(initialTarget);
  const [checkouts, setCheckouts] = React.useState(openCheckouts);
  const [checkoutId, setCheckoutId] = React.useState<string | null>(initialCheckoutId);
  const [newCheckout, setNewCheckout] = React.useState("");
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const [current, setCurrent] = React.useState<AssetHit | null>(null);
  const [inspectList, setInspectList] = React.useState<AssetHit[]>([]);
  const [pending, setPending] = React.useState<PendingQuantity | null>(null);
  const [quantity, setQuantity] = React.useState("1");
  const [dialog, setDialog] = React.useState<"defect" | "inspection" | "batch-inspection" | null>(
    null,
  );
  const [signal, setSignal] = React.useState<ScanSignal | null>(null);
  const [scanToast, setScanToast] = React.useState<ScanToast | null>(null);
  const [snap, setSnap] = React.useState<SheetSnap>("peek");
  const [pickerOpen, setPickerOpen] = React.useState(
    initialMode === "checkout" && !initialCheckoutId,
  );
  const hydrated = useHydrated();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const queue = React.useRef(Promise.resolve());
  // Scans laufen in einer Warteschlange; sie lesen den Zustand über diese Ref, damit ein gerade
  // gescanntes Ziel schon für den nächsten Scan gilt.
  const live = React.useRef({ mode, target, checkoutId });
  React.useEffect(() => {
    live.current.mode = mode;
    live.current.checkoutId = checkoutId;
  }, [mode, checkoutId]);
  const chooseTarget = React.useCallback((next: Target | null) => {
    live.current.target = next;
    setTarget(next);
  }, []);

  const signalTone = React.useCallback((tone: ScanSignal["tone"]) => {
    scanFeedback(tone);
    setSignal({ tone, key: Date.now() });
  }, []);

  const push = React.useCallback(
    (entry: Omit<LogEntry, "key">) => {
      signalTone(entry.tone);
      setScanToast({ key: Date.now(), tone: entry.tone, title: entry.title, detail: entry.detail });
      setLog((items) =>
        [{ ...entry, key: `${Date.now()}-${Math.random()}` }, ...items].slice(0, 60),
      );
    },
    [signalTone],
  );

  const selectedCheckout = checkouts.find((entry) => entry.id === checkoutId) ?? null;

  const placeOne = React.useCallback(
    async (asset: AssetHit, place: Target, amount?: number) => {
      const result = await batchPlaceAction({ type: place.type, id: place.id }, [
        { assetId: asset.id, quantity: amount },
      ]);
      const outcome = result.ok ? result.data[0] : null;
      if (!result.ok || !outcome?.ok) {
        push({
          tone: "error",
          title: `${asset.code} ${asset.name}`,
          detail: result.ok ? outcome?.error : result.error,
        });
        return;
      }
      push({
        tone: "ok",
        title: `${asset.code} ${asset.name}`,
        detail: `${amount ? `${amount} × ` : ""}→ ${place.label}`,
        href: inventoryAssetPath(asset.code),
      });
    },
    [push],
  );

  const checkoutOne = React.useCallback(
    async (asset: AssetHit, amount = 1) => {
      const checkoutId = live.current.checkoutId;
      if (!checkoutId) return;
      const result = await addToCheckoutAction(checkoutId, asset.id, amount);
      if (!result.ok) {
        push({ tone: "error", title: `${asset.code} ${asset.name}`, detail: result.error });
        return;
      }
      push({
        tone: result.data.warning ? "warn" : "ok",
        title: `${asset.code} ${asset.name}`,
        detail:
          result.data.warning ??
          (asset.kind === "bulk" ? `${result.data.quantity} ausgegeben` : "ausgegeben"),
        href: inventoryAssetPath(asset.code),
      });
    },
    [push],
  );

  const handle = React.useCallback(
    async (raw: string) => {
      const code = parseInventoryCode(raw);
      if (!code) {
        push({ tone: "error", title: "Kein Lager-Code", detail: raw.slice(0, 60) });
        return;
      }
      const lookup = await lookupCodeAction(code);
      if (!lookup.ok) {
        push({ tone: "error", title: code, detail: lookup.error });
        return;
      }
      const hit = lookup.data;
      const { mode, target, checkoutId } = live.current;

      if (mode === "lookup") {
        if (hit.type === "location") {
          signalTone("ok");
          router.push(inventoryLocationPath(hit.code));
          return;
        }
        signalTone(hit.locked ? "warn" : "ok");
        setCurrent(hit);
        setSnap("half");
        return;
      }

      if (mode === "store") {
        if (hit.type === "location") {
          chooseTarget({ type: "location", id: hit.id, code: hit.code, label: hit.path });
          push({ tone: "ok", title: `Ziel: ${hit.path}`, detail: "Jetzt Objekte scannen" });
          return;
        }
        if (!target) {
          if (hit.kind === "container") {
            chooseTarget({
              type: "container",
              id: hit.id,
              code: hit.code,
              label: `${hit.code} ${hit.name}`,
            });
            push({ tone: "ok", title: `Ziel: Kiste ${hit.code}`, detail: "Jetzt Objekte scannen" });
          } else {
            push({
              tone: "warn",
              title: "Erst das Ziel scannen",
              detail: "Lagerplatz- oder Kisten-Etikett",
            });
          }
          return;
        }
        if (hit.id === target.id) {
          push({ tone: "warn", title: "Das ist das Ziel selbst" });
          return;
        }
        if (hit.kind === "bulk") {
          setQuantity("1");
          setPending({ asset: hit, purpose: "store" });
          return;
        }
        await placeOne(hit, target);
        return;
      }

      if (hit.type === "location") {
        push({
          tone: "warn",
          title: `${hit.code} ist ein Lagerplatz`,
          detail: "Hier bitte Objekte scannen",
        });
        return;
      }

      if (mode === "checkout") {
        if (!checkoutId) {
          push({ tone: "warn", title: "Erst eine Ausgabe wählen" });
          return;
        }
        if (hit.kind === "bulk") {
          setQuantity("1");
          setPending({ asset: hit, purpose: "checkout" });
          return;
        }
        await checkoutOne(hit);
        return;
      }

      if (mode === "return") {
        const result = await returnAssetAction(hit.id);
        if (!result.ok) {
          push({ tone: "error", title: `${hit.code} ${hit.name}`, detail: result.error });
          return;
        }
        push({
          tone: "ok",
          title: `${hit.code} ${hit.name}`,
          detail: `zurück aus „${result.data.checkoutTitle}“${result.data.open ? ` · noch ${result.data.open} offen` : ""}`,
          href: inventoryAssetPath(hit.code),
        });
        return;
      }

      if (mode === "inspect") {
        setInspectList((items) => {
          if (items.some((item) => item.id === hit.id)) return items;
          return [hit, ...items];
        });
        push({
          tone: "ok",
          title: `${hit.code} ${hit.name}`,
          detail: INSPECTION_STATE_LABELS[hit.inspection],
        });
      }
    },
    [push, signalTone, router, placeOne, checkoutOne, chooseTarget],
  );

  const onScan = React.useCallback(
    (raw: string) => {
      // Scans nacheinander abarbeiten, damit nichts doppelt oder in falscher Reihenfolge bucht.
      queue.current = queue.current
        .then(() => handle(raw))
        .catch((error: unknown) => {
          console.error("Scan-Verarbeitung", error);
          push({ tone: "error", title: "Fehler bei der Verarbeitung" });
        });
    },
    [handle, push],
  );

  const confirmQuantity = async () => {
    if (!pending) return;
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1) {
      toast.error("Bitte eine Menge ab 1 eingeben.");
      return;
    }
    const { asset, purpose } = pending;
    setPending(null);
    const currentTarget = live.current.target;
    if (purpose === "store" && currentTarget) await placeOne(asset, currentTarget, amount);
    if (purpose === "checkout") await checkoutOne(asset, amount);
  };

  const createCheckout = async () => {
    const title = newCheckout.trim();
    if (!title) return;
    const result = await createCheckoutAction({ title });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCheckouts((items) => [{ id: result.data.id, title }, ...items]);
    setCheckoutId(result.data.id);
    setNewCheckout("");
    setPickerOpen(false);
  };

  const changeMode = (next: ScanMode) => {
    setMode(next);
    setCurrent(null);
    setLog([]);
    setSnap("peek");
    // Ohne gewählte Ausgabe gleich die Auswahl öffnen – sonst landet jeder Scan als Warnung.
    if (next === "checkout" && !live.current.checkoutId && !desktop) setPickerOpen(true);
  };

  const closeCurrent = () => {
    setCurrent(null);
    setSnap("peek");
  };

  const modeMeta = MODES.find((entry) => entry.value === mode)!;
  const okCount = log.filter((entry) => entry.tone === "ok").length;
  const problemCount = log.length - okCount;
  const mobile = hydrated && !desktop;
  const scannerPaused =
    pending !== null ||
    dialog !== null ||
    (mobile && (pickerOpen || (mode === "lookup" && current !== null)));
  const hint =
    mode === "store" && target
      ? `Objekte scannen – sie kommen nach ${target.label}`
      : mode === "checkout" && selectedCheckout
        ? `Alles scannen, was nach „${selectedCheckout.title}“ mitgeht`
        : modeMeta.hint;

  const modeButtons = (compact: boolean) => (
    <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Scan-Modus">
      {MODES.map((entry) => (
        <button
          key={entry.value}
          type="button"
          role="radio"
          aria-checked={mode === entry.value}
          onClick={() => changeMode(entry.value)}
          className={cn(
            "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-xs",
            compact ? "min-h-12" : "min-h-14 border",
            mode === entry.value
              ? "border-primary bg-primary/15 text-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
            compact && mode !== entry.value && "bg-transparent",
          )}
        >
          {entry.icon}
          <span className="max-w-full truncate">{entry.label}</span>
        </button>
      ))}
    </div>
  );

  const checkoutPicker = (
    <CheckoutPicker
      checkouts={checkouts}
      checkoutId={checkoutId}
      onSelect={(id) => {
        setCheckoutId(id);
        setPickerOpen(false);
      }}
      newCheckout={newCheckout}
      onNewCheckoutChange={setNewCheckout}
      onCreate={() => void createCheckout()}
      selected={selectedCheckout}
    />
  );

  const protocol = <ProtocolList log={log} empty="Noch nichts gescannt." className="max-h-none" />;

  const inspectPanel = (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-foreground">
          {inspectList.length} {inspectList.length === 1 ? "Gerät" : "Geräte"} gesammelt
        </p>
        {inspectList.length ? (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setInspectList([])}>
            Leeren
          </Button>
        ) : null}
      </div>
      <Button
        className="w-full"
        disabled={!inspectList.length}
        onClick={() => setDialog("batch-inspection")}
      >
        <ShieldCheckIcon className="mr-2 h-4 w-4" />
        Prüfung für {inspectList.length || "…"} eintragen
      </Button>
    </div>
  );

  const dialogs = (
    <>
      <ResponsivePanel
        open={pending !== null}
        onOpenChange={(open) => (!open ? setPending(null) : undefined)}
        title="Wie viele?"
        description="Menge für den Mengenartikel"
        footer={
          <Button className="w-full" size="lg" onClick={() => void confirmQuantity()}>
            {pending?.purpose === "checkout" ? "Ausgeben" : "Einlagern"}
          </Button>
        }
      >
        {pending ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void confirmQuantity();
            }}
          >
            <p className="text-sm text-muted-foreground">
              {pending.asset.code} · {pending.asset.name}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setQuantity((value) => String(Math.max(1, Number(value || 1) - 1)))}
                aria-label="Weniger"
              >
                −
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="h-11 min-w-0 flex-1 text-center text-lg"
                aria-label="Menge"
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setQuantity((value) => String(Number(value || 0) + 1))}
                aria-label="Mehr"
              >
                +
              </Button>
              <span className="text-sm text-muted-foreground">{pending.asset.unit ?? "Stk."}</span>
            </div>
          </form>
        ) : null}
      </ResponsivePanel>

      {current ? (
        <>
          <DefectDialog
            open={dialog === "defect"}
            onOpenChange={(open) => (!open ? setDialog(null) : undefined)}
            assetId={current.id}
            assetLabel={`${current.code} · ${current.name}`}
            onDone={() => setCurrent(null)}
          />
          <InspectionDialog
            open={dialog === "inspection"}
            onOpenChange={(open) => (!open ? setDialog(null) : undefined)}
            assetIds={[current.id]}
            label={`${current.code} · ${current.name}`}
            onDone={() => setCurrent(null)}
          />
        </>
      ) : null}
      <InspectionDialog
        open={dialog === "batch-inspection"}
        onOpenChange={(open) => (!open ? setDialog(null) : undefined)}
        assetIds={inspectList.map((item) => item.id)}
        label={inspectList.map((item) => item.code).join(", ")}
        onDone={() => setInspectList([])}
      />
    </>
  );

  if (!hydrated) return null;

  if (mobile) {
    const chip = (
      icon: React.ReactNode,
      text: string,
      active: boolean,
      onClick?: () => void,
      onClear?: () => void,
    ) => (
      <div
        className={cn(
          "flex max-w-full items-center gap-2 rounded-full py-1 pr-1 pl-3 text-sm font-medium shadow-md",
          active ? "bg-primary text-primary-foreground" : "bg-background/90 text-foreground",
          !onClear && "pr-3",
        )}
      >
        <span className="shrink-0">{icon}</span>
        {onClick ? (
          <button type="button" onClick={onClick} className="min-w-0 truncate py-1 text-left">
            {text}
          </button>
        ) : (
          <span className="min-w-0 truncate py-1">{text}</span>
        )}
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-full p-1.5 hover:bg-black/10"
            aria-label="Ziel zurücksetzen"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );

    const context =
      mode === "store"
        ? chip(
            target?.type === "container" ? (
              <PackageIcon className="h-4 w-4" />
            ) : (
              <MapPinIcon className="h-4 w-4" />
            ),
            target ? target.label : "Erst Lagerplatz oder Kiste scannen",
            Boolean(target),
            undefined,
            target ? () => chooseTarget(null) : undefined,
          )
        : mode === "checkout"
          ? chip(
              <ArrowRightIcon className="h-4 w-4" />,
              selectedCheckout ? selectedCheckout.title : "Ausgabe wählen",
              Boolean(selectedCheckout),
              () => setPickerOpen(true),
            )
          : mode === "inspect" && inspectList.length
            ? chip(
                <ShieldCheckIcon className="h-4 w-4" />,
                `${inspectList.length} ${inspectList.length === 1 ? "Gerät" : "Geräte"} gesammelt`,
                true,
                () => setSnap("half"),
              )
            : null;

    const summary =
      mode === "lookup" ? (
        <span className="block truncate text-sm font-medium">
          {current
            ? `${current.code} · ${current.name}`
            : "Etikett scannen – Details erscheinen hier"}
        </span>
      ) : (
        <span className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">
            {log.length ? `${okCount} erfolgreich` : "Noch nichts gescannt"}
          </span>
          {problemCount ? (
            <span className="text-xs text-warning">
              {problemCount} {problemCount === 1 ? "Hinweis" : "Hinweise"}
            </span>
          ) : null}
        </span>
      );

    return (
      <>
        <ScannerShell
          closeHref={INVENTORY_BASE_PATH}
          title={modeMeta.label === "Info" ? "Scannen" : modeMeta.label}
          context={context}
          onScan={onScan}
          paused={scannerPaused}
          hint={hint}
          signal={signal}
          toast={mode === "lookup" ? null : scanToast}
          summary={summary}
          snap={snap}
          onSnapChange={setSnap}
          footer={modeButtons(true)}
        >
          <div className="space-y-3 px-3 pb-3">
            {mode === "lookup" ? (
              current ? (
                <LookupCard
                  asset={current}
                  onDefect={() => setDialog("defect")}
                  onInspection={() => setDialog("inspection")}
                  onClose={closeCurrent}
                />
              ) : (
                <p className="py-2 text-sm text-muted-foreground">
                  Etikett scannen – hier erscheint das Objekt mit Ort, Zustand und Prüfstatus.
                </p>
              )
            ) : (
              <>
                {mode === "inspect" ? inspectPanel : null}
                {protocol}
              </>
            )}
          </div>
        </ScannerShell>
        <ResponsivePanel
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title="Ausgabe wählen"
          description="Offene Ausgabe wählen oder neu anlegen"
        >
          {checkoutPicker}
        </ResponsivePanel>
        {dialogs}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {modeButtons(false)}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {mode === "store" ? (
            <ContextBar
              icon={
                target?.type === "container" ? (
                  <PackageIcon className="h-5 w-5" />
                ) : (
                  <MapPinIcon className="h-5 w-5" />
                )
              }
              label={target ? "Ziel" : "Noch kein Ziel"}
              value={target ? target.label : "Lagerplatz- oder Kisten-Etikett scannen"}
              active={Boolean(target)}
              onClear={target ? () => chooseTarget(null) : undefined}
            />
          ) : null}
          {mode === "checkout" ? (
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <Label>Ausgabe</Label>
              {checkoutPicker}
            </div>
          ) : null}

          <QrScanner onScan={onScan} paused={scannerPaused} hint={hint} signal={signal} />
          <p className="text-xs text-muted-foreground">{modeMeta.hint}</p>
        </div>

        <div className="space-y-3">
          {mode === "lookup" ? (
            current ? (
              <LookupCard
                asset={current}
                onDefect={() => setDialog("defect")}
                onInspection={() => setDialog("inspection")}
                onClose={() => setCurrent(null)}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Etikett scannen – hier erscheint das Objekt mit Ort, Zustand und Prüfstatus.
              </div>
            )
          ) : null}

          {mode === "inspect" ? inspectPanel : null}

          {mode !== "lookup" ? (
            <section className="rounded-xl border border-border bg-card" aria-live="polite">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <p className="text-sm font-medium text-foreground">Protokoll</p>
                <p className="text-xs text-muted-foreground">{okCount} erfolgreich</p>
              </div>
              <ProtocolList log={log} empty="Noch nichts gescannt." />
            </section>
          ) : null}
        </div>
      </div>

      {dialogs}
    </div>
  );
}

function ProtocolList({
  log,
  empty,
  className,
}: {
  log: LogEntry[];
  empty: string;
  className?: string;
}) {
  if (!log.length) return <p className="px-3 py-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul
      className={cn("max-h-[50dvh] divide-y divide-border overflow-y-auto", className)}
      aria-live="polite"
    >
      {log.map((entry) => (
        <li key={entry.key} className="flex items-start gap-3 px-3 py-2">
          <ScanToneIcon tone={entry.tone} className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            {entry.href ? (
              <Link
                href={entry.href}
                className="block truncate text-sm font-medium text-foreground hover:underline"
              >
                {entry.title}
              </Link>
            ) : (
              <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
            )}
            {entry.detail ? (
              <p className="text-xs break-words text-muted-foreground">{entry.detail}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CheckoutPicker({
  checkouts,
  checkoutId,
  onSelect,
  newCheckout,
  onNewCheckoutChange,
  onCreate,
  selected,
}: {
  checkouts: { id: string; title: string }[];
  checkoutId: string | null;
  onSelect: (id: string) => void;
  newCheckout: string;
  onNewCheckoutChange: (value: string) => void;
  onCreate: () => void;
  selected: { id: string; title: string } | null;
}) {
  return (
    <div className="space-y-2">
      <Select value={checkoutId ?? ""} onValueChange={onSelect}>
        <SelectTrigger aria-label="Ausgabe wählen">
          <SelectValue placeholder="Offene Ausgabe wählen" />
        </SelectTrigger>
        <SelectContent>
          {checkouts.map((entry) => (
            <SelectItem key={entry.id} value={entry.id}>
              {entry.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate();
        }}
      >
        <Input
          value={newCheckout}
          onChange={(event) => onNewCheckoutChange(event.target.value)}
          placeholder="oder neu: z. B. Probe Schlosspark"
          aria-label="Neue Ausgabe"
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="outline" disabled={!newCheckout.trim()}>
          Anlegen
        </Button>
      </form>
      {selected ? (
        <Link
          href={`${INVENTORY_BASE_PATH}/ausgaben/${selected.id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Packliste „{selected.title}“ öffnen
        </Link>
      ) : null}
    </div>
  );
}

function ContextBar({
  icon,
  label,
  value,
  active,
  onClear,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
  onClear?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3",
        active ? "border-primary/50 bg-primary/10" : "border-dashed border-border bg-card",
      )}
    >
      <span className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
      {onClear ? (
        <Button size="icon" variant="ghost" onClick={onClear} aria-label="Ziel zurücksetzen">
          <CloseIcon />
        </Button>
      ) : null}
    </div>
  );
}

function LookupCard({
  asset,
  onDefect,
  onInspection,
  onClose,
}: {
  asset: AssetHit;
  onDefect: () => void;
  onInspection: () => void;
  onClose: () => void;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      {asset.locked ? (
        <div className="flex items-center gap-2 rounded-md bg-destructive/15 px-3 py-2 text-sm font-semibold text-destructive">
          <AlertTriangleIcon className="h-4 w-4" />
          Gesperrt – nicht benutzen
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        <AssetThumb photoId={asset.photoId} kind={asset.kind} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted-foreground">{asset.code}</p>
          <p className="font-semibold break-words text-foreground">{asset.name}</p>
          <p className="text-xs text-muted-foreground">
            {asset.areaName}
            {asset.kind === "bulk" ? ` · ${asset.quantity} ${asset.unit ?? "Stk."}` : ""}
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Schließen">
          <CloseIcon />
        </Button>
      </div>
      <p className="flex items-center gap-2 text-sm text-foreground">
        <MapPinIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        {asset.place ?? "Kein Ort hinterlegt"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <ToneBadge tone={ASSET_STATUS_TONES[asset.status]}>
          {ASSET_STATUS_LABELS[asset.status]}
        </ToneBadge>
        {asset.inspection !== "none" ? (
          <ToneBadge tone={INSPECTION_STATE_TONES[asset.inspection]}>
            {INSPECTION_STATE_LABELS[asset.inspection]}
          </ToneBadge>
        ) : null}
        {asset.openDefects ? (
          <ToneBadge tone="warning">
            {asset.openDefects === 1 ? "1 Mangel" : `${asset.openDefects} Mängel`}
          </ToneBadge>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button asChild variant="primary">
          <Link href={inventoryAssetPath(asset.code)}>
            <InfoIcon className="mr-1.5 h-4 w-4" />
            Öffnen
          </Link>
        </Button>
        <Button variant="outline" onClick={onDefect}>
          Mangel
        </Button>
        <Button variant="outline" onClick={onInspection}>
          Prüfung
        </Button>
      </div>
    </section>
  );
}
