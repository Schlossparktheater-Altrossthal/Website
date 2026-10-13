"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CheckIcon, TrashIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatTile } from "@/components/ui/stat-tile";
import type { ProductionActionResult } from "@/lib/produktionen/actions-helpers";
import type { ScriptReviewData } from "@/lib/skript/review";

import {
  deleteScriptDraftAction,
  releaseScriptAction,
  resolveScriptCueAction,
  saveScriptRolesAction,
} from "../../actions/skript";
import { inputClass } from "../ui";
import { byline } from "./format";

const CUE_LABEL: Record<string, string> = {
  ton: "Ton",
  licht: "Licht",
  nebel: "Nebel",
  effekt: "Effekt",
  umbau: "Umbau/Choreo",
  aus: "Off-Stimme",
  technik: "Technik",
};

const NEW = "__new__";

function report(result: ProductionActionResult, router: ReturnType<typeof useRouter>) {
  if (!result.ok) {
    toast.error("Das hat nicht geklappt", { description: result.error, duration: 6000 });
    return false;
  }
  if (result.message) toast.success(result.message);
  router.refresh();
  return true;
}

export function ScriptReview({ data, canManage }: { data: ScriptReviewData; canManage: boolean }) {
  const { version } = data;
  const editable = canManage && version.status === "draft";
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-words">{version.label}</span>
            {version.status === "draft" ? (
              <Badge variant="warning">Entwurf</Badge>
            ) : (
              <Badge variant="success">Freigegeben</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Eingelesen</dt>
            <dd className="min-w-0 break-words">
              {byline(version.createdByName, version.createdAt)} · {version.sourceName}
            </dd>
            {version.releasedAt ? (
              <>
                <dt className="text-muted-foreground">Freigegeben</dt>
                <dd>{byline(version.releasedByName, version.releasedAt)}</dd>
              </>
            ) : null}
            {version.basedOnLabel ? (
              <>
                <dt className="text-muted-foreground">Vorfassung</dt>
                <dd className="min-w-0 break-words">{version.basedOnLabel}</dd>
              </>
            ) : null}
          </dl>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Szenen" value={version.report.scenes} />
            <StatTile label="Absätze" value={version.report.blocks} />
            <StatTile label="Rollen" value={data.entries.length} />
            <StatTile label="Unsichere Hinweise" value={data.cues.length} />
          </div>
        </CardContent>
      </Card>

      <RoleSection
        key={data.entries.map((e) => `${e.name}=${e.roleId}`).join("|")}
        data={data}
        editable={editable}
      />
      {data.cues.length ? <CueSection data={data} editable={editable} /> : null}
      {editable ? <ReleaseBar data={data} /> : null}
    </div>
  );
}

function RoleSection({ data, editable }: { data: ScriptReviewData; editable: boolean }) {
  const router = useRouter();
  const roleName = new Map(data.roles.map((r) => [r.id, r.name]));
  const initial = React.useMemo(
    () =>
      Object.fromEntries(
        data.entries.map((entry) => [
          entry.name,
          { choice: entry.roleId ?? entry.suggestedRoleId ?? NEW, newName: entry.name },
        ]),
      ),
    [data.entries],
  );
  // Nach dem Speichern liefert der Server neue Einträge; `key` am Aufrufer setzt den Zustand zurück.
  const [state, setState] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  const unconfirmed = data.entries.filter((entry) => !entry.roleId).length;
  const typoFor = new Map(data.version.report.roleTypos.map((t) => [t.name, t.similarTo]));

  const save = async () => {
    setBusy(true);
    const assignments = data.entries.map((entry) => {
      const value = state[entry.name];
      return value.choice === NEW
        ? { name: entry.name, createName: value.newName.trim() || entry.name }
        : { name: entry.name, roleId: value.choice };
    });
    report(await saveScriptRolesAction(data.version.id, assignments), router);
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Rollen
          {editable && unconfirmed ? (
            <Badge variant="warning" size="sm">
              {unconfirmed} unbestätigt
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {editable ? (
          <p className="text-sm text-muted-foreground">
            Gleiche Rollen in anderer Schreibweise sind schon zusammengeführt. Ordne jede Rolle
            einer Skript-Rolle zu oder lege sie neu an – die Zuordnung gilt auch für spätere
            Fassungen.
          </p>
        ) : null}
        <ul className="divide-y divide-border/60">
          {data.entries.map((entry) => {
            const value = state[entry.name];
            const typo = typoFor.get(entry.name);
            return (
              <li
                key={entry.name}
                className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-medium">{entry.name}</span>
                    {entry.roleId ? (
                      <Badge variant="success" size="sm">
                        <CheckIcon aria-hidden /> {roleName.get(entry.roleId)}
                      </Badge>
                    ) : null}
                    {typo ? (
                      <Badge variant="warning" size="sm">
                        Tippfehler? ähnlich „{typo}“
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.lines} Repliken · {entry.words} Wörter
                    {entry.spellings.filter((s) => s !== entry.name).length
                      ? ` · im PDF auch: ${entry.spellings.filter((s) => s !== entry.name).join(", ")}`
                      : ""}
                  </p>
                </div>
                {editable ? (
                  <div className="grid min-w-0 gap-2">
                    <select
                      className={inputClass}
                      aria-label={`Skript-Rolle für ${entry.name}`}
                      value={value.choice}
                      onChange={(event) =>
                        setState((prev) => ({
                          ...prev,
                          [entry.name]: { ...prev[entry.name], choice: event.target.value },
                        }))
                      }
                    >
                      <option value={NEW}>Neue Rolle anlegen</option>
                      {data.roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    {value.choice === NEW ? (
                      <input
                        className={inputClass}
                        aria-label={`Name der neuen Rolle für ${entry.name}`}
                        value={value.newName}
                        maxLength={80}
                        onChange={(event) =>
                          setState((prev) => ({
                            ...prev,
                            [entry.name]: { ...prev[entry.name], newName: event.target.value },
                          }))
                        }
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {editable ? (
          <div className="flex justify-end">
            <AsyncButton type="button" isLoading={busy} loadingText="Speichert …" onClick={save}>
              Zuordnung speichern
            </AsyncButton>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CueSection({ data, editable }: { data: ScriptReviewData; editable: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const resolve = async (blockId: string, partIndex: number, as: "cue" | "text" | "direction") => {
    setPending(`${blockId}:${partIndex}`);
    report(await resolveScriptCueAction(data.version.id, blockId, partIndex, as), router);
    setPending(null);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unsichere Hinweise</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Diese Stellen stehen ohne Farbmarkierung im Text und wurden nur an Stichwörtern wie „TON“
          erkannt. Ist es ein technischer Hinweis oder gehört es zum Text?
        </p>
        <ul className="space-y-3">
          {data.cues.map((cue) => {
            const key = `${cue.blockId}:${cue.partIndex}`;
            return (
              <li key={key} className="space-y-2 rounded-md border border-border/60 bg-muted p-3">
                <p className="text-xs text-muted-foreground">
                  {cue.sceneTitle}
                  {cue.speaker ? ` · ${cue.speaker}` : ""}
                </p>
                <p className="min-w-0 break-words text-sm">
                  <span className="text-muted-foreground">…{cue.before} </span>
                  <mark className="rounded bg-warning/20 px-1 text-foreground">
                    <span className="text-xs font-semibold">{CUE_LABEL[cue.category]}:</span>{" "}
                    {cue.text}
                  </mark>
                  <span className="text-muted-foreground"> {cue.after}…</span>
                </p>
                {editable ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={pending === key}
                      onClick={() => resolve(cue.blockId, cue.partIndex, "cue")}
                    >
                      Ist ein Hinweis
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending === key}
                      onClick={() => resolve(cue.blockId, cue.partIndex, "text")}
                    >
                      Gesprochener Text
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending === key}
                      onClick={() => resolve(cue.blockId, cue.partIndex, "direction")}
                    >
                      Regieanweisung
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ReleaseBar({ data }: { data: ScriptReviewData }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const blocked = data.blockers.length > 0;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 pt-6">
        <div className="min-w-0 flex-1 text-sm">
          {blocked ? (
            <span className="text-muted-foreground">
              Vor der Freigabe: {data.blockers.join(", ")}.
            </span>
          ) : (
            <span>
              Alles geprüft. Nach der Freigabe können alle Mitglieder diese Fassung lesen;
              Kommentare der Vorfassung wandern mit.
            </span>
          )}
        </div>
        <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
          <TrashIcon aria-hidden /> Verwerfen
        </Button>
        <AsyncButton
          isLoading={busy}
          loadingText="Gibt frei …"
          disabled={blocked}
          onClick={async () => {
            setBusy(true);
            report(await releaseScriptAction(data.version.id), router);
            setBusy(false);
          }}
        >
          Freigeben
        </AsyncButton>
      </CardContent>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Entwurf verwerfen?"
        description="Der Entwurf und das hochgeladene PDF werden gelöscht. Bestätigte Rollen bleiben erhalten."
        confirmLabel="Verwerfen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          if (report(await deleteScriptDraftAction(data.version.id), router)) {
            router.push("/mitglieder/produktionen/stueck?ansicht=skript");
          }
        }}
      />
    </Card>
  );
}
