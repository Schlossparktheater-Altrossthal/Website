"use client";

import { useState } from "react";

import { MeasurementForm } from "@/components/forms/measurement-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import {
  MEASUREMENT_TYPE_DESCRIPTIONS,
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_UNIT_LABELS,
  measurementResponseSchema,
  measurementTypeEnum,
  type MeasurementFormData,
  type MeasurementType,
} from "@/data/measurements";
import { cn } from "@/lib/utils";

import type { ProfileMeasurement } from "../profile-shared";

type MeasurementsSectionProps = {
  measurements: ProfileMeasurement[];
  onMeasurementsChange: (next: ProfileMeasurement[]) => void;
};

const NUMBER_FORMAT = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** Eigene Körpermaße für das Kostüm-Team. Nur für Personen im Ensemble sichtbar. */
export function MeasurementsSection({
  measurements,
  onMeasurementsChange,
}: MeasurementsSectionProps) {
  const [editing, setEditing] = useState<MeasurementType | null>(null);
  const byType = new Map(measurements.map((entry) => [entry.type, entry]));
  const current = editing ? (byType.get(editing) ?? null) : null;

  const handleSubmit = async (data: MeasurementFormData) => {
    const response = await fetch("/api/measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      throw new Error(
        typeof payload?.error === "string" ? payload.error : "Speichern der Maße fehlgeschlagen.",
      );
    }
    const saved = measurementResponseSchema.parse({ ...payload, note: payload.note ?? null });
    onMeasurementsChange([
      ...measurements.filter((entry) => entry.type !== saved.type),
      {
        id: saved.id,
        type: saved.type,
        value: saved.value,
        unit: saved.unit,
        note: saved.note ?? null,
        updatedAt: saved.updatedAt ?? new Date().toISOString(),
      },
    ]);
    setEditing(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {byType.size} von {measurementTypeEnum.options.length} Maßen eingetragen. Am besten misst
        dich jemand anderes, mit Maßband und in leichter Kleidung. Das Kostüm-Team sieht und ergänzt
        diese Angaben.
      </p>
      <div className="rounded-lg border border-border/60 bg-card p-1 shadow-sm">
        <ListRowGroup>
          {measurementTypeEnum.options.map((type) => {
            const entry = byType.get(type);
            return (
              <ListRow
                key={type}
                onClick={() => setEditing(type)}
                title={MEASUREMENT_TYPE_LABELS[type]}
                description={
                  <span className={cn(!entry && "text-warning")}>
                    {entry
                      ? `${NUMBER_FORMAT.format(entry.value)} ${MEASUREMENT_UNIT_LABELS[entry.unit]}${
                          entry.note ? ` · ${entry.note}` : ""
                        }`
                      : "Noch nicht eingetragen"}
                  </span>
                }
                chevron
              />
            );
          })}
        </ListRowGroup>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => (!open ? setEditing(null) : null)}>
        <DialogContent className="max-w-md">
          {editing ? (
            <>
              <DialogHeader>
                <DialogTitle>{MEASUREMENT_TYPE_LABELS[editing]}</DialogTitle>
                <DialogDescription>{MEASUREMENT_TYPE_DESCRIPTIONS[editing]}</DialogDescription>
              </DialogHeader>
              <MeasurementForm
                key={editing}
                disableTypeSelection
                initialData={
                  current
                    ? {
                        type: current.type,
                        value: current.value,
                        unit: current.unit,
                        note: current.note ?? "",
                      }
                    : { type: editing }
                }
                onSubmit={handleSubmit}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
