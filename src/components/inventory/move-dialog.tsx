"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  moveAssetAction,
  setStockAction,
  transferStockAction,
} from "@/app/(members)/mitglieder/lager/actions/placement";
import { PlacementPicker, type PlacementOptions } from "@/components/inventory/placement-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { PlacementTarget } from "@/lib/inventory/service-types";

/** Einzelstück oder Kiste an einen anderen Ort bzw. in eine Kiste legen. */
export function MoveDialog({
  assetId,
  assetLabel,
  isContainer,
  current,
  options,
  open,
  onOpenChange,
}: {
  assetId: string;
  assetLabel: string;
  isContainer: boolean;
  current: PlacementTarget;
  options: PlacementOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState<PlacementTarget>(current);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setTarget(current);
  }, [open, current]);

  const submit = async () => {
    setSaving(true);
    const result = await moveAssetAction(assetId, target);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Umgelagert.");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Umlagern"
      description={`${assetLabel} umlagern`}
      footer={
        <Button type="button" size="lg" className="w-full" disabled={saving} onClick={submit}>
          {saving ? "Speichert …" : "Hierhin legen"}
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {assetLabel}
          {isContainer ? " – der Inhalt wandert mit." : ""}
        </p>
        <PlacementPicker
          value={target}
          onChange={setTarget}
          options={options}
          excludeContainerId={assetId}
        />
        <p className="text-xs text-muted-foreground">
          Schneller geht es mit dem Scanner: erst den Lagerplatz scannen, dann die Objekte.
        </p>
      </div>
    </ResponsivePanel>
  );
}

type StockRow = { id: string; quantity: number; target: PlacementTarget; label: string };

/** Bestand eines Mengenartikels zählen, ergänzen oder verschieben. */
export function StockDialog({
  assetId,
  assetLabel,
  unit,
  stocks,
  options,
  open,
  onOpenChange,
}: {
  assetId: string;
  assetLabel: string;
  unit: string;
  stocks: StockRow[];
  options: PlacementOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"set" | "transfer">("set");
  const [target, setTarget] = React.useState<PlacementTarget>(
    stocks[0]?.target ?? { type: "none" },
  );
  const [source, setSource] = React.useState<string>(stocks[0]?.id ?? "");
  const [quantity, setQuantity] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const targetKey = target.type === "none" ? "" : `${target.type}:${target.id}`;
  const existing = stocks.find(
    (stock) =>
      stock.target.type !== "none" && `${stock.target.type}:${stock.target.id}` === targetKey,
  );

  React.useEffect(() => {
    if (!open) return;
    setMode("set");
    setTarget(stocks[0]?.target ?? { type: "none" });
    setSource(stocks[0]?.id ?? "");
  }, [open, stocks]);

  React.useEffect(() => {
    if (mode === "set") setQuantity(existing ? String(existing.quantity) : "");
  }, [mode, existing]);

  const submit = async () => {
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 0) {
      toast.error("Bitte eine ganze Zahl eingeben.");
      return;
    }
    setSaving(true);
    const from = stocks.find((stock) => stock.id === source);
    const result =
      mode === "set"
        ? await setStockAction(assetId, target, amount, "set")
        : from
          ? await transferStockAction(assetId, from.target, target, amount)
          : { ok: false as const, error: "Bitte die Herkunft wählen." };
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Gespeichert.");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Bestand"
      description={`Bestand von ${assetLabel}`}
      footer={
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={saving || target.type === "none" || quantity === ""}
          onClick={submit}
        >
          {saving ? "Speichert …" : mode === "set" ? "Menge speichern" : "Verschieben"}
        </Button>
      }
    >
      <div className="space-y-4">
        <SegmentedControl
          aria-label="Aktion"
          value={mode}
          onValueChange={setMode}
          fullWidth
          options={[
            { value: "set", label: "Zählen" },
            { value: "transfer", label: "Verschieben", disabled: !stocks.length },
          ]}
        />
        {mode === "transfer" ? (
          <div className="space-y-1.5">
            <Label>Von</Label>
            <div className="grid grid-cols-1 gap-2">
              {stocks.map((stock) => (
                <button
                  key={stock.id}
                  type="button"
                  onClick={() => setSource(stock.id)}
                  aria-pressed={source === stock.id}
                  className={
                    source === stock.id
                      ? "rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-left text-sm"
                      : "rounded-md border-2 border-border px-3 py-2 text-left text-sm"
                  }
                >
                  {stock.label} · {stock.quantity} {unit}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label>{mode === "transfer" ? "Nach" : "Lagerplatz"}</Label>
          <PlacementPicker
            value={target}
            onChange={setTarget}
            options={options}
            allowNone={false}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock-quantity">
            {mode === "set" ? `Menge dort (${unit})` : `Wie viele? (${unit})`}
          </Label>
          <Input
            id="stock-quantity"
            type="number"
            inputMode="numeric"
            min={0}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="text-lg"
          />
          {mode === "set" && existing ? (
            <p className="text-xs text-muted-foreground">
              Bisher {existing.quantity} {unit}. 0 entfernt den Lagerplatz.
            </p>
          ) : null}
        </div>
      </div>
    </ResponsivePanel>
  );
}
