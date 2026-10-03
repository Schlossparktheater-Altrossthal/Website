"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteProjectAction,
  saveProjectAction,
} from "@/app/(members)/mitglieder/lager/actions/projects";
import { PlusIcon, TrashIcon } from "@/components/ui/action-icons";
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
import { Textarea } from "@/components/ui/textarea";
import {
  INVENTORY_PROJECTS_PATH,
  inventoryProjectPath,
  PHASE_KIND_LABELS,
  PHASE_KINDS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type PhaseKind,
  type ProjectFormValues,
  type ProjectStatus,
} from "@/lib/inventory/project-constants";

const NONE = "__none__";
const OTHER = "__other__";

/** Projekt anlegen/bearbeiten: Eckdaten oben, Phasen als kurze Zeilen. */
export function ProjectForm({
  projectId,
  initialValues,
  contacts,
  members,
  shows,
  canDelete = false,
}: {
  projectId: string | null;
  canDelete?: boolean;
  initialValues: ProjectFormValues;
  contacts: string[];
  members: { id: string; label: string }[];
  shows: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initialValues);
  const [leadMode, setLeadMode] = React.useState<"member" | "other">(
    initialValues.leadName && !initialValues.leadUserId ? "other" : "member",
  );
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const setPhase = (index: number, patch: Partial<ProjectFormValues["phases"][number]>) =>
    setValues((current) => ({
      ...current,
      phases: current.phases.map((phase, position) =>
        position === index ? { ...phase, ...patch } : phase,
      ),
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveProjectAction(projectId, {
        title: values.title,
        status: values.status,
        contactName: values.contactName,
        venue: values.venue,
        leadUserId: leadMode === "member" ? values.leadUserId : null,
        leadName: leadMode === "other" ? values.leadName : null,
        showId: values.showId,
        note: values.note,
        // Leere Phasen weglassen; „bis“ ohne Wert = eintägig.
        phases: values.phases
          .filter((phase) => phase.startsOn)
          .map((phase) => ({ ...phase, endsOn: phase.endsOn || null })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Gespeichert.");
      router.push(inventoryProjectPath(result.data.publicId));
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="project-title">Event / Titel</Label>
            <Input
              id="project-title"
              value={values.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="z. B. Stadtfest Berlin"
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={values.status}
              onValueChange={(status) => set("status", status as ProjectStatus)}
            >
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {PROJECT_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-contact">Kunde</Label>
            <Input
              id="project-contact"
              list="project-contacts"
              value={values.contactName}
              onChange={(event) => set("contactName", event.target.value)}
              placeholder="z. B. Muster GmbH"
              autoComplete="off"
            />
            <datalist id="project-contacts">
              {contacts.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="project-venue">Veranstaltungsort</Label>
            <Input
              id="project-venue"
              value={values.venue}
              onChange={(event) => set("venue", event.target.value)}
              placeholder="z. B. Berlin, Alexanderplatz"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Projektleitung</Label>
            <Select
              value={leadMode === "other" ? OTHER : (values.leadUserId ?? NONE)}
              onValueChange={(value) => {
                if (value === OTHER) {
                  setLeadMode("other");
                } else {
                  setLeadMode("member");
                  set("leadUserId", value === NONE ? null : value);
                }
              }}
            >
              <SelectTrigger aria-label="Projektleitung">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>– noch offen –</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.label}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>Andere Person …</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {leadMode === "other" ? (
            <div className="space-y-1.5">
              <Label htmlFor="project-lead-name">Name Projektleitung</Label>
              <Input
                id="project-lead-name"
                value={values.leadName}
                onChange={(event) => set("leadName", event.target.value)}
                placeholder="z. B. Max Mustermann"
              />
            </div>
          ) : null}
          {shows.length ? (
            <div className="space-y-1.5">
              <Label>Eigene Produktion</Label>
              <Select
                value={values.showId ?? NONE}
                onValueChange={(value) => set("showId", value === NONE ? null : value)}
              >
                <SelectTrigger aria-label="Produktion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>– keine –</SelectItem>
                  {shows.map((show) => (
                    <SelectItem key={show.id} value={show.id}>
                      {show.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Termine</h2>
          <p className="text-sm text-muted-foreground">
            Vom ersten bis zum letzten Tag ist das Material belegt. „Bis“ leer = ein Tag.
          </p>
        </div>
        <ul className="space-y-3">
          {values.phases.map((phase, index) => (
            <li
              key={index}
              className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end sm:border-0 sm:p-0"
            >
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label className="text-xs text-muted-foreground sm:sr-only">Art</Label>
                <Select
                  value={phase.kind}
                  onValueChange={(kind) => setPhase(index, { kind: kind as PhaseKind })}
                >
                  <SelectTrigger aria-label={`Art von Termin ${index + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHASE_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {PHASE_KIND_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`phase-${index}-from`} className="text-xs text-muted-foreground">
                  {index === 0 ? "Von" : <span className="sm:sr-only">Von</span>}
                </Label>
                <Input
                  id={`phase-${index}-from`}
                  type="date"
                  value={phase.startsOn}
                  onChange={(event) => setPhase(index, { startsOn: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`phase-${index}-to`} className="text-xs text-muted-foreground">
                  {index === 0 ? "Bis" : <span className="sm:sr-only">Bis</span>}
                </Label>
                <Input
                  id={`phase-${index}-to`}
                  type="date"
                  min={phase.startsOn || undefined}
                  value={phase.endsOn}
                  onChange={(event) => setPhase(index, { endsOn: event.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-span-2 justify-self-end text-muted-foreground hover:text-destructive sm:col-span-1"
                aria-label={`Termin ${index + 1} entfernen`}
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    phases: current.phases.filter((_, position) => position !== index),
                  }))
                }
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const last = values.phases[values.phases.length - 1];
            set("phases", [
              ...values.phases,
              {
                kind: "other",
                label: "",
                startsOn: last?.endsOn || last?.startsOn || "",
                endsOn: "",
              },
            ]);
          }}
        >
          <PlusIcon className="mr-1.5 h-4 w-4" />
          Termin
        </Button>
      </section>

      <section className="space-y-1.5 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <Label htmlFor="project-note">Notiz</Label>
        <Textarea
          id="project-note"
          rows={3}
          value={values.note}
          onChange={(event) => set("note", event.target.value)}
          placeholder="Ansprechpartner vor Ort, Zufahrt, Stromanschluss …"
        />
      </section>

      <div className="sticky bottom-[var(--members-bottom-nav,0px)] z-10 -mx-1 flex gap-2 bg-background/95 px-1 py-3 backdrop-blur">
        <Button
          type="submit"
          size="lg"
          disabled={saving || !values.title.trim()}
          className="flex-1 sm:flex-none"
        >
          {saving ? "Speichert …" : projectId ? "Speichern" : "Projekt anlegen"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          Abbrechen
        </Button>
        {projectId && canDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={async () => {
              if (!window.confirm(`Projekt „${values.title}“ löschen?`)) return;
              const result = await deleteProjectAction(projectId);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success(result.message ?? "Gelöscht.");
              router.push(INVENTORY_PROJECTS_PATH);
              router.refresh();
            }}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Löschen
          </Button>
        ) : null}
      </div>
    </form>
  );
}
