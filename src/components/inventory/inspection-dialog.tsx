"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { recordInspectionAction } from "@/app/(members)/mitglieder/lager/actions/care";
import { FileIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { toDateInputValue } from "@/lib/inventory/constants";

/**
 * Prüfung eintragen – für ein Objekt oder eine ganze Auswahl (Prüftag). Das Protokoll
 * (PDF/Foto) wird danach an jede Prüfung gehängt.
 */
export function InspectionDialog({
  assetIds,
  label,
  defaultIntervalMonths,
  open,
  onOpenChange,
  onDone,
}: {
  assetIds: string[];
  label: string;
  defaultIntervalMonths?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [result, setResult] = React.useState<"passed" | "failed">("passed");
  const [inspectedAt, setInspectedAt] = React.useState(toDateInputValue(new Date()));
  const [intervalMonths, setIntervalMonths] = React.useState(String(defaultIntervalMonths ?? 12));
  const [kind, setKind] = React.useState("DGUV V3");
  const [inspectorName, setInspectorName] = React.useState("");
  const [note, setNote] = React.useState("");
  const [document, setDocument] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setResult("passed");
      setInspectedAt(toDateInputValue(new Date()));
      setIntervalMonths(String(defaultIntervalMonths ?? 12));
      setNote("");
      setDocument(null);
    }
  }, [open, defaultIntervalMonths]);

  const submit = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set(
        "inspection",
        JSON.stringify({
          kind,
          result,
          inspectedAt,
          intervalMonths: intervalMonths ? Number(intervalMonths) : null,
          inspectorName,
          note,
        }),
      );
      const response = await recordInspectionAction(assetIds, formData);
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      if (document) {
        const uploads = await Promise.all(
          response.data.inspectionIds.map((id) => {
            const body = new FormData();
            body.set("file", document);
            return fetch(`/api/lager/inspections/${id}/document`, { method: "POST", body });
          }),
        );
        if (uploads.some((upload) => !upload.ok)) {
          toast.warning("Prüfung gespeichert, das Protokoll konnte nicht hochgeladen werden.");
        }
      }
      toast.success(response.message ?? "Eingetragen.");
      onOpenChange(false);
      onDone?.();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Prüfung eintragen"
      description={`Prüfung für ${label} eintragen`}
      footer={
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={saving || !inspectedAt}
          onClick={submit}
          variant={result === "failed" ? "destructive" : "primary"}
        >
          {saving
            ? "Speichert …"
            : result === "failed"
              ? "Nicht bestanden – sperren"
              : assetIds.length > 1
                ? `${assetIds.length} Prüfungen eintragen`
                : "Bestanden eintragen"}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <SegmentedControl
          aria-label="Ergebnis"
          value={result}
          onValueChange={setResult}
          fullWidth
          size="md"
          options={[
            { value: "passed", label: "Bestanden" },
            { value: "failed", label: "Nicht bestanden" },
          ]}
          activeClassName={(value) =>
            value === "failed" ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inspection-date">Geprüft am</Label>
            <Input
              id="inspection-date"
              type="date"
              value={inspectedAt}
              onChange={(event) => setInspectedAt(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inspection-interval">Nächste in (Monaten)</Label>
            <Input
              id="inspection-interval"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={intervalMonths}
              onChange={(event) => setIntervalMonths(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inspection-kind">Art</Label>
            <Input
              id="inspection-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inspection-name">Geprüft von</Label>
            <Input
              id="inspection-name"
              value={inspectorName}
              onChange={(event) => setInspectorName(event.target.value)}
              placeholder="Standard: du"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inspection-note">Messwerte / Bemerkung</Label>
          <Textarea
            id="inspection-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="z. B. RPE 0,12 Ω, RISO > 2 MΩ"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:text-foreground">
          <FileIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {document ? document.name : "Prüfprotokoll anhängen (PDF oder Foto, optional)"}
          </span>
          <input
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={(event) => setDocument(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </ResponsivePanel>
  );
}
