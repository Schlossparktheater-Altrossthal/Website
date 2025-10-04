"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RolePicker } from "@/components/members/role-picker";
import { UserAvatar } from "@/components/user-avatar";
import { combineNameParts } from "@/lib/names";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS, sortRoles, type Role } from "@/lib/roles";
import { toast } from "sonner";

export function RoleManager({
  userId,
  email,
  firstName,
  lastName,
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
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  initialRoles: Role[];
  canEditOwner?: boolean;
  availableCustomRoles?: { id: string; name: string }[];
  initialCustomRoleIds?: string[];
  onSaved?: (payload: { roles: Role[]; customRoleIds: string[] }) => void;
  onUserUpdated?: (payload: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
  }) => void;
}) {
  const initialSorted = useMemo(() => sortRoles(initialRoles), [initialRoles]);
  const [selected, setSelected] = useState<Role[]>(initialSorted);
  const [saved, setSaved] = useState<Role[]>(initialSorted);
  const [selectedCustomIds, setSelectedCustomIds] = useState<string[]>([...initialCustomRoleIds]);
  const [savedCustomIds, setSavedCustomIds] = useState<string[]>([...initialCustomRoleIds]);

  const [currentEmail, setCurrentEmail] = useState(email ?? "");
  const [currentFirstName, setCurrentFirstName] = useState(firstName ?? "");
  const [currentLastName, setCurrentLastName] = useState(lastName ?? "");
  const [currentNameFallback, setCurrentNameFallback] = useState(name ?? "");

  const [profileEmail, setProfileEmail] = useState(email ?? "");
  const [profileFirstName, setProfileFirstName] = useState(firstName ?? "");
  const [profileLastName, setProfileLastName] = useState(lastName ?? "");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileConfirmPassword, setProfileConfirmPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const nextEmail = email ?? "";
    setCurrentEmail(nextEmail);
    setProfileEmail(nextEmail);
  }, [email]);

  useEffect(() => {
    const nextFirstName = firstName ?? "";
    setCurrentFirstName(nextFirstName);
    setProfileFirstName(nextFirstName);
  }, [firstName]);

  useEffect(() => {
    const nextLastName = lastName ?? "";
    setCurrentLastName(nextLastName);
    setProfileLastName(nextLastName);
  }, [lastName]);

  useEffect(() => {
    const nextName = name ?? "";
    setCurrentNameFallback(nextName);
  }, [name]);

  const displayName =
    combineNameParts(profileFirstName, profileLastName) ||
    profileEmail ||
    currentNameFallback ||
    "Unbekannte Person";

  const rolesDirty = useMemo(
    () => selected.join("|") !== saved.join("|") || selectedCustomIds.join("|") !== savedCustomIds.join("|"),
    [selected, saved, selectedCustomIds, savedCustomIds],
  );

  const profileDirty = useMemo(() => {
    const normalizedEmail = profileEmail.trim().toLowerCase();
    const normalizedSavedEmail = currentEmail.trim().toLowerCase();
    const trimmedFirstName = profileFirstName.trim();
    const trimmedSavedFirstName = currentFirstName.trim();
    const trimmedLastName = profileLastName.trim();
    const trimmedSavedLastName = currentLastName.trim();
    const passwordChanged = Boolean(profilePassword) || Boolean(profileConfirmPassword);

    return (
      normalizedEmail !== normalizedSavedEmail ||
      trimmedFirstName !== trimmedSavedFirstName ||
      trimmedLastName !== trimmedSavedLastName ||
      passwordChanged
    );
  }, [
    profileEmail,
    currentEmail,
    profileFirstName,
    currentFirstName,
    profileLastName,
    currentLastName,
    profilePassword,
    profileConfirmPassword,
  ]);

  const dirty = rolesDirty || profileDirty;

  const handleRolesSave = async () => {
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

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        roles?: Role[];
        customRoles?: { id: string }[];
      };

      if (!response.ok) {
        throw new Error(data?.error ?? "Speichern fehlgeschlagen");
      }

      const updatedRoles = sortRoles((data?.roles as Role[] | undefined) ?? selected);
      setSelected(updatedRoles);
      setSaved(updatedRoles);
      const updatedCustom: string[] = Array.isArray(data?.customRoles)
        ? data.customRoles.map((r) => r.id)
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

  const handleRolesReset = () => {
    setSelected(saved);
    setSelectedCustomIds(savedCustomIds);
    setError(null);
  };

  const handleProfileReset = () => {
    setProfileEmail(currentEmail);
    setProfileFirstName(currentFirstName);
    setProfileLastName(currentLastName);
    setProfilePassword("");
    setProfileConfirmPassword("");
    setProfileError(null);
  };

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError(null);

    const trimmedEmail = profileEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setProfileError("E-Mail darf nicht leer sein.");
      return;
    }

    const trimmedFirstName = profileFirstName.trim();
    const trimmedLastName = profileLastName.trim();

    if (!trimmedFirstName) {
      setProfileError("Vorname darf nicht leer sein.");
      return;
    }

    if (profilePassword && profilePassword.length < 6) {
      setProfileError("Passwort muss mindestens 6 Zeichen haben.");
      return;
    }

    if (profilePassword && profilePassword !== profileConfirmPassword) {
      setProfileError("Passwörter stimmen nicht überein.");
      return;
    }

    const combinedName = combineNameParts(trimmedFirstName, trimmedLastName);
    const payload: Record<string, unknown> = {
      email: trimmedEmail,
      firstName: trimmedFirstName || null,
      lastName: trimmedLastName || null,
      name: combinedName ?? null,
    };

    if (profilePassword) {
      payload.password = profilePassword;
    }

    setProfileSaving(true);
    try {
      const response = await fetch(`/api/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        user?: {
          email?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          name?: string | null;
        };
      };

      if (!response.ok) {
        throw new Error(data?.error ?? "Aktualisierung fehlgeschlagen");
      }

      const updatedEmail = data?.user?.email ?? trimmedEmail;
      const updatedFirstName = data?.user?.firstName ?? (trimmedFirstName || null);
      const updatedLastName = data?.user?.lastName ?? (trimmedLastName || null);
      const updatedName =
        combineNameParts(updatedFirstName, updatedLastName) ??
        (data?.user?.name ?? combinedName ?? null);

      const normalizedEmail = updatedEmail ?? "";
      setCurrentEmail(normalizedEmail);
      setCurrentFirstName(updatedFirstName ?? "");
      setCurrentLastName(updatedLastName ?? "");
      setCurrentNameFallback(updatedName ?? "");

      setProfileEmail(normalizedEmail);
      setProfileFirstName(updatedFirstName ?? "");
      setProfileLastName(updatedLastName ?? "");
      setProfilePassword("");
      setProfileConfirmPassword("");

      onUserUpdated?.({
        email: updatedEmail,
        firstName: updatedFirstName,
        lastName: updatedLastName,
        name: updatedName,
      });

      toast.success("Benutzer aktualisiert");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen";
      setProfileError(message);
      toast.error(message);
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <UserAvatar
                email={profileEmail}
                firstName={profileFirstName}
                lastName={profileLastName}
                name={displayName}
                size={48}
                className="h-12 w-12 text-lg"
              />

              <div className="min-w-0 flex-1">
                <CardTitle className="mb-1 text-xl">{displayName}</CardTitle>
                <p className="mb-3 text-sm text-muted-foreground">
                  {profileEmail || "Keine E-Mail hinterlegt"}
                </p>

                <div className="flex flex-wrap gap-2">
                  {selected.map((role) => (
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

            <div className="ml-4 flex flex-col items-end gap-2">
              {dirty && (
                <div className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  Nicht gespeichert
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profil &amp; Zugang</CardTitle>
          <p className="text-sm text-muted-foreground">
            Aktualisiere Kontaktdaten oder hinterlege ein neues Passwort.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleProfileSave}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto,1fr]">
              <div className="flex items-center gap-4">
                <UserAvatar
                  userId={userId}
                  email={profileEmail}
                  firstName={profileFirstName}
                  lastName={profileLastName}
                  name={displayName}
                  size={64}
                  className="h-16 w-16 text-lg"
                />
                <div>
                  <div className="text-sm font-medium">{displayName}</div>
                  <div className="text-xs text-muted-foreground">ID: {userId}</div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm">
                  <span>E-Mail</span>
                  <Input
                    type="email"
                    value={profileEmail}
                    onChange={(event) => setProfileEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span>Vorname</span>
                    <Input
                      value={profileFirstName}
                      onChange={(event) => setProfileFirstName(event.target.value)}
                      placeholder="Vorname"
                      required
                      autoComplete="given-name"
                    />
                  </label>
                  <label className="block text-sm">
                    <span>Nachname (optional)</span>
                    <Input
                      value={profileLastName}
                      onChange={(event) => setProfileLastName(event.target.value)}
                      placeholder="Nachname"
                      autoComplete="family-name"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium">Neues Passwort (optional)</span>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm">
                  <span>Passwort</span>
                  <Input
                    type="password"
                    value={profilePassword}
                    onChange={(event) => setProfilePassword(event.target.value)}
                    placeholder="Leer lassen, um das Passwort zu behalten"
                    autoComplete="new-password"
                  />
                </label>
                <label className="block text-sm">
                  <span>Passwort bestätigen</span>
                  <Input
                    type="password"
                    value={profileConfirmPassword}
                    onChange={(event) => setProfileConfirmPassword(event.target.value)}
                    placeholder="Nur bei Änderung erforderlich"
                    autoComplete="new-password"
                  />
                </label>
              </div>
            </div>

            {profileError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {profileError}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleProfileReset}
                disabled={!profileDirty || profileSaving}
              >
                Zurücksetzen
              </Button>
              <Button type="submit" size="sm" disabled={!profileDirty || profileSaving} className="min-w-24">
                {profileSaving ? "Speichern…" : "Speichern"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
              const nextSet = new Set<Role>(next);
              if (!canEditOwner) nextSet.delete("owner");
              if (nextSet.size === 0) return;
              const arr = sortRoles(Array.from(nextSet));
              setSelected(arr);
              setError(null);
            }}
          />

          {availableCustomRoles.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-foreground">Zusätzliche Rollen</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {availableCustomRoles.map((role) => {
                  const active = selectedCustomIds.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-all ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        checked={active}
                        onChange={() =>
                          setSelectedCustomIds((prev) =>
                            prev.includes(role.id)
                              ? prev.filter((id) => id !== role.id)
                              : [...prev, role.id],
                          )
                        }
                      />
                      <span className="font-medium">{role.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRolesReset}
              disabled={!rolesDirty || saving}
            >
              Zurücksetzen
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRolesSave}
              disabled={!rolesDirty || saving || selected.length === 0}
              className="min-w-24"
            >
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
