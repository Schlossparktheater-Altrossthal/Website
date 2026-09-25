"use client";

import { useEffect, useState } from "react";
import { eachDayOfInterval } from "date-fns";

import { AsyncButton } from "@/components/ui/async-button";
import { AVAILABILITY_STATUS, type AvailabilityStatus } from "@/components/ui/availability-status";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { parseDayKey, toDayKey } from "@/lib/sperrliste/day-tiers";
import { cn } from "@/lib/utils";

type RangeStatus = Exclude<AvailabilityStatus, "free">;

const MAX_DAYS = 62;

type RangeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: string;
  onSubmit: (dates: string[], status: RangeStatus, reason: string | null) => Promise<boolean>;
};

/** Mehrere Tage am Stück eintragen, z. B. Urlaub. */
export function RangeDialog({ open, onOpenChange, initialDate, onSubmit }: RangeDialogProps) {
  const [from, setFrom] = useState(initialDate);
  const [to, setTo] = useState(initialDate);
  const [status, setStatus] = useState<RangeStatus>("blocked");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFrom(initialDate);
    setTo(initialDate);
    setReason("");
    setStatus("blocked");
  }, [initialDate, open]);

  const valid = Boolean(from && to && to >= from);
  const dayCount = valid
    ? eachDayOfInterval({ start: parseDayKey(from), end: parseDayKey(to) }).length
    : 0;
  const tooLong = dayCount > MAX_DAYS;

  const handleSave = async () => {
    if (!valid || tooLong) return;
    setSaving(true);
    const dates = eachDayOfInterval({ start: parseDayKey(from), end: parseDayKey(to) }).map(
      toDayKey,
    );
    const ok = await onSubmit(dates, status, reason || null);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <ModalFormDialog
      title="Zeitraum eintragen"
      description="Zum Beispiel Urlaub oder eine Klausurphase. Bereits eingetragene Tage bleiben unverändert."
      open={open}
      onOpenChange={onOpenChange}
      footer={
        <AsyncButton
          type="button"
          isLoading={saving}
          loadingText="Speichert …"
          disabled={!valid || tooLong}
          onClick={handleSave}
        >
          {dayCount > 1 ? `${dayCount} Tage eintragen` : "Eintragen"}
        </AsyncButton>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="range-from">Von</Label>
            <DateInput
              id="range-from"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                if (event.target.value > to) setTo(event.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="range-to">Bis</Label>
            <DateInput
              id="range-to"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </div>
        {tooLong ? (
          <p className="text-xs text-destructive">Höchstens {MAX_DAYS} Tage auf einmal.</p>
        ) : null}
        <div className="space-y-1.5">
          <Label>Status</Label>
          <SegmentedControl
            aria-label="Status für den Zeitraum"
            fullWidth
            size="md"
            value={status}
            onValueChange={setStatus}
            options={(["preferred", "limited", "blocked"] as const).map((value) => ({
              value,
              label: AVAILABILITY_STATUS[value].label,
            }))}
            activeClassName={(value) =>
              cn(AVAILABILITY_STATUS[value].surface, AVAILABILITY_STATUS[value].text)
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="range-reason">Grund (optional)</Label>
          <Input
            id="range-reason"
            value={reason}
            maxLength={200}
            placeholder="z. B. Urlaub"
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Den Grund sehen nur Planer.</p>
        </div>
      </div>
    </ModalFormDialog>
  );
}
