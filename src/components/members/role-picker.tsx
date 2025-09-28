"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PRIMARY_ROLE,
  PRIMARY_ROLES,
  SUPPLEMENTAL_ROLES,
  hasPrimaryRole,
  isPrimaryRole,
  ROLE_BADGE_VARIANTS,
  ROLE_LABELS,
  sortRoles,
  type Role,
} from "@/lib/roles";

export function RolePicker({
  value,
  onChange,
  canEditOwner = false,
  className = "",
}: {
  value: Role[];
  onChange: (next: Role[]) => void;
  canEditOwner?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selected = useMemo(() => new Set(value), [value]);
  const filterRoles = useCallback(
    (roles: readonly Role[]) => {
      const q = query.trim().toLowerCase();
      if (!q) return roles;
      return roles.filter((role) => (ROLE_LABELS[role] ?? role).toLowerCase().includes(q));
    },
    [query],
  );

  const filteredPrimary = useMemo(() => filterRoles(PRIMARY_ROLES), [filterRoles]);
  const filteredSupplemental = useMemo(
    () => filterRoles(SUPPLEMENTAL_ROLES),
    [filterRoles],
  );

  const toggle = (role: Role) => {
    if (role === "owner" && !canEditOwner) return;
    const isActive = selected.has(role);
    let next = isActive ? value.filter((r) => r !== role) : [...value, role];
    if (!hasPrimaryRole(next)) {
      if (isPrimaryRole(role) && isActive) {
        // Prevent removing the last primary role
        return;
      }
      next = [...next, DEFAULT_PRIMARY_ROLE];
    }
    onChange(sortRoles(next));
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Rollen wählen</span>
        <span className="flex flex-wrap gap-1 max-w-[18rem]">
          {value.slice(0, 3).map((role) => (
            <span
              key={role}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${ROLE_BADGE_VARIANTS[role]}`}
            >
              {ROLE_LABELS[role] ?? role}
            </span>
          ))}
          {value.length > 3 && (
            <span className="text-xs text-muted-foreground">+{value.length - 3}</span>
          )}
        </span>
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="absolute z-50 mt-2 w-80 rounded-md border border-border bg-popover p-2 shadow-lg"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rollen suchen…"
          />
          <div className="mt-2 max-h-64 overflow-auto pr-1 space-y-3">
            {filteredPrimary.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Kernrollen
                </div>
                {filteredPrimary.map((role) => {
                  const active = selected.has(role);
                  const disabled = role === "owner" && !canEditOwner;
                  return (
                    <label
                      key={role}
                      className={`flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent/40 ${
                        disabled ? "cursor-not-allowed opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={active}
                          onChange={() => toggle(role)}
                          disabled={disabled}
                        />
                        <span>{ROLE_LABELS[role] ?? role}</span>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${ROLE_BADGE_VARIANTS[role]}`}
                      >
                        {role}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {filteredSupplemental.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Zusätzliche Rollen
                </div>
                {filteredSupplemental.map((role) => {
                  const active = selected.has(role);
                  return (
                    <label
                      key={role}
                      className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent/40"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={active}
                          onChange={() => toggle(role)}
                        />
                        <span>{ROLE_LABELS[role] ?? role}</span>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${ROLE_BADGE_VARIANTS[role]}`}
                      >
                        {role}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {filteredPrimary.length === 0 && filteredSupplemental.length === 0 && (
              <div className="px-2 py-4 text-sm text-muted-foreground">Keine Treffer</div>
            )}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Schließen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

