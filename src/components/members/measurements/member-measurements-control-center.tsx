"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3 } from "lucide-react";

import { MeasurementForm } from "@/components/forms/measurement-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar, type AvatarSource } from "@/components/user-avatar";
import {
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_UNIT_LABELS,
  measurementResponseSchema,
  sortMeasurements,
  type MeasurementFormData,
  type MeasurementType,
  type MeasurementUnit,
} from "@/data/measurements";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { formatRelativeWithAbsolute } from "@/lib/datetime";

type MeasurementEntry = {
  id: string;
  type: MeasurementType;
  value: number;
  unit: MeasurementUnit;
  note: string | null;
  updatedAt: string;
};

type MeasurementMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  roles: Role[];
  avatarSource: AvatarSource | string | null;
  avatarUpdatedAt: string | null;
  measurements: MeasurementEntry[];
};

type MemberMeasurementsControlCenterProps = {
  members: MeasurementMember[];
};

type DialogState =
  | { mode: "create"; memberId: string }
  | { mode: "edit"; memberId: string; entry: MeasurementEntry };

type PreparedMember = MeasurementMember & {
  displayName: string;
  lastUpdated: string | null;
};

const ABSOLUTE_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function MemberMeasurementsControlCenter({
  members,
}: MemberMeasurementsControlCenterProps) {
  const [memberItems, setMemberItems] = useState<MeasurementMember[]>(() =>
    members.map((member) => ({
      ...member,
      measurements: sortMeasurements(member.measurements),
    })),
  );
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMemberItems(
      members.map((member) => ({
        ...member,
        measurements: sortMeasurements(member.measurements),
      })),
    );
  }, [members]);

  const preparedMembers = useMemo<PreparedMember[]>(() => {
    return memberItems.map((member) => {
      const displayName = buildDisplayName(member);
      const lastUpdated = member.measurements.reduce<string | null>((latest, entry) => {
        if (!entry.updatedAt) return latest;
        if (!latest || entry.updatedAt > latest) {
          return entry.updatedAt;
        }
        return latest;
      }, null);

      return { ...member, displayName, lastUpdated };
    });
  }, [memberItems]);

  const dialogMember = dialogState
    ? preparedMembers.find((member) => member.id === dialogState.memberId) ?? null
    : null;

  const handleClose = () => {
    if (saving) return;
    setDialogState(null);
  };

  const handleSubmit = async (memberId: string, data: MeasurementFormData) => {
    setSaving(true);
    try {
      const response = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, userId: memberId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Speichern der Maße fehlgeschlagen.";
        throw new Error(message);
      }

      const parsed = measurementResponseSchema.parse({
        ...payload,
        note: payload?.note ?? null,
      });

      const saved: MeasurementEntry = {
        id: parsed.id,
        type: parsed.type,
        value: parsed.value,
        unit: parsed.unit,
        note: parsed.note ?? null,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      };

      setMemberItems((prev) =>
        prev.map((member) => {
          if (member.id !== memberId) return member;
          const nextMeasurements = sortMeasurements([
            ...member.measurements.filter((entry) => entry.type !== saved.type),
            saved,
          ]);
          return { ...member, measurements: nextMeasurements };
        }),
      );

      setDialogState(null);
    } finally {
      setSaving(false);
    }
  };

  if (!preparedMembers.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-border/60 bg-background/80 p-8 text-center text-sm text-muted-foreground">
        <AlertTriangle className="h-5 w-5" />
        <p>Keine Mitglieder mit Körpermaßen gefunden. Lege neue Profile an oder versuche es später erneut.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {preparedMembers.map((member) => (
        <div
          key={member.id}
          className="rounded-lg border border-border/60 bg-background/80 p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-1 items-start gap-3">
              <UserAvatar
                name={member.displayName}
                avatarSource={member.avatarSource}
                avatarUpdatedAt={member.avatarUpdatedAt}
                className="h-11 w-11"
              />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{member.displayName}</p>
                <div className="flex flex-wrap gap-1">
                  {member.roles.length ? (
                    member.roles.map((role) => (
                      <Badge
                        key={role}
                        className={cn("text-[11px]", ROLE_BADGE_VARIANTS[role])}
                        variant="outline"
                      >
                        {ROLE_LABELS[role] ?? role}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Keine Rollen</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>{formatLastUpdated(member.lastUpdated)}</span>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setDialogState({ mode: "create", memberId: member.id })}
              disabled={saving}
            >
              Maß hinzufügen
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {member.measurements.length ? (
              member.measurements.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md border border-border/60 bg-muted/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {MEASUREMENT_TYPE_LABELS[entry.type] ?? entry.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.note?.trim() ? entry.note : "Keine Notiz"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{formatValue(entry.value)}</p>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          {MEASUREMENT_UNIT_LABELS[entry.unit] ?? entry.unit}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDialogState({ mode: "edit", memberId: member.id, entry })}
                        disabled={saving}
                      >
                        Bearbeiten
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span>Noch keine Maße hinterlegt.</span>
              </div>
            )}
          </div>
        </div>
      ))}

      <Dialog open={dialogState !== null} onOpenChange={(open) => (!open ? handleClose() : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === "edit"
                ? `${dialogState.entry ? MEASUREMENT_TYPE_LABELS[dialogState.entry.type] ?? dialogState.entry.type : "Maß"} anpassen`
                : "Neues Maß hinzufügen"}
            </DialogTitle>
            {dialogMember ? (
              <DialogDescription>
                {dialogState?.mode === "edit"
                  ? `Aktualisiere die Angaben von ${dialogMember.displayName}.`
                  : `Lege ein neues Maß für ${dialogMember.displayName} an.`}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {dialogState ? (
            <MeasurementForm
              initialData={
                dialogState.mode === "edit"
                  ? {
                      type: dialogState.entry.type,
                      value: dialogState.entry.value,
                      unit: dialogState.entry.unit,
                      note: dialogState.entry.note ?? "",
                    }
                  : undefined
              }
              disableTypeSelection={dialogState.mode === "edit"}
              onSubmit={(formData) => handleSubmit(dialogState.memberId, formData)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildDisplayName(member: {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}) {
  const parts = [member.firstName?.trim(), member.lastName?.trim()].filter(Boolean);
  if (parts.length) {
    return parts.join(" ");
  }
  if (member.name?.trim()) {
    return member.name.trim();
  }
  return "Unbekanntes Mitglied";
}

function formatValue(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : "—";
}

function formatLastUpdated(value: string | null) {
  if (!value) {
    return "Noch keine Maße";
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "Letzte Aktualisierung unbekannt";
  }
  const date = new Date(timestamp);
  return formatRelativeWithAbsolute(date, { absoluteFormatter: ABSOLUTE_DATE_FORMATTER }).combined;
}
