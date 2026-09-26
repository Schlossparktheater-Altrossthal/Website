"use client";

import { useEffect, useState } from "react";
import type { CalendarEventKind } from "@prisma/client";
import { toast } from "sonner";

import { TrashIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TimeInput } from "@/components/ui/time-input";
import {
  CALENDAR_EVENT_KINDS,
  CALENDAR_EVENT_KIND_LABELS,
  type CalendarEntry,
} from "@/lib/calendar/event-kinds";
import { formatIsoDateInTimeZone, formatIsoTimeInTimeZone } from "@/lib/date-time";

export type EventDialogState =
  { mode: "create"; date: string } | { mode: "edit"; entry: CalendarEntry } | null;

type FormState = {
  title: string;
  kind: CalendarEventKind;
  date: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  /** Produktion des Termins; null = alle Produktionen. */
  showId: string | null;
};

/** Gewählte Produktion, der neue Termine standardmäßig zugeordnet werden. */
export type EventDialogProduction = { id: string; title: string } | null;

function toFormState(
  state: NonNullable<EventDialogState>,
  production: EventDialogProduction,
): FormState {
  if (state.mode === "create") {
    return {
      title: "",
      kind: "MEETING",
      date: state.date,
      endDate: state.date,
      allDay: false,
      startTime: "18:00",
      endTime: "",
      location: "",
      description: "",
      showId: production?.id ?? null,
    };
  }
  const { entry } = state;
  return {
    title: entry.title,
    kind: entry.kind === "REHEARSAL" ? "OTHER" : entry.kind,
    date: entry.dayKey,
    endDate: entry.end ? formatIsoDateInTimeZone(entry.end) : entry.dayKey,
    allDay: entry.allDay,
    startTime: entry.allDay ? "18:00" : formatIsoTimeInTimeZone(entry.start),
    endTime: !entry.allDay && entry.end ? formatIsoTimeInTimeZone(entry.end) : "",
    location: entry.location ?? "",
    description: entry.description ?? "",
    showId: entry.showId ?? null,
  };
}

type EventDialogProps = {
  state: EventDialogState;
  onClose: () => void;
  onSaved: (entry: CalendarEntry, previousId?: string) => void;
  onDeleted: (id: string) => void;
  production?: EventDialogProduction;
};

export function EventDialog({
  state,
  onClose,
  onSaved,
  onDeleted,
  production = null,
}: EventDialogProps) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setForm(state ? toFormState(state, production) : null);
  }, [state, production]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const editingId = state?.mode === "edit" ? state.entry.id : null;
  const multiDay = Boolean(form && form.endDate && form.endDate !== form.date);

  const handleSave = async () => {
    if (!form) return;
    if (!form.title.trim()) {
      toast.error("Titel fehlt", { duration: 5000 });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/calendar-events/${editingId}` : "/api/calendar-events",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            kind: form.kind,
            date: form.date,
            endDate: form.endDate && form.endDate > form.date ? form.endDate : null,
            allDay: form.allDay,
            startTime: form.allDay ? null : form.startTime,
            endTime: form.allDay ? null : form.endTime || null,
            location: form.location,
            description: form.description,
            showId: form.showId,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        (CalendarEntry & { error?: string }) | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Termin konnte nicht gespeichert werden.");
      }
      onSaved(payload, editingId ?? undefined);
      toast.success(editingId ? "Termin aktualisiert" : "Termin angelegt", { duration: 3000 });
      onClose();
    } catch (error) {
      console.error("[sperrliste:event-save]", error);
      toast.error("Nicht gespeichert", {
        description: error instanceof Error ? error.message : undefined,
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    try {
      const response = await fetch(`/api/calendar-events/${editingId}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Termin konnte nicht gelöscht werden.");
      }
      onDeleted(editingId);
      toast.success("Termin gelöscht", { duration: 3000 });
      setConfirmOpen(false);
      onClose();
    } catch (error) {
      console.error("[sperrliste:event-delete]", error);
      toast.error("Nicht gelöscht", {
        description: error instanceof Error ? error.message : undefined,
        duration: 5000,
      });
    }
  };

  return (
    <>
      <ModalFormDialog
        title={editingId ? "Termin bearbeiten" : "Termin anlegen"}
        description="Termine erscheinen im Kalender und im Dashboard der Mitglieder."
        open={Boolean(state)}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {editingId ? (
              <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)}>
                <TrashIcon className="h-4 w-4" aria-hidden />
                Löschen
              </Button>
            ) : (
              <span />
            )}
            <AsyncButton
              type="button"
              isLoading={saving}
              loadingText="Speichert …"
              onClick={handleSave}
            >
              Speichern
            </AsyncButton>
          </div>
        }
      >
        {form ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="event-title">Titel</Label>
              <Input
                id="event-title"
                value={form.title}
                maxLength={120}
                placeholder="z. B. Mitgliederversammlung"
                onChange={(event) => update("title", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-kind">Art</Label>
              <Select
                value={form.kind}
                onValueChange={(value) => {
                  const kind = CALENDAR_EVENT_KINDS.find((entry) => entry === value);
                  if (kind) update("kind", kind);
                }}
              >
                <SelectTrigger id="event-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALENDAR_EVENT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {CALENDAR_EVENT_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="event-date">Datum</Label>
                <DateInput
                  id="event-date"
                  value={form.date}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            date: value,
                            endDate: current.endDate < value ? value : current.endDate,
                          }
                        : current,
                    );
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-end-date">Bis (optional)</Label>
                <DateInput
                  id="event-end-date"
                  value={form.endDate}
                  min={form.date}
                  onChange={(event) => update("endDate", event.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Ganztägig{multiDay ? " (mehrtägig)" : ""}</span>
              <Switch checked={form.allDay} onCheckedChange={(value) => update("allDay", value)} />
            </label>
            {!form.allDay ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="event-start">Beginn</Label>
                  <TimeInput
                    id="event-start"
                    value={form.startTime}
                    onChange={(event) => update("startTime", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-end">Ende (optional)</Label>
                  <TimeInput
                    id="event-end"
                    value={form.endTime}
                    onChange={(event) => update("endTime", event.target.value)}
                  />
                </div>
              </div>
            ) : null}
            {production || form.showId ? (
              <div className="space-y-1.5">
                <Label>Gilt für</Label>
                <SegmentedControl
                  aria-label="Gilt für"
                  fullWidth
                  value={form.showId ? "production" : "all"}
                  onValueChange={(value) =>
                    update(
                      "showId",
                      value === "production" ? (form.showId ?? production?.id ?? null) : null,
                    )
                  }
                  options={[
                    {
                      value: "production",
                      label:
                        form.showId && form.showId !== production?.id
                          ? "Andere Produktion"
                          : (production?.title ?? "Produktion"),
                    },
                    { value: "all", label: "Alle Produktionen" },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  {form.showId
                    ? "Erscheint nur in dieser Produktion."
                    : "Erscheint in jeder Produktion, z. B. Vereinstermine."}
                </p>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="event-location">Ort (optional)</Label>
              <Input
                id="event-location"
                value={form.location}
                maxLength={160}
                onChange={(event) => update("location", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-description">Beschreibung (optional)</Label>
              <Textarea
                id="event-description"
                value={form.description}
                rows={3}
                maxLength={2000}
                onChange={(event) => update("description", event.target.value)}
              />
            </div>
          </div>
        ) : null}
      </ModalFormDialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Termin löschen?"
        description="Der Termin verschwindet für alle Mitglieder aus dem Kalender."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
