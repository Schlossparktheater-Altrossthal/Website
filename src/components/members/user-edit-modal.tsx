"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import type { AvatarSource } from "@/components/user-avatar";
import { combineNameParts, splitFullName } from "@/lib/names";

export type EditableUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  avatarSource?: AvatarSource | null;
  avatarUpdatedAt?: string | null;
};

type UserEditModalProps = {
  user: EditableUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (user: EditableUser) => void;
};

export function UserEditModal({ user, open, onOpenChange, onUpdated }: UserEditModalProps) {
  const deriveNames = useCallback((value: EditableUser) => {
    const parts = value.name ? splitFullName(value.name) : { firstName: null, lastName: null };
    return {
      firstName: value.firstName ?? parts.firstName ?? "",
      lastName: value.lastName ?? parts.lastName ?? "",
    };
  }, []);

  const initialNames = deriveNames(user);

  const [email, setEmail] = useState(user.email ?? "");
  const [firstName, setFirstName] = useState(initialNames.firstName);
  const [lastName, setLastName] = useState(initialNames.lastName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyUserState = useCallback(
    (value: EditableUser) => {
      setEmail(value.email ?? "");
      const names = deriveNames(value);
      setFirstName(names.firstName);
      setLastName(names.lastName);
      setPassword("");
      setConfirmPassword("");
      setError(null);
    },
    [deriveNames],
  );

  const resetState = useCallback(() => {
    applyUserState(user);
  }, [applyUserState, user]);

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const closeModal = () => {
    if (saving) return;
    onOpenChange(false);
    resetState();
  };

  const displayName = combineNameParts(firstName, lastName) || user.name || "";
  const headerDisplayName = displayName || user.email || "Unbekannte Person";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("E-Mail darf nicht leer sein");
      return;
    }

    if (password && password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen haben");
      return;
    }

    if (password && password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName) {
      setError("Vorname darf nicht leer sein");
      return;
    }

    const combinedName = combineNameParts(trimmedFirstName, trimmedLastName);

    const payload: Record<string, unknown> = {
      email: trimmedEmail,
      firstName: trimmedFirstName || null,
      lastName: trimmedLastName || null,
      name: combinedName ?? null,
    };

    if (password) {
      payload.password = password;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/members/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? "Aktualisierung fehlgeschlagen");
      }

      const updatedEmail = (data?.user?.email as string | null | undefined) ?? trimmedEmail;
      const updatedFirstName =
        (data?.user?.firstName as string | null | undefined) ?? (trimmedFirstName || null);
      const updatedLastName =
        (data?.user?.lastName as string | null | undefined) ?? (trimmedLastName || null);
      const updatedName =
        combineNameParts(updatedFirstName, updatedLastName) ??
        ((data?.user?.name as string | null | undefined) ?? combinedName ?? null);

      toast.success("Benutzer aktualisiert");
      const updatedUser: EditableUser = {
        id: user.id,
        email: updatedEmail,
        firstName: updatedFirstName,
        lastName: updatedLastName,
        name: updatedName,
        avatarSource: user.avatarSource,
        avatarUpdatedAt: user.avatarUpdatedAt,
      };

      onUpdated(updatedUser);
      onOpenChange(false);
      applyUserState(updatedUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title="Benutzer bearbeiten"
      description="Passe Kontaktinformationen und Zugangsdaten an"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center gap-4">
            <UserAvatar
              userId={user.id}
              email={email}
              firstName={firstName}
              lastName={lastName}
              name={displayName}
              size={64}
              className="h-16 w-16 text-lg"
              avatarSource={user.avatarSource}
              avatarUpdatedAt={user.avatarUpdatedAt}
            />
            <div>
              <div className="text-sm font-medium">{headerDisplayName}</div>
              <div className="text-xs text-muted-foreground">ID: {user.id}</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm">
              <span>E-Mail</span>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm">
                <span>Vorname</span>
                <Input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Vorname"
                  required
                  autoComplete="given-name"
                />
              </label>
              <label className="block text-sm">
                <span>Nachname (optional)</span>
                <Input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Nachname"
                  autoComplete="family-name"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">Neues Passwort (optional)</span>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span>Passwort</span>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Leer lassen, um das Passwort zu behalten"
                autoComplete="new-password"
              />
            </label>
            <label className="block text-sm">
              <span>Passwort bestätigen</span>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Nur bei Änderung erforderlich"
                autoComplete="new-password"
              />
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
