"use client";

import type { DirectionWishStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import type { DirectionWishView } from "@/lib/regie/wishes";
import { cn } from "@/lib/utils";

import {
  createWishAction,
  replyWishAction,
  setWishStatusAction,
  type WishActionResult,
} from "@/app/(members)/mitglieder/regie/actions";

export type WishOption = { id: string; label: string };

const STATUS: Record<
  DirectionWishStatus,
  { label: string; variant: "warning" | "info" | "success" | "muted" }
> = {
  open: { label: "offen", variant: "warning" },
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

/** Neuer Wunsch: Textfeld zuerst, Bezug optional über Chips. */
export function WishComposer({
  showId,
  scenes,
  people,
  trigger,
}: {
  showId: string;
  scenes: WishOption[];
  people: WishOption[];
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [sceneIds, setSceneIds] = React.useState<string[]>([]);
  const [userIds, setUserIds] = React.useState<string[]>([]);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [more, setMore] = React.useState(false);
  const { pending, run } = useAction();

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter((list) => (list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id]));

  const reset = () => {
    setText("");
    setSceneIds([]);
    setUserIds([]);
    setDateFrom("");
    setDateTo("");
    setMore(false);
    setOpen(false);
  };

  const submit = () =>
    run(
      () => createWishAction({ showId, text, sceneIds, userIds, dateFrom, dateTo }),
      "Wunsch an die Planung geschickt",
      reset,
    );

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
        title="Wunsch an die Planung"
        description="Was soll die Probenplanung berücksichtigen?"
        showDescription
        footer={
          <div className="flex gap-2 p-4 sm:px-6">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button className="flex-1" onClick={submit} disabled={pending || !text.trim()}>
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
                label="Personen"
                options={people}
                selected={userIds}
                onToggle={toggle(setUserIds)}
              />
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setMore(true)}>
              + Zeitraum oder Personen angeben
            </Button>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

function WishCard({
  wish,
  currentUserId,
  mode,
  events,
}: {
  wish: DirectionWishView;
  currentUserId: string;
  mode: "direction" | "planner";
  events: WishOption[];
}) {
  const [reply, setReply] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const [decision, setDecision] = React.useState<"planned" | "declined" | null>(null);
  const [reason, setReason] = React.useState("");
  const [eventId, setEventId] = React.useState(wish.event?.id ?? "");
  const { pending, run } = useAction();
  const range = rangeLabel(wish.dateFrom, wish.dateTo);
  const status = STATUS[wish.status];
  const replies = wish.messages.length;

  const setStatus = (
    next: DirectionWishStatus,
    extra: { reason?: string; eventId?: string } = {},
  ) =>
    run(
      () => setWishStatusAction({ wishId: wish.id, status: next, ...extra }),
      `Wunsch ${STATUS[next].label}`,
      () => {
        setDecision(null);
        setReason("");
      },
    );

  return (
    <li
      id={`wunsch-${wish.id}`}
      className="scroll-mt-24 rounded-xl border border-border/70 bg-card p-4 target:ring-2 target:ring-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="whitespace-pre-line text-[15px] leading-snug">{wish.text}</p>
        <Badge variant={status.variant} className="shrink-0">
          {status.label}
        </Badge>
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
      </p>

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
                  {message.status ? (
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

      {mode === "planner" ? (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <div className="flex flex-wrap gap-2">
            {wish.status !== "planned" ? (
              <Button size="sm" variant="outline" onClick={() => setDecision("planned")}>
                Eingeplant …
              </Button>
            ) : null}
            {wish.status !== "done" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setStatus("done")}
              >
                Erledigt
              </Button>
            ) : null}
            {wish.status !== "declined" ? (
              <Button size="sm" variant="ghost" onClick={() => setDecision("declined")}>
                Ablehnen …
              </Button>
            ) : null}
            {wish.status !== "open" ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setStatus("open")}
              >
                Wieder öffnen
              </Button>
            ) : null}
          </div>
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
                placeholder="Grund (sieht das Regieteam)"
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
        </div>
      ) : wish.status === "planned" ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          disabled={pending}
          onClick={() => setStatus("done")}
        >
          Als erledigt markieren
        </Button>
      ) : null}
    </li>
  );
}

type Filter = "all" | "mine" | "open";

/** Gemeinsamer Eingang „Regieteam“ bzw. Sicht der Planung. */
export function WishBoard({
  wishes,
  currentUserId,
  mode,
  events = [],
}: {
  wishes: DirectionWishView[];
  currentUserId: string;
  mode: "direction" | "planner";
  events?: WishOption[];
}) {
  const [filter, setFilter] = React.useState<Filter>(mode === "planner" ? "open" : "all");
  const visible = wishes.filter((wish) =>
    filter === "mine"
      ? wish.author?.id === currentUserId
      : filter === "open"
        ? wish.status === "open" || wish.status === "planned"
        : true,
  );

  return (
    <div className="space-y-3">
      <SegmentedControl
        aria-label="Wünsche filtern"
        value={filter}
        onValueChange={setFilter}
        options={[
          { value: "all", label: `Alle (${wishes.length})` },
          { value: "open", label: "Offen" },
          ...(mode === "direction" ? [{ value: "mine" as const, label: "Meine Wünsche" }] : []),
        ]}
      />
      {visible.length ? (
        <ul className="space-y-3">
          {visible.map((wish) => (
            <WishCard
              key={wish.id}
              wish={wish}
              currentUserId={currentUserId}
              mode={mode}
              events={events}
            />
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
