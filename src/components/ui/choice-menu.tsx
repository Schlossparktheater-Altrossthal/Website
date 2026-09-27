"use client";

import * as React from "react";

import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

export type ChoiceItem = { id: string; label: string; hint?: string };

export type ChoiceEntry = {
  id: string;
  label: string;
  /** Zweite Zeile im mobilen Blatt bzw. rechts im Menü. */
  hint?: string;
  /** Mit Einträgen öffnet sich eine zweite Ebene; ohne löst der Eintrag direkt aus. */
  items?: ChoiceItem[];
  onSelect: (itemId?: string) => void;
  /** Mobil nach der Auswahl offen bleiben (mehrere nacheinander wählen). */
  keepOpen?: boolean;
  /** Trennlinie vor diesem Eintrag (nur Desktop-Menü). */
  separatorBefore?: boolean;
};

/** Ab so vielen Einträgen zeigt die zweite Ebene eine Suche. */
const SEARCH_FROM = 8;

/**
 * Auswahlmenü mit optionaler zweiter Ebene: am Desktop ein Dropdown mit Untermenüs,
 * mobil ein Blatt von unten mit großen Zeilen, „Zurück“ und Suche bei langen Listen.
 */
export function ChoiceMenu({
  trigger,
  title,
  entries,
  align = "end",
}: {
  /** Ein Button-Element; wird als Auslöser verwendet. */
  trigger: React.ReactElement;
  title: string;
  entries: ChoiceEntry[];
  align?: "start" | "end";
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [open, setOpen] = React.useState(false);
  const [groupId, setGroupId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const visibleEntries = entries.filter((entry) => !entry.items || entry.items.length);

  if (isDesktop) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-64">
          {visibleEntries.map((entry) => (
            <React.Fragment key={entry.id}>
              {entry.separatorBefore ? <DropdownMenuSeparator /> : null}
              {entry.items ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>{entry.label}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-80 w-72 overflow-y-auto">
                    {entry.items.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onSelect={() => entry.onSelect(item.id)}
                        className="flex-col items-start gap-0"
                      >
                        <span>{item.label}</span>
                        {item.hint ? (
                          <span className="text-xs text-muted-foreground">{item.hint}</span>
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem onSelect={() => entry.onSelect()}>
                  {entry.label}
                  {entry.hint ? (
                    <span className="ml-auto pl-2 text-xs text-muted-foreground">{entry.hint}</span>
                  ) : null}
                </DropdownMenuItem>
              )}
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const group = visibleEntries.find((entry) => entry.id === groupId && entry.items);
  const normalized = query.trim().toLocaleLowerCase("de");
  const items = (group?.items ?? []).filter(
    (item) => !normalized || item.label.toLocaleLowerCase("de").includes(normalized),
  );
  const close = () => {
    setOpen(false);
    setGroupId(null);
    setQuery("");
  };
  const rowClass =
    "flex min-h-12 w-full items-center gap-3 px-1 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  return (
    <>
      {React.cloneElement(trigger as React.ReactElement<{ onClick?: () => void }>, {
        onClick: () => setOpen(true),
      })}
      <BottomSheet
        open={open}
        onOpenChange={(value) => (value ? setOpen(true) : close())}
        title={group ? group.label : title}
        footer={
          group?.keepOpen ? (
            <Button type="button" className="h-11 w-full" onClick={close}>
              Fertig
            </Button>
          ) : undefined
        }
        description={group ? `${title}: ${group.label}` : title}
        headerAction={
          group ? (
            <button
              type="button"
              onClick={() => {
                setGroupId(null);
                setQuery("");
              }}
              className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeftIcon className="h-4 w-4" aria-hidden /> Zurück
            </button>
          ) : null
        }
      >
        {group ? (
          <div className="space-y-2">
            {(group.items?.length ?? 0) >= SEARCH_FROM ? (
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Suchen"
                  aria-label={`${group.label} suchen`}
                  className="h-11 pl-9"
                />
              </div>
            ) : null}
            {items.length ? (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={rowClass}
                      onClick={() => {
                        group.onSelect(item.id);
                        if (!group.keepOpen) close();
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.label}</span>
                        {item.hint ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.hint}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Nichts gefunden.
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visibleEntries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={rowClass}
                  onClick={() => {
                    if (entry.items) {
                      setGroupId(entry.id);
                    } else {
                      entry.onSelect();
                      close();
                    }
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{entry.label}</span>
                    {entry.hint ? (
                      <span className="block text-xs text-muted-foreground">{entry.hint}</span>
                    ) : null}
                  </span>
                  {entry.items ? (
                    <ChevronRightIcon
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground")}
                      aria-hidden
                    />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </>
  );
}
