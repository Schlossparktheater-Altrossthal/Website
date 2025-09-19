"use client";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS, sortRoles, type Role } from "@/lib/roles";
import { toast } from "sonner";
import { UserEditModal } from "@/components/members/user-edit-modal";
import { RolePicker } from "@/components/members/role-picker";

export function RoleManager({
  userId,
  email,
  name,
  initialRoles,
  canEditOwner = false,
  availableCustomRoles = [],
  initialCustomRoleIds = [],
  onSaved,
  onUserUpdated,
}: {
  userId: string;
  email?: string | null;
  name?: string | null;
  initialRoles: Role[];
  canEditOwner?: boolean;
  availableCustomRoles?: { id: string; name: string }[];
  initialCustomRoleIds?: string[];
  onSaved?: (payload: { roles: Role[]; customRoleIds: string[] }) => void;
  onUserUpdated?: (payload: { email?: string | null; name?: string | null }) => void;
}) {
  const initialSorted = useMemo(() => sortRoles(initialRoles), [initialRoles]);
  const [selected, setSelected] = useState<Role[]>(initialSorted);
  const [saved, setSaved] = useState<Role[]>(initialSorted);
  const [selectedCustomIds, setSelectedCustomIds] = useState<string[]>([...initialCustomRoleIds]);
  const [savedCustomIds, setSavedCustomIds] = useState<string[]>([...initialCustomRoleIds]);
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
    setSelectedCustomIds([...initialCustomRoleIds]);
    setSavedCustomIds([...initialCustomRoleIds]);
  }, [initialCustomRoleIds]);

  useEffect(() => {
    setCurrentEmail(email ?? "");
  }, [email]);

  useEffect(() => {
    setCurrentName(name ?? "");
  }, [name]);

  const dirty = useMemo(() => selected.join("|") !== saved.join("|") || selectedCustomIds.join("|") !== savedCustomIds.join("|"), [selected, saved, selectedCustomIds, savedCustomIds]);

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
        body: JSON.stringify({ userId, roles: selected, customRoleIds: selectedCustomIds }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? "Speichern fehlgeschlagen");
      }

      const updatedRoles = sortRoles((data?.roles as Role[] | undefined) ?? selected);
      setSelected(updatedRoles);
      setSaved(updatedRoles);
      const updatedCustom: string[] = Array.isArray(data?.customRoles)
        ? data.customRoles.map((r: { id: string }) => r.id)
        : selectedCustomIds;
      setSelectedCustomIds(updatedCustom);
      setSavedCustomIds(updatedCustom);
      onSaved?.({ roles: updatedRoles, customRoleIds: updatedCustom });
      toast.success("Rollen aktualisiert");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelected(saved);
    setSelectedCustomIds(savedCustomIds);
    setError(null);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{currentName || currentEmail || "Unbekannte Person"}</h3>
          <p className="text-sm text-muted-foreground">{currentEmail || "Keine E-Mail hinterlegt"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {saved.map((role) => (
              <span
                key={role}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_VARIANTS[role]}`}
              >
                {ROLE_LABELS[role] ?? role}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {dirty && <span className="text-xs font-medium text-amber-600">Änderungen nicht gespeichert</span>}
          <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Profil bearbeiten
          </Button>
        </div>
      </div>

      <RolePicker
        value={selected}
        canEditOwner={canEditOwner}
        onChange={(next) => {
          // prevent empty selection and enforce owner guard
          const nextSet = new Set<Role>(next);
          if (!canEditOwner) nextSet.delete("owner");
          if (nextSet.size === 0) return; // keep at least one role
          const arr = sortRoles(Array.from(nextSet));
          setSelected(arr);
          setError(null);
        }}
      />

      {availableCustomRoles.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Zusätzliche Rollen</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {availableCustomRoles.map((r) => {
              const active = selectedCustomIds.includes(r.id);
              return (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                    active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none"
                    checked={active}
                    onChange={() =>
                      setSelectedCustomIds((prev) =>
                        prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id],
                      )
                    }
                  />
                  <span>{r.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={!dirty || saving}>
          Zurücksetzen
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={!dirty || saving || selected.length === 0}>
          {saving ? "Speichern…" : "Speichern"}
        </Button>
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
          onUserUpdated?.({ email: updated.email, name: updated.name });
        }}
      />
    </Card>
  );
}
