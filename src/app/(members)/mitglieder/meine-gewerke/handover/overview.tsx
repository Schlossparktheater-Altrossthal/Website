"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";

import {
  AlertTriangleIcon,
  CheckIcon,
  MoonStarIcon,
  PlusIcon,
  SettingsIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { NOTE_LIMIT } from "@/lib/departments/activity-format";
import type {
  HandoverSettings,
  HandoverSummary,
  NoticeView,
  SinceLastVisit,
} from "@/lib/departments/handover";
import { cn } from "@/lib/utils";

import { useAction } from "../ausstattung/shared";
import {
  addNoticeAction,
  prepareHandoverAction,
  resolveNoticeAction,
  saveHandoverAction,
  updateHandoverSettingsAction,
} from "../handover-actions";
import { ago } from "./task-handover";

/**
 * Kopf der Gewerk-Startseite: angepinnte Hinweise, Übergaben und Änderungen seit dem
 * letzten Besuch (docs/Plan/uebergabe-plan.md).
 */
export function HandoverOverview({
  departmentId,
  basePath,
  notices,
  news,
  settings,
  canEdit,
  canEditNotes,
  canManage,
}: {
  departmentId: string;
  basePath: string;
  notices: NoticeView[];
  news: SinceLastVisit;
  settings: HandoverSettings;
  canEdit: boolean;
  canEditNotes: boolean;
  canManage: boolean;
}) {
  const [handoverOpen, setHandoverOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  return (
    <section className="space-y-3" aria-labelledby="handover-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="handover-heading" className="text-sm font-semibold">
          {news.since
            ? `Seit deinem letzten Besuch · ${format(new Date(news.since), "EEE d. MMM, HH:mm", { locale: de })}`
            : "Was zuletzt passiert ist"}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {canManage ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              aria-label="Übergabe einstellen"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon />
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => setHandoverOpen(true)}
            >
              <MoonStarIcon className="h-4 w-4" /> Feierabend
            </Button>
          ) : null}
        </div>
      </div>

      <Notices departmentId={departmentId} notices={notices} canEdit={canEditNotes} />

      {news.handovers.map((handover) => (
        <article
          key={handover.id}
          className="space-y-1 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5"
        >
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{handover.author ?? "Jemand"}</span> hat
            Feierabend gemacht · {ago(handover.at)}
          </p>
          {handover.note ? <p className="whitespace-pre-wrap text-sm">{handover.note}</p> : null}
          {handover.summary.length ? (
            <ul className="space-y-0.5 text-sm">
              {handover.summary.map((group, index) => (
                <li key={`${group.taskId}-${index}`}>
                  <span className="font-medium">{group.title}:</span>{" "}
                  <span className="text-muted-foreground">{group.lines.join(" · ")}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}

      {news.tasks.length ? (
        <ul className="space-y-2">
          {news.tasks.map((task) => {
            const href = task.taskId
              ? `${basePath}?ansicht=aufgaben&karte=${task.taskId}`
              : task.objectId
                ? `${basePath}/objekt/${task.objectId}`
                : basePath;
            return (
              <li key={task.taskId ?? task.objectId ?? task.title}>
                <Link
                  href={href}
                  className="block space-y-1 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{task.title}</span>
                    {task.handover?.claim ? (
                      <span className="shrink-0 text-xs font-medium text-info">
                        {task.handover.claim.name.split(" ")[0]} dran
                      </span>
                    ) : null}
                  </span>
                  {task.handover?.caution ? (
                    <span className="flex items-start gap-1 rounded-md bg-warning/15 px-2 py-1 text-xs text-warning-foreground">
                      <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {task.handover.caution.text}
                    </span>
                  ) : null}
                  {task.handover?.nextStep ? (
                    <span className="block text-xs">
                      <span className="font-medium">Weiter:</span> {task.handover.nextStep.text}
                    </span>
                  ) : null}
                  <ul className="space-y-0.5">
                    {task.entries.map((entry) => (
                      <li key={entry.id} className="truncate text-xs text-muted-foreground">
                        {entry.actor?.split(" ")[0] ?? "Jemand"} {entry.text} · {ago(entry.at)}
                      </li>
                    ))}
                  </ul>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : !news.handovers.length ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          {news.since
            ? "Seit deinem letzten Besuch hat niemand etwas geändert."
            : "In der letzten Woche hat niemand etwas geändert."}
        </p>
      ) : null}

      <HandoverPanel
        open={handoverOpen}
        onOpenChange={setHandoverOpen}
        departmentId={departmentId}
        push={settings.handoverPush}
      />
      {canManage ? (
        <SettingsPanel
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          departmentId={departmentId}
          settings={settings}
        />
      ) : null}
    </section>
  );
}

function Notices({
  departmentId,
  notices,
  canEdit,
}: {
  departmentId: string;
  notices: NoticeView[];
  canEdit: boolean;
}) {
  const run = useAction();
  const [text, setText] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);

  if (!notices.length && !canEdit) return null;

  return (
    <div className="space-y-2">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className="flex items-start gap-2 rounded-xl border border-warning/60 bg-warning/10 px-3 py-2"
        >
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-wrap text-sm">{notice.body}</p>
            <p className="text-xs text-muted-foreground">
              {notice.author?.split(" ")[0] ?? "Jemand"} · {ago(notice.at)}
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => void run(() => resolveNoticeAction({ noticeId: notice.id }))}
            >
              <CheckIcon className="h-4 w-4" /> Erledigt
            </Button>
          ) : null}
        </div>
      ))}
      {canEdit ? (
        formOpen ? (
          <form
            className="flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!text.trim()) return;
              setAdding(true);
              if (await run(() => addNoticeAction({ departmentId, body: text }), "Angepinnt")) {
                setText("");
                setFormOpen(false);
              }
              setAdding(false);
            }}
          >
            <input
              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
              value={text}
              maxLength={NOTE_LIMIT}
              autoFocus
              placeholder="z. B. Werkstattschlüssel liegt bei Anna"
              aria-label="Hinweis für alle"
              onChange={(event) => setText(event.target.value)}
            />
            <AsyncButton type="submit" className="h-11" isLoading={adding}>
              Anpinnen
            </AsyncButton>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <PlusIcon className="h-4 w-4" /> Hinweis für alle anpinnen
          </button>
        )
      ) : null}
    </div>
  );
}

const PUSH_HINT: Record<HandoverSettings["handoverPush"], string> = {
  none: "Ohne Push-Nachricht – die Übergabe steht hier auf der Startseite.",
  leads: "Leitung und Vertretung bekommen eine Push-Nachricht.",
  all: "Alle im Gewerk bekommen eine Push-Nachricht.",
};

function HandoverPanel({
  open,
  onOpenChange,
  departmentId,
  push,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  push: HandoverSettings["handoverPush"];
}) {
  const run = useAction();
  const [summary, setSummary] = React.useState<HandoverSummary | null>(null);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Beim Öffnen die eigene Arbeit von heute laden.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void prepareHandoverAction({ departmentId }).then((result) => {
      if (!cancelled) setSummary(result.ok ? (result.data ?? []) : []);
    });
    return () => {
      cancelled = true;
      setSummary(null);
    };
  }, [open, departmentId]);

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Feierabend"
      description="Übergabe an die Nächsten"
      footer={
        <AsyncButton
          type="button"
          className="h-11 w-full"
          isLoading={saving}
          loadingText="Speichert …"
          disabled={summary === null || (!summary.length && !note.trim())}
          onClick={async () => {
            setSaving(true);
            const ok = await run(
              () => saveHandoverAction({ departmentId, note }),
              "Übergabe gespeichert – schönen Feierabend!",
            );
            setSaving(false);
            if (ok) {
              setNote("");
              onOpenChange(false);
            }
          }}
        >
          Übergabe speichern
        </AsyncButton>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">Das hast du heute gemacht</h3>
          {summary === null ? (
            <p className="text-sm text-muted-foreground">Lädt …</p>
          ) : summary.length ? (
            <ul className="space-y-1.5">
              {summary.map((group, index) => (
                <li key={`${group.taskId}-${index}`} className="rounded-lg bg-muted/50 px-3 py-2">
                  <span className="block text-sm font-medium">{group.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {group.lines.join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Heute hast du im Board nichts geändert. Schreib kurz, was du gemacht hast.
            </p>
          )}
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Noch etwas für die Nächsten? (optional)
          </span>
          <textarea
            className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            maxLength={1000}
            value={note}
            placeholder="z. B. Pinsel liegen eingeweicht im Eimer"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          {PUSH_HINT[push]} Karten, an denen du dran warst, werden wieder frei.
        </p>
      </div>
    </ResponsivePanel>
  );
}

function SettingsPanel({
  open,
  onOpenChange,
  departmentId,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  settings: HandoverSettings;
}) {
  const run = useAction();
  const [draft, setDraft] = React.useState(settings);
  const [saving, setSaving] = React.useState(false);
  return (
    <ResponsivePanel
      open={open}
      onOpenChange={(value) => {
        if (value) setDraft(settings);
        onOpenChange(value);
      }}
      title="Übergabe einstellen"
      description="Push-Nachricht und Rechte für Hinweise"
      footer={
        <AsyncButton
          type="button"
          className="h-11 w-full"
          isLoading={saving}
          onClick={async () => {
            setSaving(true);
            const ok = await run(
              () => updateHandoverSettingsAction({ departmentId, ...draft }),
              "Gespeichert",
            );
            setSaving(false);
            if (ok) onOpenChange(false);
          }}
        >
          Speichern
        </AsyncButton>
      }
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Push-Nachricht bei Feierabend an</span>
          <SegmentedControl<HandoverSettings["handoverPush"]>
            aria-label="Push-Nachricht bei Feierabend"
            size="md"
            fullWidth
            value={draft.handoverPush}
            onValueChange={(value) => setDraft((current) => ({ ...current, handoverPush: value }))}
            options={[
              { value: "none", label: "Niemand", ariaLabel: "Niemand" },
              { value: "leads", label: "Leitung", ariaLabel: "Leitung und Vertretung" },
              { value: "all", label: "Alle", ariaLabel: "Alle im Gewerk" },
            ]}
          />
          <p className="text-xs text-muted-foreground">{PUSH_HINT[draft.handoverPush]}</p>
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Hinweise und „Achtung“ pflegen</span>
          <SegmentedControl<HandoverSettings["noteEditors"]>
            aria-label="Hinweise und Achtung pflegen"
            size="md"
            fullWidth
            value={draft.noteEditors}
            onValueChange={(value) => setDraft((current) => ({ ...current, noteEditors: value }))}
            options={[
              { value: "all", label: "Alle", ariaLabel: "Alle im Gewerk" },
              { value: "leads", label: "Leitung", ariaLabel: "Nur Leitung und Vertretung" },
            ]}
          />
          <p className={cn("text-xs text-muted-foreground")}>
            „Nächster Schritt“ und „Ich bin dran“ können immer alle im Gewerk setzen.
          </p>
        </div>
      </div>
    </ResponsivePanel>
  );
}
