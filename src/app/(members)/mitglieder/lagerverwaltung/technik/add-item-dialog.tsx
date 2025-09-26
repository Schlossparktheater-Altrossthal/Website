"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

  const categoryLabel = TECH_CATEGORY_LABEL[category];
  const prefix = TECH_CATEGORY_PREFIX[category];

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
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
          <div className="grid gap-1.5">
            <Label htmlFor={`technik-name-${category}`}>Artikelname</Label>
            <Input
              id={`technik-name-${category}`}
              name="name"
              placeholder="z. B. LED-Fluter"
              required
              maxLength={160}
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
              defaultValue={1}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`technik-details-${category}`}>Details</Label>
            <Textarea
              id={`technik-details-${category}`}
              name="details"
              placeholder="Besonderheiten, Zubehör, Zustand …"
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Optional: kurze Beschreibung oder Hinweise für das Team.
            </p>
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
