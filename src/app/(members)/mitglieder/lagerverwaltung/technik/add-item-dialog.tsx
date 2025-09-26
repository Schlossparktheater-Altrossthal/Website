"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  createTechnikInventoryItem,
  type TechnikInventoryActionState,
} from "./actions";
import {
  TECH_CATEGORY_LABEL,
  TECH_CATEGORY_PREFIX,
  type TechnikInventoryCategory,
} from "./config";

const INITIAL_STATE: TechnikInventoryActionState = { status: "idle" };

const CURRENCY_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

interface AddTechnikItemDialogProps {
  category: TechnikInventoryCategory;
}

export function AddTechnikItemDialog({ category }: AddTechnikItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createTechnikInventoryItem,
    INITIAL_STATE,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const categoryLabel = TECH_CATEGORY_LABEL[category];
  const prefix = TECH_CATEGORY_PREFIX[category];

  const computedTotal = useMemo(() => {
    const parsedQuantity = Number.parseInt(quantity, 10);
    const parsedCost = Number.parseFloat(acquisitionCost);

    if (!Number.isFinite(parsedQuantity) || !Number.isFinite(parsedCost)) {
      return null;
    }

    const rawTotal = parsedQuantity * parsedCost;

    return Math.round(rawTotal * 100) / 100;
  }, [acquisitionCost, quantity]);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
      setOpen(false);
      setErrorMessage(null);
      setQuantity("1");
      setAcquisitionCost("");
    }

    if (state.status === "error") {
      toast.error(state.error);
      setErrorMessage(state.error);
    }
  }, [state]);

  useEffect(() => {
    if (!open) {
      setErrorMessage(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Artikel hinzufügen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Artikel in {categoryLabel} anlegen</DialogTitle>
          <DialogDescription>
            Die Artikelnummer wird automatisch als{" "}
            <span className="font-mono">
              {prefix}
              001
            </span>{" "}
            vergeben und fortlaufend erhöht.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="category" value={category} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-manufacturer-${category}`}>
                Hersteller
              </Label>
              <Input
                id={`technik-manufacturer-${category}`}
                name="manufacturer"
                placeholder="z. B. Cameo"
                required
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-name-${category}`}>
                Modellbezeichnung
              </Label>
              <Input
                id={`technik-name-${category}`}
                name="name"
                placeholder="z. B. Zenit W600"
                required
                maxLength={160}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-type-${category}`}>Typ</Label>
              <Input
                id={`technik-type-${category}`}
                name="itemType"
                placeholder="z. B. LED-Fluter"
                required
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-quantity-${category}`}>Menge</Label>
              <Input
                id={`technik-quantity-${category}`}
                name="quantity"
                type="number"
                min={0}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-acquisition-${category}`}>
                Kosten bei Anschaffung (EUR)
              </Label>
              <Input
                id={`technik-acquisition-${category}`}
                name="acquisitionCost"
                type="number"
                min={0}
                step="0.01"
                placeholder="z. B. 2499"
                value={acquisitionCost}
                onChange={(event) => setAcquisitionCost(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-total-${category}`}>
                Gesamtwert (automatisch)
              </Label>
              <Input
                id={`technik-total-${category}`}
                type="text"
                readOnly
                tabIndex={-1}
                value={
                  computedTotal !== null
                    ? CURRENCY_FORMATTER.format(computedTotal)
                    : "–"
                }
              />
              <p className="text-xs text-muted-foreground">
                Berechnet als Menge × Anschaffungskosten.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-purchase-${category}`}>
                Kaufdatum
              </Label>
              <Input
                id={`technik-purchase-${category}`}
                name="purchaseDate"
                type="date"
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-lastUsedAt-${category}`}>
                Zuletzt benutzt
              </Label>
              <Input
                id={`technik-lastUsedAt-${category}`}
                name="lastUsedAt"
                type="date"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-lastInventoryAt-${category}`}>
                Letzte Inventur
              </Label>
              <Input
                id={`technik-lastInventoryAt-${category}`}
                name="lastInventoryAt"
                type="date"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`technik-details-${category}`}>Anmerkungen</Label>
            <Textarea
              id={`technik-details-${category}`}
              name="details"
              placeholder="Besonderheiten, Zubehör, Wartungshinweise …"
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Optional: kurze Beschreibung oder Hinweise für das Team.
            </p>
          </div>
          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              {isPending ? "Speichere …" : "Artikel speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
