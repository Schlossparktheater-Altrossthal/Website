"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  bookPresaleAction,
  recordCashCountAction,
  recordDonationAction,
} from "@/app/(members)/mitglieder/finanzen/actions";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { Textarea } from "@/components/ui/textarea";
import type { PeriodOption } from "@/lib/finance/book";
import type { PerformanceIncomeView } from "@/lib/finance/income";
import { formatDateTime } from "@/lib/format/date";
import { formatCents, parseEuroToCents } from "@/lib/format/money";

type Fund = { id: string; name: string; kind: string };
type Sheet =
  | { kind: "count"; performance: PerformanceIncomeView }
  | { kind: "presale"; performance: PerformanceIncomeView }
  | { kind: "donation"; performance: PerformanceIncomeView };

export type IncomeOverviewProps = {
  periods: PeriodOption[];
  period: { id: string; name: string; hasShow: boolean };
  performances: PerformanceIncomeView[];
  funds: Fund[];
  canManage: boolean;
};

function defaultFund(funds: Fund[], kind: "cash" | "bank") {
  return (funds.find((fund) => fund.kind === kind) ?? funds[0])?.id ?? "";
}

/** Einnahmen je Vorstellung: was die Kartenbuchung erwarten lässt und was schon gebucht ist. */
export function IncomeOverview(props: IncomeOverviewProps) {
  const { performances, canManage } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [sheet, setSheet] = React.useState<Sheet | null>(null);

  const sum = (pick: (performance: PerformanceIncomeView) => number) =>
    performances.reduce((total, performance) => total + pick(performance), 0);
  const booked = sum(
    (p) => p.booked.boxOfficeCents + p.booked.ticketsCents + p.booked.donationCents,
  );
  const expected = sum((p) => p.expectedCashCents + p.presaleCents);
  const unbookedCash = sum((p) => (p.cashCounts.length ? 0 : p.expectedCashCents));

  return (
    <div className="space-y-4">
      <select
        aria-label="Zeitraum"
        value={props.period.id}
        onChange={(event) =>
          router.push(`${pathname}?tab=einnahmen&zeitraum=${event.target.value}`)
        }
        className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
      >
        {props.periods.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>

      {!props.period.hasShow ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {props.period.name} gehört zu keiner Produktion – hier gibt es keine Vorstellungen.
          Einnahmen wie Förderungen buchst du im Kassenbuch.
        </Card>
      ) : !performances.length ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Für {props.period.name} sind noch keine Vorstellungen angelegt.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatTile
              label="Kartenerlöse laut Buchung"
              value={formatCents(expected)}
              hint="Abendkasse + bezahlte Reservierungen"
            />
            <StatTile label="Im Kassenbuch" value={formatCents(booked)} tone="success" />
            <StatTile
              label="Ohne Kassensturz"
              value={formatCents(unbookedCash)}
              hint="erwartetes Bargeld"
              tone={unbookedCash > 0 ? "warning" : "neutral"}
              className="col-span-2 lg:col-span-1"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {performances.map((performance) => (
              <PerformanceCard
                key={performance.eventId}
                performance={performance}
                canManage={canManage}
                onOpen={(kind) => setSheet({ kind, performance })}
              />
            ))}
          </div>
        </>
      )}

      {sheet ? (
        <IncomeSheet
          sheet={sheet}
          funds={props.funds}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Row({ label, cents, muted }: { label: string; cents: number; muted?: boolean }) {
  return (
    <div className={muted ? "flex justify-between text-muted-foreground" : "flex justify-between"}>
      <span>{label}</span>
      <span className="tabular-nums">{formatCents(cents)}</span>
    </div>
  );
}

function PerformanceCard({
  performance,
  canManage,
  onOpen,
}: {
  performance: PerformanceIncomeView;
  canManage: boolean;
  onOpen: (kind: Sheet["kind"]) => void;
}) {
  const lastCount = performance.cashCounts.at(-1);
  const difference = lastCount ? lastCount.countedCents - lastCount.expectedCents : 0;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{performance.title}</h3>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(performance.start)} · {performance.tickets} Karten
          </p>
        </div>
        {performance.cancelled ? (
          <Badge variant="outline" size="sm">
            Abgesagt
          </Badge>
        ) : lastCount ? (
          <Badge variant={difference === 0 ? "success" : "warning"} size="sm">
            {difference === 0
              ? "Kasse stimmt"
              : `${difference > 0 ? "+" : "−"}${formatCents(Math.abs(difference))}`}
          </Badge>
        ) : null}
      </div>
      <div className="space-y-1 text-sm">
        <Row label="Abendkasse verkauft" cents={performance.boxOfficeCents} />
        <Row label="An der Tür kassiert" cents={performance.doorPaidCents} />
        <Row label="Vorab bezahlt" cents={performance.presaleCents} />
        {performance.openCents ? (
          <Row label="Noch offen" cents={performance.openCents} muted />
        ) : null}
      </div>
      <div className="space-y-1 border-t pt-2 text-sm">
        <Row label="Gebucht Abendkasse" cents={performance.booked.boxOfficeCents} />
        <Row label="Gebucht Vorverkauf" cents={performance.booked.ticketsCents} />
        {performance.booked.donationCents ? (
          <Row label="Spenden" cents={performance.booked.donationCents} />
        ) : null}
        {lastCount ? (
          <p className="text-xs text-muted-foreground">
            Kassensturz: {formatCents(lastCount.countedCents)} gezählt, erwartet{" "}
            {formatCents(lastCount.expectedCents)} · {lastCount.countedBy}
            {lastCount.notes ? ` · ${lastCount.notes}` : ""}
          </p>
        ) : null}
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={lastCount ? "outline" : "default"}
            onClick={() => onOpen("count")}
          >
            Kassensturz
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={performance.presaleUnbookedCents <= 0}
            onClick={() => onOpen("presale")}
          >
            Vorverkauf buchen
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onOpen("donation")}>
            Spende
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function IncomeSheet({
  sheet,
  funds,
  onClose,
  onDone,
}: {
  sheet: Sheet;
  funds: Fund[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { performance } = sheet;
  const [fundId, setFundId] = React.useState(
    defaultFund(funds, sheet.kind === "presale" ? "bank" : "cash"),
  );
  const [amount, setAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [donorName, setDonorName] = React.useState("");
  const [donorAddress, setDonorAddress] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const counted = parseEuroToCents(amount);
  const difference = counted === null ? null : counted - performance.expectedCashCents;

  const submit = async () => {
    setBusy(true);
    const result =
      sheet.kind === "count"
        ? await recordCashCountAction({
            eventId: performance.eventId,
            fundId,
            counted: amount,
            notes,
          })
        : sheet.kind === "presale"
          ? await bookPresaleAction({ eventId: performance.eventId, fundId })
          : await recordDonationAction({
              eventId: performance.eventId,
              fundId,
              amount,
              donorName,
              donorAddress,
            });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Gebucht.");
    onDone();
  };

  const title =
    sheet.kind === "count"
      ? "Kassensturz"
      : sheet.kind === "presale"
        ? "Vorverkauf buchen"
        : "Spende erfassen";
  const disabled = busy || !fundId || (sheet.kind !== "presale" && counted === null);

  return (
    <BottomSheet
      open
      onOpenChange={(next) => !next && onClose()}
      title={title}
      description={`${performance.title} · ${formatDateTime(performance.start)}`}
      footer={
        <Button className="w-full" disabled={disabled} onClick={submit}>
          {sheet.kind === "count" ? "Kassensturz buchen" : "Buchen"}
        </Button>
      }
    >
      <div className="space-y-4">
        {sheet.kind === "count" ? (
          <p className="text-sm text-muted-foreground">
            Erwartet: <strong>{formatCents(performance.expectedCashCents)}</strong> (Abendkasse{" "}
            {formatCents(performance.boxOfficeCents)} + an der Tür kassiert{" "}
            {formatCents(performance.doorPaidCents)}). Wechselgeld vorher abziehen.
          </p>
        ) : null}
        {sheet.kind === "presale" ? (
          <p className="text-sm text-muted-foreground">
            Bucht <strong>{formatCents(performance.presaleUnbookedCents)}</strong> vorab bezahlte
            Karten als Einnahme „Kartenverkauf“.
          </p>
        ) : null}
        {sheet.kind !== "presale" ? (
          <div className="space-y-1">
            <Label htmlFor="income-amount">{sheet.kind === "count" ? "Gezählt" : "Betrag"}</Label>
            <div className="relative">
              <Input
                id="income-amount"
                inputMode="decimal"
                value={amount}
                placeholder="0,00"
                onChange={(event) => setAmount(event.target.value)}
                className="h-12 pr-9 text-xl font-bold tabular-nums"
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                €
              </span>
            </div>
            {sheet.kind === "count" && difference !== null && difference !== 0 ? (
              <p className={difference < 0 ? "text-sm text-destructive" : "text-sm"}>
                {difference < 0 ? "Fehlbetrag" : "Überschuss"} {formatCents(Math.abs(difference))} –
                bitte kurz begründen.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="income-fund">Topf</Label>
          <select
            id="income-fund"
            value={fundId}
            onChange={(event) => setFundId(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
              </option>
            ))}
          </select>
        </div>
        {sheet.kind === "count" ? (
          <div className="space-y-1">
            <Label htmlFor="income-notes">Notiz</Label>
            <Textarea
              id="income-notes"
              value={notes}
              maxLength={1000}
              placeholder="z. B. 2 Karten zu wenig berechnet"
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        ) : null}
        {sheet.kind === "donation" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="income-donor">Spender (optional, für Zuwendungsbestätigung)</Label>
              <Input
                id="income-donor"
                value={donorName}
                maxLength={200}
                placeholder="leer = Spendenkasse"
                onChange={(event) => setDonorName(event.target.value)}
              />
            </div>
            {donorName.trim() ? (
              <div className="space-y-1">
                <Label htmlFor="income-donor-address">Anschrift</Label>
                <Textarea
                  id="income-donor-address"
                  value={donorAddress}
                  maxLength={400}
                  onChange={(event) => setDonorAddress(event.target.value)}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </BottomSheet>
  );
}
