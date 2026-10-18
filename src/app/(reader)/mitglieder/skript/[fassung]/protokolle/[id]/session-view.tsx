"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ArrowLeftIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SessionDetail } from "@/lib/skript/session-protocol";

import {
  confirmSessionAction,
  discardSessionAction,
  stopRecordingAction,
  updateSessionAction,
  type SessionActionResult,
} from "../../../session-actions";
import { DATE_TIME, KIND_LABEL, STATUS_LABEL, TIME, formatSeconds } from "../shared";

const NO_EVENT = "none";
const PERCENT = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 0 });

export function SessionView({
  versionId,
  versionLabel,
  detail,
  canManage,
  roleNames,
  snippets,
}: {
  versionId: string;
  versionLabel: string;
  detail: SessionDetail;
  canManage: boolean;
  roleNames: Record<string, string>;
  snippets: Record<number, string>;
}) {
  const router = useRouter();
  const { session, protocol, events } = detail;
  const group = session.kind === "group";
  /** Gemeinsam: Verwaltung; privat: Besitzer. */
  const editable = group ? canManage : session.own;
  const listHref = `/mitglieder/skript/${versionId}/protokolle`;
  const [title, setTitle] = React.useState(session.title ?? "");
  const [note, setNote] = React.useState(session.note ?? "");
  const [busy, setBusy] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const sceneTitle = React.useMemo(
    () => new Map(protocol?.scenes.map((scene) => [scene.sceneId, scene.title]) ?? []),
    [protocol],
  );

  const act = async (task: () => Promise<SessionActionResult>, after?: () => void) => {
    setBusy(true);
    try {
      const result = await task();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.message) toast.success(result.message);
      if (after) after();
      else router.refresh();
    } finally {
      setBusy(false);
    }
  };
  const save = (patch: { title?: string | null; note?: string | null; eventId?: string | null }) =>
    act(() => updateSessionAction({ sessionId: session.id, ...patch }));

  const start = new Date(session.startedAt);
  const end = session.endedAt ? new Date(session.endedAt) : null;
  const heading = session.title ?? session.event?.title ?? (group ? "Probe" : "Private Aufnahme");

  return (
    <div className="min-h-dvh bg-background">
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-1 px-1 lg:px-4">
          <Button asChild variant="ghost" size="icon" aria-label="Zurück zu den Protokollen">
            <Link href={listHref}>
              <ArrowLeftIcon aria-hidden />
            </Link>
          </Button>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-sm font-medium">{heading}</p>
            <p className="truncate text-xs text-muted-foreground">
              {group ? "Probenprotokoll" : "Private Aufnahme"} · {versionLabel}
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-6 px-3 py-4 lg:px-6">
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              {DATE_TIME.format(start)}
              {end ? `–${TIME.format(end)}` : ""}
            </span>
            <Badge
              size="sm"
              variant={
                session.status === "confirmed"
                  ? "success"
                  : session.status === "recording"
                    ? "destructive"
                    : "muted"
              }
            >
              {!group && session.status === "draft" ? "Fertig" : STATUS_LABEL[session.status]}
            </Badge>
            {protocol?.kind ? (
              <Badge size="sm" variant="info">
                {KIND_LABEL[protocol.kind]}
              </Badge>
            ) : null}
          </div>
          {group && !session.own && session.ownerName ? (
            <p className="text-xs text-muted-foreground">Gestartet von {session.ownerName}</p>
          ) : null}
          {group && session.status === "draft" ? (
            <p className="text-xs text-muted-foreground">
              Entwurf – sichtbar nur für die Skript-Verwaltung. Nach dem Bestätigen sehen ihn alle,
              die das Skript lesen dürfen, und er erscheint am Termin.
            </p>
          ) : null}
          {!group ? (
            <p className="text-xs text-muted-foreground">Nur du siehst diese Aufnahme.</p>
          ) : null}
          {detail.ownTrackId ? (
            <Link
              href={`${listHref}/${detail.ownTrackId}`}
              className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
            >
              Meine private Spur in dieser Probe
            </Link>
          ) : null}
        </section>

        {editable ? (
          <section className="space-y-3 rounded-lg border border-border/60 p-3">
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Titel</span>
              <Input
                value={title}
                maxLength={120}
                placeholder={group ? "z. B. Leseprobe Akt 1" : "z. B. Text üben Szene 4"}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => {
                  if (title.trim() !== (session.title ?? ""))
                    void save({ title: title.trim() || null });
                }}
              />
            </label>
            {group ? (
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Termin</span>
                <Select
                  value={session.event?.id ?? NO_EVENT}
                  onValueChange={(value) =>
                    void save({ eventId: value === NO_EVENT ? null : value })
                  }
                  disabled={busy}
                >
                  <SelectTrigger aria-label="Termin">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_EVENT}>Ohne Termin</SelectItem>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {DATE_TIME.format(new Date(event.start))} · {event.title}
                        {event.cancelled ? " (abgesagt)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Notiz</span>
              <Textarea
                value={note}
                maxLength={4000}
                rows={3}
                onChange={(event) => setNote(event.target.value)}
                onBlur={() => {
                  if (note.trim() !== (session.note ?? ""))
                    void save({ note: note.trim() || null });
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {session.status === "recording" ? (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => act(() => stopRecordingAction({ sessionId: session.id }))}
                >
                  Aufnahme beenden
                </Button>
              ) : null}
              {group && session.status !== "confirmed" ? (
                <Button
                  disabled={busy || !protocol}
                  onClick={() => act(() => confirmSessionAction({ sessionId: session.id }))}
                >
                  Bestätigen
                </Button>
              ) : null}
              <Button variant="ghost" disabled={busy} onClick={() => setConfirmDiscard(true)}>
                {group ? "Verwerfen" : "Löschen"}
              </Button>
            </div>
          </section>
        ) : session.note ? (
          <p className="whitespace-pre-wrap rounded-lg border border-border/60 p-3 text-sm">
            {session.note}
          </p>
        ) : null}

        {!protocol ? (
          <p className="text-sm text-muted-foreground">
            {session.status === "recording"
              ? "Noch keine Messpunkte. Sie kommen alle 5 Sekunden, solange jemand mitliest."
              : "Keine Messpunkte aufgezeichnet."}
          </p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <Stat label="Dauer" value={formatSeconds(protocol.totalSeconds)} />
              <Stat label="Gelesen" value={formatSeconds(protocol.readingSeconds)} />
              <Stat
                label="Stillstand / Pause"
                value={`${formatSeconds(protocol.stopSeconds)} / ${formatSeconds(protocol.pauseSeconds)}`}
              />
              <Stat label="Wiederholungen" value={String(protocol.repeats.length)} />
              {group ? <Stat label="Max. Mitlesende" value={String(protocol.maxActive)} /> : null}
              {protocol.gapSeconds ? (
                <Stat label="Ohne Messpunkte" value={formatSeconds(protocol.gapSeconds)} />
              ) : null}
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ablauf
              </h2>
              <ol className="divide-y divide-border/60 rounded-lg border border-border/60">
                {protocol.segments.map((segment) => (
                  <li
                    key={`${segment.start}-${segment.sceneId}`}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-sm"
                  >
                    <span className="w-28 shrink-0 tabular-nums text-muted-foreground">
                      {TIME.format(new Date(segment.start))}–{TIME.format(new Date(segment.end))}
                    </span>
                    <span className="min-w-0 flex-1 font-medium">
                      {segment.sceneId ? (sceneTitle.get(segment.sceneId) ?? "Szene") : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[
                        segment.repeats ? `${segment.repeats}× wiederholt` : null,
                        segment.stops
                          ? `${segment.stops} ${segment.stops === 1 ? "Stillstand" : "Stillstände"}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Szenen
              </h2>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className={th}>Szene</th>
                      <th className={th}>Brutto</th>
                      <th className={th}>Netto</th>
                      <th className={th}>Gelesen</th>
                      <th className={th}>Wdh.</th>
                      <th className={th}>Stillst.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {protocol.scenes.map((scene) => (
                      <React.Fragment key={scene.sceneId}>
                        <tr>
                          <td className={td}>{scene.title}</td>
                          <td className={`${td} tabular-nums`}>
                            {formatSeconds(scene.grossSeconds)}
                          </td>
                          <td className={`${td} tabular-nums`}>
                            {formatSeconds(scene.netSeconds)}
                          </td>
                          <td className={`${td} tabular-nums`}>{PERCENT.format(scene.coverage)}</td>
                          <td className={`${td} tabular-nums`}>{scene.repeats || "–"}</td>
                          <td className={`${td} tabular-nums`}>{scene.stops || "–"}</td>
                        </tr>
                        {scene.missingRoleIds.length ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-2 pb-2 text-xs text-amber-700 dark:text-amber-400"
                            >
                              Nicht mitgelesen:{" "}
                              {scene.missingRoleIds.map((id) => roleNames[id] ?? "?").join(", ")}
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {group ? (
                <p className="text-xs text-muted-foreground">
                  Netto = vorwärts gelesen, Brutto inkl. Stillstände. „Nicht mitgelesen“: Rolle
                  spricht in der Szene, aber niemand mit dieser Rolle hat mitgelesen – nur ein
                  Hinweis, keine Anwesenheit.
                </p>
              ) : null}
            </section>

            {protocol.repeats.length ? (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Wiederholungen
                </h2>
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                  {protocol.repeats.map((repeat) => (
                    <li key={repeat.at} className="flex gap-3 px-3 py-2 text-sm">
                      <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                        {TIME.format(new Date(repeat.at))}
                      </span>
                      <span className="min-w-0">
                        <span className="font-medium">
                          {repeat.sceneId ? sceneTitle.get(repeat.sceneId) : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          ab „{snippets[repeat.blockIndex] ?? "…"}“
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {protocol.stops.length ? (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Stillstände und Pausen
                </h2>
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                  {protocol.stops.map((stop) => (
                    <li key={stop.at} className="flex gap-3 px-3 py-2 text-sm">
                      <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                        {TIME.format(new Date(stop.at))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">
                          {stop.pause ? "Pause" : "Stillstand"} · {formatSeconds(stop.seconds)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {stop.sceneId ? `${sceneTitle.get(stop.sceneId) ?? ""} · ` : ""}„
                          {snippets[stop.blockIndex] ?? "…"}“
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {protocol.skipped.length ? (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Übersprungen
                </h2>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {protocol.skipped.map((range) => (
                    <li key={range.from}>
                      {range.sceneIds.map((id) => sceneTitle.get(id) ?? "Szene").join(", ") ||
                        "Teil des Skripts"}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </main>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={group ? "Protokoll verwerfen?" : "Aufnahme löschen?"}
        description={
          group
            ? "Die Messpunkte werden gelöscht. Das lässt sich nicht rückgängig machen."
            : "Die private Aufnahme wird endgültig gelöscht."
        }
        confirmLabel={group ? "Verwerfen" : "Löschen"}
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          void act(
            () => discardSessionAction({ sessionId: session.id }),
            () => router.push(listHref),
          );
        }}
      />
    </div>
  );
}

const th = "px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
const td = "px-2 py-2 align-top";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 px-2 py-2">
      <p className="text-base font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
