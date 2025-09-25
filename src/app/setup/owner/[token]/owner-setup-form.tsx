"use client";

import { useState, type FormEvent } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OwnerSetupFormProps {
  token: string;
}

interface ApiResponse {
  ok?: boolean;
  error?: string;
  user?: { email?: string | null; name?: string | null; firstName?: string | null; lastName?: string | null };
}

export function OwnerSetupForm({ token }: OwnerSetupFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdEmail, setCreatedEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedEmail) {
      setError("Bitte eine E-Mail-Adresse angeben.");
      return;
    }

    if (!trimmedFirstName) {
      setError("Bitte einen Vornamen angeben.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Die E-Mail-Adresse ist ungültig.");
      return;
    }

    if (trimmedPassword.length < 6) {
      setError("Das Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/setup/owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          firstName: trimmedFirstName,
          lastName: trimmedLastName || undefined,
          email: trimmedEmail,
          password: trimmedPassword,
        }),
      });

      const data: ApiResponse = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        const message = data.error || "Owner konnte nicht angelegt werden.";
        setError(message);
        return;
      }

      setCreatedEmail(trimmedEmail);
      setSuccess(true);
    } catch {
      setError("Netzwerkfehler – bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Owner erfolgreich angelegt</h2>
        <p className="text-sm text-muted-foreground">
          Du kannst dich jetzt mit <span className="font-medium text-foreground">{createdEmail}</span> anmelden.
        </p>
        <Button asChild variant="secondary">
          <Link href="/login">Zum Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="owner-first-name">
            Vorname
          </label>
          <Input
            id="owner-first-name"
            autoComplete="given-name"
            placeholder="Max"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="owner-last-name">
            Nachname (optional)
          </label>
          <Input
            id="owner-last-name"
            autoComplete="family-name"
            placeholder="Mustermann"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="owner-email">
          E-Mail
        </label>
        <Input
          id="owner-email"
          type="email"
          autoComplete="email"
          placeholder="owner@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="owner-password">
          Passwort
        </label>
        <Input
          id="owner-password"
          type="password"
          autoComplete="new-password"
          placeholder="Mindestens 6 Zeichen"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="owner-password-confirm">
          Passwort bestätigen
        </label>
        <Input
          id="owner-password-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Passwort erneut eingeben"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Wird angelegt..." : "Owner anlegen"}
      </Button>
    </form>
  );
}
