import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { ConfirmReservationButton } from "@/components/karten/public/confirm-button";
import { ManageReservation } from "@/components/karten/public/manage-reservation";
import { PrintButton } from "@/components/karten/public/print-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { findReservationByToken } from "@/lib/karten/booking";
import {
  describeItems,
  formatPerformanceDateLong,
  formatPrice,
  PAYMENT_STATUS_LABELS,
  PUBLIC_TICKETS_PATH,
} from "@/lib/karten/constants";
import { showDisplayTitle } from "@/lib/karten/mails";
import { loadPublicShow } from "@/lib/karten/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deine Reservierung",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function ReservationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const reservation = await findReservationByToken(token);
  if (!reservation) notFound();

  const now = new Date();
  const title = showDisplayTitle(reservation.show);
  const when = formatPerformanceDateLong(reservation.event.start);
  const past = reservation.event.start <= now;
  const eventCancelled = reservation.event.status === "CANCELLED";

  const details = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Vorstellung</dt>
      <dd className="font-medium">{when}</dd>
      {reservation.event.location ? (
        <>
          <dt className="text-muted-foreground">Ort</dt>
          <dd>{reservation.event.location}</dd>
        </>
      ) : null}
      <dt className="text-muted-foreground">Name</dt>
      <dd>{reservation.name}</dd>
      <dt className="text-muted-foreground">Karten</dt>
      <dd>{describeItems(reservation.items)}</dd>
      {reservation.totalCents > 0 ? (
        <>
          <dt className="text-muted-foreground">Preis</dt>
          <dd>
            {formatPrice(reservation.totalCents)} (
            {PAYMENT_STATUS_LABELS[reservation.paymentStatus]}
            {reservation.paymentStatus === "open" ? ", an der Abendkasse" : ""})
          </dd>
        </>
      ) : null}
      <dt className="text-muted-foreground">Code</dt>
      <dd className="font-mono tracking-widest">{reservation.code}</dd>
    </dl>
  );

  if (reservation.status === "cancelled" || reservation.status === "expired") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Card className="space-y-3">
          <Badge variant={reservation.status === "cancelled" ? "destructive" : "muted"}>
            {reservation.status === "cancelled" ? "Storniert" : "Verfallen – nicht bestätigt"}
          </Badge>
          {details}
        </Card>
        <Link href={`${PUBLIC_TICKETS_PATH}/${reservation.show.id}`} className="text-sm underline">
          Neue Karten reservieren
        </Link>
      </div>
    );
  }

  if (reservation.status === "pending") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Card className="space-y-4">
          <p>Bitte bestätige deine Reservierung – erst dann gelten die Karten.</p>
          {details}
          <ConfirmReservationButton token={token} />
        </Card>
      </div>
    );
  }

  const qrSvg = await QRCode.toString(reservation.code, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
  });
  const publicShow = past ? null : await loadPublicShow(reservation.show.id, now);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold print:text-xl">{title}</h1>
      {eventCancelled ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Diese Vorstellung ist leider abgesagt. Unten kannst du kostenlos auf eine andere
          Vorstellung umbuchen.
        </div>
      ) : null}
      <Card variant="plain" className="space-y-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:gap-6">
          <div
            className="w-48 shrink-0 rounded-md bg-white p-2"
            // QR-Code aus der eigenen Bibliothek, kein Fremdinhalt.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
            aria-label={`QR-Code ${reservation.code}`}
            role="img"
          />
          <div className="w-full space-y-3">
            <Badge variant="success">Bestätigt</Badge>
            {details}
            <p className="text-xs text-muted-foreground">
              Zeig den QR-Code am Einlass – auf dem Handy oder ausgedruckt. Deinen Namen zu nennen
              reicht auch.
            </p>
          </div>
        </div>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </Card>
      {!past && publicShow && reservation.source !== "free_ticket" ? (
        <div className="print:hidden">
          <ManageReservation
            token={token}
            currentEventId={reservation.eventId}
            quantities={Object.fromEntries(
              reservation.items
                .filter((item) => item.categoryId)
                .map((item) => [item.categoryId as string, item.quantity]),
            )}
            performances={publicShow.performances.map((row) => ({
              eventId: row.eventId,
              start: row.start.toISOString(),
              free: row.free,
              selectable: !row.cancelled && !row.salesClosed,
            }))}
            categories={publicShow.categories.map((category) => ({
              id: category.id,
              name: category.name,
              priceCents: category.priceCents,
            }))}
            seats={reservation.seats}
          />
        </div>
      ) : null}
    </div>
  );
}
