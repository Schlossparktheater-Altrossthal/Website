"use client";

import type { DirectionWishStatus, DirectionWishTargetStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import type { WishRecipientOptions } from "@/lib/regie/data";
import type { DirectionWishView, WishTargetInput, WishTargetView } from "@/lib/regie/wishes";
import { cn } from "@/lib/utils";

import {
  createWishAction,
  editWishAction,
  replyWishAction,
  setWishTargetStatusAction,
  type WishActionResult,
} from "@/app/(members)/mitglieder/regie/actions";

export type WishOption = { id: string; label: string };

type Variant = "warning" | "info" | "success" | "muted";

const STATUS: Record<DirectionWishStatus, { label: string; variant: Variant }> = {
  open: { label: "offen", variant: "warning" },
  planned: { label: "in Arbeit", variant: "info" },
  done: { label: "erledigt", variant: "success" },
  declined: { label: "abgelehnt", variant: "muted" },
};

const TARGET_STATUS: Record<DirectionWishTargetStatus, { label: string; variant: Variant }> = {
  open: { label: "offen", variant: "warning" },
  accepted: { label: "angenommen", variant: "info" },
  planned: { label: "eingeplant", variant: "info" },
  done: { label: "erledigt", variant: "success" },
  declined: { label: "abgelehnt", variant: "muted" },
};

const DAY = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  timeZone: "Europe/Berlin",
});
const STAMP = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

function rangeLabel(from: string | null, to: string | null) {
  if (from && to) return `${DAY.format(new Date(from))} – ${DAY.format(new Date(to))}`;
  if (to) return `bis ${DAY.format(new Date(to))}`;
  if (from) return `ab ${DAY.format(new Date(from))}`;
  return null;
}

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = React.useCallback(
    (action: () => Promise<WishActionResult>, success: string, after?: () => void) =>
      startTransition(async () => {
        const result = await action();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(success, { duration: 2500 });
        after?.();
        router.refresh();
      }),
    [router],
  );
  return { pending, run };
}

function Chips({
  options,
  selected,
  onToggle,
  label,
}: {
  options: WishOption[];
  selected: string[];
  onToggle: (id: string) => void;
  label: string;
}) {
  if (!options.length) return null;
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option.id)}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const PLANNING_KEY = "planning";

function parseTargetKey(key: string): WishTargetInput {
  if (key === PLANNING_KEY) return { kind: "planning" };
  const [kind, id] = key.split(":") as [Exclude<WishTargetInput["kind"], "planning">, string];
  return { kind, id };
}

/** Neuer Wunsch: Textfeld zuerst, dann „An:“ (Planung vorausgewählt), Bezug optional. */
export function WishComposer({
  showId,
  scenes,
  recipients,
  trigger,
}: {
  showId: string;
  scenes: WishOption[];
  recipients: WishRecipientOptions;
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [targets, setTargets] = React.useState<string[]>([PLANNING_KEY]);
  const [sceneIds, setSceneIds] = React.useState<string[]>([]);
  const [userIds, setUserIds] = React.useState<string[]>([]);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [moreTargets, setMoreTargets] = React.useState(false);
  const [more, setMore] = React.useState(false);
  const { pending, run } = useAction();

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((list) => (list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]));

  const reset = () => {
    setText("");
    setTargets([PLANNING_KEY]);
    setSceneIds([]);
    setUserIds([]);
    setDateFrom("");
    setDateTo("");
    setMoreTargets(false);
    setMore(false);
    setOpen(false);
  };

  const prefixed = (kind: string, options: WishOption[]) =>
    options.map((option) => ({ id: `${kind}:${option.id}`, label: option.label }));

  const submit = () =>
    run(
      () =>
        createWishAction({
          showId,
          text,
          targets: targets.map(parseTargetKey),
          sceneIds,
          userIds,
          dateFrom,
          dateTo,
        }),
      targets.length === 1 && targets[0] === PLANNING_KEY
        ? "Wunsch an die Planung geschickt"
        : "Wunsch geschickt",
      reset,
    );

  const chosenOthers = targets.filter((key) => key !== PLANNING_KEY).length;

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button size="lg" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
          Neuer Wunsch
        </Button>
      )}
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Neuer Wunsch"
        description="Was soll berücksichtigt werden – und von wem?"
        showDescription
        footer={
          <div className="flex gap-2 p-4 sm:px-6">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button
              className="flex-1"
              onClick={submit}
              disabled={pending || !text.trim() || !targets.length}
            >
              {pending ? "Senden …" : "Senden"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Textarea
            autoFocus
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="z. B. Szene 4 und 5 vor dem 12.6. einmal durchlaufen"
            aria-label="Wunsch"
          />
          <Chips
            label="An"
            options={[
              { id: PLANNING_KEY, label: "Planung" },
              // Eingeklappt: die schon gewählten weiteren Empfänger hier zeigen.
              ...(moreTargets
                ? []
                : [
                    ...prefixed("department", recipients.departments),
                    ...prefixed("character", recipients.characters),
                    ...prefixed("user", recipients.people),
                  ].filter((option) => targets.includes(option.id))),
            ]}
            selected={targets}
            onToggle={toggle(setTargets)}
          />
          {moreTargets ? (
            <>
              <Chips
                label="Gewerke"
                options={prefixed("department", recipients.departments)}
                selected={targets}
                onToggle={toggle(setTargets)}
              />
              <Chips
                label="Rollen"
                options={prefixed("character", recipients.characters)}
                selected={targets}
                onToggle={toggle(setTargets)}
              />
              <Chips
                label="Personen"
                options={prefixed("user", recipients.people)}
                selected={targets}
                onToggle={toggle(setTargets)}
              />
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setMoreTargets(true)}>
              + Gewerk, Rolle oder Person{chosenOthers ? ` (${chosenOthers} gewählt)` : ""}
            </Button>
          )}
          <Chips
            label="Szenen"
            options={scenes}
            selected={sceneIds}
            onToggle={toggle(setSceneIds)}
          />
          {more ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-sm font-medium">
                  <span>Ab</span>
                  <DateInput
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  <span>Bis</span>
                  <DateInput value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                </label>
              </div>
              <Chips
                label="Es geht um (Personen)"
                options={recipients.people}
                selected={userIds}
                onToggle={toggle(setUserIds)}
              />
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setMore(true)}>
              + Zeitraum oder betroffene Personen
            </Button>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

const ACTION_LABELS: Partial<Record<DirectionWishTargetStatus, string>> = {
  accepted: "Annehmen",
  done: "Erledigt",
  open: "Wieder öffnen",
};

/** Ein Empfänger mit Status und den Knöpfen, die die angemeldete Person nutzen darf. */
function TargetRow({ target, events }: { target: WishTargetView; events: WishOption[] }) {
  const [decision, setDecision] = React.useState<"planned" | "declined" | null>(null);
  const [reason, setReason] = React.useState("");
  const [eventId, setEventId] = React.useState("");
  const { pending, run } = useAction();
  const status = TARGET_STATUS[target.status];

  const setStatus = (
    next: DirectionWishTargetStatus,
    extra: { reason?: string; eventId?: string } = {},
  ) =>
    run(
      () => setWishTargetStatusAction({ targetId: target.id, status: next, ...extra }),
      `${target.label}: ${TARGET_STATUS[next].label}`,
      () => {
        setDecision(null);
        setReason("");
      },
    );

  // Wer nicht zum Empfänger gehört (Regieteam), sieht nur „Wieder öffnen“ bei fertigen Zielen.
  const actions = target.mine
    ? target.allowed
    : target.allowed.filter(
        (next) => next === "open" && (target.status === "declined" || target.status === "done"),
      );

  return (
    <li className="space-y-2 py-2 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium">{target.label}</span>
          {target.reason ? (
            <span className="block text-sm text-muted-foreground">Grund: {target.reason}</span>
          ) : null}
          {target.statusBy && target.status !== "open" ? (
            <span className="block text-xs text-muted-foreground">
              {target.statusBy}
              {target.statusAt ? ` · ${STAMP.format(new Date(target.statusAt))}` : ""}
            </span>
          ) : null}
        </div>
        <Badge variant={status.variant} className="shrink-0">
          {status.label}
        </Badge>
      </div>
      {actions.length ? (
        <div className="flex flex-wrap gap-2">
          {actions.includes("planned") ? (
            <Button size="sm" variant="outline" onClick={() => setDecision("planned")}>
              Eingeplant …
            </Button>
          ) : null}
          {(["accepted", "done", "open"] as const)
            .filter((next) => actions.includes(next))
            .map((next) => (
              <Button
                key={next}
                size="sm"
                variant={next === "open" ? "ghost" : "outline"}
                disabled={pending}
                onClick={() => setStatus(next)}
              >
                {ACTION_LABELS[next]}
              </Button>
            ))}
          {actions.includes("declined") ? (
            <Button size="sm" variant="ghost" onClick={() => setDecision("declined")}>
              Ablehnen …
            </Button>
          ) : null}
        </div>
      ) : null}
      {decision === "planned" ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 space-y-1 text-sm">
            <span className="font-medium">In welcher Probe? (optional)</span>
            <select
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Ohne Termin</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => setStatus("planned", { eventId: eventId || undefined })}
          >
            Speichern
          </Button>
        </div>
      ) : null}
      {decision === "declined" ? (
        <div className="flex gap-2">
          <Textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Grund (sieht die Regie)"
            aria-label="Grund"
          />
          <Button
            size="sm"
            className="self-end"
            disabled={pending || !reason.trim()}
            onClick={() => setStatus("declined", { reason })}
          >
            Ablehnen
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function WishCard({
  wish,
  currentUserId,
  events,
}: {
  wish: DirectionWishView;
  currentUserId: string;
  events: WishOption[];
}) {
  const [reply, setReply] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(wish.text);
  const { pending, run } = useAction();
  const range = rangeLabel(wish.dateFrom, wish.dateTo);
  const status = STATUS[wish.status];
  const replies = wish.messages.length;
  // Eigene Empfänger zuerst, damit die Knöpfe oben stehen.
  const targets = [...wish.targets].sort((a, b) => Number(b.mine) - Number(a.mine));

  return (
    <li
      id={`wunsch-${wish.id}`}
      className="scroll-mt-24 rounded-xl border border-border/70 bg-card p-4 target:ring-2 target:ring-primary"
    >
      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <div className="flex-1 space-y-2">
            <Textarea
              rows={3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Wunsch bearbeiten"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending || !draft.trim()}
                onClick={() =>
                  run(
                    () => editWishAction({ wishId: wish.id, text: draft }),
                    "Wunsch geändert",
                    () => setEditing(false),
                  )
                }
              >
                Speichern
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-line text-[15px] leading-snug">{wish.text}</p>
        )}
        {wish.targets.length > 1 ? (
          <Badge variant={status.variant} className="shrink-0">
            {status.label}
          </Badge>
        ) : null}
      </div>
      {wish.scenes.length || range || wish.people.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {wish.scenes.map((scene) => (
            <Badge key={scene.id} variant="outline">
              Sz. {scene.label}
            </Badge>
          ))}
          {range ? <Badge variant="outline">{range}</Badge> : null}
          {wish.people.map((person) => (
            <Badge key={person.id} variant="outline">
              {person.name}
            </Badge>
          ))}
        </div>
      ) : null}
      {wish.event ? (
        <p className="mt-2 text-sm text-info">
          Eingeplant: {wish.event.title}, {DAY.format(new Date(wish.event.start))}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {wish.author?.id === currentUserId ? "Von dir" : `Von ${wish.author?.name ?? "Unbekannt"}`}
        {" · "}
        {STAMP.format(new Date(wish.createdAt))}
        {wish.canEdit && !editing ? (
          <>
            {" · "}
            <button
              type="button"
              className="font-medium text-primary"
              onClick={() => {
                setDraft(wish.text);
                setEditing(true);
              }}
            >
              Bearbeiten
            </button>
          </>
        ) : null}
      </p>

      <div className="mt-3 rounded-lg border border-border/60 px-3 py-2">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">An</p>
        <ul className="divide-y divide-border/60">
          {targets.map((target) => (
            <TargetRow key={target.id} target={target} events={events} />
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-2 min-h-9 text-sm font-medium text-primary"
        aria-expanded={expanded}
      >
        {expanded
          ? "Verlauf schließen"
          : replies
            ? `Verlauf (${replies}) · Antworten`
            : "Antworten"}
      </button>

      {expanded ? (
        <div className="mt-2 space-y-3 border-t border-border/60 pt-3">
          {wish.messages.length ? (
            <ol className="space-y-2">
              {wish.messages.map((message) => (
                <li key={message.id} className="text-sm">
                  <span className="font-medium">
                    {message.authorId === currentUserId ? "Du" : (message.author ?? "Unbekannt")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · {STAMP.format(new Date(message.createdAt))}
                  </span>
                  {message.targetStatus ? (
                    <span className="block text-muted-foreground">
                      {message.targetLabel ? `${message.targetLabel}: ` : ""}„
                      {TARGET_STATUS[message.targetStatus].label}“
                    </span>
                  ) : message.status ? (
                    <span className="block text-muted-foreground">
                      hat den Wunsch auf „{STATUS[message.status].label}“ gesetzt
                    </span>
                  ) : null}
                  {message.text ? (
                    <span className="block whitespace-pre-line">{message.text}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          <div className="flex gap-2">
            <Textarea
              rows={2}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Antwort schreiben"
              aria-label="Antwort"
              className="min-h-0"
            />
            <Button
              className="self-end"
              disabled={pending || !reply.trim()}
              onClick={() =>
                run(
                  () => replyWishAction({ wishId: wish.id, text: reply }),
                  "Antwort gesendet",
                  () => setReply(""),
                )
              }
            >
              Senden
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

type Filter = "all" | "mine" | "open";

/** Offen aus Sicht der Ansicht: Planung bzw. eigene Empfänger noch nicht fertig. */
function isOpenFor(wish: DirectionWishView, mode: "direction" | "planner" | "recipient") {
  const relevant =
    mode === "planner"
      ? wish.targets.filter((target) => target.kind === "planning")
      : mode === "recipient"
        ? wish.targets.filter((target) => target.mine)
        : wish.targets;
  return relevant.some((target) => target.status !== "done" && target.status !== "declined");
}

/** Eingang des Regieteams, Sicht der Planung oder Wünsche an mich, meine Rollen und Gewerke. */
export function WishBoard({
  wishes,
  currentUserId,
  mode,
  events = [],
}: {
  wishes: DirectionWishView[];
  currentUserId: string;
  mode: "direction" | "planner" | "recipient";
  events?: WishOption[];
}) {
  const [filter, setFilter] = React.useState<Filter>(mode === "direction" ? "all" : "open");
  const visible = wishes.filter((wish) =>
    filter === "mine"
      ? wish.author?.id === currentUserId
      : filter === "open"
        ? isOpenFor(wish, mode)
        : true,
  );

  return (
    <div className="space-y-3">
      <SegmentedControl
        aria-label="Wünsche filtern"
        value={filter}
        onValueChange={setFilter}
        options={[
          { value: "open", label: "Offen" },
          { value: "all", label: `Alle (${wishes.length})` },
          ...(mode === "direction" ? [{ value: "mine" as const, label: "Meine Wünsche" }] : []),
        ]}
      />
      {visible.length ? (
        <ul className="space-y-3">
          {visible.map((wish) => (
            <WishCard key={wish.id} wish={wish} currentUserId={currentUserId} events={events} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
          Keine Wünsche in dieser Ansicht.
        </p>
      )}
    </div>
  );
}
