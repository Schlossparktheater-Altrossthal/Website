"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
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
  updateTechnikInventoryItem,
  type TechnikInventoryActionState,
} from "./actions";
import { TECH_CATEGORY_LABEL, type TechnikInventoryCategory } from "./config";

const INITIAL_STATE: TechnikInventoryActionState = { status: "idle" };

function formatDateInput(value: Date | null | undefined): string {
  if (!value) {
    return "";
  }

  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface EditTechnikItemDialogProps {
  item: {
    id: string;
    sku: string;
    category: TechnikInventoryCategory;
    name: string;
    manufacturer: string | null;
    itemType: string | null;
    quantity: number;
    acquisitionCost: number | null;
    totalValue: number | null;
    purchaseDate: Date | null;
    lastUsedAt: Date | null;
    lastInventoryAt: Date | null;
    details: string | null;
  };
}

export function EditTechnikItemDialog({ item }: EditTechnikItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateTechnikInventoryItem,
    INITIAL_STATE,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const categoryLabel = TECH_CATEGORY_LABEL[item.category];

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
      setErrorMessage(null);
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
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Inventarposten ${item.sku} bearbeiten`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inventarposten bearbeiten</DialogTitle>
          <DialogDescription>
            Aktualisiere Details für {categoryLabel}. Änderungen werden direkt
            gespeichert.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="category" value={item.category} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-manufacturer-edit-${item.id}`}>
                Hersteller
              </Label>
              <Input
                id={`technik-manufacturer-edit-${item.id}`}
                name="manufacturer"
                defaultValue={item.manufacturer ?? ""}
                required
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-name-edit-${item.id}`}>
                Modellbezeichnung
              </Label>
              <Input
                id={`technik-name-edit-${item.id}`}
                name="name"
                defaultValue={item.name}
                required
                maxLength={160}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-type-edit-${item.id}`}>Typ</Label>
              <Input
                id={`technik-type-edit-${item.id}`}
                name="itemType"
                defaultValue={item.itemType ?? ""}
                required
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-quantity-edit-${item.id}`}>
                Menge
              </Label>
              <Input
                id={`technik-quantity-edit-${item.id}`}
                name="quantity"
                type="number"
                min={0}
                step={1}
                defaultValue={item.quantity}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-acquisition-edit-${item.id}`}>
                Kosten bei Anschaffung (EUR)
              </Label>
              <Input
                id={`technik-acquisition-edit-${item.id}`}
                name="acquisitionCost"
                type="number"
                min={0}
                step="0.01"
                defaultValue={item.acquisitionCost ?? ""}
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-total-edit-${item.id}`}>
                Gesamtwert (EUR)
              </Label>
              <Input
                id={`technik-total-edit-${item.id}`}
                name="totalValue"
                type="number"
                min={0}
                step="0.01"
                defaultValue={item.totalValue ?? ""}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-purchase-edit-${item.id}`}>
                Kaufdatum
              </Label>
              <Input
                id={`technik-purchase-edit-${item.id}`}
                name="purchaseDate"
                type="date"
                defaultValue={formatDateInput(item.purchaseDate)}
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-lastUsed-edit-${item.id}`}>
                Zuletzt benutzt
              </Label>
              <Input
                id={`technik-lastUsed-edit-${item.id}`}
                name="lastUsedAt"
                type="date"
                defaultValue={formatDateInput(item.lastUsedAt)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`technik-lastInventory-edit-${item.id}`}>
                Letzte Inventur
              </Label>
              <Input
                id={`technik-lastInventory-edit-${item.id}`}
                name="lastInventoryAt"
                type="date"
                defaultValue={formatDateInput(item.lastInventoryAt)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`technik-notes-edit-${item.id}`}>Anmerkungen</Label>
            <Textarea
              id={`technik-notes-edit-${item.id}`}
              name="details"
              defaultValue={item.details ?? ""}
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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Speichere …" : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
