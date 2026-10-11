"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createBoxOfficeAccessAction,
  createDoorAccessAction,
  resendBoxOfficeAccessAction,
  revokeBoxOfficeAccessAction,
} from "@/app/(members)/mitglieder/karten/einstellungen/actions";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyIcon, MailIcon, PlusIcon, QrCodeIcon } from "@/components/ui/action-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";

import { DoorQrDialog } from "./door-qr-dialog";

export type AccessRow = {
  id: string;
  name: string;
  email: string;
  /** false = reiner Einlass-Zugang per QR-Code. */
  canOffice: boolean;
  canCheckIn: boolean;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  /** Vom Server berechnet (nicht gesperrt und nicht abgelaufen). */
  active: boolean;
};

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: DEFAULT_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function AccessCard({ showId, accesses }: { showId: string; accesses: AccessRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", canCheckIn: true, days: 120 });
  const [revoking, setRevoking] = useState<AccessRow | null>(null);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);
  const [creatingDoor, setCreatingDoor] = useState(false);
  const [doorDraft, setDoorDraft] = useState({ name: "Einlass", days: 3 });
  const [doorQr, setDoorQr] = useState<{ link: string; title: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const handleLink = (
    result: Awaited<ReturnType<typeof resendBoxOfficeAccessAction>>,
    title = "Einlass",
  ) => {
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Erledigt.");
    if (result.data.door && result.data.link) {
      setDoorQr({ link: result.data.link, title });
    } else {
      // Ohne Mailserver (lokal) den Link direkt anzeigen.
      setFallbackLink(result.data.link);
    }
    router.refresh();
    return true;
  };

  const create = () =>
    startTransition(async () => {
      if (handleLink(await createBoxOfficeAccessAction(showId, draft))) {
        setCreating(false);
        setDraft({ name: "", email: "", canCheckIn: true, days: 120 });
      }
    });

  const createDoor = () =>
    startTransition(async () => {
      const result = await createDoorAccessAction(showId, doorDraft);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCreatingDoor(false);
      setDoorQr({ link: result.data.link, title: doorDraft.name });
      router.refresh();
    });

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Zugänge ohne Konto</h2>
          <p className="text-sm text-muted-foreground">
            Sekretariat: persönlicher Link per Mail, verwaltet Reservierungen. Einlass-Helfer:
            QR-Code zum Ausdrucken, öffnet nur den Einlass. Beides gilt nur für diese Produktion.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setCreatingDoor(true)}>
            <QrCodeIcon /> Einlass-QR
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon /> Kartenbüro-Zugang
          </Button>
        </div>
      </div>

      {fallbackLink ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted p-4 text-sm">
          <p>
            Diesen Link persönlich weitergeben (z. B. per Messenger). Er wird nur jetzt angezeigt
            und öffnet das Kartenbüro ohne Passwort.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={fallbackLink} onFocus={(event) => event.target.select()} />
            <Button
              size="icon"
              variant="outline"
              aria-label="Link kopieren"
              onClick={() => {
                void navigator.clipboard.writeText(fallbackLink);
                toast.success("Link kopiert.");
              }}
            >
              <CopyIcon />
            </Button>
          </div>
        </div>
      ) : null}

      {accesses.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Noch keine Zugänge.</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border/60">
          {accesses.map((access) => {
            const active = access.active;
            return (
              <li key={access.id} className="flex min-h-12 flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{access.name}</span>
                    <Badge variant={active ? "success" : "muted"} size="sm">
                      {access.revokedAt ? "gesperrt" : active ? "aktiv" : "abgelaufen"}
                    </Badge>
                    {!access.canOffice ? (
                      <Badge variant="info" size="sm">
                        Einlass-QR
                      </Badge>
                    ) : access.canCheckIn ? (
                      <Badge variant="muted" size="sm">
                        + Einlass
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {access.email ? `${access.email} · ` : ""}bis{" "}
                    {dateFormat.format(new Date(access.expiresAt))}
                    {access.lastUsedAt
                      ? ` · zuletzt ${dateFormat.format(new Date(access.lastUsedAt))}`
                      : " · noch nicht benutzt"}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      handleLink(await resendBoxOfficeAccessAction(access.id), access.name);
                    })
                  }
                >
                  {access.canOffice ? <MailIcon /> : <QrCodeIcon />}
                  {!access.canOffice
                    ? "Neuer QR"
                    : access.email
                      ? "Neuer Link"
                      : "Neuer Link anzeigen"}
                </Button>
                {!access.revokedAt ? (
                  <Button size="xs" variant="ghost" onClick={() => setRevoking(access)}>
                    Sperren
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <ModalFormDialog
        title="Kartenbüro-Zugang"
        description="Mit E-Mail kommt der Link per Mail, ohne wird er hier angezeigt und du gibst ihn selbst weiter. Wer ihn öffnet, ist auf dem Gerät angemeldet."
        open={creating}
        onOpenChange={setCreating}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Abbrechen
            </Button>
            <AsyncButton isLoading={pending} onClick={create}>
              {draft.email.trim() ? "Link senden" : "Link erstellen"}
            </AsyncButton>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="access-name">Name</Label>
            <Input
              id="access-name"
              autoFocus
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="access-email">E-Mail (optional)</Label>
            <Input
              id="access-email"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="access-days">Gültig (Tage)</Label>
            <Input
              id="access-days"
              type="number"
              min={1}
              max={365}
              className="w-32"
              value={draft.days}
              onChange={(event) =>
                setDraft({ ...draft, days: Number.parseInt(event.target.value, 10) || 120 })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md bg-muted/40 p-3">
            <div>
              <p className="text-sm font-medium">Auch Einlass & Abendkasse</p>
              <p className="text-xs text-muted-foreground">Zum Beispiel für Helfer an der Tür.</p>
            </div>
            <Switch
              checked={draft.canCheckIn}
              onCheckedChange={(value) => setDraft({ ...draft, canCheckIn: value })}
              aria-label="Auch Einlass"
            />
          </div>
          <button type="submit" hidden />
        </form>
      </ModalFormDialog>

      <ModalFormDialog
        title="Einlass-QR"
        description="Für Helfer an der Tür ohne Mitgliedskonto. Der Code öffnet nur den Einlass dieser Produktion."
        open={creatingDoor}
        onOpenChange={setCreatingDoor}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreatingDoor(false)}>
              Abbrechen
            </Button>
            <AsyncButton isLoading={pending} onClick={createDoor}>
              QR erstellen
            </AsyncButton>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createDoor();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="door-name">Bezeichnung</Label>
            <Input
              id="door-name"
              placeholder="z. B. Einlass Premierenwochenende"
              value={doorDraft.name}
              onChange={(event) => setDoorDraft({ ...doorDraft, name: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="door-days">Gültig (Tage)</Label>
            <Input
              id="door-days"
              type="number"
              min={1}
              max={60}
              className="w-32"
              value={doorDraft.days}
              onChange={(event) =>
                setDoorDraft({ ...doorDraft, days: Number.parseInt(event.target.value, 10) || 3 })
              }
            />
            <p className="text-xs text-muted-foreground">
              Kurz halten – z. B. bis zum Ende des Vorstellungswochenendes.
            </p>
          </div>
          <button type="submit" hidden />
        </form>
      </ModalFormDialog>

      {doorQr ? (
        <DoorQrDialog link={doorQr.link} title={doorQr.title} onClose={() => setDoorQr(null)} />
      ) : null}

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => (!open ? setRevoking(null) : undefined)}
        title={`Zugang von ${revoking?.name ?? ""} sperren?`}
        description="Der Link funktioniert danach nicht mehr, auch auf bereits angemeldeten Geräten. Mit „Neuer Link“ lässt er sich wieder aktivieren."
        confirmLabel="Sperren"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setRevoking(null)}
        onConfirm={() => {
          const target = revoking;
          setRevoking(null);
          if (!target) return;
          startTransition(async () => {
            const result = await revokeBoxOfficeAccessAction(target.id);
            if (result.ok) {
              toast.success(result.message ?? "Gesperrt.");
              router.refresh();
            } else toast.error(result.error);
          });
        }}
      />
    </Card>
  );
}
