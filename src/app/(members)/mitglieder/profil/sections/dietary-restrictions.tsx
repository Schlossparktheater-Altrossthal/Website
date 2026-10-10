"use client";

import type { AllergyLevel, RestrictionKind } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ChevronDownIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ALLERGEN_CATALOG, normalizeDietaryLabel } from "@/data/allergens";
import { splitAllergenList } from "@/lib/food/split-list";
import type { TaxonSuggestion } from "@/lib/food/taxon-suggestions";
import { cn } from "@/lib/utils";

import { deleteAllergyAction, upsertAllergyAction } from "../actions/allergies";
import { deleteAversionAction, upsertAversionAction } from "../actions/aversions";
import type { Allergy, Aversion } from "../profile-shared";

/**
 * Allergien, Unverträglichkeiten und Abneigungen als eine Liste (Profil → Ernährung).
 * Die Stufe entscheidet, wo gespeichert wird: „Mag ich nicht“ ist eine Abneigung, alle anderen
 * sind Allergie-Einträge. Bearbeiten im Sheet: Schnellauswahl, Suche, Stufe, Details auf Wunsch.
 */

type Stage = "aversion" | "intolerance" | "allergy" | "severe";

const STAGES: { value: Stage; label: string; short: string; hint: string }[] = [
  {
    value: "aversion",
    label: "Mag ich nicht",
    short: "Mag nicht",
    hint: "Kein medizinischer Grund – die Küche berücksichtigt es, wenn es geht.",
  },
  {
    value: "intolerance",
    label: "Verträgt nicht",
    short: "Verträgt nicht",
    hint: "Unverträglichkeit, z. B. Bauchschmerzen – kein Notfall.",
  },
  {
    value: "allergy",
    label: "Allergie",
    short: "Allergie",
    hint: "Allergische Reaktion – muss sicher weggelassen werden.",
  },
  {
    value: "severe",
    label: "Schwer",
    short: "Schwer",
    hint: "Starke Reaktion, Notfall möglich.",
  },
];

const STAGE_CHIP: Record<Stage, string> = {
  aversion: "border-border bg-muted text-foreground",
  intolerance: "border-warning/30 bg-warning/10 text-foreground",
  allergy: "border-warning/60 bg-warning/20 text-foreground",
  severe: "border-destructive/50 bg-destructive/10 text-destructive",
};

const STAGE_ACTIVE: Record<Stage, string> = {
  aversion: "bg-background text-foreground",
  intolerance: "bg-warning/25 text-foreground",
  allergy: "bg-warning/50 text-foreground",
  severe: "bg-destructive text-destructive-foreground",
};

const STAGE_ORDER: Record<Stage, number> = { severe: 0, allergy: 1, intolerance: 2, aversion: 3 };

/** Schnellauswahl: die 14 kennzeichnungspflichtigen Allergene und häufige Unverträglichkeiten. */
const QUICK_VALUES = [
  "gluten",
  "milk-protein",
  "lactose",
  "eggs",
  "peanuts",
  "tree-nuts",
  "soy",
  "fish",
  "crustaceans",
  "molluscs",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "fructose",
  "histamine",
];
const QUICK = QUICK_VALUES.flatMap((value) => {
  const entry = ALLERGEN_CATALOG.find((item) => item.value === value);
  return entry ? [entry] : [];
});

function stageOfAllergy(entry: Pick<Allergy, "kind" | "level">): Stage {
  if (entry.level === "SEVERE" || entry.level === "LETHAL") return "severe";
  if (entry.kind === "ALLERGY") return "allergy";
  return "intolerance";
}

function kindAndLevel(
  stage: Stage,
  lethal: boolean,
): { kind: RestrictionKind; level: AllergyLevel } {
  switch (stage) {
    case "severe":
      return {
        kind: "ALLERGY",
        level: lethal ? "LETHAL" : "SEVERE",
      };
    case "allergy":
      return { kind: "ALLERGY", level: "MODERATE" };
    default:
      return { kind: "INTOLERANCE", level: "MILD" };
  }
}

type Entry =
  | { type: "allergy"; id: string; label: string; stage: Stage; entry: Allergy }
  | { type: "aversion"; id: string; label: string; stage: "aversion"; entry: Aversion };

type FormState = {
  text: string;
  stage: Stage;
  lethal: boolean;
  tracesOk: boolean | null;
  diagnosed: boolean;
  symptoms: string;
  treatment: string;
  note: string;
};

const EMPTY_FORM: FormState = {
  text: "",
  stage: "allergy",
  lethal: false,
  tracesOk: null,
  diagnosed: false,
  symptoms: "",
  treatment: "",
  note: "",
};

function formFromEntry(entry: Entry): FormState {
  if (entry.type === "aversion") {
    return { ...EMPTY_FORM, text: entry.label, stage: "aversion", note: entry.entry.note ?? "" };
  }
  const allergy = entry.entry;
  return {
    text: allergy.allergen,
    stage: entry.stage,
    lethal: allergy.level === "LETHAL",
    tracesOk: allergy.tracesOk,
    diagnosed: allergy.diagnosed,
    symptoms: allergy.symptoms ?? "",
    treatment: allergy.treatment ?? "",
    note: allergy.note ?? "",
  };
}

export function DietaryRestrictions({
  allergies,
  onAllergiesChange,
  aversions,
  onAversionsChange,
}: {
  allergies: Allergy[];
  onAllergiesChange: (next: Allergy[]) => void;
  aversions: Aversion[];
  onAversionsChange: (next: Aversion[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const entries = useMemo<Entry[]>(
    () =>
      [
        ...allergies.map((entry): Entry => ({
          type: "allergy",
          id: entry.id,
          label: entry.allergen,
          stage: stageOfAllergy(entry),
          entry,
        })),
        ...aversions.map((entry): Entry => ({
          type: "aversion",
          id: entry.id,
          label: entry.label,
          stage: "aversion",
          entry,
        })),
      ].sort(
        (a, b) =>
          STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.label.localeCompare(b.label, "de"),
      ),
    [allergies, aversions],
  );

  const existing = useMemo(
    () => new Set(entries.map((entry) => normalizeDietaryLabel(entry.label))),
    [entries],
  );

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  };

  const openEdit = (entry: Entry) => {
    setEditing(entry);
    setForm(formFromEntry(entry));
    setError(null);
    setOpen(true);
  };

  const removeEntry = async (entry: Entry): Promise<boolean> => {
    const result =
      entry.type === "allergy"
        ? await deleteAllergyAction(entry.label)
        : await deleteAversionAction(entry.label);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    if (entry.type === "allergy") {
      onAllergiesChange(allergies.filter((item) => item.id !== entry.id));
    } else {
      onAversionsChange(aversions.filter((item) => item.id !== entry.id));
    }
    return true;
  };

  const parts = editing ? [] : splitAllergenList(form.text);
  const labels = parts.length > 1 ? parts : [form.text.trim()];

  const save = async () => {
    setError(null);
    if (form.text.trim().length < 2) {
      setError("Bitte angeben, worum es geht.");
      return;
    }
    setSaving(true);
    try {
      let nextAllergies =
        editing?.type === "allergy"
          ? allergies.filter((item) => item.id !== editing.id)
          : [...allergies];
      let nextAversions =
        editing?.type === "aversion"
          ? aversions.filter((item) => item.id !== editing.id)
          : [...aversions];

      // Typwechsel oder Umbenennung: alten Eintrag entfernen (gespeichert wird nach Name).
      const renamed =
        editing && normalizeDietaryLabel(editing.label) !== normalizeDietaryLabel(form.text);
      const typeChanged = editing && (editing.type === "aversion") !== (form.stage === "aversion");
      if (editing && (renamed || typeChanged)) {
        const result =
          editing.type === "allergy"
            ? await deleteAllergyAction(editing.label)
            : await deleteAversionAction(editing.label);
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }

      for (const label of labels) {
        if (form.stage === "aversion") {
          const result = await upsertAversionAction({ label, note: form.note.trim() || undefined });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          const saved = result.data.aversion;
          nextAversions = [
            ...nextAversions.filter(
              (item) => normalizeDietaryLabel(item.label) !== normalizeDietaryLabel(saved.label),
            ),
            { id: saved.id, label: saved.label, note: saved.note, updatedAt: saved.updatedAt },
          ];
        } else {
          // Unveränderte Stufe behält die genaue Art/den Schweregrad des Bestands.
          const keep =
            editing?.type === "allergy" && editing.stage === form.stage && form.stage !== "severe";
          const { kind, level } = keep
            ? {
                kind: editing.entry.kind as RestrictionKind,
                level: editing.entry.level as AllergyLevel,
              }
            : kindAndLevel(form.stage, form.lethal);
          const result = await upsertAllergyAction({
            allergen: label,
            kind,
            level,
            tracesOk: form.stage === "intolerance" ? null : form.tracesOk,
            diagnosed: form.diagnosed,
            symptoms: form.symptoms.trim() || null,
            treatment: form.treatment.trim() || null,
            note: form.note.trim() || null,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          const saved = result.data.allergy;
          nextAllergies = [
            ...nextAllergies.filter(
              (item) =>
                normalizeDietaryLabel(item.allergen) !== normalizeDietaryLabel(saved.allergen),
            ),
            saved,
          ];
        }
      }
      onAllergiesChange(nextAllergies.sort((a, b) => a.allergen.localeCompare(b.allergen, "de")));
      onAversionsChange(nextAversions.sort((a, b) => a.label.localeCompare(b.label, "de")));
      toast.success(labels.length > 1 ? `${labels.length} Einträge gespeichert` : "Gespeichert");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="plain" size="md" className="space-y-3">
      <SectionHeader
        title="Allergien & Abneigungen"
        as="h3"
        description="Was du nicht verträgst oder nicht magst – die Küche plant danach."
        action={
          <Button type="button" size="sm" variant="outline" onClick={openNew}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            Hinzufügen
          </Button>
        }
      />
      {entries.length === 0 ? (
        <button
          type="button"
          onClick={openNew}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6 text-sm text-muted-foreground hover:bg-muted/40"
        >
          <PlusIcon className="h-4 w-4 shrink-0" aria-hidden />
          Noch nichts eingetragen
        </button>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2">
            {entries.map((entry) => (
              <li key={`${entry.type}-${entry.id}`}>
                <button
                  type="button"
                  onClick={() => openEdit(entry)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    STAGE_CHIP[entry.stage],
                  )}
                >
                  {entry.label}
                  <span className="text-xs font-normal opacity-75">
                    {entry.type === "allergy" && entry.entry.level === "LETHAL"
                      ? "Notfall"
                      : STAGES.find((stage) => stage.value === entry.stage)?.short}
                  </span>
                  {entry.type === "allergy" && entry.entry.taxonCode === null ? (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-warning"
                      title="Wird von der Verpflegung zugeordnet"
                      aria-label="wird geprüft"
                    />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Antippen zum Ändern oder Entfernen.</p>
        </>
      )}

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? editing.label : "Hinzufügen"}
        description="Allergie, Unverträglichkeit oder Abneigung eintragen"
        className="sm:max-w-lg"
        footer={
          <div className="flex items-center gap-2">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Entfernen"
                title="Entfernen"
                onClick={() => setConfirmDelete(true)}
                className="text-destructive hover:text-destructive"
              >
                <TrashIcon />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="ml-auto"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <AsyncButton type="button" isLoading={saving} loadingText="Speichern…" onClick={save}>
              {labels.length > 1 ? `${labels.length} speichern` : "Speichern"}
            </AsyncButton>
          </div>
        }
      >
        <RestrictionForm
          form={form}
          onChange={setForm}
          isNew={!editing}
          existing={existing}
          parts={parts}
          error={error}
        />
      </BottomSheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eintrag entfernen?"
        description={`„${editing?.label ?? ""}“ wird aus deinem Profil gelöscht.`}
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          const entry = editing;
          if (!entry) return;
          void removeEntry(entry).then((ok) => {
            if (ok) {
              toast.success("Entfernt");
              setOpen(false);
            }
          });
        }}
      />
    </Card>
  );
}

const SEARCH_DELAY_MS = 200;

function useTaxonSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<TaxonSuggestion[]>([]);
  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/food/taxa?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { items: [] }))
        .then((data: { items?: TaxonSuggestion[] }) => setResults(data.items ?? []))
        .catch(() => undefined);
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled]);
  return enabled && query.trim().length >= 2 ? results : [];
}

function RestrictionForm({
  form,
  onChange,
  isNew,
  existing,
  parts,
  error,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  isNew: boolean;
  existing: Set<string>;
  parts: string[];
  error: string | null;
}) {
  const [searching, setSearching] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(form.symptoms || form.treatment || form.diagnosed),
  );
  const results = useTaxonSearch(form.text, searching);
  const set = (patch: Partial<FormState>) => onChange({ ...form, ...patch });
  const medical = form.stage !== "aversion";
  const showDetails = medical && (detailsOpen || form.stage === "severe");
  const stageInfo = STAGES.find((stage) => stage.value === form.stage);

  const pick = (text: string, stage?: Stage) => {
    setSearching(false);
    onChange({ ...form, text, stage: stage ?? form.stage });
  };

  return (
    <div className="space-y-5">
      {isNew ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Häufig
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((entry) => {
              const taken = existing.has(normalizeDietaryLabel(entry.label));
              const active =
                normalizeDietaryLabel(form.text) === normalizeDietaryLabel(entry.label);
              return (
                <button
                  key={entry.value}
                  type="button"
                  disabled={taken}
                  aria-pressed={active}
                  onClick={() =>
                    pick(entry.label, entry.kind === "INTOLERANCE" ? "intolerance" : "allergy")
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted",
                    taken && "cursor-default opacity-40",
                  )}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="restriction-text" className="text-sm font-medium text-foreground">
          {isNew ? "Oder suchen / selbst schreiben" : "Bezeichnung"}
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="restriction-text"
            value={form.text}
            onChange={(event) => {
              setSearching(true);
              set({ text: event.target.value });
            }}
            onBlur={() => setTimeout(() => setSearching(false), 150)}
            placeholder="z. B. Haselnuss, Pilze, Koriander"
            autoComplete="off"
            className="pl-9"
          />
          {results.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
              {results.map((taxon) => (
                <li key={taxon.code}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(taxon.name)}
                    className="flex min-h-10 w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium text-foreground">{taxon.name}</span>
                    {taxon.path.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {taxon.path.join(" › ")}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {parts.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            Wird getrennt gespeichert: {parts.join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">Wie stark?</p>
        <div
          role="radiogroup"
          aria-label="Stufe"
          className="grid grid-cols-4 gap-1 rounded-lg bg-muted/70 p-1"
        >
          {STAGES.map((stage) => {
            const active = stage.value === form.stage;
            return (
              <button
                key={stage.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ stage: stage.value })}
                className={cn(
                  "min-h-11 rounded-md px-1 py-1.5 text-center text-xs font-medium leading-tight transition sm:text-sm",
                  active
                    ? cn(STAGE_ACTIVE[stage.value], "shadow-sm")
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {stage.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{stageInfo?.hint}</p>
      </div>

      {form.stage === "severe" ? (
        <ToggleRow
          label="Lebensbedrohlich"
          hint="Notfallmedikament nötig (z. B. Adrenalin-Pen)."
          checked={form.lethal}
          onChange={(lethal) => set({ lethal })}
        />
      ) : null}

      {form.stage === "allergy" || form.stage === "severe" ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Spuren</p>
          <SegmentedControl
            aria-label="Spuren"
            fullWidth
            value={form.tracesOk === true ? "ok" : form.tracesOk === false ? "risk" : "unset"}
            onValueChange={(value) =>
              set({ tracesOk: value === "ok" ? true : value === "risk" ? false : null })
            }
            options={[
              { value: "ok", label: "Unproblematisch" },
              { value: "risk", label: "Gefährlich" },
              { value: "unset", label: "Weiß nicht" },
            ]}
            className="[&>button]:flex-1"
          />
        </div>
      ) : null}

      {medical ? (
        <div className="space-y-3">
          {form.stage !== "severe" ? (
            <button
              type="button"
              onClick={() => setDetailsOpen((value) => !value)}
              aria-expanded={showDetails}
              className="flex items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronDownIcon
                className={cn("h-4 w-4 shrink-0 transition-transform", showDetails && "rotate-180")}
              />
              Mehr Angaben
              <span className="font-normal">· Symptome, Notfall</span>
            </button>
          ) : null}
          {showDetails ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <ToggleRow
                label="Ärztlich abgeklärt"
                hint="Aus einer Untersuchung bekannt, nicht nur vermutet."
                checked={form.diagnosed}
                onChange={(diagnosed) => set({ diagnosed })}
              />
              <TextField
                id="restriction-symptoms"
                label="Symptome"
                value={form.symptoms}
                onChange={(symptoms) => set({ symptoms })}
              />
              <TextField
                id="restriction-treatment"
                label="Was hilft im Notfall?"
                value={form.treatment}
                onChange={(treatment) => set({ treatment })}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <TextField
        id="restriction-note"
        label="Notiz (optional)"
        value={form.note}
        onChange={(note) => set({ note })}
        placeholder={medical ? "z. B. gekocht verträglich" : "z. B. gilt auch für Trüffel"}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Textarea
        id={id}
        rows={2}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
