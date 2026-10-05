"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  closeCheckoutAction,
  removeCheckoutLineAction,
  reopenCheckoutAction,
  returnAssetAction,
} from "@/app/(members)/mitglieder/lager/actions/checkouts";
import { AssetThumb } from "@/components/inventory/asset-thumb";
import {
  ArrowLeftRightIcon,
  CheckCircleIcon,
  ScanLineIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { INVENTORY_BASE_PATH, inventoryAssetPath, type AssetKind } from "@/lib/inventory/constants";

export type PacklistLine = {
  id: string;
  assetId: string;
  code: string;
  name: string;
  kind: AssetKind;
  unit: string | null;
  photoId: string | null;
  place: string | null;
  quantity: number;
  returnedQuantity: number;
};

/**
 * Packliste einer Ausgabe. „Fehlt noch“ ist beim Abbau die wichtigste Ansicht – sortiert nach
 * Lagerplatz, damit man beim Zurückräumen nicht hin und her läuft.
 */
export function CheckoutPacklist({
  checkoutId,
  status,
  lines,
}: {
  checkoutId: string;
  status: "open" | "closed";
  lines: PacklistLine[];
}) {
  const router = useRouter();
  const outstanding = lines.filter((line) => line.returnedQuantity < line.quantity);
  const [view, setView] = React.useState<"missing" | "all">(outstanding.length ? "missing" : "all");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);

  const visible = (view === "missing" ? outstanding : lines)
    .slice()
    .sort(
      (a, b) =>
        (a.place ?? "").localeCompare(b.place ?? "", "de") ||
        a.code.localeCompare(b.code, "de", { numeric: true }),
    );

  const run = async (
    key: string,
    action: () => Promise<{ ok: boolean; error?: string; message?: string }>,
  ) => {
    setBusy(key);
    const result = await action();
    setBusy(null);
    if (!result.ok) toast.error(result.error ?? "Fehler");
    else {
      toast.success(result.message ?? "Erledigt.");
      router.refresh();
    }
  };

  const scanHref = (mode: string) =>
    `${INVENTORY_BASE_PATH}/scannen?modus=${mode}${mode === "ausgeben" ? `&ausgabe=${checkoutId}` : ""}`;

  return (
    <div className="space-y-4">
      {status === "open" ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button asChild>
            <Link href={scanHref("ausgeben")}>
              <ScanLineIcon className="mr-2 h-4 w-4" />
              Einpacken
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={scanHref("zurueck")}>
              <ArrowLeftRightIcon className="mr-2 h-4 w-4" />
              Rücknahme
            </Link>
          </Button>
          <Button
            variant="outline"
            className="col-span-2 sm:col-span-1"
            disabled={busy !== null}
            onClick={() =>
              outstanding.length
                ? setConfirm(true)
                : run("close", () => closeCheckoutAction(checkoutId))
            }
          >
            <CheckCircleIcon className="mr-2 h-4 w-4" />
            Abschließen
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => run("reopen", () => reopenCheckoutAction(checkoutId))}
        >
          Wieder öffnen
        </Button>
      )}

      <SegmentedControl
        aria-label="Ansicht"
        value={view}
        onValueChange={setView}
        options={[
          { value: "missing", label: `Fehlt noch (${outstanding.length})` },
          { value: "all", label: `Alle (${lines.length})` },
        ]}
      />

      {visible.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {visible.map((line) => {
            const open = line.quantity - line.returnedQuantity;
            const unit = line.unit ?? "Stk.";
            return (
              <li key={line.id} className="flex items-center gap-3 px-3 py-2">
                <AssetThumb photoId={line.photoId} kind={line.kind} size="sm" />
                <Link href={inventoryAssetPath(line.code)} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {line.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{line.code}</span>
                    {line.kind === "bulk" ? ` · ${line.quantity} ${unit}` : ""}
                    {line.place ? ` · ${line.place}` : ""}
                  </span>
                </Link>
                {open > 0 ? (
                  status === "open" ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() =>
                          run(line.id, () => returnAssetAction(line.assetId, undefined, checkoutId))
                        }
                      >
                        {line.kind === "bulk" ? `${open} zurück` : "Zurück"}
                      </Button>
                      {line.returnedQuantity === 0 ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={busy !== null}
                          aria-label={`${line.code} von der Liste nehmen`}
                          onClick={() => run(line.id, () => removeCheckoutLineAction(line.id))}
                        >
                          <TrashIcon />
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-destructive">fehlt</span>
                  )
                ) : (
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-success" aria-label="zurück" />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {view === "missing"
            ? lines.length
              ? "Alles ist zurück."
              : "Noch nichts eingepackt – mit „Einpacken“ scannen."
            : "Die Liste ist leer."}
        </p>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Trotzdem abschließen?"
        description={`${outstanding.length} Positionen sind nicht zurück. Sie werden als vermisst markiert, bis sie wieder gescannt werden.`}
        confirmLabel="Als vermisst abschließen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void run("close", () => closeCheckoutAction(checkoutId, true));
        }}
      />
    </div>
  );
}
