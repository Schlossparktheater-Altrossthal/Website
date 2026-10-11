"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  officeCancelReservationAction,
  officeConfirmReservationAction,
  officeResendTicketAction,
  officeRestoreReservationAction,
  officeSetPaymentAction,
} from "@/app/kartenbuero/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, EditIcon, MailIcon, TrashIcon } from "@/components/ui/action-icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  describeItems,
  formatPerformanceDate,
  formatPrice,
  PAYMENT_STATUS_LABELS,
  RESERVATION_SOURCE_LABELS,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_TONES,
} from "@/lib/karten/constants";
import { cn } from "@/lib/utils";

import type { OfficeReservation } from "./types";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export function ReservationRow({
  reservation,
  performanceStart,
  onEdit,
  onChanged,
}: {
  reservation: OfficeReservation;
  /** Bei der Suche über alle Vorstellungen wird das Datum mit angezeigt. */
  performanceStart?: string | null;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pending, startTransition] = useTransition();
  const inactive = reservation.status === "cancelled" || reservation.status === "expired";

  const run = (operation: () => Promise<Result>) =>
    startTransition(async () => {
      const result = await operation();
      if (result.ok) {
        if (result.message) toast.success(result.message);
        onChanged();
      } else toast.error(result.error);
    });

  return (
    <li className={cn("px-3 py-2", inactive && "opacity-60")}>
      <button
        type="button"
        className="flex min-h-10 w-full items-center gap-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("font-medium", inactive && "line-through")}>
              {reservation.name}
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {describeItems(reservation.items)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {performanceStart ? (
              <span>{formatPerformanceDate(new Date(performanceStart))}</span>
            ) : null}
            <span className="font-mono">{reservation.code}</span>
            {reservation.phone ? <span>{reservation.phone}</span> : null}
            {reservation.memberName ? <span>über {reservation.memberName}</span> : null}
            {reservation.note ? <span className="text-warning">„{reservation.note}“</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {reservation.status !== "confirmed" ? (
            <Badge variant={RESERVATION_STATUS_TONES[reservation.status]} size="sm">
              {RESERVATION_STATUS_LABELS[reservation.status]}
            </Badge>
          ) : null}
          <Badge variant="muted" size="sm">
            {RESERVATION_SOURCE_LABELS[reservation.source]}
          </Badge>
          {reservation.totalCents > 0 ? (
            <Badge variant={reservation.paymentStatus === "paid" ? "success" : "outline"} size="sm">
              {formatPrice(reservation.totalCents)}{" "}
              {PAYMENT_STATUS_LABELS[reservation.paymentStatus]}
            </Badge>
          ) : null}
          {reservation.checkedInCount > 0 ? (
            <Badge variant="info" size="sm">
              {reservation.checkedInCount} da
            </Badge>
          ) : null}
          <ChevronDownIcon className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open ? (
        <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-3 text-sm">
          {reservation.email ? <p className="text-muted-foreground">{reservation.email}</p> : null}
          {reservation.internalNote ? (
            <p>
              <span className="text-muted-foreground">Intern:</span> {reservation.internalNote}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!inactive ? (
              <Button size="xs" variant="outline" onClick={onEdit}>
                <EditIcon /> Ändern
              </Button>
            ) : null}
            {reservation.status === "pending" ? (
              <Button
                size="xs"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => officeConfirmReservationAction(reservation.id))}
              >
                Jetzt bestätigen
              </Button>
            ) : null}
            {reservation.totalCents > 0 && !inactive ? (
              <Button
                size="xs"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    officeSetPaymentAction(
                      reservation.id,
                      reservation.paymentStatus === "paid" ? "open" : "paid",
                    ),
                  )
                }
              >
                {reservation.paymentStatus === "paid"
                  ? "Als offen markieren"
                  : "Als bezahlt markieren"}
              </Button>
            ) : null}
            {reservation.email && reservation.status === "confirmed" ? (
              <Button
                size="xs"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => officeResendTicketAction(reservation.id))}
              >
                <MailIcon /> Ticket erneut senden
              </Button>
            ) : null}
            {inactive ? (
              <Button
                size="xs"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => officeRestoreReservationAction(reservation.id))}
              >
                Wiederherstellen
              </Button>
            ) : (
              <Button size="xs" variant="ghost" onClick={() => setCancelling(true)}>
                <TrashIcon /> Stornieren
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Reservierung von ${reservation.name} stornieren?`}
        description={
          reservation.email
            ? "Die Plätze werden wieder frei, der Gast bekommt eine Mail."
            : "Die Plätze werden wieder frei."
        }
        confirmLabel="Stornieren"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setCancelling(false)}
        onConfirm={() => {
          setCancelling(false);
          run(() =>
            officeCancelReservationAction(reservation.id, {
              reason: "Storniert durch das Kartenbüro",
              notify: Boolean(reservation.email),
            }),
          );
        }}
      />
    </li>
  );
}
