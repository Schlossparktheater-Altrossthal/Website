"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS, ROLES, type Role } from "@/lib/roles";

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
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ROLES;
    return ROLES.filter((r) => (ROLE_LABELS[r] ?? r).toLowerCase().includes(q));
  }, [query]);

  const roleIdPrefix = useId();

  const handleRoleCheckedChange = (role: Role, checked: CheckedState) => {
    if (role === "owner" && !canEditOwner) {
      return;
    }

    const shouldAdd = checked === true;
    const isActive = selected.has(role);

    if (shouldAdd === isActive) {
      return;
    }

    const next = shouldAdd ? [...value, role] : value.filter((r) => r !== role);
    onChange(next);
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
          <div className="mt-2 max-h-64 overflow-auto pr-1">
            {filtered.map((role) => {
              const active = selected.has(role);
              const disabled = role === "owner" && !canEditOwner;
              return (
                <Label
                  key={role}
                  htmlFor={`${roleIdPrefix}-${role}`}
                  className={`flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent/40 ${
                    disabled ? "cursor-not-allowed opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`${roleIdPrefix}-${role}`}
                      checked={active}
                      onCheckedChange={(checked) => handleRoleCheckedChange(role, checked)}
                      disabled={disabled}
                    />
                    <span>{ROLE_LABELS[role] ?? role}</span>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${ROLE_BADGE_VARIANTS[role]}`}>
                    {role}
                  </span>
                </Label>
              );
            })}
            {filtered.length === 0 && (
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

