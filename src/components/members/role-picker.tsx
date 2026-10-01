"use client";

import { useMemo, useState } from "react";

import { RoleChips } from "@/components/members/role-chips";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

/**
 * Rollen-Auswahl als Popover. Das Popup wird in ein Portal gerendert, damit es auch in
 * scrollenden Dialogen vollständig sichtbar bleibt (ein absolut positioniertes Panel würde
 * am Rand des Scrollcontainers abgeschnitten).
 */
export function RolePicker({
  value,
  onChange,
  canEditOwner = false,
  className,
}: {
  value: Role[];
  onChange: (next: Role[]) => void;
  canEditOwner?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => new Set(value), [value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ROLES;
    return ROLES.filter((role) => (ROLE_LABELS[role] ?? role).toLowerCase().includes(q));
  }, [query]);

  const toggle = (role: Role) => {
    if (role === "owner" && !canEditOwner) return;
    onChange(selected.has(role) ? value.filter((r) => r !== role) : [...value, role]);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("flex h-auto min-h-11 max-w-full items-center gap-2", className)}
        >
          <span className="shrink-0">Rollen wählen</span>
          <RoleChips roles={value} max={3} className="min-w-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b border-border/60 p-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rollen suchen…"
            aria-label="Rollen suchen"
          />
        </div>
        <ul className="max-h-64 overflow-y-auto p-1">
          {filtered.map((role) => {
            const active = selected.has(role);
            const disabled = role === "owner" && !canEditOwner;
            return (
              <li key={role}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/40",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Checkbox
                    checked={active}
                    onCheckedChange={() => toggle(role)}
                    disabled={disabled}
                    aria-label={`${ROLE_LABELS[role] ?? role} ${active ? "abwählen" : "auswählen"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{ROLE_LABELS[role] ?? role}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ROLE_DESCRIPTIONS[role]}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="px-2 py-4 text-center text-sm text-muted-foreground">Keine Treffer</li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
