"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CloseIcon, PrinterIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { parseInventoryCode } from "@/lib/inventory/constants";
import {
  CUSTOM_TEMPLATE_ID,
  DEFAULT_LABEL_CONTENT,
  findLabelTemplate,
  LABEL_SHEET_TEMPLATES,
  labelsPerSheet,
  validateLabelTemplate,
  type LabelContentOptions,
  type LabelSheetTemplate,
} from "@/lib/inventory/label-templates";
import { cn } from "@/lib/utils";

export type LabelCandidate = { code: string; name: string };

const STORAGE_KEY = "lager.etiketten.v1";

type Stored = {
  templateId: string;
  custom: LabelSheetTemplate;
  content: LabelContentOptions;
};

const DEFAULT_CUSTOM: LabelSheetTemplate = {
  ...LABEL_SHEET_TEMPLATES[0]!,
  id: CUSTOM_TEMPLATE_ID,
  label: "Eigenes Format",
  hint: "",
};

const CUSTOM_FIELDS: { key: keyof LabelSheetTemplate; label: string; step: string }[] = [
  { key: "columns", label: "Spalten", step: "1" },
  { key: "rows", label: "Zeilen", step: "1" },
  { key: "width", label: "Breite (mm)", step: "0.1" },
  { key: "height", label: "Höhe (mm)", step: "0.1" },
  { key: "marginTop", label: "Rand oben", step: "0.1" },
  { key: "marginLeft", label: "Rand links", step: "0.1" },
  { key: "gapX", label: "Abstand waagerecht", step: "0.1" },
  { key: "gapY", label: "Abstand senkrecht", step: "0.1" },
];

/**
 * Etiketten zusammenstellen und als PDF drucken. Bogen und Inhalt merkt sich das Gerät;
 * auf angebrochenen Bögen wählt man das erste freie Feld per Tipp.
 */
export function LabelDesigner({
  initial,
  presets,
}: {
  initial: LabelCandidate[];
  presets: { id: string; label: string; items: LabelCandidate[] }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<LabelCandidate[]>(initial);
  const [manual, setManual] = React.useState("");
  const [templateId, setTemplateId] = React.useState(LABEL_SHEET_TEMPLATES[0]!.id);
  const [custom, setCustom] = React.useState<LabelSheetTemplate>(DEFAULT_CUSTOM);
  const [content, setContent] = React.useState<LabelContentOptions>(DEFAULT_LABEL_CONTENT);
  const [skip, setSkip] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as Partial<Stored>;
      if (stored.templateId) setTemplateId(stored.templateId);
      if (stored.custom) setCustom({ ...DEFAULT_CUSTOM, ...stored.custom });
      if (stored.content) setContent({ ...DEFAULT_LABEL_CONTENT, ...stored.content });
    } catch (error) {
      console.warn("Etiketten-Einstellungen nicht lesbar", error);
    }
  }, []);

  React.useEffect(() => {
    const stored: Stored = { templateId, custom, content };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [templateId, custom, content]);

  const template =
    templateId === CUSTOM_TEMPLATE_ID
      ? custom
      : (findLabelTemplate(templateId) ?? LABEL_SHEET_TEMPLATES[0]!);
  const perSheet = labelsPerSheet(template);
  const invalid = templateId === CUSTOM_TEMPLATE_ID ? validateLabelTemplate(custom) : null;
  const sheets = selected.length ? Math.ceil((selected.length + skip) / perSheet) : 0;

  React.useEffect(() => {
    if (skip >= perSheet) setSkip(0);
  }, [perSheet, skip]);

  const add = (items: LabelCandidate[]) =>
    setSelected((current) => {
      const known = new Set(current.map((item) => item.code));
      return [...current, ...items.filter((item) => !known.has(item.code))];
    });

  const addManual = () => {
    const codes = manual
      .split(/[\s,;]+/)
      .map(parseInventoryCode)
      .filter((code): code is string => Boolean(code));
    if (!codes.length) {
      toast.error("Keine gültigen Codes erkannt.");
      return;
    }
    add(codes.map((code) => ({ code, name: "" })));
    setManual("");
  };

  const print = async (outlines: boolean) => {
    if (!selected.length || invalid) return;
    setBusy(true);
    // Fenster sofort öffnen – Safari blockt Pop-ups nach einem await.
    const preview = window.open("", "_blank");
    try {
      const response = await fetch("/api/lager/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codes: selected.map((item) => item.code),
          templateId,
          custom: templateId === CUSTOM_TEMPLATE_ID ? custom : undefined,
          skip,
          outlines,
          markPrinted: !outlines,
          content,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "PDF konnte nicht erstellt werden.");
      }
      const url = URL.createObjectURL(await response.blob());
      if (preview) preview.location.href = url;
      else window.location.href = url;
      if (!outlines) {
        toast.success("PDF erstellt – drucken mit „Tatsächliche Größe“ (100 %).");
        router.refresh();
      }
    } catch (error) {
      preview?.close();
      toast.error(error instanceof Error ? error.message : "PDF konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-foreground">
            Auswahl <span className="font-normal text-muted-foreground">({selected.length})</span>
          </h2>
          {selected.length ? (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected([])}>
              Leeren
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant="outline"
              disabled={!preset.items.length}
              onClick={() => add(preset.items)}
            >
              {preset.label} ({preset.items.length})
            </Button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addManual();
          }}
        >
          <Input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Codes eingeben, z. B. T-0001 T-0002"
            aria-label="Codes hinzufügen"
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" disabled={!manual.trim()}>
            Hinzufügen
          </Button>
        </form>
        {selected.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {selected.map((item) => (
              <li
                key={item.code}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 py-1 pr-1 pl-3 text-xs"
              >
                <span className="font-mono font-medium">{item.code}</span>
                {item.name ? (
                  <span className="truncate text-muted-foreground">{item.name}</span>
                ) : null}
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                  aria-label={`${item.code} entfernen`}
                  onClick={() =>
                    setSelected((current) => current.filter((entry) => entry.code !== item.code))
                  }
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch nichts ausgewählt. Nimm z. B. alle Objekte ohne Etikett.
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
        <h2 className="font-semibold text-foreground">Bogen</h2>
        <div className="space-y-1.5">
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger aria-label="Etikettenbogen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LABEL_SHEET_TEMPLATES.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_TEMPLATE_ID}>Eigenes Format …</SelectItem>
            </SelectContent>
          </Select>
          {templateId !== CUSTOM_TEMPLATE_ID ? (
            <p className="text-xs text-muted-foreground">{template.hint}</p>
          ) : null}
        </div>
        {templateId === CUSTOM_TEMPLATE_ID ? (
          <div className="grid grid-cols-2 gap-3">
            {CUSTOM_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={`custom-${field.key}`} className="text-xs">
                  {field.label}
                </Label>
                <Input
                  id={`custom-${field.key}`}
                  type="number"
                  inputMode="decimal"
                  step={field.step}
                  min={0}
                  value={String(custom[field.key])}
                  onChange={(event) =>
                    setCustom((current) => ({
                      ...current,
                      [field.key]: Number(event.target.value),
                    }))
                  }
                />
              </div>
            ))}
            {invalid ? <p className="col-span-2 text-xs text-destructive">{invalid}</p> : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Erstes freies Feld</p>
          <SheetPreview template={template} skip={skip} onSkip={setSkip} />
          <p className="text-xs text-muted-foreground">
            Tippe auf das erste noch freie Etikett eines angebrochenen Bogens.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Inhalt</p>
          {(
            [
              ["showName", "Name"],
              ["showArea", "Bereich & Kategorie"],
              ["showInspection", "Prüfdatum (Elektroprüfung)"],
              ["showOrganisation", "Vereinsname"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 text-sm">
              {label}
              <Switch
                checked={content[key]}
                onCheckedChange={(checked) =>
                  setContent((current) => ({ ...current, [key]: checked }))
                }
                aria-label={label}
              />
            </label>
          ))}
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Button
            size="lg"
            className="w-full"
            disabled={busy || !selected.length || Boolean(invalid)}
            onClick={() => print(false)}
          >
            <PrinterIcon className="mr-2 h-4 w-4" />
            {selected.length
              ? `${selected.length} Etiketten · ${sheets} ${sheets === 1 ? "Bogen" : "Bögen"}`
              : "Etiketten drucken"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy || !selected.length || Boolean(invalid)}
            onClick={() => print(true)}
          >
            Probedruck mit Rahmen auf Normalpapier
          </Button>
          <p className="text-xs text-muted-foreground">
            Im Druckdialog „Tatsächliche Größe“ bzw. 100 % wählen. Den Probedruck auf den Bogen
            legen und gegen das Licht halten – passt alles, echte Bögen einlegen.
          </p>
        </div>
      </section>
    </div>
  );
}

function SheetPreview({
  template,
  skip,
  onSkip,
}: {
  template: LabelSheetTemplate;
  skip: number;
  onSkip: (value: number) => void;
}) {
  const total = labelsPerSheet(template);
  const cells = Array.from({ length: Math.min(total, 120) }, (_, index) => index);
  return (
    <div
      className="mx-auto grid w-full max-w-[14rem] gap-0.5 rounded-md border border-border bg-background p-1.5"
      style={{
        gridTemplateColumns: `repeat(${template.columns}, minmax(0, 1fr))`,
        aspectRatio: "210 / 297",
      }}
      role="group"
      aria-label="Bogenvorschau"
    >
      {cells.map((index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSkip(index)}
          aria-label={`Ab Etikett ${index + 1}`}
          aria-pressed={index === skip}
          className={cn(
            "rounded-[2px] border transition-colors",
            index < skip
              ? "border-dashed border-border bg-muted"
              : index === skip
                ? "border-primary bg-primary/40"
                : "border-border bg-primary/10 hover:bg-primary/20",
          )}
        />
      ))}
    </div>
  );
}
