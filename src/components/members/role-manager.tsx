"use client";

import { useEffect, useMemo, useState } from "react";

import { RolePicker } from "@/components/members/role-picker";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { UserAvatar } from "@/components/user-avatar";
import { combineNameParts } from "@/lib/names";
import { sortRoles, type Role } from "@/lib/roles";
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
    () =>
      selected.join("|") !== saved.join("|") ||
      selectedCustomIds.join("|") !== savedCustomIds.join("|"),
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
        data?.user?.name ??
        combinedName ??
        null;

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
      <div className="flex items-start gap-3">
        <UserAvatar
          userId={userId}
          email={profileEmail}
          firstName={profileFirstName}
          lastName={profileLastName}
          name={displayName}
          size={48}
          className="h-12 w-12 shrink-0 text-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{displayName}</p>
          <p className="truncate text-sm text-muted-foreground">
            {profileEmail || "Keine E-Mail hinterlegt"}
          </p>
          <p className="truncate text-xs text-muted-foreground">ID: {userId}</p>
        </div>
        {dirty ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
            Nicht gespeichert
          </span>
        ) : null}
      </div>

      <section className="space-y-3 border-t border-border/60 pt-5">
        <div>
          <h3 className="text-sm font-medium">Profil &amp; Zugang</h3>
          <p className="text-xs text-muted-foreground">
            Kontaktdaten aktualisieren oder ein neues Passwort hinterlegen.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleProfileSave}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span>E-Mail</span>
              <Input
                type="email"
                value={profileEmail}
                onChange={(event) => setProfileEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
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

          <div className="space-y-3">
            <span className="text-sm font-medium">Neues Passwort (optional)</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span>Passwort</span>
                <PasswordInput
                  value={profilePassword}
                  onChange={(event) => setProfilePassword(event.target.value)}
                  placeholder="Leer lassen, um das Passwort zu behalten"
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-sm">
                <span>Passwort bestätigen</span>
                <PasswordInput
                  value={profileConfirmPassword}
                  onChange={(event) => setProfileConfirmPassword(event.target.value)}
                  placeholder="Nur bei Änderung erforderlich"
                  autoComplete="new-password"
                />
              </label>
            </div>
          </div>

          {profileError ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {profileError}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleProfileReset}
              disabled={!profileDirty || profileSaving}
            >
              Verwerfen
            </Button>
            <AsyncButton
              type="submit"
              size="sm"
              isLoading={profileSaving}
              loadingText="Speichern…"
              disabled={!profileDirty}
            >
              Speichern
            </AsyncButton>
          </div>
        </form>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-5">
        <div>
          <h3 className="text-sm font-medium">Rollen</h3>
          <p className="text-xs text-muted-foreground">
            Bestimmt, welche Bereiche diese Person sieht und bearbeiten darf.
          </p>
        </div>
        <RolePicker
          value={selected}
          canEditOwner={canEditOwner}
          customRoles={availableCustomRoles}
          customRoleIds={selectedCustomIds}
          onCustomRolesChange={(ids) => {
            setSelectedCustomIds(ids);
            setError(null);
          }}
          onChange={(next) => {
            const nextSet = new Set<Role>(next);
            if (!canEditOwner) nextSet.delete("owner");
            if (nextSet.size === 0) return;
            const arr = sortRoles(Array.from(nextSet));
            setSelected(arr);
            setError(null);
          }}
        />

        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRolesReset}
            disabled={!rolesDirty || saving}
          >
            Verwerfen
          </Button>
          <AsyncButton
            type="button"
            size="sm"
            onClick={handleRolesSave}
            isLoading={saving}
            loadingText="Speichern…"
            disabled={!rolesDirty || selected.length === 0}
          >
            Speichern
          </AsyncButton>
        </div>
      </section>
    </div>
  );
}
