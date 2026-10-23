"use client";

import { LockIcon, PlusIcon, SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  createEntryAction,
  lockPeriodAction,
  reverseEntryAction,
  updateEntryAction,
} from "@/app/(members)/mitglieder/finanzen/actions";
import { ReceiptGallery, formatClaimDay } from "@/components/finance/claim-ui";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatTile } from "@/components/ui/stat-tile";
import { Textarea } from "@/components/ui/textarea";
import type { BookTotals, EntryView, PeriodOption } from "@/lib/finance/book";
import { FINANCE_ENTRY_TYPE_LABELS } from "@/lib/finance/constants";
import { MAX_RECEIPTS_PER_CLAIM, RECEIPT_ACCEPT } from "@/lib/finance/receipts";
import { formatCents, formatSignedCents, parseEuroToCents } from "@/lib/format/money";
import { resizeImageFile } from "@/lib/inventory/photo-client";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };
type CategoryOption = Option & { type: "income" | "expense" };
type EntryType = EntryView["type"];

export type CashBookProps = {
  periods: PeriodOption[];
  period: {
    id: string;
    name: string;
    code: string;
    lockedThrough: number;
    nextNumber: number;
    closed: boolean;
  };
  entries: EntryView[];
  totals: BookTotals;
  openClaims: { count: number; cents: number };
  funds: Option[];
  categories: CategoryOption[];
  departments: Option[];
  filter: {
    fundId: string | null;
    type: EntryType | null;
    categoryId: string | null;
    departmentId: string | null;
    query: string;
  };
  canManage: boolean;
};

const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

/** Vorzeichen aus Sicht des gefilterten Topfs (Umbuchung: ab = −, zu = +, ohne Topf neutral). */
function signedAmount(entry: EntryView, fundId: string | null) {
  if (entry.type === "income") return entry.amountCents;
  if (entry.type === "expense") return -entry.amountCents;
  if (!fundId) return 0;
  return entry.transferFund?.id === fundId ? entry.amountCents : -entry.amountCents;
}

function AmountCell({ entry, fundId }: { entry: EntryView; fundId: string | null }) {
  const signed = signedAmount(entry, fundId);
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        signed > 0 && "text-success",
        signed < 0 && "text-destructive",
        entry.reversedBy && "line-through opacity-60",
      )}
    >
      {signed === 0 ? formatCents(entry.amountCents) : formatSignedCents(signed)}
    </span>
  );
}

function fundLabel(entry: EntryView) {
  return entry.transferFund ? `${entry.fund.name} → ${entry.transferFund.name}` : entry.fund.name;
}

export function CashBook(props: CashBookProps) {
  const { entries, totals, filter, funds, canManage, period } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [form, setForm] = React.useState<{ type: EntryType; entry?: EntryView } | null>(null);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState(filter.query);
  const detail = entries.find((entry) => entry.id === detailId) ?? null;

  const setParam = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams?.toString());
      next.set("tab", "kassenbuch");
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    if (query === filter.query) return;
    const timer = setTimeout(() => setParam({ q: query || null }), 350);
    return () => clearTimeout(timer);
  }, [query, filter.query, setParam]);

  const fundName = funds.find((fund) => fund.id === filter.fundId)?.name;
  const canBook = canManage && !period.closed && funds.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Zeitraum"
            value={period.id}
            onChange={(event) =>
              setParam({
                zeitraum: event.target.value,
                topf: null,
                art: null,
                kategorie: null,
                gewerk: null,
                q: null,
              })
            }
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
          >
            {props.periods.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Topf">
            {[{ id: "", name: "Alle Töpfe" }, ...funds].map((fund) => (
              <button
                key={fund.id || "all"}
                type="button"
                onClick={() => setParam({ topf: fund.id || null })}
                className={cn(
                  "rounded-full px-3 py-1 text-sm",
                  (filter.fundId ?? "") === fund.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/70",
                )}
              >
                {fund.name}
              </button>
            ))}
          </div>
        </div>
        {canBook ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setForm({ type: "transfer" })}>
              Umbuchen
            </Button>
            <Button onClick={() => setForm({ type: "expense" })}>
              <PlusIcon className="size-4" aria-hidden /> Buchung
            </Button>
          </div>
        ) : null}
      </div>
      {canManage && !funds.length ? (
        <Card className="p-4 text-sm">
          Noch kein Geldtopf angelegt – bitte zuerst unter <strong>Töpfe</strong> einen anlegen.
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Einnahmen" value={formatCents(totals.incomeCents)} tone="success" />
        <StatTile label="Ausgaben" value={formatCents(totals.expenseCents)} tone="destructive" />
        <StatTile
          label={fundName ? `Saldo ${fundName}` : "Saldo"}
          value={formatSignedCents(totals.balanceCents)}
          hint={fundName ? "inkl. Umbuchungen" : "Einnahmen − Ausgaben"}
        />
        <StatTile
          label="Offene Auslagen"
          value={String(props.openClaims.count)}
          hint={formatCents(props.openClaims.cents)}
          tone={props.openClaims.count ? "warning" : "neutral"}
          href={props.openClaims.count ? "/mitglieder/finanzen" : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Suchen: Text, Händler, Nummer"
            className="pl-9"
            aria-label="Kassenbuch durchsuchen"
          />
        </div>
        <SegmentedControl
          aria-label="Art"
          value={filter.type ?? "all"}
          onValueChange={(value) => setParam({ art: value === "all" ? null : value })}
          options={[
            { value: "all", label: "Alle" },
            { value: "income", label: "Einnahmen" },
            { value: "expense", label: "Ausgaben" },
            { value: "transfer", label: "Umbuchungen" },
          ]}
        />
        <FilterSelect
          label="Kategorie"
          value={filter.categoryId}
          options={props.categories}
          onChange={(value) => setParam({ kategorie: value })}
        />
        {props.departments.length ? (
          <FilterSelect
            label="Gewerk"
            value={filter.departmentId}
            options={props.departments}
            onChange={(value) => setParam({ gewerk: value })}
          />
        ) : null}
      </div>

      {entries.length ? (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Nr.</th>
                  <th className="px-3 py-2 font-medium">Datum</th>
                  <th className="px-3 py-2 font-medium">Text</th>
                  <th className="px-3 py-2 font-medium">Kategorie</th>
                  <th className="px-3 py-2 font-medium">Gewerk</th>
                  <th className="px-3 py-2 font-medium">Topf</th>
                  <th className="px-3 py-2 font-medium">Beleg</th>
                  <th className="px-3 py-2 text-right font-medium">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setDetailId(entry.id)}
                    className="cursor-pointer border-t hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {entry.locked ? (
                        <LockIcon
                          className="mr-1 inline size-3 text-muted-foreground"
                          aria-label="festgeschrieben"
                        />
                      ) : null}
                      {entry.label}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatClaimDay(entry.bookingDate)}
                    </td>
                    <td className="max-w-80 px-3 py-2">
                      <div className="truncate">{entry.description}</div>
                      {entry.counterparty ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {entry.counterparty}
                        </div>
                      ) : null}
                      <EntryFlags entry={entry} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {entry.type === "transfer" ? "Umbuchung" : (entry.category?.name ?? "–")}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{entry.department?.name ?? "–"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fundLabel(entry)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {entry.receipts.length ? `${entry.receipts.length} 📎` : "–"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <AmountCell entry={entry} fundId={filter.fundId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Card className="divide-y p-0 md:hidden">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setDetailId(entry.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{entry.description}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {entry.label} · {formatClaimDay(entry.bookingDate)} · {fundLabel(entry)}
                  </div>
                  <EntryFlags entry={entry} />
                </div>
                <AmountCell entry={entry} fundId={filter.fundId} />
              </button>
            ))}
          </Card>
        </>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {filter.query || filter.type || filter.categoryId || filter.departmentId || filter.fundId
            ? "Keine Buchungen für diese Filter."
            : "Noch keine Buchungen in diesem Zeitraum."}
        </Card>
      )}

      {period.lockedThrough > 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <LockIcon className="size-3.5" aria-hidden />
          Buchungen bis {period.code}-{String(period.lockedThrough).padStart(3, "0")} sind
          festgeschrieben – Korrektur nur per Storno.
        </p>
      ) : null}

      {form ? (
        <EntryFormSheet
          key={form.entry?.id ?? form.type}
          {...props}
          initialType={form.type}
          entry={form.entry}
          onClose={() => setForm(null)}
        />
      ) : null}
      {detail ? (
        <EntryDetailSheet
          key={detail.id}
          entry={detail}
          period={period}
          canManage={canManage}
          onEdit={() => {
            setDetailId(null);
            setForm({ type: detail.type, entry: detail });
          }}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </div>
  );
}

function EntryFlags({ entry }: { entry: EntryView }) {
  const flags: React.ReactNode[] = [];
  if (entry.reversedBy)
    flags.push(
      <Badge key="r" variant="muted" size="sm">
        storniert durch {entry.reversedBy}
      </Badge>,
    );
  if (entry.reversalOf)
    flags.push(
      <Badge key="s" variant="muted" size="sm">
        Storno zu {entry.reversalOf}
      </Badge>,
    );
  if (entry.source === "expense_claim")
    flags.push(
      <Badge key="a" variant="outline" size="sm">
        Auslage
      </Badge>,
    );
  if (entry.donorName)
    flags.push(
      <Badge key="d" variant="outline" size="sm">
        Spende
      </Badge>,
    );
  return flags.length ? <div className="mt-1 flex flex-wrap gap-1">{flags}</div> : null;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Option[];
  onChange: (value: string | null) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">{label}: alle</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}

function EntryDetailSheet({
  entry,
  period,
  canManage,
  onEdit,
  onClose,
}: {
  entry: EntryView;
  period: CashBookProps["period"];
  canManage: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"view" | "reverse" | "lock">("view");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const act = async (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true);
    const result = await task();
    setBusy(false);
    if (!result.ok) return toast.error(result.error ?? "Fehler");
    toast.success(success);
    onClose();
    router.refresh();
  };

  const editable = canManage && !entry.locked && !entry.reversalOf && !entry.reversedBy;
  const reversible = canManage && !period.closed && !entry.reversalOf && !entry.reversedBy;
  const lockable = canManage && entry.number > period.lockedThrough;

  const footer = !canManage ? null : mode === "reverse" ? (
    <div className="flex gap-2">
      <Button variant="outline" className="flex-1" onClick={() => setMode("view")}>
        Zurück
      </Button>
      <Button
        variant="destructive"
        className="flex-[2]"
        disabled={busy}
        onClick={() => act(() => reverseEntryAction({ id: entry.id, reason }), "Storniert.")}
      >
        Stornobuchung anlegen
      </Button>
    </div>
  ) : mode === "lock" ? (
    <div className="flex gap-2">
      <Button variant="outline" className="flex-1" onClick={() => setMode("view")}>
        Zurück
      </Button>
      <Button
        className="flex-[2]"
        disabled={busy}
        onClick={() =>
          act(
            () => lockPeriodAction({ periodId: period.id, throughNumber: entry.number }),
            "Festgeschrieben.",
          )
        }
      >
        Bis {entry.label} festschreiben
      </Button>
    </div>
  ) : (
    <div className="flex flex-wrap gap-2">
      {editable ? (
        <Button className="flex-1" onClick={onEdit}>
          Bearbeiten
        </Button>
      ) : null}
      {reversible ? (
        <Button variant="outline" className="flex-1" onClick={() => setMode("reverse")}>
          Stornieren
        </Button>
      ) : null}
      {lockable ? (
        <Button variant="ghost" className="w-full" onClick={() => setMode("lock")}>
          <LockIcon className="size-4" aria-hidden /> Bis hier festschreiben
        </Button>
      ) : null}
    </div>
  );

  return (
    <BottomSheet
      open
      onOpenChange={(next) => !next && onClose()}
      title={`${entry.label} · ${FINANCE_ENTRY_TYPE_LABELS[entry.type]}`}
      description="Buchung im Kassenbuch"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold">
            <AmountCell entry={entry} fundId={null} />
          </span>
          {entry.locked ? (
            <Badge variant="muted">
              <LockIcon className="mr-1 size-3" aria-hidden /> festgeschrieben
            </Badge>
          ) : null}
        </div>
        <p className="font-medium">{entry.description}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Datum</dt>
          <dd>{formatClaimDay(entry.bookingDate)}</dd>
          <dt className="text-muted-foreground">Topf</dt>
          <dd>{fundLabel(entry)}</dd>
          {entry.counterparty ? (
            <>
              <dt className="text-muted-foreground">Gegenüber</dt>
              <dd>{entry.counterparty}</dd>
            </>
          ) : null}
          {entry.category ? (
            <>
              <dt className="text-muted-foreground">Kategorie</dt>
              <dd>{entry.category.name}</dd>
            </>
          ) : null}
          {entry.department ? (
            <>
              <dt className="text-muted-foreground">Gewerk</dt>
              <dd>{entry.department.name}</dd>
            </>
          ) : null}
          {entry.donorName ? (
            <>
              <dt className="text-muted-foreground">Spender</dt>
              <dd>{[entry.donorName, entry.donorAddress].filter(Boolean).join(", ")}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Gebucht von</dt>
          <dd>{entry.createdBy}</dd>
        </dl>
        <EntryFlags entry={entry} />
        <ReceiptGallery receipts={entry.receipts} />
        {mode === "reverse" ? (
          <div className="space-y-1">
            <Label htmlFor="reverse-reason">Grund (optional)</Label>
            <Textarea
              id="reverse-reason"
              value={reason}
              maxLength={160}
              onChange={(event) => setReason(event.target.value)}
              placeholder="z. B. falscher Betrag"
            />
            <p className="text-xs text-muted-foreground">
              Es entsteht eine Gegenbuchung mit neuer Nummer. Die ursprüngliche Buchung bleibt
              sichtbar.
            </p>
          </div>
        ) : null}
        {mode === "lock" ? (
          <p className="rounded-lg bg-muted/50 p-3 text-sm">
            Alle Buchungen bis einschließlich {entry.label} lassen sich danach nicht mehr bearbeiten
            – nur noch stornieren. Das lässt sich nicht rückgängig machen.
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}

function EntryFormSheet({
  period,
  funds,
  categories,
  departments,
  filter,
  initialType,
  entry,
  onClose,
}: CashBookProps & { initialType: EntryType; entry?: EntryView; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = React.useState<EntryType>(initialType);
  const [amount, setAmount] = React.useState(
    entry ? (entry.amountCents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [bookingDate, setBookingDate] = React.useState(entry?.bookingDate ?? todayIso());
  const [description, setDescription] = React.useState(entry?.description ?? "");
  const [counterparty, setCounterparty] = React.useState(entry?.counterparty ?? "");
  const [fundId, setFundId] = React.useState(entry?.fund.id ?? filter.fundId ?? funds[0]?.id ?? "");
  const [transferFundId, setTransferFundId] = React.useState(
    entry?.transferFund?.id ?? funds.find((fund) => fund.id !== fundId)?.id ?? "",
  );
  const [categoryId, setCategoryId] = React.useState(entry?.category?.id ?? "");
  const [departmentId, setDepartmentId] = React.useState(entry?.department?.id ?? "");
  const [donorName, setDonorName] = React.useState(entry?.donorName ?? "");
  const [donorAddress, setDonorAddress] = React.useState(entry?.donorAddress ?? "");
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const typeCategories = categories.filter((category) => category.type === type);
  const isDonationCategory =
    categories.find((category) => category.id === categoryId)?.name === "Spenden";
  const showDonor = type === "income" && (isDonationCategory || Boolean(donorName));
  const cents = parseEuroToCents(amount);
  const valid =
    Boolean(cents && cents > 0) &&
    description.trim().length > 0 &&
    Boolean(fundId) &&
    (type !== "transfer" || (Boolean(transferFundId) && transferFundId !== fundId));

  const changeType = (next: EntryType) => {
    setType(next);
    if (categories.find((category) => category.id === categoryId)?.type !== next) setCategoryId("");
  };

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    try {
      const prepared = await Promise.all(
        Array.from(list).map((file) =>
          file.type.startsWith("image/") ? resizeImageFile(file, 2000, 0.85) : file,
        ),
      );
      setFiles((current) => [...current, ...prepared].slice(0, MAX_RECEIPTS_PER_CLAIM));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Beleg konnte nicht gelesen werden.");
    }
  };

  const submit = async () => {
    const data = new FormData();
    data.set("periodId", period.id);
    data.set("type", type);
    data.set("fundId", fundId);
    data.set("transferFundId", type === "transfer" ? transferFundId : "");
    data.set("amount", amount);
    data.set("bookingDate", bookingDate);
    data.set("description", description);
    data.set("counterparty", counterparty);
    data.set("categoryId", type === "transfer" ? "" : categoryId);
    data.set("departmentId", departmentId);
    data.set("donorName", showDonor ? donorName : "");
    data.set("donorAddress", showDonor ? donorAddress : "");
    files.forEach((file) => data.append("receipt", file));
    setBusy(true);
    const result = entry ? await updateEntryAction(entry.id, data) : await createEntryAction(data);
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(entry ? "Gespeichert." : "Gebucht.");
    onClose();
    router.refresh();
  };

  return (
    <BottomSheet
      open
      onOpenChange={(next) => !next && onClose()}
      title={
        entry ? `${entry.label} bearbeiten` : type === "transfer" ? "Umbuchung" : "Neue Buchung"
      }
      description={`Kassenbuch ${period.name}`}
      footer={
        <Button className="w-full" size="lg" disabled={!valid || busy} onClick={submit}>
          {busy ? "Wird gespeichert …" : entry ? "Speichern" : "Buchen"}
        </Button>
      }
    >
      <div className="space-y-4">
        <SegmentedControl
          aria-label="Buchungsart"
          fullWidth
          value={type}
          onValueChange={changeType}
          options={(["expense", "income", "transfer"] as const).map((value) => ({
            value,
            label: FINANCE_ENTRY_TYPE_LABELS[value],
          }))}
        />
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="space-y-1">
            <Label htmlFor="entry-amount">Betrag</Label>
            <div className="relative">
              <Input
                id="entry-amount"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="h-12 pr-9 text-xl font-bold tabular-nums"
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                €
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="entry-date">Datum</Label>
            <DateInput
              id="entry-date"
              value={bookingDate}
              onChange={(event) => setBookingDate(event.target.value)}
              className="h-12"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="entry-description">Buchungstext</Label>
          <Input
            id="entry-description"
            value={description}
            maxLength={200}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={
              type === "transfer"
                ? "z. B. Abendkasse auf Konto eingezahlt"
                : "z. B. Rechnung Farbenhaus"
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormSelect
            id="entry-fund"
            label={type === "transfer" ? "Von Topf" : "Topf"}
            value={fundId}
            onChange={setFundId}
            options={funds}
          />
          {type === "transfer" ? (
            <FormSelect
              id="entry-target"
              label="Nach Topf"
              value={transferFundId}
              onChange={setTransferFundId}
              options={funds.filter((fund) => fund.id !== fundId)}
            />
          ) : (
            <FormSelect
              id="entry-category"
              label="Kategorie"
              value={categoryId}
              onChange={setCategoryId}
              options={typeCategories}
              empty="ohne"
            />
          )}
        </div>
        {type !== "transfer" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="entry-counterparty">
                {type === "income" ? "Von" : "An / Händler"}
              </Label>
              <Input
                id="entry-counterparty"
                value={counterparty}
                maxLength={120}
                onChange={(event) => setCounterparty(event.target.value)}
              />
            </div>
            {departments.length ? (
              <FormSelect
                id="entry-department"
                label="Gewerk"
                value={departmentId}
                onChange={setDepartmentId}
                options={departments}
                empty="ohne"
              />
            ) : null}
          </div>
        ) : null}
        {showDonor ? (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">
              Für die Spendenquittung (optional, später nutzbar)
            </p>
            <div className="space-y-1">
              <Label htmlFor="entry-donor">Spender</Label>
              <Input
                id="entry-donor"
                value={donorName}
                maxLength={200}
                onChange={(event) => setDonorName(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="entry-donor-address">Anschrift</Label>
              <Textarea
                id="entry-donor-address"
                rows={2}
                value={donorAddress}
                maxLength={400}
                onChange={(event) => setDonorAddress(event.target.value)}
              />
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={RECEIPT_ACCEPT}
            multiple
            className="sr-only"
            onChange={(event) => {
              void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          {entry?.receipts.length ? <ReceiptGallery receipts={entry.receipts} /> : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            Beleg anhängen{files.length ? ` (${files.length} neu)` : ""}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function FormSelect({
  id,
  label,
  value,
  onChange,
  options,
  empty,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  empty?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        {empty !== undefined ? <option value="">{empty}</option> : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
