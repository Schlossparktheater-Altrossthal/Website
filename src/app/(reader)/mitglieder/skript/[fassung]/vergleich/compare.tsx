"use client";

import * as React from "react";
import Link from "next/link";

import { ArrowLeftIcon, ChevronDownIcon, UsersIcon } from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import type {
  CompareBlock,
  CompareScene,
  ScriptComparison,
  ScriptVersionOption,
} from "@/lib/skript/compare";
import type { ScriptPart } from "@/lib/skript/types";
import { cn } from "@/lib/utils";

import { CueMark, FONT_SIZES, SPEAKER_MAX_CHARS, useSettings } from "../../shared";

type Filter = "all" | "mine" | "cues";

const TYPE_LABEL: Record<CompareBlock["type"], string> = {
  same: "unverändert",
  changed: "geändert",
  added: "neu",
  removed: "gestrichen",
};

const TYPE_STYLE: Record<CompareBlock["type"], string> = {
  same: "border-transparent",
  changed: "border-warning bg-warning/10",
  added: "border-success bg-success/10",
  removed: "border-destructive bg-destructive/10",
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function Parts({ parts, struck = false }: { parts: ScriptPart[]; struck?: boolean }) {
  return (
    <>
      {parts.map((part, index) =>
        part.kind === "cue" ? (
          <span key={index} className={cn(struck && "line-through opacity-60")}>
            <CueMark part={part} />
          </span>
        ) : (
          <span
            key={index}
            className={cn(part.kind === "direction" && "italic text-muted-foreground")}
          >
            {part.text}{" "}
          </span>
        ),
      )}
    </>
  );
}

function ChangedText({ entry }: { entry: CompareBlock }) {
  const after = entry.block.parts;
  const cuesBefore = (entry.before?.parts ?? []).filter((part) => part.kind === "cue");
  return (
    <>
      {entry.words?.map((token, index) =>
        token.op === "equal" ? (
          <span key={index}>{token.text} </span>
        ) : token.op === "insert" ? (
          <ins key={index} className="bg-success/25 no-underline">
            {token.text}
          </ins>
        ) : (
          <del key={index} className="bg-destructive/15 text-muted-foreground">
            {token.text}
          </del>
        ),
      )}{" "}
      <Parts parts={after.filter((part) => part.kind !== "text")} />
      {entry.cueCategories.length ? (
        <Parts
          struck
          parts={cuesBefore.filter(
            (part) => part.kind === "cue" && !after.some((p) => p.text === part.text),
          )}
        />
      ) : null}
    </>
  );
}

function BlockRow({
  entry,
  mine,
  stacked,
}: {
  entry: CompareBlock;
  mine: boolean;
  stacked: boolean;
}) {
  const { block } = entry;
  const speaker = entry.speakerChanged ? (
    <>
      <del className="text-muted-foreground">{entry.before?.speaker}</del> {block.speaker}
    </>
  ) : (
    block.speaker
  );
  const body =
    entry.type === "changed" ? (
      <ChangedText entry={entry} />
    ) : (
      <span className={cn(entry.type === "removed" && "line-through decoration-destructive/60")}>
        <Parts parts={block.parts} />
      </span>
    );
  return (
    <div
      className={cn(
        "-mx-3 border-l-[3px] px-3 py-1 md:mx-0 md:grid md:grid-cols-[var(--speaker-col)_minmax(0,1fr)_5.5rem] md:gap-3 md:px-2",
        TYPE_STYLE[entry.type],
        entry.type === "same" && "opacity-55",
      )}
    >
      {block.kind === "speech" ? (
        <span
          aria-hidden
          className={cn(
            "hidden pt-[0.2em] text-[0.8em] font-bold uppercase tracking-wide md:block md:break-words",
            stacked && "md:col-span-3",
            mine && "text-primary",
          )}
        >
          {speaker}
        </span>
      ) : (
        <span className="hidden md:block" />
      )}
      <p
        className={cn(
          "break-words",
          stacked && "md:col-start-2",
          block.kind === "direction" && "italic text-muted-foreground",
        )}
      >
        {block.kind === "speech" ? (
          <span
            className={cn(
              "mr-1.5 text-[0.72em] font-bold uppercase tracking-wide md:sr-only",
              mine ? "text-primary" : "text-muted-foreground",
            )}
          >
            {speaker}
          </span>
        ) : null}
        {body}
      </p>
      <span
        className={cn(
          "block pt-[0.25em] text-[0.7em] font-semibold uppercase tracking-wide md:text-right",
          entry.type === "changed" && "text-foreground",
          entry.type === "added" && "text-success",
          entry.type === "removed" && "text-destructive",
          entry.type === "same" && "hidden",
        )}
      >
        {TYPE_LABEL[entry.type]}
      </span>
    </div>
  );
}

type Row =
  | { kind: "block"; entry: CompareBlock; key: string }
  | { kind: "same"; entries: CompareBlock[]; key: string };

/** Unveränderte Absätze zwischen Änderungen zu einer aufklappbaren Zeile zusammenfassen. */
function groupRows(blocks: CompareBlock[], relevant: (entry: CompareBlock) => boolean): Row[] {
  const rows: Row[] = [];
  blocks.forEach((entry, index) => {
    if (relevant(entry)) {
      rows.push({ kind: "block", entry, key: `${entry.block.id}-${index}` });
      return;
    }
    const last = rows.at(-1);
    if (last?.kind === "same") last.entries.push(entry);
    else rows.push({ kind: "same", entries: [entry], key: `same-${index}` });
  });
  return rows;
}

function SceneSection({
  scene,
  relevant,
  roleSet,
  showSame,
}: {
  scene: CompareScene;
  relevant: (entry: CompareBlock) => boolean;
  roleSet: ReadonlySet<string>;
  showSame: boolean;
}) {
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const rows = groupRows(scene.blocks, relevant);
  const isMine = (entry: CompareBlock) => entry.roleIds.some((id) => roleSet.has(id));
  const stackedOf = (entry: CompareBlock) => (entry.block.speaker?.length ?? 0) > SPEAKER_MAX_CHARS;
  return (
    <section id={`szene-${scene.key}`} className="scroll-mt-28">
      <h2 className="mb-1 mt-8 flex flex-wrap items-baseline gap-x-3 border-b-2 border-foreground pb-1 text-[0.85em] font-bold uppercase tracking-wider">
        <span>{scene.title}</span>
        {scene.previousTitle ? (
          <span className="text-[0.85em] font-normal normal-case tracking-normal text-muted-foreground">
            vorher: {scene.previousTitle}
          </span>
        ) : null}
        {scene.type === "added" || scene.type === "removed" ? (
          <span
            className={cn(
              "text-[0.8em]",
              scene.type === "added" ? "text-success" : "text-destructive",
            )}
          >
            {scene.type === "added" ? "neue Szene" : "Szene gestrichen"}
          </span>
        ) : null}
      </h2>
      {rows.map((row) => {
        if (row.kind === "block") {
          return (
            <BlockRow
              key={row.key}
              entry={row.entry}
              mine={isMine(row.entry)}
              stacked={stackedOf(row.entry)}
            />
          );
        }
        if (showSame || open.has(row.key)) {
          return row.entries.map((entry, index) => (
            <BlockRow
              key={`${row.key}-${index}`}
              entry={entry}
              mine={isMine(entry)}
              stacked={stackedOf(entry)}
            />
          ));
        }
        return (
          <button
            key={row.key}
            type="button"
            onClick={() => setOpen((current) => new Set(current).add(row.key))}
            className="-mx-3 flex min-h-9 w-[calc(100%+1.5rem)] items-center gap-2 px-3 text-left text-[0.8em] text-muted-foreground hover:bg-muted md:mx-0 md:w-full md:px-2"
          >
            <span className="h-px flex-1 bg-border" />
            {plural(row.entries.length, "Absatz", "Absätze")} ohne Änderung
            <span className="h-px flex-1 bg-border" />
          </button>
        );
      })}
    </section>
  );
}

export function ScriptCompare({
  comparison,
  versions,
  initialFilter,
}: {
  comparison: ScriptComparison;
  versions: ScriptVersionOption[];
  initialFilter: Filter;
}) {
  const { before, after, scenes, roles } = comparison;
  const [settings, update] = useSettings(after.showId, comparison.ownRoleIds);
  const [filter, setFilter] = React.useState<Filter>(initialFilter);
  const [showSame, setShowSame] = React.useState(false);
  const [panel, setPanel] = React.useState<"versions" | "roles" | null>(null);
  const roleSet = React.useMemo(() => new Set(settings.roleIds), [settings.roleIds]);
  const followed = React.useMemo(() => new Set(settings.followedCues), [settings.followedCues]);

  const relevant = React.useCallback(
    (entry: CompareBlock) => {
      if (entry.type === "same") return false;
      if (filter === "mine") return entry.roleIds.some((id) => roleSet.has(id));
      if (filter === "cues") {
        return followed.size
          ? entry.cueCategories.some((category) => followed.has(category))
          : entry.cueCategories.length > 0;
      }
      return true;
    },
    [filter, roleSet, followed],
  );

  const counts = React.useMemo(() => {
    const result = { changed: 0, added: 0, removed: 0 };
    for (const scene of scenes) {
      for (const entry of scene.blocks)
        if (entry.type !== "same" && relevant(entry)) result[entry.type] += 1;
    }
    return result;
  }, [scenes, relevant]);
  const visibleScenes = scenes.filter(
    (scene) =>
      showSame ||
      scene.type === "added" ||
      scene.type === "removed" ||
      scene.previousTitle ||
      scene.blocks.some(relevant),
  );
  const speakerChars = React.useMemo(() => {
    const lengths = scenes.flatMap((scene) =>
      scene.blocks.map((entry) => entry.block.speaker?.length ?? 0),
    );
    return Math.min(SPEAKER_MAX_CHARS, Math.max(8, ...lengths));
  }, [scenes]);
  const total = counts.changed + counts.added + counts.removed;
  const selectedNames = roles.filter((role) => roleSet.has(role.id)).map((role) => role.name);

  return (
    <div>
      <div className="fixed inset-x-0 top-0 z-30 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1240px] items-center gap-0.5 px-1 lg:px-4">
          <Button asChild variant="ghost" size="icon" aria-label="Zurück zum Skript">
            <Link href={`/mitglieder/skript/${after.id}`}>
              <ArrowLeftIcon aria-hidden />
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => setPanel("versions")}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-1 px-1 text-left hover:bg-muted"
            aria-label="Vergleichsfassung wählen"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                Änderungen seit {before.label}
              </span>
              <span className="block truncate text-xs text-muted-foreground">in {after.label}</span>
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Rollen wählen"
            className="relative"
            onClick={() => setPanel("roles")}
          >
            <UsersIcon aria-hidden />
            {settings.roleIds.length ? (
              <span className="absolute right-1 top-1 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                {settings.roleIds.length}
              </span>
            ) : null}
          </Button>
        </div>
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-4 gap-y-2 px-3 pb-2 lg:px-4">
          <SegmentedControl<Filter>
            aria-label="Änderungen filtern"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "Alle" },
              { value: "mine", label: "Meine Rollen", disabled: !settings.roleIds.length },
              { value: "cues", label: settings.followedCues.length ? "Meine Gewerke" : "Hinweise" },
            ]}
          />
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={showSame}
              onCheckedChange={setShowSame}
              aria-label="Unverändertes zeigen"
            />
            Unverändertes zeigen
          </label>
        </div>
      </div>

      <div
        className={cn(
          "mx-auto max-w-[1240px] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:px-4",
          FONT_SIZES[settings.fontSize] ?? FONT_SIZES[0],
        )}
        style={{ ["--speaker-col" as string]: `${(speakerChars * 0.62).toFixed(2)}em` }}
      >
        <aside className="sticky top-0 hidden max-h-dvh self-start overflow-y-auto pb-6 pt-28 text-sm lg:block">
          <p className="px-2 pb-1 text-xs text-muted-foreground">Szenen mit Änderungen</p>
          <ul>
            {visibleScenes.map((scene) => {
              const changes = scene.blocks.filter(relevant).length;
              return (
                <li key={scene.key}>
                  <a
                    href={`#szene-${scene.key}`}
                    className="flex min-h-8 items-center gap-2 px-2 py-1 hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 break-words">{scene.title}</span>
                    {changes ? (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {changes}
                      </span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </aside>
        <article className="min-w-0 px-3 pb-24 pt-[calc(6.5rem+env(safe-area-inset-top))] leading-normal sm:px-4 lg:px-0">
          <div className="-mx-3 mb-4 border-l-[3px] border-border bg-muted px-3 py-2 text-sm sm:-mx-4 sm:px-4 md:mx-0 md:px-3">
            <p className="font-medium">
              {total
                ? `${filter === "mine" ? "Für deine Rollen: " : filter === "cues" ? "Hinweise: " : ""}${[
                    counts.changed ? plural(counts.changed, "Änderung", "Änderungen") : null,
                    counts.added ? `${counts.added} neu` : null,
                    counts.removed ? `${counts.removed} gestrichen` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}`
                : filter === "mine"
                  ? "Für deine Rollen hat sich nichts geändert."
                  : "Keine Änderungen."}
            </p>
            {filter === "mine" && selectedNames.length ? (
              <p className="text-xs text-muted-foreground">Rollen: {selectedNames.join(", ")}</p>
            ) : null}
          </div>
          {visibleScenes.map((scene) => (
            <SceneSection
              key={scene.key}
              scene={scene}
              relevant={relevant}
              roleSet={roleSet}
              showSame={showSame}
            />
          ))}
        </article>
      </div>

      <BottomSheet
        open={panel === "versions"}
        onOpenChange={(open) => setPanel(open ? "versions" : null)}
        title="Vergleichen mit"
        description="Ältere Fassung für den Vergleich wählen"
      >
        <ul className="divide-y divide-border/60">
          {versions.map((version) => (
            <li key={version.id}>
              <Link
                href={`/mitglieder/skript/${after.id}/vergleich?mit=${version.id}`}
                className={cn(
                  "flex min-h-11 items-center gap-3 py-2 text-sm hover:bg-muted",
                  version.id === before.id && "font-semibold",
                )}
                onClick={() => setPanel(null)}
              >
                <span className="min-w-0 flex-1 break-words">{version.label}</span>
                {version.status === "draft" ? (
                  <span className="text-xs text-muted-foreground">Entwurf</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <BottomSheet
        open={panel === "roles"}
        onOpenChange={(open) => setPanel(open ? "roles" : null)}
        title="Rollen"
        description="Rollen für „Meine Rollen“ wählen"
      >
        <ul className="divide-y divide-border/60">
          {roles.map((role) => (
            <li key={role.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm">
                <Checkbox
                  checked={roleSet.has(role.id)}
                  onCheckedChange={(checked) =>
                    update({
                      roleIds:
                        checked === true
                          ? [...settings.roleIds, role.id]
                          : settings.roleIds.filter((id) => id !== role.id),
                    })
                  }
                />
                <span className="min-w-0 flex-1 break-words font-medium">{role.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}
