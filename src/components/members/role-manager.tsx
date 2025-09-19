"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditIcon } from "@/components/ui/icons";
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

  // Helper function to generate initials
  const getInitials = (name?: string | null, email?: string | null) => {
    const source = (name && name.trim()) || (email && email.split("@")[0]) || "?";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-lg font-bold text-slate-700 shadow-sm">
                {getInitials(currentName, currentEmail)}
              </div>
              
              {/* User Info */}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl mb-1">
                  {currentName || "Unbekannte Person"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mb-3">
                  {currentEmail || "Keine E-Mail hinterlegt"}
                </p>
                
                {/* Current Roles Display */}
                <div className="flex flex-wrap gap-2">
                  {saved.map((role) => (
                    <span
                      key={role}
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${ROLE_BADGE_VARIANTS[role]}`}
                    >
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col items-end gap-2 ml-4">
              {dirty && (
                <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                  Nicht gespeichert
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
                <EditIcon className="w-4 h-4" />
                Profil bearbeiten
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Roles Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rollen verwalten</CardTitle>
          <p className="text-sm text-muted-foreground">Wählen Sie die Rollen für diesen Benutzer aus</p>
        </CardHeader>
        <CardContent className="space-y-6">
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
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground">Zusätzliche Rollen</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {availableCustomRoles.map((r) => {
                  const active = selectedCustomIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-all ${
                        active 
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20" 
                          : "border-border hover:bg-accent/50 hover:border-accent-foreground/20"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                        checked={active}
                        onChange={() =>
                          setSelectedCustomIds((prev) =>
                            prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id],
                          )
                        }
                      />
                      <span className="font-medium">{r.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={!dirty || saving}>
              Zurücksetzen
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={!dirty || saving || selected.length === 0} className="min-w-24">
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
