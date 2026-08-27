"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AsyncButton } from "@/components/ui/async-button";
import { Checkbox } from "@/components/ui/checkbox";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { toast } from "sonner";

const CONFIGURABLE_ROLES: Role[] = ["admin", "board", "finance", "tech", "cast", "member"];

export function SeasonResetSettingsPanel({
  initialProtectedRoles,
}: {
  initialProtectedRoles: Role[];
}) {
  const [selected, setSelected] = useState<Set<Role>>(() => new Set(initialProtectedRoles));
  const [saving, setSaving] = useState(false);

  const toggle = (role: Role) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const protectedRoles = CONFIGURABLE_ROLES.filter((role) => selected.has(role));
      const response = await fetch("/api/season-reset/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protectedRoles }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        protectedRoles?: Role[];
      };

      if (!response.ok) {
        throw new Error(data?.error ?? "Speichern fehlgeschlagen");
      }

      setSelected(new Set(data?.protectedRoles ?? []));
      toast.success("Geschützte Rollen gespeichert");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geschützte Rollen beim Jahreswechsel</CardTitle>
        <p className="text-sm text-muted-foreground">
          Diese Rollen werden beim Wechsel der aktiven Produktion nicht deaktiviert. Owner ist immer
          geschützt.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked disabled aria-readonly />
            <span>{ROLE_LABELS.owner} — immer geschützt</span>
          </label>
          {CONFIGURABLE_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <Checkbox checked={selected.has(role)} onCheckedChange={() => toggle(role)} />
              <span>{ROLE_LABELS[role]}</span>
            </label>
          ))}
        </div>
        <AsyncButton onClick={handleSave} isLoading={saving} loadingText="Speichere …">
          Speichern
        </AsyncButton>
      </CardContent>
    </Card>
  );
}
