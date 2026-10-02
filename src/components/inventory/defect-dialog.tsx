"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { reportDefectAction } from "@/app/(members)/mitglieder/lager/actions/care";
import { CameraIcon, CloseIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFECT_SEVERITIES,
  DEFECT_SEVERITY_LABELS,
  type DefectSeverity,
} from "@/lib/inventory/constants";
import { resizeImageFile } from "@/lib/inventory/photo-client";
import { cn } from "@/lib/utils";

const SEVERITY_HINTS: Record<DefectSeverity, string> = {
  cosmetic: "Kratzer, Flecken – funktioniert",
  limited: "Geht noch, aber nicht richtig",
  locked: "Nicht mehr benutzen",
};

const SEVERITY_ACTIVE: Record<DefectSeverity, string> = {
  cosmetic: "border-muted-foreground/60 bg-muted",
  limited: "border-warning bg-warning/15",
  locked: "border-destructive bg-destructive/15",
};

/** Mangel melden: drei große Stufen, ein Satz, optional ein Foto. */
export function DefectDialog({
  assetId,
  assetLabel,
  open,
  onOpenChange,
  onDone,
}: {
  assetId: string;
  assetLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [severity, setSeverity] = React.useState<DefectSeverity>("limited");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setSeverity("limited");
      setTitle("");
      setDescription("");
      setPhoto(null);
    }
  }, [open]);

  const submit = async () => {
    setSaving(true);
    const formData = new FormData();
    formData.set("defect", JSON.stringify({ title, description, severity }));
    if (photo) formData.set("photo", photo);
    const result = await reportDefectAction(assetId, formData);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Gemeldet.");
    onOpenChange(false);
    onDone?.();
    router.refresh();
  };

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Mangel melden"
      description={`Mangel an ${assetLabel} melden`}
      footer={
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={saving || !title.trim()}
          onClick={submit}
          variant={severity === "locked" ? "destructive" : "primary"}
        >
          {saving ? "Speichert …" : severity === "locked" ? "Melden und sperren" : "Melden"}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{assetLabel}</p>
        <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Schwere">
          {DEFECT_SEVERITIES.map((entry) => (
            <button
              key={entry}
              type="button"
              role="radio"
              aria-checked={severity === entry}
              onClick={() => setSeverity(entry)}
              className={cn(
                "rounded-lg border-2 px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                severity === entry ? SEVERITY_ACTIVE[entry] : "border-border bg-background",
              )}
            >
              <span className="block text-sm font-medium text-foreground">
                {DEFECT_SEVERITY_LABELS[entry]}
              </span>
              <span className="block text-xs text-muted-foreground">{SEVERITY_HINTS[entry]}</span>
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="defect-title">Was ist los?</Label>
          <Input
            id="defect-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="z. B. Lüfter laut, Naht offen"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="defect-description">Details (optional)</Label>
          <Textarea
            id="defect-description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Foto vom Mangel"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              setPhoto(await resizeImageFile(file));
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Foto nicht lesbar.");
            }
          }}
        />
        {photo ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span>Foto angehängt</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setPhoto(null)}
              aria-label="Foto entfernen"
            >
              <CloseIcon />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <CameraIcon className="mr-2 h-4 w-4" />
            Foto hinzufügen
          </Button>
        )}
      </div>
    </ResponsivePanel>
  );
}
