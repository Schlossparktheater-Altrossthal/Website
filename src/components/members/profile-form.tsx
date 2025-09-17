"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProfileFormProps {
  initialName?: string | null;
  initialEmail?: string | null;
}

export function ProfileForm({ initialName, initialEmail }: ProfileFormProps) {
  const { update } = useSession();
  const [baseline, setBaseline] = useState({
    name: initialName ?? "",
    email: initialEmail ?? "",
  });
  const [name, setName] = useState(baseline.name);
  const [email, setEmail] = useState(baseline.email);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setName(baseline.name);
    setEmail(baseline.email);
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

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
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? "Aktualisierung fehlgeschlagen");
      }

      const updatedName = (data?.user?.name as string | null | undefined) ?? null;
      const updatedEmail = (data?.user?.email as string | null | undefined) ?? null;

      setBaseline({
        name: updatedName ?? "",
        email: updatedEmail ?? "",
      });
      setName(updatedName ?? "");
      setEmail(updatedEmail ?? "");
      setPassword("");
      setConfirmPassword("");
      setSuccess("Profil wurde erfolgreich aktualisiert");
      toast.success("Profil wurde aktualisiert");

      // Aktualisiere die Session-Daten, damit Navigationskomponenten sofort aktualisiert werden.
      try {
        await update({
          user: {
            name: updatedName ?? null,
            email: updatedEmail ?? null,
          },
        });
      } catch (sessionError) {
        console.error("[Profil] Session konnte nicht aktualisiert werden", sessionError);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Aktualisierung fehlgeschlagen";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground/90" htmlFor="profile-name">
          Name
        </label>
        <Input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Vorname Nachname"
          autoComplete="name"
        />
        <p className="text-xs text-foreground/70">
          Der Name wird in internen Übersichten und im Mitgliederbereich angezeigt.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground/90" htmlFor="profile-email">
          E-Mail-Adresse
        </label>
        <Input
          id="profile-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
        <p className="text-xs text-foreground/70">
          Diese E-Mail dient sowohl zur Anmeldung als auch für Benachrichtigungen.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground/90" htmlFor="profile-password">
            Neues Passwort
          </label>
          <Input
            id="profile-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Optional – mindestens 6 Zeichen"
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground/90" htmlFor="profile-password-confirm">
            Passwort bestätigen
          </label>
          <Input
            id="profile-password-confirm"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Nur wenn du das Passwort änderst"
            autoComplete="new-password"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
          Zurücksetzen
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Speichern…" : "Änderungen speichern"}
        </Button>
      </div>
    </form>
  );
}
