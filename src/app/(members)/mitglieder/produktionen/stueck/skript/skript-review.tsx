"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { BookOpenTextIcon, CheckIcon, TrashIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatTile } from "@/components/ui/stat-tile";
import type { ProductionActionResult } from "@/lib/produktionen/actions-helpers";
import {
  SCRIPT_CREDIT_KINDS,
  SCRIPT_CREDIT_KIND_LABELS,
  joinNames,
  mergeCredits,
  type ScriptCredit,
} from "@/lib/skript/credits";
import type { ScriptReviewData } from "@/lib/skript/review";

import {
  deleteScriptDraftAction,
  releaseScriptAction,
  resolveScriptCueAction,
  saveScriptCreditsAction,
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
/** Gleiche Rolle wie ein anderer Eintrag dieser Fassung (Tippfehler zusammenlegen). */
const SAME = "same:";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
            <span className="ml-auto flex flex-wrap gap-2">
              {version.basedOnLabel ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/mitglieder/skript/${version.id}/vergleich`}>
                    Vergleich mit {version.basedOnLabel}
                  </Link>
                </Button>
              ) : null}
              <Button asChild size="sm" variant="outline">
                <Link href={`/mitglieder/skript/${version.id}`}>
                  <BookOpenTextIcon aria-hidden /> Lesen
                </Link>
              </Button>
            </span>
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

      <CreditsSection key={JSON.stringify(data.credits.saved)} data={data} editable={canManage} />
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
  const typoFor = new Map(data.version.report.roleTypos.map((t) => [t.name, t.similarTo]));
  const names = new Set(data.entries.map((e) => e.name));
  const initial = Object.fromEntries(
    data.entries.map((entry) => {
      const typo = typoFor.get(entry.name);
      const choice =
        entry.roleId ?? entry.suggestedRoleId ?? (typo && names.has(typo) ? `${SAME}${typo}` : NEW);
      return [entry.name, { choice, newName: entry.name }];
    }),
  );
  // Nach dem Speichern liefert der Server neue Einträge; `key` am Aufrufer setzt den Zustand zurück.
  const [state, setState] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  const unconfirmed = data.entries.filter((entry) => !entry.roleId).length;
  const save = async () => {
    setBusy(true);
    // „Gleiche Rolle wie …“ folgt dem Ziel des anderen Eintrags (höchstens eine Stufe tief).
    const resolve = (name: string) => {
      const value = state[name];
      const target = value.choice.startsWith(SAME) ? value.choice.slice(SAME.length) : null;
      return target && state[target] && !state[target].choice.startsWith(SAME)
        ? { value: state[target], name: target }
        : { value, name };
    };
    const assignments = data.entries.map((entry) => {
      const { value, name } = resolve(entry.name);
      return value.choice === NEW || value.choice.startsWith(SAME)
        ? { name: entry.name, createName: value.newName.trim() || name }
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
                    {plural(entry.lines, "Replik", "Repliken")} ·{" "}
                    {plural(entry.words, "Wort", "Wörter")}
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
                      {data.entries
                        .filter((other) => other.name !== entry.name && !other.roleId)
                        .map((other) => (
                          <option key={other.name} value={`${SAME}${other.name}`}>
                            Gleiche Rolle wie „{other.name}“
                          </option>
                        ))}
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

type CreditRow = { kind: ScriptCredit["kind"]; label: string; names: string };

const toRows = (credits: ScriptCredit[]): CreditRow[] =>
  credits.map((credit) => ({ ...credit, names: credit.names.join(", ") }));

function CreditsSection({ data, editable }: { data: ScriptReviewData; editable: boolean }) {
  const router = useRouter();
  const { saved, found, newNames } = data.credits;
  const [rows, setRows] = React.useState<CreditRow[]>(() => toRows(saved));
  const [busy, setBusy] = React.useState(false);

  const save = async (credits: ScriptCredit[]) => {
    setBusy(true);
    report(await saveScriptCreditsAction(data.version.id, credits), router);
    setBusy(false);
  };
  const fromRows = (): ScriptCredit[] =>
    rows
      .map((row) => ({
        kind: row.kind,
        label: row.label.trim() || SCRIPT_CREDIT_KIND_LABELS[row.kind],
        names: row.names
          .split(/\s*(?:,|;|\bund\b)\s*/u)
          .map((name) => name.trim())
          .filter(Boolean),
      }))
      .filter((credit) => credit.names.length);
  const update = (index: number, patch: Partial<CreditRow>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Mitwirkende
          {editable && newNames.length ? (
            <Badge variant="warning" size="sm">
              {plural(newNames.length, "neuer Name", "neue Namen")}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Stehen auf dem Deckblatt der PDFs und gelten für die ganze Produktion. Fehlt die Regie,
          nimmt das Deckblatt die Mitglieder des Gewerks Regie.
        </p>
        {editable && newNames.length ? (
          <div className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 break-words">
              Diese Fassung nennt {saved.length ? "weitere Namen" : "Namen"}:{" "}
              <strong>{joinNames(newNames)}</strong>
            </p>
            <AsyncButton
              size="sm"
              isLoading={busy}
              loadingText="Speichert …"
              onClick={() => save(mergeCredits(saved, found))}
            >
              Ergänzen
            </AsyncButton>
          </div>
        ) : null}
        {editable ? (
          <>
            <ul className="space-y-3">
              {rows.map((row, index) => (
                <li
                  key={index}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[11rem_minmax(0,10rem)_minmax(0,1fr)_auto] sm:items-center"
                >
                  <select
                    className={inputClass}
                    aria-label="Art"
                    value={row.kind}
                    onChange={(event) =>
                      update(index, { kind: event.target.value as CreditRow["kind"] })
                    }
                  >
                    {SCRIPT_CREDIT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {SCRIPT_CREDIT_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                  <input
                    className={inputClass}
                    aria-label="Bezeichnung auf dem Deckblatt"
                    placeholder={SCRIPT_CREDIT_KIND_LABELS[row.kind]}
                    value={row.label}
                    maxLength={60}
                    onChange={(event) => update(index, { label: event.target.value })}
                  />
                  <input
                    className={inputClass}
                    aria-label="Namen, mit Komma getrennt"
                    placeholder="Vorname Nachname, …"
                    value={row.names}
                    onChange={(event) => update(index, { names: event.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Zeile entfernen"
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <TrashIcon aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setRows((prev) => [...prev, { kind: "direction", label: "Regie", names: "" }])
                }
              >
                Zeile hinzufügen
              </Button>
              <AsyncButton
                isLoading={busy}
                loadingText="Speichert …"
                onClick={() => save(fromRows())}
              >
                Mitwirkende speichern
              </AsyncButton>
            </div>
          </>
        ) : saved.length ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
            {saved.map((credit, index) => (
              <React.Fragment key={index}>
                <dt className="text-muted-foreground">{credit.label}</dt>
                <dd className="min-w-0 break-words">{joinNames(credit.names)}</dd>
              </React.Fragment>
            ))}
          </dl>
        ) : (
          <p className="text-muted-foreground">Noch keine Angaben.</p>
        )}
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
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
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
        <div className="flex flex-wrap justify-end gap-2">
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
        </div>
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
