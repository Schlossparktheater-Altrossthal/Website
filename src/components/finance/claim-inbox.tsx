"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  approveClaimAction,
  payClaimAction,
  rejectClaimAction,
} from "@/app/(members)/mitglieder/finanzen/actions";
import { ClaimStatusBadge, ReceiptGallery, formatClaimDay } from "@/components/finance/claim-ui";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EXPENSE_CLAIM_PAYOUT_LABELS } from "@/lib/finance/constants";
import type { ClaimView } from "@/lib/finance/claims";
import { receiptUrl } from "@/lib/finance/paths";
import { formatCents } from "@/lib/format/money";

export type PayoutDetails = {
  iban: string | null;
  accountHolder: string | null;
  paypal: string | null;
};

const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

export function ClaimInbox({
  claims,
  funds,
  payoutDetails,
  canManage,
}: {
  claims: ClaimView[];
  funds: { id: string; name: string }[];
  payoutDetails: Record<string, PayoutDetails>;
  canManage: boolean;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = claims.find((claim) => claim.id === openId) ?? null;
  const total = claims.reduce((sum, claim) => sum + claim.amountCents, 0);

  if (!claims.length) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Keine offenen Auslagen. Neue Einreichungen erscheinen hier.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {claims.length} offen · {formatCents(total)}
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {claims.map((claim) => {
          const thumb = claim.receipts.find((receipt) => receipt.mimeType.startsWith("image/"));
          return (
            <button
              key={claim.id}
              type="button"
              onClick={() => setOpenId(claim.id)}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- geschützte Route
                  <img
                    src={receiptUrl(thumb.id)}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    PDF
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{claim.purpose}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {claim.submittedBy.name} · {claim.department?.name ?? claim.periodName}
                </div>
                <div className="mt-1">
                  <ClaimStatusBadge claim={claim} />
                </div>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatCents(claim.amountCents)}
              </span>
            </button>
          );
        })}
      </div>
      {open ? (
        <InboxSheet
          key={open.id}
          claim={open}
          funds={funds}
          payout={payoutDetails[open.submittedBy.id] ?? null}
          canManage={canManage}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}

function InboxSheet({
  claim,
  funds,
  payout,
  canManage,
  onClose,
}: {
  claim: ClaimView;
  funds: { id: string; name: string }[];
  payout: PayoutDetails | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [fundId, setFundId] = React.useState(claim.fund?.id ?? funds[0]?.id ?? "");
  const [bookingDate, setBookingDate] = React.useState(todayIso);
  const [rejecting, setRejecting] = React.useState(false);
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

  const payoutLine =
    claim.payout === "bank"
      ? payout?.iban
        ? `${payout.accountHolder ?? claim.submittedBy.name} · ${payout.iban}`
        : "Keine IBAN hinterlegt"
      : claim.payout === "paypal"
        ? (payout?.paypal ?? "Kein PayPal hinterlegt")
        : claim.payout === "donated"
          ? "Verzichtet – wird als Spende verbucht"
          : "Bar auszahlen";

  const footer = !canManage ? null : rejecting ? (
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
  ) : (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={() => setRejecting(true)}
        >
          Ablehnen
        </Button>
        <Button
          className="flex-[2]"
          disabled={busy || !fundId}
          onClick={() =>
            act(
              () => payClaimAction({ id: claim.id, fundId, bookingDate }),
              claim.payout === "donated" ? "Als Spende verbucht." : "Erstattet und gebucht.",
            )
          }
        >
          {claim.payout === "donated" ? "Spende buchen" : "Erstatten + buchen"}
        </Button>
      </div>
      {claim.status === "submitted" && claim.payout !== "donated" ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={busy || !fundId}
          onClick={() =>
            act(
              () => approveClaimAction({ id: claim.id, fundId }),
              "Freigegeben – Erstattung folgt.",
            )
          }
        >
          Nur freigeben, später erstatten
        </Button>
      ) : null}
    </div>
  );

  return (
    <BottomSheet
      open
      onOpenChange={(next) => !next && onClose()}
      title={claim.purpose}
      description="Auslage prüfen"
      footer={footer}
    >
      <div className="space-y-4">
        <ReceiptGallery receipts={claim.receipts} />
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tabular-nums">{formatCents(claim.amountCents)}</span>
          {claim.stage === "department" ? (
            <Badge variant="warning">Gewerk hat noch nicht geprüft</Badge>
          ) : claim.departmentCheckedBy ? (
            <Badge variant="success">Gewerk ✓</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {[
            claim.submittedBy.name,
            formatClaimDay(claim.spentOn),
            claim.vendor,
            claim.department?.name,
            claim.periodName,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <span className="text-muted-foreground">Auszahlung: </span>
          <span className="font-medium">{EXPENSE_CLAIM_PAYOUT_LABELS[claim.payout]}</span>
          <div className="mt-0.5 break-all">{payoutLine}</div>
        </div>
        {canManage && !rejecting ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inbox-fund">Topf</Label>
              <select
                id="inbox-fund"
                value={fundId}
                onChange={(event) => setFundId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {funds.length ? null : <option value="">Erst Topf anlegen</option>}
                {funds.map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inbox-date">Buchungsdatum</Label>
              <DateInput
                id="inbox-date"
                value={bookingDate}
                onChange={(event) => setBookingDate(event.target.value)}
              />
            </div>
          </div>
        ) : null}
        {rejecting ? (
          <div className="space-y-1">
            <Label htmlFor="inbox-reason">Warum nicht?</Label>
            <Textarea
              id="inbox-reason"
              value={reason}
              maxLength={200}
              onChange={(event) => setReason(event.target.value)}
              autoFocus
            />
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
