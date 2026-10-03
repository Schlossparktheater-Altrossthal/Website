"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ExemplarFormValues } from "@/lib/inventory/asset-form-values";
import { CONDITION_LABELS, CONDITIONS, type Condition } from "@/lib/inventory/constants";

/** Zustand eines Exemplars – kurz genug für die oberste Ebene des Formulars. */
export function ConditionSelect({
  value,
  onChange,
}: {
  value: Condition;
  onChange: (value: Condition) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Zustand</Label>
      <Select value={value} onValueChange={(next) => onChange(next as Condition)}>
        <SelectTrigger aria-label="Zustand">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONDITIONS.map((condition) => (
            <SelectItem key={condition} value={condition}>
              {CONDITION_LABELS[condition]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Angaben, die je Exemplar verschieden sind. `single` = genau ein Exemplar (sonst ergeben
 * Zusatz und Seriennummer keinen Sinn).
 */
export function ExemplarFields<T extends ExemplarFormValues>({
  values,
  onChange,
  single,
  inspectionRequired,
  canManage,
}: {
  values: T;
  onChange: (values: T) => void;
  single: boolean;
  inspectionRequired: boolean;
  canManage: boolean;
}) {
  const set = <K extends keyof ExemplarFormValues>(key: K, value: ExemplarFormValues[K]) =>
    onChange({ ...values, [key]: value });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {single ? (
          <>
            <TextField
              id="label"
              label="Zusatz zum Namen"
              placeholder="z. B. Kiste 3, links"
              value={values.label}
              onChange={(value) => set("label", value)}
            />
            <TextField
              id="serial"
              label="Seriennummer"
              value={values.serialNumber}
              onChange={(value) => set("serialNumber", value)}
            />
          </>
        ) : null}
        {inspectionRequired ? (
          <div className="space-y-1.5">
            <Label htmlFor="exemplar-next-inspection">Nächste Prüfung</Label>
            <Input
              id="exemplar-next-inspection"
              type="date"
              value={values.nextInspectionAt}
              onChange={(event) => set("nextInspectionAt", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Leer = gleich prüfen</p>
          </div>
        ) : null}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="exemplar-note">Interne Notiz</Label>
          <Textarea
            id="exemplar-note"
            rows={2}
            value={values.internalNote}
            onChange={(event) => set("internalNote", event.target.value)}
            placeholder="Nur für Mitglieder mit Lagerzugriff"
          />
        </div>
      </div>
      {canManage ? (
        <fieldset className="grid grid-cols-1 gap-4 rounded-lg border border-border p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Anschaffung{single ? "" : " (je Stück)"} – nur für die Lagerverwaltung sichtbar
          </legend>
          <TextField
            id="cost"
            label="Preis (€)"
            inputMode="decimal"
            value={values.acquisitionCost}
            onChange={(value) => set("acquisitionCost", value)}
          />
          <div className="space-y-1.5">
            <Label htmlFor="exemplar-purchase">Kaufdatum</Label>
            <Input
              id="exemplar-purchase"
              type="date"
              value={values.purchaseDate}
              onChange={(event) => set("purchaseDate", event.target.value)}
            />
          </div>
          <TextField
            id="supplier"
            label="Händler"
            value={values.supplier}
            onChange={(value) => set("supplier", value)}
          />
          <TextField
            id="ownership"
            label="Eigentum"
            placeholder="z. B. Leihgabe von …"
            value={values.ownership}
            onChange={(value) => set("ownership", value)}
          />
        </fieldset>
      ) : null}
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`exemplar-${id}`}>{label}</Label>
      <Input
        id={`exemplar-${id}`}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
