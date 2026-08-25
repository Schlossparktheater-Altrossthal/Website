"use client";

import { FileDownIcon } from "@/components/ui/action-icons";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ExportCasting = {
  id: string;
  type: string;
  notes: string | null;
  userName: string;
};

type ExportCharacter = {
  id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  notes: string | null;
  color: string | null;
  castings: ExportCasting[];
};

type CastingExportDialogProps = {
  showTitle: string;
  characters: ExportCharacter[];
};

const TYPE_LABELS: Record<string, string> = {
  primary: "Primär",
  alternate: "Sekundär",
};

function extractFilenameFromDisposition(disposition: string | null) {
  if (!disposition) return null;
  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i);
  const value = match?.[1] ?? match?.[2];
  return value ? decodeURIComponent(value) : null;
}

export function CastingExportDialog({ showTitle, characters }: CastingExportDialogProps) {
  const [selectedRoleIds, setSelectedRoleIds] = useState(
    () => new Set(characters.map((role) => role.id)),
  );
  const [includeDescriptions, setIncludeDescriptions] = useState(true);
  const [includeRoleNotes, setIncludeRoleNotes] = useState(true);
  const [includeCastingNotes, setIncludeCastingNotes] = useState(true);
  const [includeEmptyRoles, setIncludeEmptyRoles] = useState(true);
  const [isPending, startTransition] = useTransition();

  const selectedCount = selectedRoleIds.size;
  const roleOptions = useMemo(
    () =>
      characters.map((role) => ({
        ...role,
        label: role.shortName ? `${role.name} (${role.shortName})` : role.name,
      })),
    [characters],
  );

  const handleToggleAll = () => {
    setSelectedRoleIds((current) => {
      if (current.size === characters.length) {
        return new Set();
      }
      return new Set(characters.map((role) => role.id));
    });
  };

  const handleToggleRole = (roleId: string) => {
    setSelectedRoleIds((current) => {
      const next = new Set(current);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const exportPayload = useMemo(() => {
    const roles = characters
      .filter((role) => selectedRoleIds.has(role.id))
      .filter((role) => (includeEmptyRoles ? true : role.castings.length > 0))
      .map((role) => ({
        name: role.name,
        shortName: role.shortName,
        description: includeDescriptions ? role.description : null,
        notes: includeRoleNotes ? role.notes : null,
        color: role.color,
        castings: role.castings.map((casting) => ({
          name: casting.userName,
          type: casting.type,
          typeLabel: TYPE_LABELS[casting.type] ?? "Weitere",
          notes: includeCastingNotes ? casting.notes : null,
        })),
      }));
    return {
      showTitle,
      generatedAt: new Date().toISOString(),
      roles,
    };
  }, [
    characters,
    includeCastingNotes,
    includeDescriptions,
    includeEmptyRoles,
    includeRoleNotes,
    selectedRoleIds,
    showTitle,
  ]);

  const handleExport = () => {
    if (selectedRoleIds.size === 0) {
      toast.error("Bitte wähle mindestens eine Rolle für den Export.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/pdfs/production-casting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(exportPayload),
        });

        if (!response.ok) {
          toast.error("Der PDF-Export konnte nicht erstellt werden.");
          return;
        }

        const blob = await response.blob();
        const disposition = response.headers.get("content-disposition");
        const filename = extractFilenameFromDisposition(disposition) ?? "besetzung-export.pdf";
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        toast.success("PDF-Export wurde erstellt.");
      } catch (error) {
        console.error("[CastingExportDialog] PDF export failed", error);
        toast.error("Der PDF-Export konnte nicht erstellt werden.");
      }
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileDownIcon className="mr-2 h-4 w-4" aria-hidden />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Besetzung exportieren</DialogTitle>
          <DialogDescription>Wähle Rollen und Inhalte für das PDF aus.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Rollen auswählen</p>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={handleToggleAll}
              >
                {selectedCount === characters.length ? "Alle abwählen" : "Alle auswählen"}
              </button>
            </div>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {roleOptions.map((role) => {
                const checked = selectedRoleIds.has(role.id);
                return (
                  <label
                    key={role.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md border border-border/60 px-2 py-1.5 text-sm",
                      checked ? "bg-muted/60" : "bg-background/60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleRole(role.id)}
                      className="mt-0.5 h-4 w-4 accent-foreground"
                    />
                    <span className="flex-1 text-sm text-foreground">{role.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="text-sm font-semibold text-foreground">Inhalte</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeDescriptions}
                    onChange={() => setIncludeDescriptions((value) => !value)}
                    className="h-4 w-4 accent-foreground"
                  />
                  Rollenbeschreibungen aufnehmen
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeRoleNotes}
                    onChange={() => setIncludeRoleNotes((value) => !value)}
                    className="h-4 w-4 accent-foreground"
                  />
                  Rollen-Notizen aufnehmen
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeCastingNotes}
                    onChange={() => setIncludeCastingNotes((value) => !value)}
                    className="h-4 w-4 accent-foreground"
                  />
                  Besetzungs-Notizen aufnehmen
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeEmptyRoles}
                    onChange={() => setIncludeEmptyRoles((value) => !value)}
                    className="h-4 w-4 accent-foreground"
                  />
                  Rollen ohne Besetzung aufnehmen
                </label>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground">
              <p>
                Der Export enthält {selectedCount} ausgewählte{" "}
                {selectedCount === 1 ? "Rolle" : "Rollen"}.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Abbrechen
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleExport} disabled={isPending}>
            <FileDownIcon className="h-4 w-4" aria-hidden />
            {isPending ? "Exportiert…" : "PDF exportieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
