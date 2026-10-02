"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateDefectAction } from "@/app/(members)/mitglieder/lager/actions/care";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFECT_SEVERITY_LABELS,
  DEFECT_SEVERITY_TONES,
  DEFECT_STATUS_LABELS,
  formatInventoryDate,
  type DefectSeverity,
  type DefectStatus,
} from "@/lib/inventory/constants";

export type DefectItem = {
  id: string;
  title: string;
  description: string | null;
  severity: DefectSeverity;
  status: DefectStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: string | null;
  photoIds: string[];
};

export function DefectList({ defects }: { defects: DefectItem[] }) {
  const open = defects.filter((defect) => defect.status !== "done");
  const done = defects.filter((defect) => defect.status === "done");
  const [showDone, setShowDone] = React.useState(false);

  if (!defects.length) {
    return <p className="text-sm text-muted-foreground">Keine Mängel bekannt.</p>;
  }
  return (
    <div className="space-y-3">
      {open.map((defect) => (
        <DefectRow key={defect.id} defect={defect} />
      ))}
      {!open.length ? <p className="text-sm text-muted-foreground">Keine offenen Mängel.</p> : null}
      {done.length ? (
        <div className="space-y-2">
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => setShowDone((value) => !value)}
          >
            {showDone ? "Erledigte ausblenden" : `${done.length} erledigte anzeigen`}
          </button>
          {showDone ? done.map((defect) => <DefectRow key={defect.id} defect={defect} />) : null}
        </div>
      ) : null}
    </div>
  );
}

function DefectRow({ defect }: { defect: DefectItem }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [resolving, setResolving] = React.useState(false);
  const [note, setNote] = React.useState("");

  const update = async (status: DefectStatus) => {
    setBusy(true);
    const result = await updateDefectAction(defect.id, status, note);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setResolving(false);
    toast.success(result.message ?? "Aktualisiert.");
    router.refresh();
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start gap-2">
        <p className="min-w-0 flex-1 font-medium break-words text-foreground">{defect.title}</p>
        <ToneBadge
          tone={defect.status === "done" ? "success" : DEFECT_SEVERITY_TONES[defect.severity]}
        >
          {defect.status === "done"
            ? DEFECT_STATUS_LABELS.done
            : defect.status === "repair"
              ? DEFECT_STATUS_LABELS.repair
              : DEFECT_SEVERITY_LABELS[defect.severity]}
        </ToneBadge>
      </div>
      {defect.description ? (
        <p className="text-sm whitespace-pre-line text-muted-foreground">{defect.description}</p>
      ) : null}
      {defect.photoIds.length ? (
        <div className="flex flex-wrap gap-2">
          {defect.photoIds.map((id) => (
            <a key={id} href={`/api/lager/photos/${id}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- Foto aus der DB */}
              <img
                src={`/api/lager/photos/${id}`}
                alt="Foto vom Mangel"
                className="h-16 w-16 rounded-md border border-border object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {formatInventoryDate(defect.createdAt)}
        {defect.reporter ? ` · ${defect.reporter}` : ""}
        {defect.status === "done" && defect.resolutionNote
          ? ` · Erledigt: ${defect.resolutionNote}`
          : ""}
      </p>
      {defect.status !== "done" ? (
        resolving ? (
          <div className="flex flex-wrap gap-2">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Was wurde gemacht? (optional)"
              className="min-w-0 flex-1"
              aria-label="Erledigt-Notiz"
            />
            <Button size="sm" disabled={busy} onClick={() => update("done")}>
              Erledigt
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setResolving(true)}>
              Behoben
            </Button>
            {defect.status === "open" ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => update("repair")}>
                In Reparatur
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => update("open")}>
                Zurück auf offen
              </Button>
            )}
          </div>
        )
      ) : (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => update("open")}>
          Wieder öffnen
        </Button>
      )}
    </div>
  );
}
