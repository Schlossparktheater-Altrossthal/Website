import {
  DirectionChips,
  DirectionEmpty,
  DirectionViewHeader,
} from "@/components/regie/direction-ui";
import { formatDay, loadDirectionProtocols } from "@/lib/regie/data";
import {
  directionHref,
  firstParam,
  resolveDirectionPage,
  type DirectionSearchParams,
} from "@/lib/regie/page";
import { cn } from "@/lib/utils";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Probenprotokolle · Regie" };

const FILTERS = {
  alle: "Alle Proben",
  aufgaben: "Offene Aufgaben",
  entscheidungen: "Entscheidungen",
} as const;
type Filter = keyof typeof FILTERS;

const NOTE_TONE: Record<string, string> = {
  NOTE: "border-l-muted-foreground/40",
  DECISION: "border-l-primary",
  TASK: "border-l-warning",
};

const NOTE_LABEL: Record<string, string> = {
  NOTE: "Notiz",
  DECISION: "Entscheidung",
  TASK: "Aufgabe",
};

export default async function DirectionProtocolsPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const params = await searchParams;
  const { show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const all = await loadDirectionProtocols(show.id, 30);
  const filterParam = firstParam(params.filter);
  const filter: Filter = filterParam && filterParam in FILTERS ? (filterParam as Filter) : "alle";
  const keep = (note: (typeof all)[number]["notes"][number]) =>
    filter === "aufgaben"
      ? note.type === "TASK" && !note.done
      : filter === "entscheidungen"
        ? note.type === "DECISION"
        : true;
  const protocols = all
    .map((protocol) => ({ ...protocol, notes: protocol.notes.filter(keep) }))
    .filter((protocol) => filter === "alle" || protocol.notes.length);
  const count = (f: Filter) =>
    f === "alle"
      ? all.length
      : all
          .flatMap((p) => p.notes)
          .filter((n) => (f === "aufgaben" ? n.type === "TASK" && !n.done : n.type === "DECISION"))
          .length;
  const link = (value: Filter) => `${directionHref("protokolle", show.id)}&filter=${value}`;

  return (
    <div className="space-y-4">
      <DirectionViewHeader
        title="Probenprotokolle"
        description="Die letzten Proben mit Notizen, Entscheidungen und Aufgaben"
        showId={show.id}
      />
      <DirectionChips
        items={(Object.keys(FILTERS) as Filter[]).map((value) => ({
          href: link(value),
          label: FILTERS[value],
          active: filter === value,
          count: count(value),
        }))}
      />
      {protocols.length ? (
        <ul className="space-y-3">
          {protocols.map((protocol) => (
            <li key={protocol.id} className="rounded-xl border border-border/70 bg-card p-3">
              <p className="font-medium">
                {protocol.title}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  · {formatDay(protocol.start)}
                </span>
              </p>
              {protocol.summary ? (
                <p className="mt-1 whitespace-pre-line text-sm">{protocol.summary}</p>
              ) : null}
              {protocol.notes.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {protocol.notes.map((note) => (
                    <li
                      key={note.id}
                      className={cn(
                        "border-l-2 pl-2",
                        NOTE_TONE[note.type],
                        note.done &&
                          "text-muted-foreground line-through decoration-muted-foreground/50",
                      )}
                    >
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {NOTE_LABEL[note.type] ?? note.type}
                        {note.type === "TASK" ? (note.done ? " · erledigt" : " · offen") : ""}
                      </span>
                      <span className="block whitespace-pre-line">{note.text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <DirectionEmpty>Noch keine Protokolle.</DirectionEmpty>
      )}
    </div>
  );
}
