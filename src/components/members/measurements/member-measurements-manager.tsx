"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MeasurementForm } from "@/components/forms/measurement-form";
import { useOptionalProfileCompletion } from "@/components/members/profile-completion-context";
import {
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_UNIT_LABELS,
  measurementResponseSchema,
  sortMeasurements,
  type MeasurementFormData,
  type MeasurementType,
  type MeasurementUnit,
} from "@/data/measurements";

interface MeasurementEntry {
  id: string;
  type: MeasurementType;
  value: number;
  unit: MeasurementUnit;
  note?: string | null;
  updatedAt: string;
}

interface MemberMeasurementsManagerProps {
  initialMeasurements: MeasurementEntry[];
  onMeasurementsChange?: (measurements: MeasurementEntry[]) => void;
}

type DialogState =
  | { mode: "create"; initialType?: MeasurementType | null }
  | { mode: "edit"; entry: MeasurementEntry };

export function MemberMeasurementsManager({
  initialMeasurements,
  onMeasurementsChange,
}: MemberMeasurementsManagerProps) {
  const [measurements, setMeasurements] = useState(() =>
    sortMeasurements(initialMeasurements),
  );
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const profileCompletion = useOptionalProfileCompletion();

  const notifyMeasurementsChange = useCallback(
    (next: MeasurementEntry[]) => {
      onMeasurementsChange?.(next);
    },
    [onMeasurementsChange],
  );

  const openCreateDialog = () => {
    setDialogState({ mode: "create" });
  };

  const openEditDialog = (entry: MeasurementEntry) => {
    setDialogState({ mode: "edit", entry });
  };

  const closeDialog = () => {
    if (submitting) return;
    setDialogState(null);
  };

  const handleSubmit = async (data: MeasurementFormData) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          typeof error?.error === "string"
            ? error.error
            : "Speichern der Maße fehlgeschlagen.",
        );
      }

      const payload = await response.json();
      const parsed = measurementResponseSchema.parse(payload);
      const saved: MeasurementEntry = {
        id:
          typeof parsed?.id === "string"
            ? parsed.id
            : `${parsed.type}-${Date.now()}`,
        type: parsed.type,
        value: parsed.value,
        unit: parsed.unit,
        note: parsed.note ?? null,
        updatedAt:
          typeof parsed?.updatedAt === "string"
            ? parsed.updatedAt
            : new Date().toISOString(),
      };
      setMeasurements((prev) => {
        const withoutType = prev.filter((entry) => entry.type !== saved.type);
        const next = sortMeasurements([...withoutType, saved]);
        profileCompletion?.setItemComplete("measurements", next.length > 0);
        notifyMeasurementsChange(next);
        return next;
      });
      setDialogState(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border/60 bg-background/70">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold">Körpermaße</CardTitle>
            <p className="text-sm text-muted-foreground">
              Hinterlege deine Maße für Anproben und Kostümabstimmungen. Änderungen
              stehen deinem Kostüm-Team sofort zur Verfügung.
            </p>
          </div>
          <Button size="sm" onClick={openCreateDialog}>
            Neues Maß erfassen
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {measurements.length ? (
          <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-background/60">
            {measurements.map((entry) => (
              <li
                key={entry.type}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {MEASUREMENT_TYPE_LABELS[entry.type]}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {entry.unit in MEASUREMENT_UNIT_LABELS
                        ? MEASUREMENT_UNIT_LABELS[entry.unit]
                        : entry.unit}
                    </Badge>
                  </div>
                  <p className="text-2xl font-semibold tracking-tight">
                    {formatValue(entry.value)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Aktualisiert am {formatDate(entry.updatedAt)}
                  </p>
                  {entry.note ? (
                    <p className="text-xs text-muted-foreground/90">
                      Hinweis: {entry.note}
                    </p>
                  ) : null}
                </div>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(entry)}>
                  Bearbeiten
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
            Noch keine Maße hinterlegt. Erfasse deine Körpermaße in deinem Profil, damit das Kostüm-Team dich{" "}
            bei Anproben optimal unterstützen und in der Gewerke-Übersicht den Überblick behalten kann.
          </div>
        )}

        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
          Datenschutz-Hinweis: Deine Maße sind ausschließlich für dich und Mitglieder des Kostüm-Teams sichtbar,
          die für Anproben zuständig sind.
        </div>
      </CardContent>

      <Dialog open={dialogState !== null} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === "edit"
                ? `${MEASUREMENT_TYPE_LABELS[dialogState.entry.type]} bearbeiten`
                : "Neues Maß hinzufügen"}
            </DialogTitle>
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
                  : dialogState.initialType
                    ? { type: dialogState.initialType }
                    : undefined
              }
              disableTypeSelection={dialogState.mode === "edit"}
              onSubmit={handleSubmit}
            />
          ) : (
            <div className="h-48 w-full animate-pulse rounded-xl border border-border/50 bg-muted/30" />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function formatValue(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 }) : "-";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unbekannt";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
