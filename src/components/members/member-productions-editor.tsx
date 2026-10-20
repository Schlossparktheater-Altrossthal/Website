"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  setMemberDepartmentAction,
  setMemberProductionAction,
} from "@/app/(members)/mitglieder/mitgliederverwaltung/[userId]/actions";
import { Button } from "@/components/ui/button";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type MemberProductionsEditorShow = {
  id: string;
  label: string;
  member: boolean;
  departments: { id: string; name: string; member: boolean }[];
};

/**
 * Produktionen und Gewerke einer Person direkt in der Mitgliederverwaltung bearbeiten
 * (z. B. Regie anlegen: Produktion + Gewerk Regie, ohne Onboarding).
 */
export function MemberProductionsEditor({
  userId,
  displayName,
  shows,
}: {
  userId: string;
  displayName: string;
  shows: MemberProductionsEditorShow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(shows);
  const [pending, startTransition] = useTransition();

  const run = (
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    apply: (prev: MemberProductionsEditorShow[]) => MemberProductionsEditorShow[],
  ) => {
    const before = rows;
    setRows(apply);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setRows(before);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  const toggleShow = (showId: string, member: boolean) =>
    run(
      () => setMemberProductionAction({ userId, showId, member }),
      (prev) =>
        prev.map((show) =>
          show.id === showId
            ? {
                ...show,
                member,
                departments: member
                  ? show.departments
                  : show.departments.map((dep) => ({ ...dep, member: false })),
              }
            : show,
        ),
    );

  const toggleDepartment = (showId: string, departmentId: string, member: boolean) =>
    run(
      () => setMemberDepartmentAction({ userId, departmentId, member }),
      (prev) =>
        prev.map((show) =>
          show.id === showId
            ? {
                ...show,
                member: member ? true : show.member,
                departments: show.departments.map((dep) =>
                  dep.id === departmentId ? { ...dep, member } : dep,
                ),
              }
            : show,
        ),
    );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setRows(shows);
          setOpen(true);
        }}
      >
        Bearbeiten
      </Button>
      <ModalFormDialog
        open={open}
        onOpenChange={setOpen}
        title={`Produktionen von ${displayName}`}
        description="Aufnahme ohne Onboarding; Gewerk antippen zum Zuordnen."
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine laufende oder geplante Produktion.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((show) => (
              <li key={show.id} className="space-y-3 rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span id={`show-${show.id}`} className="text-sm font-medium">
                    {show.label}
                  </span>
                  <Switch
                    aria-labelledby={`show-${show.id}`}
                    checked={show.member}
                    disabled={pending}
                    onCheckedChange={(next) => toggleShow(show.id, next)}
                  />
                </div>
                {show.departments.length > 0 ? (
                  <div className="flex flex-wrap gap-2" aria-label={`Gewerke ${show.label}`}>
                    {show.departments.map((dep) => (
                      <button
                        key={dep.id}
                        type="button"
                        aria-pressed={dep.member}
                        disabled={pending}
                        onClick={() => toggleDepartment(show.id, dep.id, !dep.member)}
                        className={cn(
                          "min-h-9 rounded-full border px-3 text-sm transition-colors disabled:opacity-60",
                          dep.member
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-muted",
                        )}
                      >
                        {dep.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Noch keine Gewerke angelegt.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </ModalFormDialog>
    </>
  );
}
