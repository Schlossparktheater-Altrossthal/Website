"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EditIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Switch } from "@/components/ui/switch";
import { ROLE_COLOR_OPTIONS } from "@/config/category-colors";
import { cn } from "@/lib/utils";

import {
  archiveDepartmentAction,
  saveDepartmentAction,
} from "../produktionen/actions/department-settings";
import { CreateDepartmentPanel } from "./create-department-panel";

export type DepartmentSettings = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  requiresJoinApproval: boolean;
};

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

type DepartmentSettingsButtonProps = {
  showId: string;
  department?: DepartmentSettings;
  /** `tile`: „+ Gewerk“-Kachel im Raster. */
  variant?: "button" | "tile";
  /** Nach Anlegen/Archivieren nicht ins Portal wechseln, sondern die Seite neu laden (Zuweisung). */
  stayOnPage?: boolean;
};

/** Gewerk anlegen (`department` fehlt, nur aus Blaupause) oder bearbeiten – nur Regie/Board. */
export function DepartmentSettingsButton(props: DepartmentSettingsButtonProps) {
  if (!props.department) {
    return <CreateDepartmentPanel showId={props.showId} stayOnPage={props.stayOnPage} />;
  }
  return <EditDepartmentPanel {...props} department={props.department} />;
}

function EditDepartmentPanel({
  showId,
  department,
  stayOnPage = false,
}: DepartmentSettingsButtonProps & { department: DepartmentSettings }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(department.name);
  const [description, setDescription] = React.useState(department.description ?? "");
  const [color, setColor] = React.useState<string | null>(
    department.color ?? ROLE_COLOR_OPTIONS[0],
  );
  const [approval, setApproval] = React.useState(department.requiresJoinApproval);
  const [saving, setSaving] = React.useState(false);
  const [confirmArchive, setConfirmArchive] = React.useState(false);

  const save = async () => {
    setSaving(true);
    const result = await saveDepartmentAction({
      showId,
      id: department.id,
      name,
      description,
      color,
      requiresJoinApproval: approval,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return;
    }
    toast.success("Gespeichert", { duration: 3000 });
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
      >
        <EditIcon className="h-3.5 w-3.5" aria-hidden />
        Bearbeiten
      </button>
      <ResponsivePanel
        open={open}
        onOpenChange={setOpen}
        title={`${department.name} bearbeiten`}
        description="Gewerk bearbeiten"
        footer={
          <div className="flex gap-2">
            {department ? (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setConfirmArchive(true)}
              >
                Archivieren
              </Button>
            ) : null}
            <AsyncButton
              type="button"
              className="h-11 flex-1"
              isLoading={saving}
              loadingText="Speichert …"
              disabled={name.trim().length < 2}
              onClick={save}
            >
              Speichern
            </AsyncButton>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <input
              className={inputClass}
              value={name}
              maxLength={80}
              placeholder="z. B. Pyrotechnik"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Beschreibung</span>
            <textarea
              className={cn(inputClass, "h-auto min-h-20 py-2")}
              value={description}
              maxLength={2000}
              placeholder="Worum kümmert sich das Gewerk?"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Farbe</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
              {ROLE_COLOR_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={color === option}
                  aria-label={option}
                  onClick={() => setColor(option)}
                  className={cn(
                    "h-9 w-9 rounded-full ring-offset-2 ring-offset-background",
                    color === option ? "ring-2 ring-ring" : "",
                  )}
                  style={{ backgroundColor: option }}
                />
              ))}
            </div>
          </div>
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Beitritt mit Prüfung</span>
              <span className="block text-xs text-muted-foreground">
                Wer beitreten möchte, stellt eine Anfrage; die Leitung entscheidet.
              </span>
            </span>
            <Switch checked={approval} onCheckedChange={setApproval} />
          </label>
        </div>
      </ResponsivePanel>
      {department ? (
        <ConfirmDialog
          open={confirmArchive}
          onOpenChange={setConfirmArchive}
          title={`${department.name} archivieren?`}
          description="Das Gewerk verschwindet aus Portal, Zuweisung und Kalender. Aufgaben, Termine und Dateien bleiben in der Datenbank erhalten."
          confirmLabel="Archivieren"
          cancelLabel="Abbrechen"
          variant="destructive"
          onCancel={() => setConfirmArchive(false)}
          onConfirm={async () => {
            setConfirmArchive(false);
            const result = await archiveDepartmentAction({ id: department.id });
            if (!result.ok) {
              toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
              return;
            }
            toast.success("Gewerk archiviert", { duration: 3000 });
            if (stayOnPage) router.refresh();
            else router.push("/mitglieder/meine-gewerke");
          }}
        />
      ) : null}
    </>
  );
}
