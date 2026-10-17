import { DirectionEmpty, DirectionViewHeader } from "@/components/regie/direction-ui";
import { formatDay, loadDirectionProtocols } from "@/lib/regie/data";
import { resolveDirectionPage, type DirectionSearchParams } from "@/lib/regie/page";
import { cn } from "@/lib/utils";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Probenprotokolle · Regie" };

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
  const { show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const protocols = await loadDirectionProtocols(show.id, 15);

  return (
    <div className="space-y-5">
      <DirectionViewHeader
        title="Probenprotokolle"
        description="Die letzten Proben mit Notizen, Entscheidungen und Aufgaben"
        showId={show.id}
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
                    <li key={note.id} className={cn(note.done && "text-muted-foreground")}>
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
