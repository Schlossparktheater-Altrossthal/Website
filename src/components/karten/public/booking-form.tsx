"use client";

import { useMemo, useState, useTransition } from "react";

import { bookTicketsAction, joinWaitlistAction } from "@/app/karten/actions";
import { QuantityStepper } from "@/components/karten/quantity-stepper";
import { AsyncButton } from "@/components/ui/async-button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckIcon, MailCheckIcon } from "@/components/ui/action-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_TIME_ZONE } from "@/lib/format/date";
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

const tileFormat = {
  weekday: new Intl.DateTimeFormat("de-DE", { timeZone: DEFAULT_TIME_ZONE, weekday: "short" }),
  day: new Intl.DateTimeFormat("de-DE", { timeZone: DEFAULT_TIME_ZONE, day: "numeric" }),
  month: new Intl.DateTimeFormat("de-DE", { timeZone: DEFAULT_TIME_ZONE, month: "short" }),
  time: new Intl.DateTimeFormat("de-DE", {
    timeZone: DEFAULT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }),
};

function statusLabel(row: PublicPerformance) {
  if (row.cancelled) return { text: "abgesagt", tone: "text-destructive" };
  if (row.salesClosed) return { text: "nur Abendkasse", tone: "text-muted-foreground" };
  if (row.level === "sold_out") return { text: "ausgebucht", tone: "text-destructive" };
  if (row.level === "few") return { text: `noch ${row.free} Plätze`, tone: "text-warning" };
  return { text: "Plätze frei", tone: "text-success" };
}

/** Kompakte Datumskachel; mehrere lassen sich auswählen. */
function PerformanceTile({
  row,
  checked,
  onToggle,
}: {
  row: PublicPerformance;
  checked: boolean;
  onToggle: () => void;
}) {
  const start = new Date(row.start);
  const status = statusLabel(row);
  const selectable = !row.cancelled && !row.salesClosed;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`${formatPerformanceDateLong(start)}, ${status.text}`}
      disabled={!selectable}
      onClick={onToggle}
      className={cn(
        "relative flex flex-col items-center rounded-lg border bg-card px-1 pb-2 pt-3 text-center transition-colors",
        checked
          ? "border-primary ring-2 ring-primary/30"
          : "border-border/60 hover:border-primary/50",
        !selectable && "cursor-not-allowed opacity-50",
      )}
    >
      {checked ? (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="h-3 w-3" />
        </span>
      ) : null}
      <span className="text-xs font-medium uppercase text-muted-foreground">
        {tileFormat.weekday.format(start).replace(".", "")}
      </span>
      <span className="text-2xl font-semibold leading-tight tabular-nums">
        {tileFormat.day.format(start).replace(".", "")}
      </span>
      <span className="text-xs text-muted-foreground">{tileFormat.month.format(start)}</span>
      <span className="mt-1 text-sm font-medium tabular-nums">
        {tileFormat.time.format(start)} Uhr
      </span>
      <span className={cn("mt-0.5 text-[11px] font-medium leading-tight", status.tone)}>
        {status.text}
      </span>
    </button>
  );
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
  const [eventIds, setEventIds] = useState<string[]>(() => {
    const initial = performances.find(
      (row) => row.eventId === initialEventId && !row.cancelled && !row.salesClosed,
    );
    return initial ? [initial.eventId] : [];
  });
  /** Anzahlen je Vorstellung und Kartenart: quantities[eventId][categoryId]. */
  const [quantities, setQuantities] = useState<Record<string, Record<string, number>>>({});
  const [contact, setContact] = useState({ name: "", email: "", phone: "", note: "", website: "" });
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    kind: "booking" | "waitlist";
    mailed: boolean;
    count: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => performances.filter((row) => eventIds.includes(row.eventId)),
    [performances, eventIds],
  );
  const perEvent = useMemo(() => {
    const result = new Map<string, { tickets: number; seats: number; cents: number }>();
    for (const row of selected) {
      const counts = quantities[row.eventId] ?? {};
      let tickets = 0;
      let seats = 0;
      let cents = 0;
      for (const category of categories) {
        const quantity = counts[category.id] ?? 0;
        tickets += quantity;
        if (category.needsSeat) seats += quantity;
        cents += quantity * category.priceCents;
      }
      result.set(row.eventId, { tickets, seats, cents });
    }
    return result;
  }, [categories, quantities, selected]);
  const totals = useMemo(() => {
    let tickets = 0;
    let cents = 0;
    for (const entry of perEvent.values()) {
      tickets += entry.tickets;
      cents += entry.cents;
    }
    return { tickets, cents };
  }, [perEvent]);

  // Ausgebuchte Vorstellung: nur einzeln wählbar, dann Warteliste.
  const waitlistMode = selected.length === 1 && !selected[0].bookable;
  const overfull = waitlistMode
    ? []
    : selected.filter((row) => (perEvent.get(row.eventId)?.seats ?? 0) > row.free);
  const overLimit = selected.filter(
    (row) => (perEvent.get(row.eventId)?.tickets ?? 0) > maxTickets,
  );
  const emptyEvents = selected.filter((row) => (perEvent.get(row.eventId)?.tickets ?? 0) === 0);
  const ready = selected.length > 0 && totals.tickets > 0;
  const blocked = overfull.length > 0 || overLimit.length > 0 || emptyEvents.length > 0;

  const toggle = (row: PublicPerformance) => {
    setError(null);
    setEventIds((current) => {
      if (current.includes(row.eventId)) return current.filter((id) => id !== row.eventId);
      if (!row.bookable) return [row.eventId];
      // Eine vorher gewählte ausgebuchte Vorstellung (Warteliste) fliegt raus.
      const bookable = current.filter(
        (id) => performances.find((entry) => entry.eventId === id)?.bookable,
      );
      return [...bookable, row.eventId];
    });
  };

  const submit = () => {
    setError(null);
    if (!ready) return;
    startTransition(async () => {
      if (waitlistMode) {
        const result = await joinWaitlistAction({
          eventId: selected[0].eventId,
          name: contact.name,
          email: contact.email,
          seats: Math.max(1, totals.tickets),
          privacy: privacy as true,
          website: contact.website,
        });
        if (result.ok) setDone({ kind: "waitlist", mailed: true, count: 1 });
        else setError(result.error);
        return;
      }
      const result = await bookTicketsAction({
        bookings: selected.map((row) => ({
          eventId: row.eventId,
          items: Object.entries(quantities[row.eventId] ?? {}).map(([categoryId, quantity]) => ({
            categoryId,
            quantity,
          })),
        })),
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        note: contact.note,
        privacy: privacy as true,
        website: contact.website,
      });
      if (result.ok) {
        setDone({ kind: "booking", mailed: result.data.mailed, count: selected.length });
      } else setError(result.error);
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
              Link darin, um die Reservierung
              {done.count > 1 ? ` für alle ${done.count} Vorstellungen` : ""} zu bestätigen. Erst
              dann gelten die Karten.
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

  const location = performances.find((row) => row.location)?.location;
  const singleLocation = performances.every((row) => !row.location || row.location === location);

  return (
    <form
      className="space-y-8 pb-24"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="text-lg font-semibold">Wann möchtest du kommen?</h2>
          <p className="text-sm text-muted-foreground">Mehrere Termine möglich</p>
        </div>
        <div
          className="grid grid-cols-4 gap-2 md:grid-cols-5"
          role="group"
          aria-label="Vorstellungen"
        >
          {performances.map((row) => (
            <PerformanceTile
              key={row.eventId}
              row={row}
              checked={eventIds.includes(row.eventId)}
              onToggle={() => toggle(row)}
            />
          ))}
        </div>
        {location && singleLocation ? (
          <p className="text-xs text-muted-foreground">Ort: {location}</p>
        ) : null}
        {selected.length > 0 && !singleLocation ? (
          <ul className="text-xs text-muted-foreground">
            {selected.map((row) => (
              <li key={row.eventId}>
                {formatPerformanceDateLong(new Date(row.start))}
                {row.location ? ` · ${row.location}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {selected.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="text-lg font-semibold">
              {waitlistMode ? "Wie viele Plätze brauchst du?" : "Wie viele Karten?"}
            </h2>
            {selected.length > 1 ? (
              <p className="text-sm text-muted-foreground">für jede Vorstellung einzeln</p>
            ) : null}
          </div>
          {waitlistMode ? (
            <p className="text-sm text-muted-foreground">
              Diese Vorstellung ist ausgebucht. Trag dich in die Warteliste ein – wir melden uns,
              sobald Plätze frei werden.
            </p>
          ) : null}
          <div className="space-y-3">
            {selected.map((row) => {
              const counts = quantities[row.eventId] ?? {};
              const sums = perEvent.get(row.eventId);
              return (
                <Card key={row.eventId} size="flush" className="divide-y divide-border/60">
                  {selected.length > 1 ? (
                    <div className="flex items-baseline justify-between gap-3 bg-muted/40 px-4 py-2">
                      <p className="text-sm font-semibold">
                        {formatPerformanceDateLong(new Date(row.start))}
                      </p>
                      <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {sums?.tickets ?? 0} {sums?.tickets === 1 ? "Karte" : "Karten"}
                      </p>
                    </div>
                  ) : null}
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {category.name}{" "}
                          <span className="font-normal text-muted-foreground">
                            {category.priceCents > 0 ? formatPrice(category.priceCents) : "frei"}
                          </span>
                        </p>
                        {category.description ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {category.description}
                          </p>
                        ) : null}
                      </div>
                      <QuantityStepper
                        label={`${category.name}${
                          selected.length > 1
                            ? ` am ${formatPerformanceDateLong(new Date(row.start))}`
                            : ""
                        }`}
                        value={counts[category.id] ?? 0}
                        max={maxTickets}
                        onChange={(value) =>
                          setQuantities({
                            ...quantities,
                            [row.eventId]: { ...counts, [category.id]: value },
                          })
                        }
                      />
                    </div>
                  ))}
                </Card>
              );
            })}
          </div>
          {overfull.map((row) => (
            <p key={row.eventId} className="text-sm text-destructive">
              Am {formatPerformanceDateLong(new Date(row.start))} sind nur noch {row.free} Plätze
              frei.
            </p>
          ))}
          {overLimit.length > 0 ? (
            <p className="text-sm text-destructive">
              Online höchstens {maxTickets} Karten je Vorstellung. Für größere Gruppen ruf uns bitte
              an.
            </p>
          ) : null}
          {ready && emptyEvents.length > 0 ? (
            <p className="text-sm text-warning">
              Für{" "}
              {emptyEvents.map((row) => formatPerformanceDateLong(new Date(row.start))).join(", ")}{" "}
              ist noch keine Karte gewählt – Anzahl eintragen oder den Termin oben abwählen.
            </p>
          ) : null}
        </section>
      ) : null}

      {ready ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Auf welchen Namen?</h2>
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
                  <Label htmlFor="booking-phone">Telefon (optional)</Label>
                  <Input
                    id="booking-phone"
                    type="tel"
                    autoComplete="tel"
                    value={contact.phone}
                    onChange={(event) => setContact({ ...contact, phone: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="booking-note">Hinweis (optional)</Label>
                  <Input
                    id="booking-note"
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
          {!waitlistMode ? (
            <p className="text-xs text-muted-foreground">
              Du bekommst eine Mail mit einem Bestätigungslink. Unbestätigte Reservierungen
              verfallen nach kurzer Zeit.
            </p>
          ) : null}
        </section>
      ) : null}

      {ready ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold tabular-nums">
                {waitlistMode
                  ? `Warteliste · ${totals.tickets} ${totals.tickets === 1 ? "Platz" : "Plätze"}`
                  : [
                      selected.length > 1 ? `${selected.length} Termine` : null,
                      `${totals.tickets} ${totals.tickets === 1 ? "Karte" : "Karten"}`,
                      totals.cents > 0 ? formatPrice(totals.cents) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </p>
              {!waitlistMode && totals.cents > 0 ? (
                <p className="truncate text-xs text-muted-foreground">
                  Bezahlung an der Abendkasse
                </p>
              ) : null}
            </div>
            <AsyncButton
              type="submit"
              size="lg"
              className="shrink-0"
              isLoading={pending}
              loadingText="Wird gesendet …"
              disabled={!privacy || blocked}
            >
              {waitlistMode ? "Auf die Warteliste" : "Reservieren"}
            </AsyncButton>
          </div>
        </div>
      ) : null}
      <input type="hidden" name="show" value={showId} />
    </form>
  );
}
