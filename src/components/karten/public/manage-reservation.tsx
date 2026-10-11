"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { guestCancelTicketsAction, guestUpdateTicketsAction } from "@/app/karten/actions";
import { QuantityStepper } from "@/components/karten/quantity-stepper";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPerformanceDate, formatPrice } from "@/lib/karten/constants";

type Performance = { eventId: string; start: string; free: number; selectable: boolean };
type Category = { id: string; name: string; priceCents: number };

export function ManageReservation({
  token,
  currentEventId,
  quantities: initialQuantities,
  performances,
  categories,
  seats,
}: {
  token: string;
  currentEventId: string;
  quantities: Record<string, number>;
  performances: Performance[];
  categories: Category[];
  seats: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState(currentEventId);
  const [quantities, setQuantities] = useState(initialQuantities);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await guestUpdateTicketsAction(token, {
        eventId: eventId !== currentEventId ? eventId : undefined,
        items: Object.entries(quantities).map(([categoryId, quantity]) => ({
          categoryId,
          quantity,
        })),
      });
      if (result.ok) {
        toast.success(result.message ?? "Geändert.");
        setOpen(false);
        router.refresh();
      } else toast.error(result.error);
    });

  const cancel = () =>
    startTransition(async () => {
      const result = await guestCancelTicketsAction(token);
      if (result.ok) {
        toast.success(result.message ?? "Storniert.");
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Reservierung ändern</h2>
        <div className="flex gap-2">
          {!open ? (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Ändern
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(true)}>
            Stornieren
          </Button>
        </div>
      </div>
      {open ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Vorstellung</p>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {performances.map((row) => (
                  <SelectItem
                    key={row.eventId}
                    value={row.eventId}
                    disabled={
                      row.eventId !== currentEventId && (!row.selectable || row.free < seats)
                    }
                  >
                    {formatPerformanceDate(new Date(row.start))}
                    {row.eventId === currentEventId ? " (aktuell)" : ` – ${row.free} frei`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="divide-y divide-border/60">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {category.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    {category.priceCents > 0 ? formatPrice(category.priceCents) : ""}
                  </span>
                </span>
                <QuantityStepper
                  label={category.name}
                  value={quantities[category.id] ?? 0}
                  onChange={(value) => setQuantities({ ...quantities, [category.id]: value })}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <AsyncButton isLoading={pending} onClick={save}>
              Änderung speichern
            </AsyncButton>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Du kannst die Anzahl ändern, auf eine andere Vorstellung umbuchen oder stornieren.
        </p>
      )}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Reservierung stornieren?"
        description="Die Plätze werden für andere freigegeben."
        confirmLabel="Stornieren"
        cancelLabel="Behalten"
        variant="destructive"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          cancel();
        }}
      />
    </Card>
  );
}
