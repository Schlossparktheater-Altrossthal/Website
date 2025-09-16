"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  describeRoles,
  ROLE_BADGE_VARIANTS,
  ROLE_LABELS,
  ROLES,
  sortRoles,
  type Role,
} from "@/lib/roles";
import { toast } from "sonner";
import { UserEditModal } from "@/components/members/user-edit-modal";

export function RoleManager({
  userId,
  email,
  name,
  initialRoles,
}: {
  userId: string;
  email?: string | null;
  name?: string | null;
  initialRoles: Role[];
}) {
  const initialSorted = useMemo(() => sortRoles(initialRoles), [initialRoles]);
  const [selected, setSelected] = useState<Role[]>(initialSorted);
  const [saved, setSaved] = useState<Role[]>(initialSorted);
  const [currentEmail, setCurrentEmail] = useState(email ?? "");
  const [currentName, setCurrentName] = useState(name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const sorted = sortRoles(initialRoles);
    setSelected(sorted);
    setSaved(sorted);
  }, [initialRoles]);

  useEffect(() => {
    setCurrentEmail(email ?? "");
  }, [email]);

  useEffect(() => {
    setCurrentName(name ?? "");
  }, [name]);

  const dirty = useMemo(() => selected.join("|") !== saved.join("|"), [selected, saved]);

  const toggleRole = (role: Role) => {
    setError(null);
    setSelected((prev) => {
      const isActive = prev.includes(role);
      const next = isActive ? prev.filter((r) => r !== role) : [...prev, role];
      if (next.length === 0) return prev;
      return sortRoles(next);
    });
  };

  const primaryRole = selected[0];

  const handleSave = async () => {
    if (selected.length === 0) {
      setError("Mindestens eine Rolle muss ausgewählt sein.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/members/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, roles: selected }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? "Speichern fehlgeschlagen");
      }

      const updatedRoles = sortRoles((data?.roles as Role[] | undefined) ?? selected);
      setSelected(updatedRoles);
      setSaved(updatedRoles);
      toast.success("Rollen aktualisiert");
    } catch (err: any) {
      const message = err?.message ?? "Unbekannter Fehler";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelected(saved);
    setError(null);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{currentName || currentEmail || "Unbekannte Person"}</h3>
          <p className="text-sm text-muted-foreground">
            {currentEmail || "Keine E-Mail hinterlegt"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {saved.map((role) => (
              <span
                key={role}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                  ROLE_BADGE_VARIANTS[role]
                }`}
              >
                {ROLE_LABELS[role] ?? role}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {dirty && (
            <span className="text-xs font-medium text-amber-600">Änderungen nicht gespeichert</span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Bearbeiten
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((role) => {
          const active = selected.includes(role);
          return (
            <label
              key={role}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent/30"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none"
                checked={active}
                onChange={() => toggleRole(role)}
              />
              <span>{ROLE_LABELS[role] ?? role}</span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-xs text-muted-foreground">
          Primäre Rolle: {primaryRole ? ROLE_LABELS[primaryRole] ?? primaryRole : "–"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!dirty || saving}
          >
            Zurücksetzen
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving || selected.length === 0}
          >
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <UserEditModal
        user={{ id: userId, email: currentEmail, name: currentName }}
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) setEditOpen(false);
          else setEditOpen(true);
        }}
        onUpdated={(updated) => {
          setCurrentEmail(updated.email ?? "");
          setCurrentName(updated.name ?? "");
        }}
      />
    </Card>
  );
}
