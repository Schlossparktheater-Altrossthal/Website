"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

import { ChevronDownIcon, PlusIcon } from "@/components/ui/action-icons";
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
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_MARKS,
  type AttendanceMarkValue,
  type ProtocolCandidate,
  type ProtocolOp,
  type ProtocolPerson,
  type ProtocolState,
} from "@/lib/calendar/protocol";
import { cn } from "@/lib/utils";

import { newId, nowIso, time } from "./format";

type Dispatch = (op: ProtocolOp) => void;
type Section = "open" | "done";

/** So lange nach dem letzten Tippen bleibt die Liste stehen, bevor sie neu einsortiert. */
const SETTLE_MS = 1500;

const MARK_TONE: Record<AttendanceMarkValue, string> = {
  PRESENT: "border-success bg-success/15 text-foreground",
  LATE: "border-warning bg-warning/15 text-foreground",
  LEFT_EARLY: "border-warning bg-warning/15 text-foreground",
  ABSENT: "border-destructive bg-destructive/10 text-muted-foreground line-through",
  EXCUSED: "border-border bg-muted text-muted-foreground",
};

const sectionOf = (person: ProtocolPerson): Section => (person.mark ? "done" : "open");

/**
 * Wer angetippt wird, bleibt an seinem Platz, solange weiter getippt wird – sonst rutscht die
 * nächste Person unter den Finger. Erst nach einer kurzen Pause sortiert die Liste neu, mit
 * View Transition (Karten gleiten an den neuen Platz), ohne bei „Bewegung reduzieren“.
 */
function useSettlingSections() {
  const [frozen, setFrozen] = useState<ReadonlyMap<string, Section>>(new Map());
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const settle = useCallback(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof document.startViewTransition !== "function") {
      setFrozen(new Map());
      return;
    }
    document.startViewTransition(() => flushSync(() => setFrozen(new Map())));
  }, []);

  const freeze = useCallback(
    (people: readonly ProtocolPerson[]) => {
      setFrozen((previous) => {
        const next = new Map(previous);
        for (const person of people) {
          if (!next.has(person.userId)) next.set(person.userId, sectionOf(person));
        }
        return next;
      });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(settle, SETTLE_MS);
    },
    [settle],
  );

  const placement = (person: ProtocolPerson) => frozen.get(person.userId) ?? sectionOf(person);
  return { freeze, placement };
}

/** Vor der Probe: nur wer eingeladen ist und wer abgesagt hat. */
function InvitedRow({ person }: { person: ProtocolPerson }) {
  return (
    <li className="flex min-h-12 flex-col justify-center rounded-lg border border-border bg-card px-3 py-1.5">
      <span
        className={cn("truncate text-sm font-medium", person.declined && "text-muted-foreground")}
      >
        {person.name}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {person.declined ? "hat abgesagt" : person.detail}
      </span>
    </li>
  );
}

function PersonChip({
  person,
  onMark,
}: {
  person: ProtocolPerson;
  onMark: (mark: AttendanceMarkValue | null, withTime?: boolean) => void;
}) {
  const here = person.mark === "PRESENT";
  return (
    <li
      style={{ viewTransitionName: `probe-person-${person.userId}` }}
      className={cn(
        "flex min-h-12 items-stretch overflow-hidden rounded-lg border transition-colors duration-200",
        person.mark ? MARK_TONE[person.mark] : "border-border bg-card",
      )}
    >
      <button
        type="button"
        onClick={() => onMark(here ? null : "PRESENT")}
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
          <DropdownMenuItem onSelect={() => onMark("PRESENT")}>da</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMark("LATE", true)}>
            kommt gerade (verspätet)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMark("LEFT_EARLY", true)}>
            geht jetzt (früher weg)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMark("ABSENT")}>fehlt</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMark("EXCUSED")}>entschuldigt</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onMark(null)}>zurücksetzen</DropdownMenuItem>
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

/** „12 da · 1 verspätet · 2 fehlen“ – Gäste zählen als da. */
function summarize(people: readonly ProtocolPerson[], guests: number) {
  const counts = new Map<AttendanceMarkValue, number>();
  for (const person of people) {
    if (person.mark) counts.set(person.mark, (counts.get(person.mark) ?? 0) + 1);
  }
  counts.set("PRESENT", (counts.get("PRESENT") ?? 0) + guests);
  return ATTENDANCE_MARKS.flatMap((mark) => {
    const count = counts.get(mark) ?? 0;
    return count ? [`${count} ${ATTENDANCE_LABELS[mark]}`] : [];
  }).join(" · ");
}

/**
 * Anwesenheit: oben „Offen“ zum Durcharbeiten, darunter „Erfasst“. Jede Erfassung lässt sich
 * über den Hinweis unten sofort zurücknehmen.
 */
export function AttendancePanel({
  state,
  candidates,
  dispatch,
  readOnly = false,
}: {
  state: ProtocolState;
  candidates: readonly ProtocolCandidate[];
  dispatch: Dispatch;
  /** Vorbereitung: Liste der Eingeladenen, Erfassen erst kurz vor Beginn. */
  readOnly?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [doneCollapsed, setDoneCollapsed] = useState(false);
  const { freeze, placement } = useSettlingSections();

  const openPeople = state.people.filter((person) => placement(person) === "open");
  const donePeople = state.people.filter((person) => placement(person) === "done");
  const unmarked = state.people.filter((person) => person.mark === null);
  const available = candidates.filter(
    (entry) => !state.people.some((person) => person.userId === entry.userId),
  );

  const mark = (person: ProtocolPerson, next: AttendanceMarkValue | null, withTime = false) => {
    const previous = { mark: person.mark, at: person.at };
    freeze([person]);
    dispatch({
      type: "attendance",
      userId: person.userId,
      mark: next,
      at: withTime ? nowIso() : null,
    });
    toast(`${person.name}: ${next ? ATTENDANCE_LABELS[next] : "offen"}`, {
      id: "probe-attendance",
      duration: 3000,
      action: {
        label: "Rückgängig",
        onClick: () => {
          freeze([person]);
          dispatch({ type: "attendance", userId: person.userId, ...previous });
        },
      },
    });
  };

  const markRemaining = () => {
    const people = unmarked;
    freeze(people);
    people.forEach((person) =>
      dispatch({ type: "attendance", userId: person.userId, mark: "PRESENT", at: null }),
    );
    toast(`${people.length} als da erfasst`, {
      id: "probe-attendance",
      duration: 5000,
      action: {
        label: "Rückgängig",
        onClick: () => {
          freeze(people);
          people.forEach((person) =>
            dispatch({ type: "attendance", userId: person.userId, mark: null, at: null }),
          );
        },
      },
    });
  };

  const doneCount = donePeople.length + state.guests.length;

  if (readOnly) {
    const invited = state.people.filter((person) => person.invited);
    const declined = invited.filter((person) => person.declined).length;
    return (
      <section className="space-y-2" aria-labelledby="probe-invited-heading">
        <h2 id="probe-invited-heading" className="text-sm font-semibold">
          Eingeladen <span className="text-muted-foreground tabular-nums">{invited.length}</span>
          {declined ? (
            <span className="font-normal text-muted-foreground"> · {declined} abgesagt</span>
          ) : null}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {invited.map((person) => (
            <InvitedRow key={person.userId} person={person} />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2" aria-labelledby="probe-open-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="probe-open-heading" className="text-sm font-semibold">
            Offen <span className="text-muted-foreground tabular-nums">{unmarked.length}</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {unmarked.length ? (
              <Button type="button" variant="ghost" size="sm" onClick={markRemaining}>
                Übrige {unmarked.length} als da
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
              <PlusIcon className="size-4" />
              Person
            </Button>
          </div>
        </div>
        {openPeople.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {openPeople.map((person) => (
              <PersonChip
                key={person.userId}
                person={person}
                onMark={(next, withTime) => mark(person, next, withTime)}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            Alle erfasst.
          </p>
        )}
      </section>

      {doneCount ? (
        <section className="space-y-2" aria-labelledby="probe-done-heading">
          <button
            type="button"
            onClick={() => setDoneCollapsed((value) => !value)}
            aria-expanded={!doneCollapsed}
            className="flex min-h-11 w-full items-center gap-2 text-left"
          >
            <h2 id="probe-done-heading" className="text-sm font-semibold">
              Erfasst <span className="text-muted-foreground tabular-nums">{doneCount}</span>
            </h2>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {summarize(donePeople, state.guests.length)}
            </span>
            <ChevronDownIcon
              className={cn("size-4 shrink-0 transition-transform", !doneCollapsed && "rotate-180")}
            />
          </button>
          {doneCollapsed ? null : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {donePeople.map((person) => (
                <PersonChip
                  key={person.userId}
                  person={person}
                  onMark={(next, withTime) => mark(person, next, withTime)}
                />
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
          )}
        </section>
      ) : null}

      <AddPersonDialog
        open={adding}
        onOpenChange={setAdding}
        candidates={available}
        dispatch={dispatch}
      />
    </div>
  );
}
