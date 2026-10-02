"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { closeStocktakeAction } from "@/app/(members)/mitglieder/lager/actions/stocktakes";
import { ChevronDownIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { inventoryAssetPath } from "@/lib/inventory/constants";
import type { ReviewAsset, StocktakeReview } from "@/lib/inventory/stocktake";
import { cn } from "@/lib/utils";

type Tone = "success" | "info" | "warning" | "destructive" | "muted";

const TONE: Record<Tone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};

/** Abgleich: was fehlt, was lag woanders, was war gar nicht erwartet – dann übernehmen. */
export function StocktakeReviewView({
  stocktakeId,
  review,
  open,
  canManage,
}: {
  stocktakeId: string;
  review: StocktakeReview;
  open: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [applyMoves, setApplyMoves] = React.useState(true);
  const [markMissing, setMarkMissing] = React.useState(true);
  const [applyBulkCounts, setApplyBulkCounts] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const close = async () => {
    setBusy(true);
    const result = await closeStocktakeAction(stocktakeId, {
      applyMoves,
      markMissing,
      applyBulkCounts,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Abgeschlossen.");
    router.refresh();
  };

  const countedBulk = review.bulkCounts.filter(
    (entry) => entry.quantity !== null && entry.quantity !== undefined,
  );

  return (
    <div className="space-y-4">
      <ReviewGroup
        title="Fehlt"
        tone="destructive"
        items={review.missing}
        detail={(item) => `erwartet: ${item.expectedPlace ?? "ohne Ort"}`}
        defaultOpen
      />
      <ReviewGroup
        title="Woanders gefunden"
        tone="warning"
        items={review.moved}
        detail={(item) => `${item.expectedPlace ?? "ohne Ort"} → ${item.foundPlace ?? "?"}`}
        defaultOpen
      />
      <ReviewGroup
        title="Nicht erwartet"
        tone="info"
        items={review.unexpected}
        detail={(item) =>
          `gefunden: ${item.foundPlace ?? "?"} · laut System: ${item.expectedPlace ?? "ohne Ort"}`
        }
      />
      <ReviewGroup
        title="In gefundener Kiste (nicht einzeln gescannt)"
        tone="muted"
        items={review.inFoundContainer}
        detail={(item) => item.expectedPlace ?? ""}
      />
      <ReviewGroup
        title="Mengenartikel"
        tone="muted"
        items={review.bulkCounts}
        detail={(item) =>
          item.quantity === null || item.quantity === undefined
            ? `nicht gezählt · Bestand ${item.expectedQuantity ?? 0}`
            : `gezählt ${item.quantity} in ${item.foundPlace ?? "?"} · Bestand gesamt ${item.expectedQuantity ?? 0}`
        }
      />
      <ReviewGroup
        title="Am richtigen Ort"
        tone="success"
        items={review.found}
        detail={(item) => item.foundPlace ?? item.expectedPlace ?? ""}
      />
      {review.unknownCodes.length ? (
        <section className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="font-medium text-foreground">Unbekannte Codes</p>
          <p className="text-muted-foreground">
            {review.unknownCodes.map((entry) => `${entry.code} (${entry.count}×)`).join(", ")}
          </p>
        </section>
      ) : null}

      {open && canManage ? (
        <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="font-semibold text-foreground">Inventur abschließen</p>
          <Toggle
            label={`Orte korrigieren (${review.moved.length + review.unexpected.length})`}
            hint="Woanders gefundene Objekte bekommen den gescannten Ort."
            checked={applyMoves}
            onChange={setApplyMoves}
          />
          <Toggle
            label={`Fehlende als vermisst markieren (${review.missing.length})`}
            hint="Sie bleiben vermisst, bis sie wieder gescannt werden."
            checked={markMissing}
            onChange={setMarkMissing}
          />
          <Toggle
            label={`Gezählte Mengen übernehmen (${countedBulk.length})`}
            hint="Setzt den Bestand am gezählten Ort auf die gezählte Menge."
            checked={applyBulkCounts}
            onChange={setApplyBulkCounts}
          />
          <Button className="w-full sm:w-auto" size="lg" disabled={busy} onClick={close}>
            {busy ? "Übernimmt …" : "Abgleich übernehmen & abschließen"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3">
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

function ReviewGroup({
  title,
  tone,
  items,
  detail,
  defaultOpen = false,
}: {
  title: string;
  tone: Tone;
  items: ReviewAsset[];
  detail: (item: ReviewAsset) => string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen && items.length > 0);
  if (!items.length) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="rounded-xl border border-border bg-card">
        <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <span className={cn("text-lg font-semibold tabular-nums", TONE[tone])}>
            {items.length}
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{title}</span>
          <ChevronDownIcon
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="divide-y divide-border border-t border-border">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-2">
                <Link
                  href={inventoryAssetPath(item.code)}
                  className="block text-sm font-medium text-foreground hover:underline"
                >
                  <span className="font-mono text-xs text-muted-foreground">{item.code}</span>{" "}
                  {item.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {detail(item)}
                  {item.scannedBy ? ` · ${item.scannedBy}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
