"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";

import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MoonStarIcon,
  PlusIcon,
  SettingsIcon,
  WrenchIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  NOTE_LIMIT,
  WORK_STATUS_LABELS,
  splitSteps,
  type WorkState,
} from "@/lib/departments/activity-format";
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
import { createBoardTaskAction } from "../board-actions";
import { StepList, ago, type WorkPermissions } from "./task-work";

export type WorkItem = {
  id: string;
  title: string;
  work: WorkState;
  hasNews: boolean;
};

/**
 * Reiter „Vor Ort“ (docs/Plan/uebergabe-plan.md, Teil 2): Hinweise, letzte Übergabe,
 * was gerade läuft – mit Schritten zum direkten Abhaken – und was sich seit dem letzten
 * Besuch geändert hat.
 */
export function VorOrt({
  departmentId,
  basePath,
  firstColumnId,
  notices,
  news,
  settings,
  items,
  perms,
  canEditNotes,
}: {
  departmentId: string;
  basePath: string;
  /** Spalte für neue Aufgaben. */
  firstColumnId: string | null;
  notices: NoticeView[];
  news: SinceLastVisit;
  settings: HandoverSettings;
  items: WorkItem[];
  perms: WorkPermissions;
  canEditNotes: boolean;
}) {
  const [handoverOpen, setHandoverOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newsOpen, setNewsOpen] = React.useState(false);
  const cardHref = (id: string) => `${basePath}?ansicht=aufgaben&karte=${id}`;

  return (
    <div className="space-y-4">
      {perms.canEdit ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className="h-11"
            disabled={!firstColumnId}
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon className="h-4 w-4" /> Aufgabe
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => setHandoverOpen(true)}
          >
            <MoonStarIcon className="h-4 w-4" /> Feierabend
          </Button>
        </div>
      ) : null}

      <Notices departmentId={departmentId} notices={notices} canEdit={canEditNotes} />

      {news.handovers.slice(0, 1).map((handover) => (
        <article
          key={handover.id}
          className="space-y-1 rounded-lg border border-border bg-card px-3 py-2.5"
        >
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{handover.author ?? "Jemand"}</span> hat
            Feierabend gemacht · {ago(handover.at)}
          </p>
          {handover.note ? <p className="whitespace-pre-wrap text-sm">{handover.note}</p> : null}
          {handover.summary.length ? (
            <ul className="space-y-0.5 text-xs">
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

      <section className="space-y-2" aria-labelledby="work-heading">
        <h2 id="work-heading" className="text-sm font-semibold">
          Gerade dran
        </h2>
        {items.length ? (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-card px-2 py-2">
                <Link
                  href={cardHref(item.id)}
                  className="flex min-h-10 items-center gap-2 rounded-md px-1 hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {item.title}
                  </span>
                  {item.hasNews ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="neu" />
                  ) : null}
                  {item.work.handover.claim ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-info">
                      <WrenchIcon className="h-3 w-3" />
                      {item.work.handover.claim.name.split(" ")[0]}
                    </span>
                  ) : null}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {WORK_STATUS_LABELS[item.work.status]}
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
                {item.work.handover.caution ? (
                  <p className="mx-1 mt-1 flex items-start gap-1 rounded-md bg-warning/15 px-2 py-1 text-xs text-warning-foreground">
                    <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {item.work.handover.caution.text}
                  </p>
                ) : null}
                {item.work.steps.some((step) => !step.done) ? (
                  <StepList
                    taskId={item.id}
                    steps={item.work.steps}
                    perms={perms}
                    limit={3}
                    hideDone
                    hideAdd
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Gerade ist nichts in Arbeit. Im Board unter „Aufgaben“ findest du alles Offene.
          </p>
        )}
      </section>

      {news.tasks.length ? (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setNewsOpen((value) => !value)}
            aria-expanded={newsOpen}
            className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-semibold"
          >
            {news.since
              ? `Seit deinem letzten Besuch (${news.tasks.length})`
              : `Letzte Woche (${news.tasks.length})`}
            {news.since ? (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {format(new Date(news.since), "EEE d. MMM, HH:mm", { locale: de })}
              </span>
            ) : null}
            <ChevronDownIcon
              className={cn(
                "ml-auto h-4 w-4 shrink-0 transition-transform",
                newsOpen && "rotate-180",
              )}
            />
          </button>
          {newsOpen ? (
            <ul className="space-y-2">
              {news.tasks.map((task) => (
                <li key={task.taskId ?? task.objectId ?? task.title}>
                  <Link
                    href={
                      task.taskId
                        ? cardHref(task.taskId)
                        : task.objectId
                          ? `${basePath}/objekt/${task.objectId}`
                          : basePath
                    }
                    className="block space-y-0.5 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-muted/40"
                  >
                    <span className="block truncate text-sm font-medium">{task.title}</span>
                    {task.entries.map((entry) => (
                      <span key={entry.id} className="block truncate text-xs text-muted-foreground">
                        {entry.actor?.split(" ")[0] ?? "Jemand"} {entry.text} · {ago(entry.at)}
                      </span>
                    ))}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {perms.canManage ? (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex h-10 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <SettingsIcon className="h-3.5 w-3.5" /> Übergabe einstellen
        </button>
      ) : null}

      <HandoverPanel
        open={handoverOpen}
        onOpenChange={setHandoverOpen}
        departmentId={departmentId}
        push={settings.handoverPush}
      />
      {firstColumnId ? (
        <QuickTaskPanel
          open={createOpen}
          onOpenChange={setCreateOpen}
          departmentId={departmentId}
          columnId={firstColumnId}
        />
      ) : null}
      {perms.canManage ? (
        <SettingsPanel
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          departmentId={departmentId}
          settings={settings}
        />
      ) : null}
    </div>
  );
}

/** Neue Aufgabe in zwei Feldern: Titel und (optional) Schritte. */
function QuickTaskPanel({
  open,
  onOpenChange,
  departmentId,
  columnId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  columnId: string;
}) {
  const run = useAction();
  const [title, setTitle] = React.useState("");
  const [steps, setSteps] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";
  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Neue Aufgabe"
      description="Titel und Schritte"
      footer={
        <AsyncButton
          type="button"
          className="h-11 w-full"
          isLoading={saving}
          disabled={!title.trim()}
          onClick={async () => {
            setSaving(true);
            const ok = await run(
              () =>
                createBoardTaskAction({
                  departmentId,
                  columnId,
                  title,
                  steps: splitSteps(steps),
                }),
              "Aufgabe angelegt",
            );
            setSaving(false);
            if (ok) {
              setTitle("");
              setSteps("");
              onOpenChange(false);
            }
          }}
        >
          Anlegen
        </AsyncButton>
      }
    >
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Was ist zu tun?</span>
          <input
            className={cn(inputClass, "h-11")}
            value={title}
            maxLength={160}
            autoFocus
            placeholder="z. B. Laterne bauen"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Schritte (optional, einer pro Zeile)
          </span>
          <textarea
            className={cn(inputClass, "min-h-32 py-2")}
            value={steps}
            placeholder={"Material besorgen\nzuschneiden\nbemalen"}
            onChange={(event) => setSteps(event.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Frist, Zuständige und Beschreibung kannst du später in der Karte unter „Details“ ergänzen.
        </p>
      </div>
    </ResponsivePanel>
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
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Abgehakte Schritte wieder öffnen</span>
          <SegmentedControl<HandoverSettings["stepUndo"]>
            aria-label="Abgehakte Schritte wieder öffnen"
            size="md"
            fullWidth
            value={draft.stepUndo}
            onValueChange={(value) => setDraft((current) => ({ ...current, stepUndo: value }))}
            options={[
              { value: "all", label: "Alle", ariaLabel: "Alle im Gewerk" },
              {
                value: "own",
                label: "Wer abgehakt hat",
                ariaLabel: "Wer abgehakt hat und Leitung",
              },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Die Leitung darf immer. „Ich bin dran“ und neue Schritte können alle setzen.
          </p>
        </div>
      </div>
    </ResponsivePanel>
  );
}
