"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { officeCreateReservationAction } from "@/app/kartenbuero/actions";
import { QuantityStepper } from "@/components/karten/quantity-stepper";
import { AsyncButton } from "@/components/ui/async-button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/karten/constants";

import type { OfficeCategory, OfficePerformance } from "./types";

export type QuickEntryHandle = { focus: () => void };

const EMPTY = { name: "", phone: "", email: "", note: "", internalNote: "" };

/**
 * Telefonbuchung in einem Zug: Name → Anzahlen → Telefon → Enter. Nach dem Speichern steht der
 * Cursor wieder im Namensfeld für den nächsten Anruf.
 */
export const QuickEntry = forwardRef<
  QuickEntryHandle,
  {
    performance: OfficePerformance;
    categories: OfficeCategory[];
    onCreated: () => void;
  }
>(function QuickEntry({ performance, categories, onCreated }, ref) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState(EMPTY);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paid, setPaid] = useState(false);
  const [sendMail, setSendMail] = useState(true);
  const [overbook, setOverbook] = useState(false);
  const [pending, startTransition] = useTransition();

  useImperativeHandle(ref, () => ({ focus: () => nameRef.current?.focus() }), []);

  const totals = useMemo(() => {
    let seats = 0;
    let tickets = 0;
    let cents = 0;
    for (const category of categories) {
      const quantity = quantities[category.id] ?? 0;
      tickets += quantity;
      if (category.needsSeat) seats += quantity;
      cents += quantity * category.priceCents;
    }
    return { seats, tickets, cents };
  }, [categories, quantities]);

  const exceeds = totals.seats > performance.freeOffice;

  const submit = () => {
    if (!fields.name.trim()) {
      nameRef.current?.focus();
      toast.error("Bitte einen Namen angeben.");
      return;
    }
    if (totals.tickets === 0) {
      toast.error("Bitte mindestens eine Karte angeben.");
      return;
    }
    startTransition(async () => {
      const result = await officeCreateReservationAction({
        eventId: performance.eventId,
        ...fields,
        items: Object.entries(quantities).map(([categoryId, quantity]) => ({
          categoryId,
          quantity,
        })),
        paid,
        allowOverbook: overbook,
        sendMail,
      });
      if (result.ok) {
        toast.success(result.message ?? "Reserviert.", {
          description: result.data.mailed ? "Ticket per Mail gesendet." : undefined,
        });
        setFields(EMPTY);
        setQuantities({});
        setPaid(false);
        setOverbook(false);
        onCreated();
        nameRef.current?.focus();
      } else {
        toast.error(result.error);
        if (result.code === "SOLD_OUT") setOverbook(false);
      }
    });
  };

  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Neue Reservierung</h2>
          <span className="text-xs text-muted-foreground">Enter speichert</span>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="office-name">Name</Label>
          <Input
            id="office-name"
            ref={nameRef}
            autoComplete="off"
            value={fields.name}
            onChange={(event) => setFields({ ...fields, name: event.target.value })}
          />
        </div>
        <div className="divide-y divide-border/60 rounded-md bg-muted/40 px-3">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-sm">
                {category.name}
                {category.priceCents > 0 ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {formatPrice(category.priceCents)}
                  </span>
                ) : null}
              </span>
              <QuantityStepper
                label={category.name}
                value={quantities[category.id] ?? 0}
                onChange={(value) => setQuantities({ ...quantities, [category.id]: value })}
              />
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="office-phone">Telefon</Label>
            <Input
              id="office-phone"
              type="tel"
              autoComplete="off"
              value={fields.phone}
              onChange={(event) => setFields({ ...fields, phone: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="office-email">E-Mail (optional)</Label>
            <Input
              id="office-email"
              type="email"
              autoComplete="off"
              value={fields.email}
              onChange={(event) => setFields({ ...fields, email: event.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="office-note">Notiz (z. B. Rollstuhl)</Label>
          <Input
            id="office-note"
            autoComplete="off"
            value={fields.note}
            onChange={(event) => setFields({ ...fields, note: event.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={paid} onCheckedChange={(value) => setPaid(value === true)} />
            bezahlt
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={sendMail} onCheckedChange={(value) => setSendMail(value === true)} />
            Ticket mailen
          </label>
          {exceeds ? (
            <label className="flex items-center gap-2 text-warning">
              <Checkbox
                checked={overbook}
                onCheckedChange={(value) => setOverbook(value === true)}
              />
              trotzdem (überbuchen)
            </label>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm tabular-nums text-muted-foreground">
            {totals.tickets > 0
              ? `${totals.tickets} Karten${totals.cents > 0 ? ` · ${formatPrice(totals.cents)}` : ""}`
              : `${performance.freeOffice} Plätze frei`}
          </span>
          <AsyncButton
            type="submit"
            isLoading={pending}
            loadingText="Speichert …"
            disabled={exceeds && !overbook}
          >
            Reservieren
          </AsyncButton>
        </div>
        {exceeds ? (
          <p className="text-sm text-warning">Nur noch {performance.freeOffice} Plätze frei.</p>
        ) : null}
      </form>
    </Card>
  );
});
