"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveTicketingSettingsAction } from "@/app/(members)/mitglieder/karten/einstellungen/actions";
import { AsyncButton } from "@/components/ui/async-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type GeneralSettingsValues = {
  enabled: boolean;
  holdMinutes: number;
  maxSeatsPerBooking: number;
  freeTicketsPerMember: number;
  freeTicketDeadline: string | null;
  infoText: string;
  retentionDays: number;
};

function toInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function GeneralSettingsCard({
  showId,
  initial,
}: {
  showId: string;
  initial: GeneralSettingsValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof GeneralSettingsValues>(key: K, value: GeneralSettingsValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const save = () =>
    startTransition(async () => {
      const result = await saveTicketingSettingsAction(showId, {
        ...values,
        freeTicketDeadline: values.freeTicketDeadline ? new Date(values.freeTicketDeadline) : null,
      });
      if (result.ok) {
        toast.success(result.message ?? "Gespeichert.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Kartenverkauf</h2>
          <p className="text-sm text-muted-foreground">
            Eingeschaltet erscheint die Produktion auf der Buchungsseite <code>/karten</code>.
          </p>
        </div>
        <Switch
          checked={values.enabled}
          onCheckedChange={(checked) => set("enabled", checked)}
          aria-label="Kartenverkauf eingeschaltet"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="hold">Haltezeit unbestätigt (Minuten)</Label>
          <Input
            id="hold"
            type="number"
            min={15}
            value={values.holdMinutes}
            onChange={(event) => set("holdMinutes", toInt(event.target.value, 120))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max">Höchstens Karten pro Online-Buchung</Label>
          <Input
            id="max"
            type="number"
            min={1}
            value={values.maxSeatsPerBooking}
            onChange={(event) => set("maxSeatsPerBooking", toInt(event.target.value, 10))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="free">Freikarten pro Mitwirkende</Label>
          <Input
            id="free"
            type="number"
            min={0}
            value={values.freeTicketsPerMember}
            onChange={(event) => set("freeTicketsPerMember", toInt(event.target.value, 2))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deadline">Anmeldefrist Freikarten</Label>
          <Input
            id="deadline"
            type="datetime-local"
            value={values.freeTicketDeadline ?? ""}
            onChange={(event) => set("freeTicketDeadline", event.target.value || null)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="info">Hinweis für Gäste (Buchungsseite und Mails)</Label>
        <Textarea
          id="info"
          rows={3}
          placeholder="z. B. Einlass ab 19 Uhr, Bezahlung bar an der Abendkasse, Decken mitbringen …"
          value={values.infoText}
          onChange={(event) => set("infoText", event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="retention">Gastdaten löschen nach (Tagen nach der Vorstellung)</Label>
          <Input
            id="retention"
            type="number"
            min={7}
            className="w-32"
            value={values.retentionDays}
            onChange={(event) => set("retentionDays", toInt(event.target.value, 90))}
          />
        </div>
        <AsyncButton isLoading={pending} loadingText="Speichert …" onClick={save}>
          Speichern
        </AsyncButton>
      </div>
    </Card>
  );
}
