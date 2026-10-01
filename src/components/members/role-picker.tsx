"use client";

import { useMemo, useState } from "react";

import { RoleChips } from "@/components/members/role-chips";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

type CustomRole = { id: string; name: string };

/**
 * Rollen-Auswahl als Popover: Systemrollen und die eigenen Rollen (z. B. „Regie“) in einer Liste.
 *
 * Zwei Eigenheiten, die den Baustein erklären:
 * - Der Inhalt liegt in einem Portal, damit er in einem scrollenden Dialog nicht am Rand des
 *   Scrollcontainers abgeschnitten wird (eigene `absolute`-Panels haben genau dieses Problem).
 * - `modal` am Root ist Pflicht, nicht Geschmack: Ein modaler Dialog (`react-remove-scroll`)
 *   verwirft Rad-Ereignisse über portalierten Inhalten, solange diese keinen eigenen
 *   Scroll-Lock mitbringen. Ohne `modal` lässt sich die Liste nicht scrollen.
 */
export function RolePicker({
  value,
  onChange,
  customRoles = [],
  customRoleIds = [],
  onCustomRolesChange,
  canEditOwner = false,
  className,
}: {
  value: Role[];
  onChange: (next: Role[]) => void;
  /** Eigene Rollen, die vergeben werden können. */
  customRoles?: CustomRole[];
  customRoleIds?: string[];
  onCustomRolesChange?: (ids: string[]) => void;
  canEditOwner?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => new Set(value), [value]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRoles = useMemo(
    () =>
      normalizedQuery
        ? ROLES.filter((role) =>
            (ROLE_LABELS[role] ?? role).toLowerCase().includes(normalizedQuery),
          )
        : ROLES,
    [normalizedQuery],
  );
  const filteredCustomRoles = useMemo(
    () =>
      normalizedQuery
        ? customRoles.filter((role) => role.name.toLowerCase().includes(normalizedQuery))
        : customRoles,
    [customRoles, normalizedQuery],
  );

  const toggleRole = (role: Role) => {
    if (role === "owner" && !canEditOwner) return;
    onChange(selected.has(role) ? value.filter((r) => r !== role) : [...value, role]);
  };

  const toggleCustomRole = (id: string) => {
    if (!onCustomRolesChange) return;
    onCustomRolesChange(
      customRoleIds.includes(id)
        ? customRoleIds.filter((entry) => entry !== id)
        : [...customRoleIds, id],
    );
  };

  const selectedCustomRoles = customRoles.filter((role) => customRoleIds.includes(role.id));
  const nothingFound = filteredRoles.length === 0 && filteredCustomRoles.length === 0;

  return (
    <Popover
      modal
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
          <RoleChips roles={value} customRoles={selectedCustomRoles} max={3} className="min-w-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="flex max-h-[min(70dvh,40rem)] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0"
      >
        <div className="shrink-0 border-b border-border/60 p-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rollen suchen…"
            aria-label="Rollen suchen"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
          {filteredRoles.length > 0 ? (
            <ul aria-label="Systemrollen">
              {filteredRoles.map((role) => {
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
                        onCheckedChange={() => toggleRole(role)}
                        disabled={disabled}
                        aria-label={`${ROLE_LABELS[role] ?? role} ${active ? "abwählen" : "auswählen"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {ROLE_LABELS[role] ?? role}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {ROLE_DESCRIPTIONS[role]}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {filteredCustomRoles.length > 0 ? (
            <>
              <div className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                Eigene Rollen
              </div>
              <ul aria-label="Eigene Rollen">
                {filteredCustomRoles.map((role) => {
                  const active = customRoleIds.includes(role.id);
                  return (
                    <li key={role.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/40">
                        <Checkbox
                          checked={active}
                          onCheckedChange={() => toggleCustomRole(role.id)}
                          aria-label={`${role.name} ${active ? "abwählen" : "auswählen"}`}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {role.name}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {nothingFound ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">Keine Treffer</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
