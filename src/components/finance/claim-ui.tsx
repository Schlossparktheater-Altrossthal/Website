"use client";

import { FileTextIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { ImageViewer } from "@/components/ui/image-viewer";
import { EXPENSE_CLAIM_PAYOUT_LABELS } from "@/lib/finance/constants";
import type { ClaimView } from "@/lib/finance/claims";
import { receiptUrl } from "@/lib/finance/paths";
import { formatCents } from "@/lib/format/money";
import { cn } from "@/lib/utils";

const DAY = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", timeZone: "UTC" });

export const formatClaimDay = (iso: string) =>
  DAY.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

/** Status-Chip aus Sicht der einreichenden Person. */
export function ClaimStatusBadge({ claim }: { claim: ClaimView }) {
  if (claim.status === "rejected") return <Badge variant="destructive">Abgelehnt</Badge>;
  if (claim.status === "paid") {
    const label =
      claim.payout === "donated"
        ? "Gespendet"
        : claim.payout === "cash"
          ? "Erstattet bar"
          : `Erstattet (${EXPENSE_CLAIM_PAYOUT_LABELS[claim.payout]})`;
    return <Badge variant="success">{label}</Badge>;
  }
  if (claim.stage === "department") return <Badge variant="warning">Beim Gewerk</Badge>;
  if (claim.status === "approved") return <Badge variant="info">Freigegeben</Badge>;
  return <Badge variant="muted">Beim Kassenwart</Badge>;
}

/** Eine Zeile: Zweck, Gewerk · Datum, Betrag, Status. */
export function ClaimRow({
  claim,
  showSubmitter = false,
  onOpen,
  action,
}: {
  claim: ClaimView;
  showSubmitter?: boolean;
  onOpen?: () => void;
  action?: React.ReactNode;
}) {
  const meta = [
    showSubmitter ? claim.submittedBy.name : null,
    claim.department?.name ?? claim.periodName,
    formatClaimDay(claim.spentOn),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left disabled:cursor-default"
      >
        <div className="min-w-0">
          <div className="truncate font-medium">{claim.purpose}</div>
          <div className="truncate text-sm text-muted-foreground">{meta}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-semibold tabular-nums">{formatCents(claim.amountCents)}</span>
          {action ? null : <ClaimStatusBadge claim={claim} />}
        </div>
      </button>
      {action}
    </div>
  );
}

/** Belegvorschau: Fotos im Bildbetrachter, PDFs in neuem Tab. */
export function ReceiptGallery({
  receipts,
  className,
}: {
  receipts: ClaimView["receipts"];
  className?: string;
}) {
  const images = receipts.filter((receipt) => receipt.mimeType.startsWith("image/"));
  const [index, setIndex] = React.useState<number | null>(null);
  if (!receipts.length) return null;
  return (
    <div className={cn("flex gap-2 overflow-x-auto", className)}>
      {receipts.map((receipt) =>
        receipt.mimeType.startsWith("image/") ? (
          <button
            key={receipt.id}
            type="button"
            onClick={() => setIndex(images.indexOf(receipt))}
            className="h-28 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted"
            aria-label={`Beleg ${receipt.filename} vergrößern`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- geschützte Route, kein Optimizer */}
            <img
              src={receiptUrl(receipt.id)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ) : (
          <a
            key={receipt.id}
            href={receiptUrl(receipt.id)}
            target="_blank"
            rel="noreferrer"
            className="flex h-28 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border bg-muted p-2 text-center text-xs"
          >
            <FileTextIcon className="size-6 text-muted-foreground" aria-hidden />
            <span className="line-clamp-2 break-all">{receipt.filename}</span>
          </a>
        ),
      )}
      {index !== null && images[index] ? (
        <ImageViewer
          open
          onClose={() => setIndex(null)}
          src={receiptUrl(images[index].id)}
          alt={images[index].filename}
          downloadHref={receiptUrl(images[index].id)}
          caption={images.length > 1 ? `${index + 1} / ${images.length}` : null}
          onPrev={
            images.length > 1
              ? () => setIndex((index - 1 + images.length) % images.length)
              : undefined
          }
          onNext={images.length > 1 ? () => setIndex((index + 1) % images.length) : undefined}
        />
      ) : null}
    </div>
  );
}
