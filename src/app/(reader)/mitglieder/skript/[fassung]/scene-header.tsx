"use client";

import * as React from "react";
import { ClockIcon, CornerDownRightIcon, FileTextIcon, NotebookPenIcon } from "lucide-react";

import { ChevronDownIcon, UsersIcon } from "@/components/ui/action-icons";
import { formatPages, type SceneHeaderModel } from "@/lib/skript/scene-header";
import { formatDuration } from "@/lib/skript/stats";
import { cn } from "@/lib/utils";

import { CUE_STYLE } from "../shared";

/**
 * Szenenkopf im Leser (docs/Plan/skript-ansicht-plan.md): kompakt eine Zeile, angetippt eine
 * Karte. Fürs Handy gebaut – das PDF hat eine eigene Darstellung.
 */

const NUMBER = new Intl.NumberFormat("de-DE");

function Names({
  ids,
  names,
  mine,
  limit,
}: {
  ids: readonly string[];
  names: ReadonlyMap<string, string>;
  mine?: ReadonlySet<string>;
  limit?: number;
}) {
  const shown = limit ? ids.slice(0, limit) : ids;
  return (
    <>
      {shown.map((id, index) => (
        <React.Fragment key={id}>
          {index ? ", " : null}
          <span className={cn(mine?.has(id) && "font-semibold text-primary")}>
            {names.get(id) ?? id}
          </span>
        </React.Fragment>
      ))}
      {limit && ids.length > limit ? ` +${ids.length - limit}` : null}
    </>
  );
}

export function SceneHeader({
  model,
  names,
  expandedByDefault,
}: {
  model: SceneHeaderModel;
  names: ReadonlyMap<string, string>;
  /** Darstellung „Karte“: aufgeklappt beginnen. */
  expandedByDefault: boolean;
}) {
  const [open, setOpen] = React.useState(expandedByDefault);
  const mine = React.useMemo(
    () => new Set(model.roles?.speaking.filter((r) => r.mine).map((r) => r.id) ?? []),
    [model.roles],
  );
  const speakingIds = model.roles?.speaking.map((r) => r.id) ?? [];
  // Eigene Rollen zuerst, damit sie in der kompakten Zeile nicht hinter „+5“ verschwinden.
  const ordered = [
    ...speakingIds.filter((id) => mine.has(id)),
    ...speakingIds.filter((id) => !mine.has(id)),
  ];

  return (
    <div className="-mx-3 mb-2 border-b border-border/60 bg-muted/40 text-[0.8em] leading-snug sm:-mx-4 md:mx-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2 px-3 py-1.5 text-left sm:px-4 md:px-3"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          {model.roles ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <UsersIcon className="h-[1.1em] w-[1.1em] shrink-0 opacity-60" aria-hidden />
              <span className="tabular-nums">
                {speakingIds.length + model.roles.mentioned.length}
              </span>
              {!open && speakingIds.length ? (
                <span className="truncate text-muted-foreground">
                  · <Names ids={ordered} names={names} mine={mine} limit={3} />
                </span>
              ) : null}
            </span>
          ) : null}
          {model.mine ? (
            <span className="font-medium text-primary">
              Du: {model.mine.passages} {model.mine.passages === 1 ? "Replik" : "Repliken"}
            </span>
          ) : null}
          {model.duration ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <ClockIcon className="h-[1.1em] w-[1.1em] opacity-60" aria-hidden />
              {formatDuration(model.duration)}
            </span>
          ) : null}
          {model.size?.pages ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <FileTextIcon className="h-[1.1em] w-[1.1em] opacity-60" aria-hidden />
              {formatPages(model.size.pages)}
            </span>
          ) : null}
          {model.cues?.map(({ category, entries }) => (
            <span
              key={category}
              className={cn("border-l-[3px] px-1.5 tabular-nums", CUE_STYLE[category].className)}
            >
              {CUE_STYLE[category].label} {entries.length}
            </span>
          ))}
          {model.transition ? (
            <span className="inline-flex items-center gap-1">
              <CornerDownRightIcon className="h-[1.1em] w-[1.1em] opacity-60" aria-hidden />
              {model.transition.continuing.length} weiter
            </span>
          ) : null}
          {model.notes ? (
            <span className="inline-flex items-center gap-1">
              <NotebookPenIcon className="h-[1.1em] w-[1.1em] opacity-60" aria-hidden />
              {model.notes}
            </span>
          ) : null}
        </span>
        <ChevronDownIcon
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 opacity-60 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
        <span className="sr-only">
          {open ? "Szenenübersicht zuklappen" : "Szenenübersicht aufklappen"}
        </span>
      </button>

      {open ? (
        <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-3 pb-2.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:px-4 md:px-3">
          {model.roles ? (
            <Row label="Wer">
              {speakingIds.length ? (
                <span>
                  {ordered.map((id, index) => {
                    const role = model.roles?.speaking.find((r) => r.id === id);
                    return (
                      <React.Fragment key={id}>
                        {index ? ", " : null}
                        <span className={cn(mine.has(id) && "font-semibold text-primary")}>
                          {names.get(id) ?? id}
                        </span>
                        {role ? (
                          <span className="text-muted-foreground">
                            {" "}
                            {NUMBER.format(role.words)}
                          </span>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </span>
              ) : null}
              {model.roles.mentioned.length ? (
                <span className="block text-muted-foreground">
                  in der Regie genannt: <Names ids={model.roles.mentioned} names={names} />
                </span>
              ) : null}
            </Row>
          ) : null}
          {model.mine ? (
            <Row label="Mein Teil">
              {model.mine.passages} {model.mine.passages === 1 ? "Replik" : "Repliken"} ·{" "}
              {NUMBER.format(model.mine.words)} Wörter
              {model.mine.cue ? (
                <span className="block text-muted-foreground">
                  Erstes Stichwort{model.mine.cueSpeaker ? ` (${model.mine.cueSpeaker})` : ""}: „…
                  {model.mine.cue}“
                </span>
              ) : null}
            </Row>
          ) : null}
          {model.cues?.map(({ category, entries }) => (
            <Row key={category} label={CUE_STYLE[category].label} bar={barOf(category)}>
              <ul className="space-y-0.5">
                {entries.map((entry) => (
                  <li key={`${entry.blockId}-${entry.number}`} className="flex gap-2">
                    {entry.tag ? (
                      <span className="w-8 shrink-0 font-semibold tabular-nums">{entry.tag}</span>
                    ) : null}
                    <span className="min-w-0 flex-1">{entry.text}</span>
                    {entry.page != null ? (
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        S. {entry.page}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Row>
          ))}
          {model.duration || model.size ? (
            <Row label={model.size ? "Umfang" : "Dauer"}>
              {[
                model.duration ? formatDuration(model.duration) : null,
                model.size?.pages ? formatPages(model.size.pages) : null,
                model.size ? `${NUMBER.format(model.size.words)} Wörter` : null,
                model.size ? `${model.size.passages} Passagen` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              {model.duration?.estimated ? (
                <span className="text-muted-foreground"> (geschätzte Sprechzeit)</span>
              ) : null}
            </Row>
          ) : null}
          {model.transition ? (
            <Row label="Weiter">
              <Names ids={model.transition.continuing} names={names} mine={mine} />
              <span className="text-muted-foreground"> – direkt aus der Szene davor</span>
            </Row>
          ) : null}
          {model.notes ? (
            <Row label="Notizen">
              {model.notes} {model.notes === 1 ? "eigene Notiz" : "eigene Notizen"} in dieser Szene
            </Row>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

/** Nur die Randfarbe des Gewerks (ohne Fläche) für die Zeilenbeschriftung. */
function barOf(category: keyof typeof CUE_STYLE) {
  return CUE_STYLE[category].className.split(" ").find((c) => c.startsWith("border-")) ?? "";
}

function Row({ label, bar, children }: { label: string; bar?: string; children: React.ReactNode }) {
  return (
    <>
      <dt
        className={cn(
          "pt-0.5 text-[0.8em] font-semibold uppercase leading-tight tracking-wide text-muted-foreground",
          bar && cn("self-start border-l-[3px] pl-1.5", bar),
        )}
      >
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}
