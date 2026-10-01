"use client";

import { Check, CircleDashed, CircleSlash, CornerDownRight } from "lucide-react";

import { EventTaskList } from "@/components/calendar/event-task-list";
import type { ProtocolView } from "@/lib/calendar/protocol-view";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { cn } from "@/lib/utils";

const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});
const time = (iso: string | null) => (iso ? TIME.format(new Date(iso)) : null);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function OutcomeMark({ outcome }: { outcome: ProtocolView["blocks"][number]["outcome"] }) {
  if (outcome === "DONE") return <Check className="size-4 text-success" aria-label="geschafft" />;
  if (outcome === "PARTIAL")
    return <CircleDashed className="size-4 text-warning" aria-label="teilweise" />;
  if (outcome === "SKIPPED")
    return <CircleSlash className="size-4 text-muted-foreground" aria-label="nicht geprobt" />;
  return <span className="size-4" aria-hidden />;
}

/** Protokoll einer Probe: kompakt und strukturiert, Freitext nur wo er entstanden ist. */
export function ProtocolSection({ protocol }: { protocol: ProtocolView }) {
  const started = time(protocol.actualStart);
  const ended = time(protocol.actualEnd);
  const myTasks = protocol.tasks.filter((task) => task.mine);
  const otherTasks = protocol.tasks.filter((task) => !task.mine);

  return (
    <div className="space-y-5">
      {started ? (
        <p className="text-sm text-muted-foreground">
          Geprobt {started}
          {ended ? `–${ended}` : " · läuft noch"} Uhr
          {protocol.sentAt ? " · Protokoll verschickt" : ""}
        </p>
      ) : null}

      {protocol.summary ? (
        <p className="whitespace-pre-line rounded-lg bg-muted p-3 text-sm">{protocol.summary}</p>
      ) : null}

      {myTasks.length ? (
        <Section title="Deine Aufgaben">
          <div className="rounded-lg border border-warning/50">
            <EventTaskList tasks={myTasks} showEvent={false} />
          </div>
        </Section>
      ) : null}

      {protocol.attendance.length || protocol.guests.length ? (
        <Section title="Anwesenheit">
          <ul className="space-y-1 text-sm">
            {protocol.attendance.map((entry) => (
              <li key={entry.mark}>
                <span className="font-medium">
                  {entry.label} ({entry.names.length}):
                </span>{" "}
                <span className="text-muted-foreground">{entry.names.join(", ")}</span>
              </li>
            ))}
            {protocol.guests.length ? (
              <li>
                <span className="font-medium">Gäste:</span>{" "}
                <span className="text-muted-foreground">{protocol.guests.join(", ")}</span>
              </li>
            ) : null}
          </ul>
        </Section>
      ) : null}

      {protocol.blocks.some((block) => block.outcome || block.actualStart || block.note) ? (
        <Section title="Ablauf">
          <ul className="divide-y divide-border">
            {protocol.blocks.map((block) => {
              const span = time(block.actualStart);
              return (
                <li key={block.id} className="flex items-start gap-2.5 py-1.5">
                  <OutcomeMark outcome={block.outcome} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm",
                        block.outcome === "SKIPPED" && "text-muted-foreground",
                      )}
                    >
                      {block.label}
                      {block.unplanned ? (
                        <span className="text-xs text-muted-foreground"> · spontan</span>
                      ) : null}
                    </p>
                    {block.note ? (
                      <p className="flex gap-1 text-xs text-muted-foreground">
                        <CornerDownRight className="mt-0.5 size-3 shrink-0" aria-hidden />
                        {block.note}
                      </p>
                    ) : null}
                  </div>
                  {span ? (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {span}
                      {block.actualEnd ? `–${time(block.actualEnd)}` : ""}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {protocol.decisions.length ? (
        <Section title="Entscheidungen">
          <ul className="space-y-1.5">
            {protocol.decisions.map((entry) => (
              <li
                key={entry.id}
                className="rounded-md border-l-2 border-info bg-info/5 px-3 py-1.5 text-sm"
              >
                {entry.text}
                {entry.block ? (
                  <span className="block text-xs text-muted-foreground">{entry.block}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {otherTasks.length ? (
        <Section title="Aufgaben">
          <ul className="space-y-1 text-sm">
            {otherTasks.map((task) => (
              <li key={task.id} className={cn(task.doneAt && "text-muted-foreground line-through")}>
                {task.doneAt ? "☑" : "☐"} {task.text}
                {task.assignee ? (
                  <span className="text-xs text-muted-foreground"> · {task.assignee}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {protocol.notes.length ? (
        <Section title="Notizen">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {protocol.notes.map((entry) => (
              <li key={entry.id}>
                {entry.text}
                {entry.block ? (
                  <span className="text-xs text-muted-foreground"> · {entry.block}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
