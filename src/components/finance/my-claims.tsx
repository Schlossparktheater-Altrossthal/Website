"use client";

import { CameraIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  departmentCheckClaimAction,
  rejectClaimAction,
  submitClaimAction,
  withdrawClaimAction,
} from "@/app/(members)/mitglieder/finanzen/actions";
import {
  ClaimRow,
  ClaimStatusBadge,
  ReceiptGallery,
  formatClaimDay,
} from "@/components/finance/claim-ui";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { EXPENSE_CLAIM_PAYOUT_LABELS } from "@/lib/finance/constants";
import type { ClaimView } from "@/lib/finance/claims";
import { MAX_RECEIPTS_PER_CLAIM, RECEIPT_ACCEPT } from "@/lib/finance/receipts";
import { formatCents, parseEuroToCents } from "@/lib/format/money";
import { resizeImageFile } from "@/lib/inventory/photo-client";

type Option = { id: string; name: string };
type Payout = ClaimView["payout"];

export type MyClaimsProps = {
  currentUserId: string;
  claims: ClaimView[];
  reviewClaims: ClaimView[];
  production: { id: string; title: string } | null;
  generalPeriodName: string;
  departments: Option[];
  defaultDepartmentId: string | null;
  categories: Option[];
  defaultPayout: Payout;
  payoutHint: string | null;
};

const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

export function MyClaims(props: MyClaimsProps) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<ClaimView | null>(null);
  const open = props.claims.filter(
    (claim) => claim.status !== "paid" && claim.status !== "rejected",
  );
  const openSum = open.reduce((sum, claim) => sum + claim.amountCents, 0);
  const year = new Date().getFullYear();
  const paidSum = props.claims
    .filter((claim) => claim.status === "paid" && claim.paidAt?.startsWith(String(year)))
    .reduce((sum, claim) => sum + claim.amountCents, 0);

  return (
    <div className="space-y-4">
      {props.reviewClaims.length ? (
        <DepartmentReview claims={props.reviewClaims} onOpen={setDetail} />
      ) : null}

      <Card className="p-4">
        <div className="mb-3">
          <h2 className="font-semibold">Eingereicht</h2>
          {props.claims.length ? (
            <p className="text-sm text-muted-foreground">
              Offen {formatCents(openSum)} · Erstattet {year}: {formatCents(paidSum)}
            </p>
          ) : null}
        </div>
        {props.claims.length ? (
          <div className="divide-y">
            {props.claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} onOpen={() => setDetail(claim)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch nichts eingereicht. Beleg fotografieren, Betrag eintragen – fertig.
          </p>
        )}
      </Card>

      <div className="sticky bottom-20 z-10 md:static">
        <Button className="w-full md:w-auto" size="lg" onClick={() => setFormOpen(true)}>
          <PlusIcon className="size-4" aria-hidden /> Auslage einreichen
        </Button>
      </div>

      <ClaimFormSheet {...props} open={formOpen} onOpenChange={setFormOpen} />
      <ClaimDetailSheet
        key={detail?.id ?? "none"}
        claim={detail}
        currentUserId={props.currentUserId}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function DepartmentReview({
  claims,
  onOpen,
}: {
  claims: ClaimView[];
  onOpen: (claim: ClaimView) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const confirm = async (claim: ClaimView) => {
    setBusy(claim.id);
    const result = await departmentCheckClaimAction({ id: claim.id });
    setBusy(null);
    if (!result.ok) return toast.error(result.error);
    toast.success("Bestätigt – geht an den Kassenwart.");
    router.refresh();
  };
  return (
    <Card className="p-4">
      <h2 className="mb-1 font-semibold">Zu prüfen ({claims.length})</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Auslagen aus deinem Gewerk. Passt es sachlich, geht es an den Kassenwart.
      </p>
      <div className="divide-y">
        {claims.map((claim) => (
          <ClaimRow
            key={claim.id}
            claim={claim}
            showSubmitter
            onOpen={() => onOpen(claim)}
            action={
              <Button
                size="sm"
                variant="outline"
                disabled={busy === claim.id}
                onClick={() => confirm(claim)}
              >
                Passt ✓
              </Button>
            }
          />
        ))}
      </div>
    </Card>
  );
}

function ClaimDetailSheet({
  claim,
  currentUserId,
  onClose,
}: {
  claim: ClaimView | null;
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  if (!claim) return null;
  // Leitung prüft fremde Auslagen; eigene kann man nur zurückziehen.
  const mine = claim.submittedBy.id === currentUserId;

  const act = async (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true);
    const result = await task();
    setBusy(false);
    if (!result.ok) return toast.error(result.error ?? "Fehler");
    toast.success(success);
    onClose();
    router.refresh();
  };

  return (
    <BottomSheet
      open
      onOpenChange={(next) => !next && onClose()}
      title={claim.purpose}
      description="Auslage im Detail"
      footer={
        rejecting ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRejecting(false)}>
              Zurück
            </Button>
            <Button
              variant="destructive"
              className="flex-[2]"
              disabled={busy || !reason.trim()}
              onClick={() => act(() => rejectClaimAction({ id: claim.id, reason }), "Abgelehnt.")}
            >
              Ablehnen
            </Button>
          </div>
        ) : claim.stage !== "done" ? (
          <ClaimDetailActions
            claim={claim}
            mine={mine}
            busy={busy}
            onReject={() => setRejecting(true)}
            act={act}
          />
        ) : null
      }
    >
      <div className="space-y-3">
        <ReceiptGallery receipts={claim.receipts} />
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums">{formatCents(claim.amountCents)}</span>
          <ClaimStatusBadge claim={claim} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Von</dt>
          <dd>{claim.submittedBy.name}</dd>
          <dt className="text-muted-foreground">Datum</dt>
          <dd>{formatClaimDay(claim.spentOn)}</dd>
          {claim.vendor ? (
            <>
              <dt className="text-muted-foreground">Händler</dt>
              <dd>{claim.vendor}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Für</dt>
          <dd>
            {[claim.periodName, claim.department?.name, claim.category?.name]
              .filter(Boolean)
              .join(" · ")}
          </dd>
          <dt className="text-muted-foreground">Erstattung</dt>
          <dd>{EXPENSE_CLAIM_PAYOUT_LABELS[claim.payout]}</dd>
          {claim.departmentCheckedBy ? (
            <>
              <dt className="text-muted-foreground">Gewerk</dt>
              <dd>bestätigt von {claim.departmentCheckedBy}</dd>
            </>
          ) : null}
          {claim.entryNumber ? (
            <>
              <dt className="text-muted-foreground">Buchung</dt>
              <dd>{claim.entryNumber}</dd>
            </>
          ) : null}
          {claim.rejectReason ? (
            <>
              <dt className="text-muted-foreground">Grund</dt>
              <dd>{claim.rejectReason}</dd>
            </>
          ) : null}
        </dl>
        {rejecting ? (
          <div className="space-y-1">
            <Label htmlFor="reject-reason">Warum nicht?</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
              placeholder="z. B. Beleg doppelt eingereicht"
              autoFocus
            />
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}

function ClaimDetailActions({
  claim,
  mine,
  busy,
  onReject,
  act,
}: {
  claim: ClaimView;
  mine: boolean;
  busy: boolean;
  onReject: () => void;
  act: (task: () => Promise<{ ok: boolean; error?: string }>, success: string) => Promise<unknown>;
}) {
  if (!mine && claim.stage !== "department") return null;
  return (
    <div className="flex gap-2">
      {!mine ? (
        <>
          <Button variant="outline" className="flex-1" onClick={onReject} disabled={busy}>
            Ablehnen
          </Button>
          <Button
            className="flex-[2]"
            disabled={busy}
            onClick={() => act(() => departmentCheckClaimAction({ id: claim.id }), "Bestätigt.")}
          >
            Passt ✓
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          disabled={busy || claim.status !== "submitted"}
          onClick={() => act(() => withdrawClaimAction({ id: claim.id }), "Zurückgezogen.")}
        >
          Zurückziehen
        </Button>
      )}
    </div>
  );
}

function ClaimFormSheet({
  open,
  onOpenChange,
  production,
  generalPeriodName,
  departments,
  defaultDepartmentId,
  categories,
  defaultPayout,
  payoutHint,
}: MyClaimsProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [files, setFiles] = React.useState<File[]>([]);
  const [amount, setAmount] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [vendor, setVendor] = React.useState("");
  const [spentOn, setSpentOn] = React.useState(todayIso);
  const [scope, setScope] = React.useState<"production" | "general">(
    production ? "production" : "general",
  );
  const [departmentId, setDepartmentId] = React.useState(defaultDepartmentId ?? "");
  const [categoryId, setCategoryId] = React.useState("");
  const [payout, setPayout] = React.useState<Payout>(defaultPayout);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const previews = React.useMemo(
    () => files.map((file) => (file.type.startsWith("image/") ? URL.createObjectURL(file) : "")),
    [files],
  );
  React.useEffect(
    () => () => previews.forEach((url) => url && URL.revokeObjectURL(url)),
    [previews],
  );

  const reset = () => {
    setFiles([]);
    setAmount("");
    setPurpose("");
    setVendor("");
    setSpentOn(todayIso());
    setCategoryId("");
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

  const amountValid = parseEuroToCents(amount) !== null && parseEuroToCents(amount)! > 0;
  const canSubmit = files.length > 0 && amountValid && purpose.trim().length > 0 && !busy;

  const submit = async () => {
    const data = new FormData();
    data.set("showId", scope === "production" && production ? production.id : "");
    data.set("amount", amount);
    data.set("spentOn", spentOn);
    data.set("purpose", purpose);
    data.set("vendor", vendor);
    data.set("departmentId", scope === "production" ? departmentId : "");
    data.set("categoryId", categoryId);
    data.set("payout", payout);
    files.forEach((file) => data.append("receipt", file));
    setBusy(true);
    const result = await submitClaimAction(data);
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Eingereicht – du bekommst Bescheid, sobald erstattet ist.");
    reset();
    onOpenChange(false);
    router.refresh();
  };

  const payoutOptions: Payout[] = ["cash", "bank", "paypal", "donated"];

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Auslage einreichen"
      description="Beleg fotografieren, Betrag und Zweck eintragen."
      footer={
        <div className="space-y-2">
          <Button className="w-full" size="lg" disabled={!canSubmit} onClick={submit}>
            {busy ? "Wird eingereicht …" : "Einreichen"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {departmentId && scope === "production"
              ? "Die Gewerksleitung prüft, dann erstattet der Kassenwart."
              : "Der Kassenwart prüft und erstattet."}
          </p>
        </div>
      }
    >
      <div className="space-y-4">
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
        {files.length ? (
          <div className="flex gap-2 overflow-x-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="relative h-28 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted"
              >
                {previews[index] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- lokale Vorschau
                  <img src={previews[index]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center p-2 text-center text-xs break-all">
                    {file.name}
                  </span>
                )}
                <button
                  type="button"
                  className="absolute top-1 right-1 rounded-full bg-background/90 p-1"
                  aria-label="Beleg entfernen"
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                >
                  <XIcon className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
            {files.length < MAX_RECEIPTS_PER_CLAIM ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-28 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
              >
                + Seite
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-36 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-muted/40 text-muted-foreground"
          >
            <CameraIcon className="size-6" aria-hidden />
            <span className="font-medium text-foreground">Beleg fotografieren</span>
            <span className="text-xs">oder Datei/PDF wählen</span>
          </button>
        )}

        <div className="space-y-1">
          <Label htmlFor="claim-amount">Betrag</Label>
          <div className="relative">
            <Input
              id="claim-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-14 pr-10 text-2xl font-bold tabular-nums"
            />
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-xl text-muted-foreground">
              €
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="claim-purpose">Wofür?</Label>
          <Input
            id="claim-purpose"
            value={purpose}
            maxLength={200}
            onChange={(event) => setPurpose(event.target.value)}
            placeholder="z. B. Farbe + Pinsel Bühnenbild"
          />
        </div>

        {production ? (
          <SegmentedControl
            aria-label="Zuordnung"
            fullWidth
            value={scope}
            onValueChange={setScope}
            options={[
              { value: "production", label: production.title },
              { value: "general", label: generalPeriodName },
            ]}
          />
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {scope === "production" && departments.length ? (
            <div className="space-y-1">
              <Label htmlFor="claim-department">Gewerk</Label>
              <NativeSelect id="claim-department" value={departmentId} onChange={setDepartmentId}>
                <option value="">ohne Gewerk</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="claim-date">Datum</Label>
            <DateInput
              id="claim-date"
              value={spentOn}
              max={todayIso()}
              onChange={(event) => setSpentOn(event.target.value)}
            />
          </div>
        </div>

        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Händler und Kategorie (optional)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="claim-vendor">Händler</Label>
              <Input
                id="claim-vendor"
                value={vendor}
                maxLength={120}
                onChange={(event) => setVendor(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="claim-category">Kategorie</Label>
              <NativeSelect id="claim-category" value={categoryId} onChange={setCategoryId}>
                <option value="">weiß nicht</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </details>

        <div className="space-y-1">
          <Label>Erstattung</Label>
          <SegmentedControl
            aria-label="Erstattung"
            fullWidth
            value={payout}
            onValueChange={setPayout}
            options={payoutOptions.map((value) => ({
              value,
              label: EXPENSE_CLAIM_PAYOUT_LABELS[value],
            }))}
          />
          {payout === "bank" || payout === "paypal" ? (
            <p className="text-xs text-muted-foreground">
              {payoutHint ?? "Noch keine Zahlungsdaten hinterlegt."}{" "}
              <Link href="/mitglieder/profil?bereich=zahlungen" className="underline">
                Im Profil ändern
              </Link>
            </p>
          ) : payout === "donated" ? (
            <p className="text-xs text-muted-foreground">
              Du verzichtest auf die Erstattung – das wird als Spende verbucht.
            </p>
          ) : null}
        </div>
      </div>
    </BottomSheet>
  );
}

function NativeSelect({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
    >
      {children}
    </select>
  );
}
