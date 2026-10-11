"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  cancelFreeTicketsAction,
  registerFreeTicketsAction,
} from "@/app/(members)/mitglieder/freikarten/actions";
import { QuantityStepper } from "@/components/karten/quantity-stepper";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPerformanceDate } from "@/lib/karten/constants";

export type FreeTicketPerformance = {
  eventId: string;
  start: string;
  free: number;
  bookable: boolean;
};
export type FreeTicketEntry = {
  id: string;
  name: string;
  email: string | null;
  quantity: number;
  start: string;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  checkedIn: number;
  past: boolean;
};

export function FreeTicketsPanel({
  title,
  quota,
  deadlinePassed,
  performances,
  entries,
}: {
  title: string;
  quota: { total: number; used: number; remaining: number };
  deadlinePassed: boolean;
  performances: FreeTicketPerformance[];
  entries: FreeTicketEntry[];
}) {
  const router = useRouter();
  const [eventId, setEventId] = useState(performances.find((row) => row.bookable)?.eventId ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(Math.min(1, quota.remaining));
  const [returning, setReturning] = useState<FreeTicketEntry | null>(null);
  const [pending, startTransition] = useTransition();
  const active = entries.filter(
    (entry) => entry.status === "confirmed" || entry.status === "pending",
  );

  const submit = () =>
    startTransition(async () => {
      const result = await registerFreeTicketsAction({ eventId, name, email, quantity });
      if (result.ok) {
        toast.success(result.message ?? "Angemeldet.");
        setName("");
        setEmail("");
        setQuantity(1);
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant={quota.remaining > 0 ? "success" : "muted"}>
          {quota.remaining} von {quota.total} frei
        </Badge>
      </div>

      {active.length > 0 ? (
        <ul className="divide-y divide-border/60 rounded-md border border-border/60">
          {active.map((entry) => (
            <li key={entry.id} className="flex min-h-12 flex-wrap items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {entry.name} · {entry.quantity} {entry.quantity === 1 ? "Karte" : "Karten"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPerformanceDate(new Date(entry.start))}
                  {entry.email ? ` · Ticket an ${entry.email}` : ""}
                </p>
              </div>
              {entry.checkedIn > 0 ? (
                <Badge variant="info" size="sm">
                  eingelassen
                </Badge>
              ) : null}
              {!entry.past && entry.checkedIn === 0 ? (
                <Button size="xs" variant="ghost" onClick={() => setReturning(entry)}>
                  Zurückgeben
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {deadlinePassed ? (
        <p className="text-sm text-muted-foreground">Die Anmeldefrist für Freikarten ist vorbei.</p>
      ) : quota.remaining === 0 ? (
        <p className="text-sm text-muted-foreground">
          Dein Kontingent ist vergeben. Brauchst du mehr, frag die Produktionsleitung.
        </p>
      ) : performances.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Vorstellungen eingerichtet.</p>
      ) : (
        <form
          className="space-y-3 rounded-md bg-muted/40 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <p className="text-sm font-medium">Freikarten anmelden</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Vorstellung</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vorstellung wählen" />
                </SelectTrigger>
                <SelectContent>
                  {performances.map((row) => (
                    <SelectItem key={row.eventId} value={row.eventId} disabled={!row.bookable}>
                      {formatPerformanceDate(new Date(row.start))}
                      {row.bookable ? "" : " – ausgebucht"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="free-name">Auf den Namen</Label>
              <Input
                id="free-name"
                placeholder="z. B. Oma Erika Müller"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="free-email">Ticket mailen an (optional)</Label>
              <Input
                id="free-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Anzahl</Label>
              <div>
                <QuantityStepper
                  label="Anzahl Freikarten"
                  value={quantity}
                  max={quota.remaining}
                  onChange={setQuantity}
                />
              </div>
            </div>
          </div>
          <AsyncButton
            type="submit"
            isLoading={pending}
            disabled={!eventId || !name.trim() || quantity < 1}
          >
            Anmelden
          </AsyncButton>
          <p className="text-xs text-muted-foreground">
            Am Einlass reicht der Name. Mit Mail-Adresse bekommt dein Gast zusätzlich ein Ticket mit
            QR-Code.
          </p>
        </form>
      )}

      <ConfirmDialog
        open={returning !== null}
        onOpenChange={(open) => (!open ? setReturning(null) : undefined)}
        title="Freikarten zurückgeben?"
        description="Die Plätze werden wieder frei und zählen nicht mehr gegen dein Kontingent."
        confirmLabel="Zurückgeben"
        cancelLabel="Behalten"
        variant="destructive"
        onCancel={() => setReturning(null)}
        onConfirm={() => {
          const target = returning;
          setReturning(null);
          if (!target) return;
          startTransition(async () => {
            const result = await cancelFreeTicketsAction(target.id);
            if (result.ok) {
              toast.success(result.message ?? "Zurückgegeben.");
              router.refresh();
            } else toast.error(result.error);
          });
        }}
      />
    </Card>
  );
}
