"use client";

import * as React from "react";

import { searchTagsAction } from "@/app/(members)/mitglieder/lager/actions/assets";
import { PlusIcon, XIcon } from "@/components/ui/action-icons";
import { cn } from "@/lib/utils";

const MAX_TAGS = 20;

/**
 * Schlagworte als Chips: Tippen schlägt vorhandene Tags vor (häufige zuerst), Enter oder Komma
 * übernimmt – unbekannte werden beim Speichern angelegt.
 */
export function TagInput({
  value,
  onChange,
  id = "product-tags",
}: {
  value: string[];
  onChange: (value: string[]) => void;
  id?: string;
}) {
  const [text, setText] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<{ name: string; count: number }[]>([]);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = `${id}-vorschlaege`;

  React.useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchTagsAction(text).then((result) => {
        if (!cancelled && result.ok) setSuggestions(result.data);
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [focused, text]);

  const chosen = new Set(value.map((tag) => tag.toLowerCase()));
  const options = suggestions.filter((tag) => !chosen.has(tag.name.toLowerCase())).slice(0, 8);
  const trimmed = text.trim().replace(/\s+/g, " ");
  const isNew =
    trimmed &&
    !chosen.has(trimmed.toLowerCase()) &&
    !options.some((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());

  const add = (name: string) => {
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!clean || chosen.has(clean.toLowerCase()) || value.length >= MAX_TAGS) {
      setText("");
      return;
    }
    onChange([...value, clean]);
    setText("");
    setActive(0);
  };

  const remove = (name: string) => onChange(value.filter((tag) => tag !== name));
  const open = focused && (options.length > 0 || Boolean(isNew));

  return (
    <div className="relative">
      <div
        className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 shadow-xs focus-within:ring-2 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-7 items-center gap-1 rounded-full bg-primary/15 pr-1 pl-2.5 text-xs font-medium text-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                remove(tag);
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label={`Tag ${tag} entfernen`}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          value={text}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          enterKeyHint="enter"
          placeholder={value.length ? "" : "z. B. Barock, rot, DMX"}
          className="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            const next = event.target.value;
            if (/[,;]$/.test(next)) add(next.slice(0, -1));
            else setText(next);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Klick auf einen Vorschlag zuerst verarbeiten lassen.
            window.setTimeout(() => setFocused(false), 150);
            if (trimmed) add(trimmed);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              const pick = options[active - (isNew ? 1 : 0)];
              add(active === 0 && isNew ? trimmed : (pick?.name ?? trimmed));
            } else if (event.key === "Backspace" && !text && value.length) {
              remove(value[value.length - 1]!);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, options.length - (isNew ? 0 : 1)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Escape") {
              setFocused(false);
            }
          }}
        />
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {isNew ? (
            <li
              role="option"
              aria-selected={active === 0}
              onMouseDown={(event) => {
                event.preventDefault();
                add(trimmed);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm",
                active === 0 && "bg-muted",
              )}
            >
              <PlusIcon className="h-4 w-4 text-muted-foreground" />„{trimmed}“ neu
            </li>
          ) : null}
          {options.map((tag, index) => {
            const position = index + (isNew ? 1 : 0);
            return (
              <li
                key={tag.name}
                role="option"
                aria-selected={active === position}
                onMouseDown={(event) => {
                  event.preventDefault();
                  add(tag.name);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-2 text-sm",
                  active === position && "bg-muted",
                )}
              >
                {tag.name}
                <span className="text-xs text-muted-foreground">{tag.count}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Tags als ruhige Chips für Anzeigen. */
export function TagChips({ tags, className }: { tags: readonly string[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
