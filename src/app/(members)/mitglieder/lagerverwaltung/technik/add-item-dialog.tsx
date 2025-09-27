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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createTechnikInventoryItem,
  type TechnikInventoryActionState,
} from "./actions";
import {
  TECH_CATEGORY_LABEL,
  TECH_CATEGORY_PREFIX,
  TECH_CATEGORY_TYPE_OPTIONS,
  TECH_CATEGORY_VALUES,
  TECH_INVENTORY_CATEGORIES,
  type TechnikInventoryCategory,
} from "./config";

const INITIAL_STATE: TechnikInventoryActionState = { status: "idle" };

const CURRENCY_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

interface AddTechnikItemDialogProps {
  defaultCategory?: TechnikInventoryCategory;
}

export function AddTechnikItemDialog({
  defaultCategory,
}: AddTechnikItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createTechnikInventoryItem,
    INITIAL_STATE,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [acquisitionCost, setAcquisitionCost] = useState("");
  const [category, setCategory] = useState<TechnikInventoryCategory>(
    defaultCategory ?? TECH_CATEGORY_VALUES[0],
  );
  const [selectedType, setSelectedType] = useState<string>(() => {
    const options = TECH_CATEGORY_TYPE_OPTIONS[
      defaultCategory ?? TECH_CATEGORY_VALUES[0]
    ];

    return options.at(0) ?? "custom";
  });
  const [customType, setCustomType] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const categoryLabel = TECH_CATEGORY_LABEL[category];
  const prefix = TECH_CATEGORY_PREFIX[category];
  const typeOptions = TECH_CATEGORY_TYPE_OPTIONS[category];

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
      setCustomType("");
    }

    if (state.status === "error") {
      toast.error(state.error);
      setErrorMessage(state.error);
    }
  }, [state]);

  useEffect(() => {
    if (!open) {
      const fallbackCategory = defaultCategory ?? TECH_CATEGORY_VALUES[0];
      setCategory(fallbackCategory);
      const fallbackType =
        TECH_CATEGORY_TYPE_OPTIONS[fallbackCategory].at(0) ?? "custom";
      setSelectedType(fallbackType);
      setCustomType("");
      setErrorMessage(null);
    }
  }, [defaultCategory, open]);

  useEffect(() => {
    const options = TECH_CATEGORY_TYPE_OPTIONS[category];
    const matchesOption = options.some((option) => option === selectedType);

    if (selectedType !== "custom" && !matchesOption) {
      setSelectedType(options.at(0) ?? "custom");
    }
  }, [category, selectedType]);

  useEffect(() => {
    if (selectedType !== "custom") {
      setCustomType("");
    }
  }, [selectedType]);

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
              <Label htmlFor="technik-category">Kategorie</Label>
              <Select
                value={category}
                onValueChange={(value) =>
                  setCategory(value as TechnikInventoryCategory)
                }
              >
                <SelectTrigger id="technik-category">
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {TECH_INVENTORY_CATEGORIES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <div className="grid gap-1.5 sm:col-span-2">
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
              <Select
                value={selectedType}
                onValueChange={(value) => setSelectedType(value)}
              >
                <SelectTrigger id={`technik-type-${category}`}>
                  <SelectValue placeholder="Typ wählen" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Eigener Typ …</SelectItem>
                </SelectContent>
              </Select>
              {selectedType === "custom" ? (
                <Input
                  className="mt-2"
                  name="itemType"
                  placeholder="Typ eintragen"
                  required
                  maxLength={120}
                  value={customType}
                  onChange={(event) => setCustomType(event.target.value)}
                />
              ) : (
                <input type="hidden" name="itemType" value={selectedType} />
              )}
              <p className="text-xs text-muted-foreground">
                Vorgeschlagene Typen passen zur gewählten Kategorie.
              </p>
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
