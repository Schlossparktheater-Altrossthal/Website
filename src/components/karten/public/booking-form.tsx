"use client";

import { useMemo, useState, useTransition } from "react";

import { bookTicketsAction, joinWaitlistAction } from "@/app/karten/actions";
import { QuantityStepper } from "@/components/karten/quantity-stepper";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { MailCheckIcon } from "@/components/ui/action-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPerformanceDateLong, formatPrice } from "@/lib/karten/constants";
import { cn } from "@/lib/utils";

export type PublicPerformance = {
  eventId: string;
  start: string;
  location: string | null;
  cancelled: boolean;
  bookable: boolean;
  salesClosed: boolean;
  free: number;
  level: "free" | "few" | "sold_out";
};

export type PublicCategory = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  needsSeat: boolean;
};

function statusLabel(row: PublicPerformance) {
  if (row.cancelled) return { text: "abgesagt", tone: "destructive" as const };
  if (row.salesClosed) return { text: "nur Abendkasse", tone: "muted" as const };
  if (row.level === "sold_out") return { text: "ausgebucht", tone: "destructive" as const };
  if (row.level === "few") return { text: `nur noch ${row.free} Plätze`, tone: "warning" as const };
  return { text: "Plätze frei", tone: "success" as const };
}

export function BookingForm({
  showId,
  performances,
  categories,
  initialEventId,
  maxTickets,
  privacyUrl,
}: {
  showId: string;
  performances: PublicPerformance[];
  categories: PublicCategory[];
  initialEventId: string | null;
  maxTickets: number;
  privacyUrl: string;
}) {
  const [eventId, setEventId] = useState<string | null>(
    performances.find((row) => row.eventId === initialEventId)?.eventId ?? null,
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [contact, setContact] = useState({ name: "", email: "", phone: "", note: "", website: "" });
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ kind: "booking" | "waitlist"; mailed: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = performances.find((row) => row.eventId === eventId) ?? null;
  const totals = useMemo(() => {
    let tickets = 0;
    let seats = 0;
    let cents = 0;
    for (const category of categories) {
      const quantity = quantities[category.id] ?? 0;
      tickets += quantity;
      if (category.needsSeat) seats += quantity;
      cents += quantity * category.priceCents;
    }
    return { tickets, seats, cents };
  }, [categories, quantities]);

  const waitlistMode =
    selected !== null && !selected.bookable && !selected.cancelled && !selected.salesClosed;
  const tooMany = selected?.bookable && totals.seats > selected.free;

  const submit = () => {
    setError(null);
    if (!selected) return;
    startTransition(async () => {
      if (waitlistMode) {
        const result = await joinWaitlistAction({
          eventId: selected.eventId,
          name: contact.name,
          email: contact.email,
          seats: Math.max(1, totals.tickets),
          privacy: privacy as true,
          website: contact.website,
        });
        if (result.ok) setDone({ kind: "waitlist", mailed: true });
        else setError(result.error);
        return;
      }
      const result = await bookTicketsAction({
        eventId: selected.eventId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        note: contact.note,
        items: Object.entries(quantities).map(([categoryId, quantity]) => ({
          categoryId,
          quantity,
        })),
        privacy: privacy as true,
        website: contact.website,
      });
      if (result.ok) setDone({ kind: "booking", mailed: result.data.mailed });
      else setError(result.error);
    });
  };

  if (done) {
    return (
      <Card className="space-y-3 py-8 text-center">
        <MailCheckIcon className="mx-auto h-10 w-10 text-primary" />
        {done.kind === "booking" ? (
          <>
            <h2 className="text-xl font-semibold">Fast geschafft – bitte bestätigen!</h2>
            <p className="text-sm text-muted-foreground">
              Wir haben dir eine Mail an <strong>{contact.email}</strong> geschickt. Klicke auf den
              Link darin, um die Reservierung zu bestätigen. Erst dann gelten die Karten.
            </p>
            {!done.mailed ? (
              <p className="text-sm text-warning">
                Die Mail konnte gerade nicht verschickt werden. Bitte melde dich bei uns.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Keine Mail? Schau im Spam-Ordner nach.
              </p>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">Du stehst auf der Warteliste</h2>
            <p className="text-sm text-muted-foreground">
              Werden Plätze frei, bekommst du sofort eine Mail. Wer dann zuerst bucht, bekommt sie.
            </p>
          </>
        )}
      </Card>
    );
  }

  if (performances.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Zurzeit sind keine Vorstellungen buchbar.
      </p>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Vorstellung wählen</h2>
        <div className="grid gap-2" role="radiogroup" aria-label="Vorstellung">
          {performances.map((row) => {
            const status = statusLabel(row);
            const active = row.eventId === eventId;
            const selectable = !row.cancelled && !row.salesClosed;
            return (
              <button
                key={row.eventId}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!selectable}
                onClick={() => setEventId(row.eventId)}
                className={cn(
                  "flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors",
                  active
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border/60 hover:border-primary/50",
                  !selectable && "cursor-not-allowed opacity-60",
                )}
              >
                <span>
                  <span className="block font-medium">
                    {formatPerformanceDateLong(new Date(row.start))}
                  </span>
                  {row.location ? (
                    <span className="block text-xs text-muted-foreground">{row.location}</span>
                  ) : null}
                </span>
                <Badge variant={status.tone} size="sm">
                  {status.text}
                </Badge>
              </button>
            );
          })}
        </div>
      </section>

      {selected ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            2. {waitlistMode ? "Wie viele Plätze brauchst du?" : "Karten"}
          </h2>
          {waitlistMode ? (
            <p className="text-sm text-muted-foreground">
              Diese Vorstellung ist ausgebucht. Trag dich in die Warteliste ein – wir melden uns,
              sobald Plätze frei werden.
            </p>
          ) : null}
          <Card size="sm" className="divide-y divide-border/60">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {category.priceCents > 0 ? formatPrice(category.priceCents) : "kostenlos"}
                    {category.description ? ` · ${category.description}` : ""}
                  </p>
                </div>
                <QuantityStepper
                  label={category.name}
                  value={quantities[category.id] ?? 0}
                  max={maxTickets}
                  onChange={(value) => setQuantities({ ...quantities, [category.id]: value })}
                />
              </div>
            ))}
          </Card>
          {totals.tickets > 0 && !waitlistMode ? (
            <p className="text-right text-sm">
              {totals.tickets} {totals.tickets === 1 ? "Karte" : "Karten"}
              {totals.cents > 0 ? (
                <>
                  {" "}
                  · <strong>{formatPrice(totals.cents)}</strong>{" "}
                  <span className="text-muted-foreground">(Bezahlung an der Abendkasse)</span>
                </>
              ) : null}
            </p>
          ) : null}
          {tooMany ? (
            <p className="text-sm text-destructive">
              Es sind nur noch {selected.free} Plätze frei.
            </p>
          ) : null}
          {totals.tickets > maxTickets ? (
            <p className="text-sm text-destructive">
              Online höchstens {maxTickets} Karten. Für größere Gruppen ruf uns bitte an.
            </p>
          ) : null}
        </section>
      ) : null}

      {selected && totals.tickets > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Auf welchen Namen?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="booking-name">Vor- und Nachname</Label>
              <Input
                id="booking-name"
                autoComplete="name"
                required
                value={contact.name}
                onChange={(event) => setContact({ ...contact, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-email">E-Mail</Label>
              <Input
                id="booking-email"
                type="email"
                autoComplete="email"
                required
                value={contact.email}
                onChange={(event) => setContact({ ...contact, email: event.target.value })}
              />
            </div>
            {!waitlistMode ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="booking-phone">Telefon (optional, für Rückfragen)</Label>
                  <Input
                    id="booking-phone"
                    type="tel"
                    autoComplete="tel"
                    value={contact.phone}
                    onChange={(event) => setContact({ ...contact, phone: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="booking-note">Hinweis (optional)</Label>
                  <Textarea
                    id="booking-note"
                    rows={2}
                    placeholder="z. B. Rollstuhl, Gehhilfe"
                    value={contact.note}
                    onChange={(event) => setContact({ ...contact, note: event.target.value })}
                  />
                </div>
              </>
            ) : null}
          </div>
          {/* Honeypot gegen Bots – für Menschen unsichtbar. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={contact.website}
                onChange={(event) => setContact({ ...contact, website: event.target.value })}
              />
            </label>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={privacy}
              onCheckedChange={(checked) => setPrivacy(checked === true)}
              className="mt-0.5"
            />
            <span>
              Ich bin einverstanden, dass meine Angaben für die Reservierung gespeichert werden. Sie
              werden nach der Saison gelöscht.{" "}
              <a href={privacyUrl} target="_blank" rel="noreferrer" className="underline">
                Datenschutz
              </a>
            </span>
          </label>
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <AsyncButton
            type="submit"
            size="lg"
            className="w-full sm:w-auto"
            isLoading={pending}
            loadingText="Wird gesendet …"
            disabled={!privacy || Boolean(tooMany) || totals.tickets > maxTickets}
          >
            {waitlistMode ? "Auf die Warteliste" : "Verbindlich reservieren"}
          </AsyncButton>
          {!waitlistMode ? (
            <p className="text-xs text-muted-foreground">
              Du bekommst eine Mail mit einem Bestätigungslink. Unbestätigte Reservierungen
              verfallen nach kurzer Zeit.
            </p>
          ) : null}
        </section>
      ) : null}
      <input type="hidden" name="show" value={showId} />
    </form>
  );
}
