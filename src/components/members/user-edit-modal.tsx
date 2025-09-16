"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export type EditableUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

type UserEditModalProps = {
  user: EditableUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (user: EditableUser) => void;
};

export function UserEditModal({ user, open, onOpenChange, onUpdated }: UserEditModalProps) {
  const [email, setEmail] = useState(user.email ?? "");
  const [name, setName] = useState(user.name ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setEmail(user.email ?? "");
    setName(user.name ?? "");
    setPassword("");
    setConfirmPassword("");
    setError(null);
  };

  const closeModal = () => {
    if (saving) return;
    onOpenChange(false);
    resetState();
  };

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

    const payload: Record<string, unknown> = {
      email: trimmedEmail,
      name: name.trim() || null,
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

      toast.success("Benutzer aktualisiert");
      onUpdated({
        id: user.id,
        email: data?.user?.email ?? trimmedEmail,
        name: data?.user?.name ?? (name.trim() || null),
      });
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      const message = err?.message ?? "Aktualisierung fehlgeschlagen";
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
          <label className="block text-sm">
            <span>Name (optional)</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Vorname Nachname"
            />
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">Neues Passwort (optional)</span>
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
