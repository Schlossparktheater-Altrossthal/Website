"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { officeUpdateReservationAction } from "@/app/kartenbuero/actions";
import { QuantityStepper } from "@/components/karten/quantity-stepper";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPerformanceDate } from "@/lib/karten/constants";

import type { OfficeCategory, OfficePerformance, OfficeReservation } from "./types";

export function EditReservationDialog({
  reservation,
  performances,
  categories,
  onClose,
  onSaved,
}: {
  reservation: OfficeReservation;
  performances: OfficePerformance[];
  categories: OfficeCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isFree = reservation.source === "free_ticket";
  const [eventId, setEventId] = useState(reservation.eventId);
  const [fields, setFields] = useState({
    name: reservation.name,
    phone: reservation.phone ?? "",
    email: reservation.email ?? "",
    note: reservation.note ?? "",
    internalNote: reservation.internalNote ?? "",
  });
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      reservation.items.flatMap((item) =>
        item.categoryId ? [[item.categoryId, item.quantity]] : [],
      ),
    ),
  );
  const [freeTickets, setFreeTickets] = useState(
    reservation.items.reduce((sum, item) => sum + item.quantity, 0),
  );
  const [overbook, setOverbook] = useState(false);
  const [sendMail, setSendMail] = useState(false);
  const [pending, startTransition] = useTransition();
  // Kategorien der Buchung, die inzwischen inaktiv sind, bleiben bearbeitbar.
  const visibleCategories = [
    ...categories,
    ...reservation.items
      .filter(
        (item) =>
          item.categoryId && !categories.some((category) => category.id === item.categoryId),
      )
      .map((item) => ({
        id: item.categoryId ?? "",
        name: item.label,
        priceCents: 0,
        needsSeat: true,
      })),
  ];

  const save = () =>
    startTransition(async () => {
      const result = await officeUpdateReservationAction(reservation.id, {
        ...fields,
        eventId: eventId !== reservation.eventId ? eventId : undefined,
        ...(isFree
          ? { freeTickets }
          : {
              items: Object.entries(quantities).map(([categoryId, quantity]) => ({
                categoryId,
                quantity,
              })),
            }),
        allowOverbook: overbook,
        sendMail,
      });
      if (result.ok) {
        toast.success(result.message ?? "Gespeichert.");
        onSaved();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <ModalFormDialog
      title={`Reservierung ${reservation.code}`}
      open
      onOpenChange={(open) => (!open ? onClose() : undefined)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <AsyncButton isLoading={pending} onClick={save}>
            Speichern
          </AsyncButton>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="space-y-1.5">
          <Label>Vorstellung</Label>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {performances.map((row) => (
                <SelectItem key={row.eventId} value={row.eventId} disabled={row.cancelled}>
                  {formatPerformanceDate(new Date(row.start))} – {row.freeOffice} frei
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={fields.name}
              onChange={(event) => setFields({ ...fields, name: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">Telefon</Label>
            <Input
              id="edit-phone"
              value={fields.phone}
              onChange={(event) => setFields({ ...fields, phone: event.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-email">E-Mail</Label>
            <Input
              id="edit-email"
              type="email"
              value={fields.email}
              onChange={(event) => setFields({ ...fields, email: event.target.value })}
            />
          </div>
        </div>
        <div className="divide-y divide-border/60 rounded-md bg-muted/40 px-3">
          {isFree ? (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm">Freikarten</span>
              <QuantityStepper label="Freikarten" value={freeTickets} onChange={setFreeTickets} />
            </div>
          ) : (
            visibleCategories.map((category) => (
              <div key={category.id} className="flex items-center justify-between py-1.5">
                <span className="text-sm">{category.name}</span>
                <QuantityStepper
                  label={category.name}
                  value={quantities[category.id] ?? 0}
                  onChange={(value) => setQuantities({ ...quantities, [category.id]: value })}
                />
              </div>
            ))
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-note">Notiz des Gastes</Label>
          <Input
            id="edit-note"
            value={fields.note}
            onChange={(event) => setFields({ ...fields, note: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-internal">Interne Notiz (sieht der Gast nicht)</Label>
          <Input
            id="edit-internal"
            value={fields.internalNote}
            onChange={(event) => setFields({ ...fields, internalNote: event.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={overbook} onCheckedChange={(value) => setOverbook(value === true)} />
            überbuchen erlauben
          </label>
          {fields.email ? (
            <label className="flex items-center gap-2">
              <Checkbox
                checked={sendMail}
                onCheckedChange={(value) => setSendMail(value === true)}
              />
              geändertes Ticket mailen
            </label>
          ) : null}
        </div>
        <button type="submit" hidden />
      </form>
    </ModalFormDialog>
  );
}
