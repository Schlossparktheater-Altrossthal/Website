"use client";

import { forwardRef, useImperativeHandle, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { officeCreateReservationAction } from "@/app/kartenbuero/actions";
import { QuantityStepper } from "@/components/karten/quantity-stepper";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CloseIcon, PlusIcon } from "@/components/ui/action-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPerformanceDate, formatPrice } from "@/lib/karten/constants";

import type { OfficeCategory, OfficePerformance } from "./types";

export type QuickEntryHandle = { focus: () => void };

type Line = { key: number; eventId: string; quantities: Record<string, number> };

const EMPTY = { name: "", phone: "", email: "", note: "" };

function lineTotals(line: Line, categories: OfficeCategory[]) {
  let seats = 0;
  let tickets = 0;
  let cents = 0;
  for (const category of categories) {
    const quantity = line.quantities[category.id] ?? 0;
    tickets += quantity;
    if (category.needsSeat) seats += quantity;
    cents += quantity * category.priceCents;
  }
  return { seats, tickets, cents };
}

/**
 * Telefonbuchung in einem Zug: Name → Vorstellung(en) mit Anzahlen → Telefon → Enter. Wer mehrere
 * Termine in unterschiedlicher Besetzung möchte, bekommt je Vorstellung eine Zeile. Nach dem
 * Speichern steht der Cursor wieder im Namensfeld für den nächsten Anruf.
 */
export const QuickEntry = forwardRef<
  QuickEntryHandle,
  {
    performances: OfficePerformance[];
    defaultEventId: string | null;
    categories: OfficeCategory[];
    onCreated: () => void;
  }
>(function QuickEntry({ performances, defaultEventId, categories, onCreated }, ref) {
  const nameRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(1);
  const bookable = performances.filter((row) => row.configured && !row.cancelled);
  const firstEvent = defaultEventId ?? bookable[0]?.eventId ?? "";
  const [fields, setFields] = useState(EMPTY);
  const [lines, setLines] = useState<Line[]>([{ key: 0, eventId: firstEvent, quantities: {} }]);
  const [paid, setPaid] = useState(false);
  const [sendMail, setSendMail] = useState(true);
  const [overbook, setOverbook] = useState(false);
  const [pending, startTransition] = useTransition();

  useImperativeHandle(ref, () => ({ focus: () => nameRef.current?.focus() }), []);

  const byId = new Map(performances.map((row) => [row.eventId, row]));
  const totals = lines.map((line) => lineTotals(line, categories));
  const ticketSum = totals.reduce((sum, entry) => sum + entry.tickets, 0);
  const centSum = totals.reduce((sum, entry) => sum + entry.cents, 0);
  const exceeds = lines.some(
    (line, index) => totals[index].seats > (byId.get(line.eventId)?.freeOffice ?? 0),
  );
  const usedEvents = new Set(lines.map((line) => line.eventId));

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const addLine = () => {
    const next = bookable.find((row) => !usedEvents.has(row.eventId))?.eventId ?? "";
    setLines((current) => [...current, { key: nextKey.current++, eventId: next, quantities: {} }]);
  };

  const reset = () => {
    setFields(EMPTY);
    setLines([{ key: nextKey.current++, eventId: firstEvent, quantities: {} }]);
    setPaid(false);
    setOverbook(false);
  };

  const submit = () => {
    if (!fields.name.trim()) {
      nameRef.current?.focus();
      toast.error("Bitte einen Namen angeben.");
      return;
    }
    const filled = lines.filter((line, index) => line.eventId && totals[index].tickets > 0);
    if (filled.length === 0) {
      toast.error("Bitte mindestens eine Karte angeben.");
      return;
    }
    startTransition(async () => {
      const result = await officeCreateReservationAction({
        ...fields,
        lines: filled.map((line) => ({
          eventId: line.eventId,
          items: Object.entries(line.quantities).map(([categoryId, quantity]) => ({
            categoryId,
            quantity,
          })),
        })),
        paid,
        allowOverbook: overbook,
        sendMail,
      });
      if (result.ok) {
        toast.success(result.message ?? "Reserviert.", {
          description: result.data.mailed > 0 ? "Ticket per Mail gesendet." : undefined,
        });
        reset();
        onCreated();
        nameRef.current?.focus();
      } else {
        toast.error(result.error);
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

        {lines.map((line, index) => {
          const performance = byId.get(line.eventId);
          const lineTotal = totals[index];
          const over = performance ? lineTotal.seats > performance.freeOffice : false;
          return (
            <div key={line.key} className="space-y-1 rounded-md bg-muted/40 p-2">
              <div className="flex items-center gap-1">
                <Select
                  value={line.eventId}
                  onValueChange={(eventId) => updateLine(line.key, { eventId })}
                >
                  <SelectTrigger className="h-9 flex-1" aria-label={`Vorstellung ${index + 1}`}>
                    <SelectValue placeholder="Vorstellung wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookable.map((row) => (
                      <SelectItem
                        key={row.eventId}
                        value={row.eventId}
                        disabled={row.eventId !== line.eventId && usedEvents.has(row.eventId)}
                      >
                        {formatPerformanceDate(new Date(row.start))} · {row.freeOffice} frei
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Vorstellung entfernen"
                    onClick={() =>
                      setLines((current) => current.filter((entry) => entry.key !== line.key))
                    }
                  >
                    <CloseIcon />
                  </Button>
                ) : null}
              </div>
              <div className="divide-y divide-border/60 px-1">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-2 py-1">
                    <span className="text-sm">
                      {category.name}
                      {category.priceCents > 0 ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {formatPrice(category.priceCents)}
                        </span>
                      ) : null}
                    </span>
                    <QuantityStepper
                      label={`${category.name}, Vorstellung ${index + 1}`}
                      value={line.quantities[category.id] ?? 0}
                      onChange={(value) =>
                        updateLine(line.key, {
                          quantities: { ...line.quantities, [category.id]: value },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              {over && performance ? (
                <p className="px-1 text-xs text-warning">
                  Nur noch {performance.freeOffice} Plätze frei.
                </p>
              ) : null}
            </div>
          );
        })}
        {bookable.length > lines.length ? (
          <Button type="button" size="xs" variant="ghost" onClick={addLine}>
            <PlusIcon /> Weitere Vorstellung
          </Button>
        ) : null}

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
            {ticketSum > 0
              ? `${ticketSum} Karten${centSum > 0 ? ` · ${formatPrice(centSum)}` : ""}`
              : ""}
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
      </form>
    </Card>
  );
});
