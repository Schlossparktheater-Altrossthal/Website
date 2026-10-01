"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { CircleDashed, CircleSlash, MoreHorizontal, Play, WifiOff } from "lucide-react";

import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { AsyncButton } from "@/components/ui/async-button";
import { Checkbox } from "@/components/ui/checkbox";
import { useEventLiveRefresh } from "@/hooks/useEventLiveRefresh";
import {
  ATTENDANCE_LABELS,
  countAttendance,
  resolveCurrentBlock,
  type AttendanceMarkValue,
  type OutcomeValue,
  type ProtocolBlock,
  type ProtocolCandidate,
  type ProtocolOp,
  type ProtocolPerson,
  type ProtocolState,
  type AssigneeOption,
} from "@/lib/calendar/protocol";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { cn } from "@/lib/utils";

import { sendProtocolAction } from "./actions";
import { NotesPanel } from "./notes-panel";
import { useProtocolSync, type SyncStatus } from "./use-protocol-sync";

const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});
const time = (iso: string | null) => (iso ? TIME.format(new Date(iso)) : "–");
const span = (start: string | null, end: string | null) =>
  start ? `${time(start)}${end ? `–${time(end)}` : ""}` : null;

function subscribeMinute(onChange: () => void) {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}
const minuteNow = () => Math.floor(Date.now() / 30_000) * 30_000;
function useNow() {
  return useSyncExternalStore(subscribeMinute, minuteNow, () => null);
}

const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

type Dispatch = (op: ProtocolOp) => void;

const SYNC_LABELS: Record<SyncStatus, string> = {
  synced: "gespeichert",
  sending: "speichert…",
  waiting: "wartet",
  offline: "offline",
};

function SyncBadge({ status, pending }: { status: SyncStatus; pending: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
        status === "offline" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground",
      )}
      role="status"
    >
      {status === "offline" ? (
        <WifiOff className="size-3.5" aria-hidden />
      ) : (
        <span
          className={cn("size-2 rounded-full", status === "synced" ? "bg-success" : "bg-warning")}
          aria-hidden
        />
      )}
      {SYNC_LABELS[status]}
      {pending ? ` · ${pending} offen` : ""}
    </span>
  );
}

function OutcomeIcon({ block }: { block: ProtocolBlock }) {
  if (block.outcome === "DONE")
    return <CheckIcon className="size-4 text-success" aria-label="geschafft" />;
  if (block.outcome === "PARTIAL")
    return <CircleDashed className="size-4 text-warning" aria-label="teilweise" />;
  if (block.outcome === "SKIPPED")
    return <CircleSlash className="size-4 text-muted-foreground" aria-label="nicht geprobt" />;
  if (block.actualStart && !block.actualEnd)
    return <Play className="size-4 text-primary" aria-label="läuft" />;
  return <span className="size-4 rounded-full border border-border" aria-hidden />;
}

const OUTCOME_OPTIONS: { value: OutcomeValue; label: string }[] = [
  { value: "DONE", label: "Geschafft" },
  { value: "PARTIAL", label: "Teilweise" },
  { value: "SKIPPED", label: "Nicht" },
];

/** Der aktuelle Punkt groß, mit den Knöpfen für Start und Ende. */
function CurrentBlock({
  block,
  running,
  dispatch,
}: {
  block: ProtocolBlock;
  running: boolean;
  dispatch: Dispatch;
}) {
  const planned = span(block.plannedStart, block.plannedEnd);
  return (
    <div className="space-y-3 rounded-lg border border-primary/50 bg-primary/5 p-4">
      <div>
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          {running ? "Läuft gerade" : "Als Nächstes"}
        </p>
        <p className="text-lg font-semibold leading-snug">{block.label}</p>
        <p className="text-xs text-muted-foreground">
          {[
            planned ? `geplant ${planned}` : block.unplanned ? "spontan hinzugefügt" : null,
            block.location,
            block.actualStart ? `begonnen ${time(block.actualStart)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {running ? (
        <div className="grid grid-cols-3 gap-2">
          {OUTCOME_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="lg"
              variant={option.value === "DONE" ? "default" : "outline"}
              onClick={() =>
                dispatch({
                  type: "block-finish",
                  blockId: block.id,
                  at: nowIso(),
                  outcome: option.value,
                })
              }
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            size="lg"
            className="flex-1"
            onClick={() => dispatch({ type: "block-start", blockId: block.id, at: nowIso() })}
          >
            <Play className="size-4" aria-hidden />
            Starten
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() =>
              dispatch({ type: "block-finish", blockId: block.id, at: null, outcome: "SKIPPED" })
            }
          >
            Überspringen
          </Button>
        </div>
      )}
    </div>
  );
}

function BlockRow({
  block,
  index,
  count,
  dispatch,
  onMove,
}: {
  block: ProtocolBlock;
  index: number;
  count: number;
  dispatch: Dispatch;
  onMove: (from: number, to: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(block.note);
  const planned = span(block.plannedStart, block.plannedEnd);
  const actual = span(block.actualStart, block.actualEnd);

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3 px-2 py-2 text-left hover:bg-muted"
      >
        <OutcomeIcon block={block} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{block.label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[
              planned ? `geplant ${planned}` : block.unplanned ? "spontan" : null,
              actual ? `ist ${actual}` : null,
              block.note ? "Notiz" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </button>
      {open ? (
        <div className="space-y-3 bg-muted/50 px-3 py-3">
          <SegmentedControl
            value={block.outcome ?? "NONE"}
            onValueChange={(value) =>
              dispatch({
                type: "block-finish",
                blockId: block.id,
                at:
                  value === "NONE"
                    ? null
                    : (block.actualEnd ?? (block.actualStart ? nowIso() : null)),
                outcome: value === "NONE" ? null : value,
              })
            }
            options={[{ value: "NONE" as const, label: "Offen" }, ...OUTCOME_OPTIONS]}
            fullWidth
            aria-label={`Ergebnis ${block.label}`}
          />
          <div className="space-y-1">
            <Label htmlFor={`note-${block.id}`}>Notiz zu diesem Punkt</Label>
            <Textarea
              id={`note-${block.id}`}
              value={note}
              rows={2}
              maxLength={2000}
              placeholder="z. B. Auftritt links statt rechts"
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => {
                if (note !== block.note) dispatch({ type: "block-note", blockId: block.id, note });
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                dispatch({
                  type: "block-start",
                  blockId: block.id,
                  at: block.actualStart ? null : nowIso(),
                })
              }
            >
              {block.actualStart ? "Zeiten zurücksetzen" : "Jetzt starten"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
              aria-label="Nach oben"
            >
              <ChevronUpIcon className="size-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={index === count - 1}
              onClick={() => onMove(index, index + 1)}
              aria-label="Nach unten"
            >
              <ChevronDownIcon className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function AddBlockDialog({
  open,
  onOpenChange,
  scenes,
  usedSceneIds,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenes: { id: string; label: string }[];
  usedSceneIds: Set<string>;
  dispatch: Dispatch;
}) {
  const [title, setTitle] = useState("");
  const available = scenes.filter((scene) => !usedSceneIds.has(scene.id));
  const add = (op: Omit<Extract<ProtocolOp, { type: "block-add" }>, "type" | "blockId">) => {
    dispatch({ type: "block-add", blockId: newId(), ...op });
    setTitle("");
    onOpenChange(false);
  };
  return (
    <ModalFormDialog
      title="Punkt hinzufügen"
      description="Spontan eingeschoben – im Protokoll als „spontan“ gekennzeichnet."
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-4">
        {available.length ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">Szene</p>
            <ul className="max-h-60 overflow-y-auto rounded-md border border-border">
              {available.map((scene) => (
                <li key={scene.id}>
                  <button
                    type="button"
                    className="min-h-11 w-full px-3 text-left text-sm hover:bg-muted"
                    onClick={() => add({ title: scene.label, sceneId: scene.id })}
                  >
                    {scene.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <form
          className="space-y-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim()) add({ title: title.trim(), sceneId: null });
          }}
        >
          <Label htmlFor="probe-add-title">Oder etwas anderes</Label>
          <div className="flex gap-2">
            <Input
              id="probe-add-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="z. B. Umbau, Lied üben"
              maxLength={200}
            />
            <Button type="submit" variant="outline" disabled={!title.trim()}>
              Hinzufügen
            </Button>
          </div>
        </form>
      </div>
    </ModalFormDialog>
  );
}

const MARK_TONE: Record<AttendanceMarkValue, string> = {
  PRESENT: "border-success bg-success/15 text-foreground",
  LATE: "border-warning bg-warning/15 text-foreground",
  LEFT_EARLY: "border-warning bg-warning/15 text-foreground",
  ABSENT: "border-destructive bg-destructive/10 text-muted-foreground line-through",
  EXCUSED: "border-border bg-muted text-muted-foreground",
};

function PersonChip({ person, dispatch }: { person: ProtocolPerson; dispatch: Dispatch }) {
  const set = (mark: AttendanceMarkValue | null, withTime = false) =>
    dispatch({ type: "attendance", userId: person.userId, mark, at: withTime ? nowIso() : null });
  const here = person.mark === "PRESENT";
  return (
    <li
      className={cn(
        "flex min-h-12 items-stretch overflow-hidden rounded-lg border",
        person.mark ? MARK_TONE[person.mark] : "border-border bg-card",
      )}
    >
      <button
        type="button"
        onClick={() => set(here ? null : "PRESENT")}
        aria-pressed={here}
        className="flex min-w-0 flex-1 flex-col justify-center px-3 py-1.5 text-left"
      >
        <span className="truncate text-sm font-medium">{person.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {person.mark
            ? `${ATTENDANCE_LABELS[person.mark]}${person.at ? ` ${time(person.at)}` : ""}`
            : person.declined
              ? "hatte abgesagt"
              : person.detail || "tippen = da"}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-10 shrink-0 items-center justify-center border-l border-border/60 hover:bg-muted"
            aria-label={`Anwesenheit ${person.name}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => set("PRESENT")}>da</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => set("LATE", true)}>
            kommt gerade (verspätet)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => set("LEFT_EARLY", true)}>
            geht jetzt (früher weg)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => set("ABSENT")}>fehlt</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => set("EXCUSED")}>entschuldigt</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => set(null)}>zurücksetzen</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function AddPersonDialog({
  open,
  onOpenChange,
  candidates,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: readonly ProtocolCandidate[];
  dispatch: Dispatch;
}) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLocaleLowerCase("de");
  const matches = term
    ? candidates.filter((entry) => entry.name.toLocaleLowerCase("de").includes(term)).slice(0, 8)
    : [];
  const close = () => {
    setQuery("");
    onOpenChange(false);
  };
  return (
    <ModalFormDialog
      title="Person hinzufügen"
      description="Wer nicht eingeladen war und trotzdem da ist – Mitglied oder Gast."
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="probe-add-person">Name</Label>
          <Input
            id="probe-add-person"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name suchen oder Gast eintragen"
            maxLength={120}
            autoFocus
          />
        </div>
        {matches.length ? (
          <ul className="rounded-md border border-border">
            {matches.map((entry) => (
              <li key={entry.userId}>
                <button
                  type="button"
                  className="min-h-11 w-full px-3 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    dispatch({
                      type: "attendance",
                      userId: entry.userId,
                      mark: "PRESENT",
                      at: null,
                    });
                    close();
                  }}
                >
                  {entry.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {query.trim() ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              dispatch({ type: "guest-add", guestId: newId(), name: query.trim() });
              close();
            }}
          >
            „{query.trim()}“ als Gast eintragen
          </Button>
        ) : null}
      </div>
    </ModalFormDialog>
  );
}

function AttendancePanel({
  state,
  candidates,
  dispatch,
}: {
  state: ProtocolState;
  candidates: readonly ProtocolCandidate[];
  dispatch: Dispatch;
}) {
  const [adding, setAdding] = useState(false);
  // Noch nicht Erfasste zuerst, damit man sich von oben nach unten durcharbeitet.
  const people = [...state.people].sort(
    (a, b) => Number(a.mark !== null) - Number(b.mark !== null),
  );
  const open = state.people.filter((person) => person.mark === null);
  const available = candidates.filter(
    (entry) => !state.people.some((person) => person.userId === entry.userId),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <PlusIcon className="size-4" />
          Person
        </Button>
        {open.length ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              open.forEach((person) =>
                dispatch({ type: "attendance", userId: person.userId, mark: "PRESENT", at: null }),
              )
            }
          >
            Übrige {open.length} als da
          </Button>
        ) : null}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((person) => (
          <PersonChip key={person.userId} person={person} dispatch={dispatch} />
        ))}
        {state.guests.map((guest) => (
          <li
            key={guest.id}
            className="flex min-h-12 items-center justify-between rounded-lg border border-success bg-success/15 px-3"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{guest.name}</span>
              <span className="block text-xs text-muted-foreground">Gast</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "guest-remove", guestId: guest.id })}
            >
              Entfernen
            </Button>
          </li>
        ))}
      </ul>
      <AddPersonDialog
        open={adding}
        onOpenChange={setAdding}
        candidates={available}
        dispatch={dispatch}
      />
    </div>
  );
}

/** Abschluss: Zusammenfassung schreiben und das Protokoll verschicken. */
function EndDialog({
  open,
  onOpenChange,
  state,
  ended,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ProtocolState;
  ended: boolean;
  onConfirm: (result: { summary: string; send: boolean }) => void;
}) {
  const [summary, setSummary] = useState(state.summary);
  const [send, setSend] = useState(!ended);
  const done = state.blocks.filter((block) => block.outcome === "DONE").length;
  const partial = state.blocks.filter((block) => block.outcome === "PARTIAL").length;
  const attendance = countAttendance(state);
  const tasks = state.notes.filter((note) => note.type === "TASK" && !note.doneAt).length;
  const decisions = state.notes.filter((note) => note.type === "DECISION").length;
  return (
    <ModalFormDialog
      title={ended ? "Zusammenfassung" : "Probe beenden"}
      description={`${done} geschafft${partial ? `, ${partial} teilweise` : ""} · ${attendance.here} von ${attendance.expected} da · ${decisions} Entscheidungen · ${tasks} offene Aufgaben`}
      open={open}
      onOpenChange={onOpenChange}
      footer={
        <Button type="button" onClick={() => onConfirm({ summary, send })}>
          {ended ? "Speichern" : "Probe beenden"}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="probe-summary">Was wurde geschafft? (freiwillig)</Label>
          <Textarea
            id="probe-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={4}
            maxLength={8000}
            placeholder="Kurz für alle: Stand, Stimmung, was nächstes Mal dran ist"
          />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Checkbox checked={send} onCheckedChange={(value) => setSend(value === true)} />
          Protokoll an alle Eingeladenen und Anwesenden schicken
        </label>
      </div>
    </ModalFormDialog>
  );
}

export function ProbeMode({
  eventId,
  title,
  plannedStart,
  plannedEnd,
  serverState,
  candidates,
  scenes,
  assignees,
  sentAt,
}: {
  eventId: string;
  title: string;
  plannedStart: string;
  plannedEnd: string | null;
  serverState: ProtocolState;
  candidates: ProtocolCandidate[];
  scenes: { id: string; label: string }[];
  assignees: AssigneeOption[];
  /** Wann das Protokoll zuletzt verschickt wurde. */
  sentAt: string | null;
}) {
  useEventLiveRefresh(eventId);
  const { state, dispatch, status, pending } = useProtocolSync(eventId, serverState, candidates);
  const now = useNow();
  const [tab, setTab] = useState<"ablauf" | "leute" | "notizen">("ablauf");
  const [ending, setEnding] = useState(false);
  // Versand erst, wenn alle Änderungen beim Server sind (auch nach einer Offline-Phase).
  const [sendWhenSynced, setSendWhenSynced] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!sendWhenSynced || status !== "synced" || sending) return;
    setSending(true);
    void sendProtocolAction({ eventId })
      .then((result) => {
        if (result.ok) toast.success("Protokoll verschickt", { duration: 3000 });
        else toast.error("Nicht verschickt", { description: result.error, duration: 5000 });
      })
      .finally(() => {
        setSending(false);
        setSendWhenSynced(false);
      });
  }, [sendWhenSynced, status, sending, eventId]);
  const [adding, setAdding] = useState(false);
  const current = resolveCurrentBlock(state.blocks);
  const attendance = countAttendance(state);
  const usedSceneIds = useMemo(
    () => new Set(state.blocks.flatMap((block) => (block.sceneId ? [block.sceneId] : []))),
    [state.blocks],
  );

  const move = (from: number, to: number) => {
    const ids = state.blocks.map((block) => block.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    dispatch({ type: "block-order", blockIds: ids });
  };

  const started = !!state.actualStart;
  const ended = !!state.actualEnd;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 space-y-2 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">
              {started
                ? `Begonnen ${time(state.actualStart)} (geplant ${time(plannedStart)})`
                : `Geplant ${span(plannedStart, plannedEnd)} Uhr`}
              {ended ? ` · beendet ${time(state.actualEnd)}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-lg font-semibold tabular-nums">
              {now === null ? "" : TIME.format(new Date(now))}
            </span>
            <SyncBadge status={status} pending={pending} />
          </div>
        </div>
        {!started ? (
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => dispatch({ type: "event-time", field: "start", at: nowIso() })}
          >
            <Play className="size-4" aria-hidden />
            Probe beginnen
          </Button>
        ) : !ended ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setEnding(true)}
          >
            Probe beenden
          </Button>
        ) : (
          <div className="flex gap-2">
            <AsyncButton
              type="button"
              size="sm"
              className="flex-1"
              isLoading={sending || sendWhenSynced}
              loadingText={status === "offline" ? "Sendet bei Netz…" : "Sendet…"}
              onClick={() => setSendWhenSynced(true)}
            >
              {sentAt ? "Protokoll erneut senden" : "Protokoll senden"}
            </AsyncButton>
            <Button type="button" variant="outline" size="sm" onClick={() => setEnding(true)}>
              Zusammenfassung
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "event-time", field: "end", at: null })}
            >
              Weiterproben
            </Button>
          </div>
        )}
      </div>

      <SegmentedControl
        value={tab}
        onValueChange={setTab}
        options={[
          { value: "ablauf" as const, label: "Ablauf" },
          {
            value: "leute" as const,
            label: `Da ${attendance.here}/${attendance.expected}`,
          },
          { value: "notizen" as const, label: `Notizen ${state.notes.length}` },
        ]}
        fullWidth
        aria-label="Bereich wählen"
      />

      {tab === "ablauf" ? (
        <div className="space-y-4">
          {current ? (
            <CurrentBlock block={current.block} running={current.running} dispatch={dispatch} />
          ) : state.blocks.length ? (
            <p className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
              Alle Punkte sind erledigt.
            </p>
          ) : null}

          <section className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 className="text-sm font-semibold">Ablauf</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(true)}>
                <PlusIcon className="size-4" />
                Punkt
              </Button>
            </div>
            {state.blocks.length ? (
              <ol>
                {state.blocks.map((block, index) => (
                  <BlockRow
                    key={`${block.id}-${block.note}`}
                    block={block}
                    index={index}
                    count={state.blocks.length}
                    dispatch={dispatch}
                    onMove={move}
                  />
                ))}
              </ol>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Kein Ablauf geplant – füge Punkte hinzu, sobald sie geprobt werden.
              </p>
            )}
          </section>
          <AddBlockDialog
            open={adding}
            onOpenChange={setAdding}
            scenes={scenes}
            usedSceneIds={usedSceneIds}
            dispatch={dispatch}
          />
        </div>
      ) : tab === "leute" ? (
        <AttendancePanel state={state} candidates={candidates} dispatch={dispatch} />
      ) : (
        <NotesPanel state={state} assignees={assignees} dispatch={dispatch} />
      )}

      <EndDialog
        open={ending}
        onOpenChange={setEnding}
        state={state}
        ended={ended}
        onConfirm={({ summary, send }) => {
          if (summary !== state.summary) dispatch({ type: "summary", text: summary });
          if (!ended) dispatch({ type: "event-time", field: "end", at: nowIso() });
          if (send) setSendWhenSynced(true);
          setEnding(false);
        }}
      />

      {status === "offline" ? (
        <Badge variant="outline" className="w-full justify-center border-warning text-warning">
          Offline – alles wird auf diesem Gerät gespeichert und später übertragen.
        </Badge>
      ) : null}
    </div>
  );
}
