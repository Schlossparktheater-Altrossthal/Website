"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import type { AvatarSource } from "@prisma/client";

interface ProfileFormProps {
  initialName?: string | null;
  initialEmail?: string | null;
  userId: string;
  initialAvatarSource?: AvatarSource | null;
  initialAvatarUpdatedAt?: string | null;
}

const AVATAR_CHOICES = ["GRAVATAR", "UPLOAD", "INITIALS"] as const;
type AvatarChoice = (typeof AVATAR_CHOICES)[number];

function normalizeAvatarChoice(value?: AvatarSource | string | null): AvatarChoice {
  const normalized = value?.toString().trim().toUpperCase();
  if (normalized && (AVATAR_CHOICES as readonly string[]).includes(normalized)) {
    return normalized as AvatarChoice;
  }
  return "GRAVATAR";
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function ProfileForm({
  userId,
  initialName,
  initialEmail,
  initialAvatarSource,
  initialAvatarUpdatedAt,
}: ProfileFormProps) {
  const { update } = useSession();
  const [baseline, setBaseline] = useState({
    name: initialName ?? "",
    email: initialEmail ?? "",
    avatarSource: normalizeAvatarChoice(initialAvatarSource),
    avatarUpdatedAt: initialAvatarUpdatedAt ?? null,
  });
  const [name, setName] = useState(baseline.name);
  const [email, setEmail] = useState(baseline.email);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [avatarSource, setAvatarSource] = useState<AvatarChoice>(baseline.avatarSource);
  const [avatarUpdatedAt, setAvatarUpdatedAt] = useState<string | null>(baseline.avatarUpdatedAt);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const hasStoredAvatar = Boolean(avatarUpdatedAt);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const resetForm = () => {
    setName(baseline.name);
    setEmail(baseline.email);
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
    setAvatarSource(baseline.avatarSource);
    setAvatarUpdatedAt(baseline.avatarUpdatedAt);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview(null);
    setAvatarFile(null);
    setAvatarError(null);
    setRemoveAvatar(false);
  };

  const handleAvatarSourceChange = (next: AvatarChoice) => {
    setAvatarSource(next);
    setAvatarError(null);
    if (next === "UPLOAD") {
      setRemoveAvatar(false);
    }
  };

  const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    }
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Bild darf maximal 2 MB groß sein");
      setAvatarFile(null);
      return;
    }
    const type = file.type?.toLowerCase() ?? "";
    if (!ALLOWED_AVATAR_TYPES.has(type)) {
      setAvatarError("Nur JPG, PNG oder WebP werden unterstützt");
      setAvatarFile(null);
      return;
    }
    setAvatarError(null);
    setRemoveAvatar(false);
    setAvatarFile(file);
    setAvatarSource("UPLOAD");
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleRemoveAvatar = () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    }
    setAvatarFile(null);
    setAvatarUpdatedAt(null);
    setRemoveAvatar(true);
    setAvatarError(null);
    if (avatarSource === "UPLOAD") {
      setAvatarSource("INITIALS");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setAvatarError(null);

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

    const trimmedName = name.trim();
    const formData = new FormData();
    formData.append("email", trimmedEmail);
    formData.append("name", trimmedName);
    if (password) {
      formData.append("password", password);
    }

    const wantsUpload = avatarSource === "UPLOAD";
    const hasPreview = Boolean(avatarFile || avatarPreview);
    if (wantsUpload && !hasPreview && !hasStoredAvatar) {
      setAvatarError("Bitte wähle ein Bild aus, bevor du den Avatar auf 'Eigenes Bild' stellst.");
      return;
    }

    formData.append("avatarSource", avatarSource);
    if (wantsUpload && avatarFile) {
      formData.append("avatarFile", avatarFile);
    }
    if (removeAvatar) {
      formData.append("removeAvatar", "1");
    }

    setSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? "Aktualisierung fehlgeschlagen");
      }

      const updatedName = (data?.user?.name as string | null | undefined) ?? null;
      const updatedEmail = (data?.user?.email as string | null | undefined) ?? null;
      const updatedAvatarSource = normalizeAvatarChoice(data?.user?.avatarSource as string | null | undefined);
      const updatedAvatarTimestamp = (data?.user?.avatarUpdatedAt as string | null | undefined) ?? null;

      setBaseline({
        name: updatedName ?? "",
        email: updatedEmail ?? "",
        avatarSource: updatedAvatarSource,
        avatarUpdatedAt: updatedAvatarTimestamp,
      });
      setName(updatedName ?? "");
      setEmail(updatedEmail ?? "");
      setPassword("");
      setConfirmPassword("");
      setAvatarSource(updatedAvatarSource);
      setAvatarUpdatedAt(updatedAvatarTimestamp);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarPreview(null);
      setAvatarFile(null);
      setRemoveAvatar(false);
      setSuccess("Profil wurde erfolgreich aktualisiert");
      toast.success("Profil wurde aktualisiert");

      // Aktualisiere die Session-Daten, damit Navigationskomponenten sofort aktualisiert werden.
      try {
        await update({
          user: {
            name: updatedName ?? null,
            email: updatedEmail ?? null,
            avatarSource: updatedAvatarSource,
            avatarUpdatedAt: updatedAvatarTimestamp,
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

      <div className="space-y-3">
        <span className="block text-sm font-medium text-foreground/90">Profilbild</span>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <UserAvatar
            userId={userId}
            email={email}
            name={name}
            size={72}
            className="h-[72px] w-[72px] text-xl"
            avatarSource={avatarSource}
            avatarUpdatedAt={avatarPreview ? Date.now() : avatarUpdatedAt}
            previewUrl={avatarPreview}
          />
          <div className="space-y-3 text-sm">
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="avatar-source"
                  value="GRAVATAR"
                  checked={avatarSource === "GRAVATAR"}
                  onChange={() => handleAvatarSourceChange("GRAVATAR")}
                  className="h-4 w-4 border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span>Gravatar (basierend auf deiner E-Mail)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="avatar-source"
                  value="INITIALS"
                  checked={avatarSource === "INITIALS"}
                  onChange={() => handleAvatarSourceChange("INITIALS")}
                  className="h-4 w-4 border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span>Initialen (farbiger Platzhalter)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="avatar-source"
                  value="UPLOAD"
                  checked={avatarSource === "UPLOAD"}
                  onChange={() => handleAvatarSourceChange("UPLOAD")}
                  className="h-4 w-4 border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span>Eigenes Bild</span>
              </label>
            </div>

            {avatarSource === "UPLOAD" && (
              <div className="space-y-2">
                <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarFileChange} />
                <p className="text-xs text-foreground/70">Unterstützt JPG, PNG und WebP bis 2&nbsp;MB.</p>
                {hasStoredAvatar && !avatarFile && !avatarPreview && !removeAvatar && (
                  <Button type="button" variant="outline" size="sm" onClick={handleRemoveAvatar}>
                    Eigenes Bild entfernen
                  </Button>
                )}
              </div>
            )}

            {avatarSource !== "UPLOAD" && hasStoredAvatar && !removeAvatar && (
              <Button type="button" variant="outline" size="sm" onClick={handleRemoveAvatar}>
                Eigenes Bild löschen
              </Button>
            )}

            {removeAvatar && (
              <p className="text-xs text-foreground/70">Das aktuelle Upload-Bild wird nach dem Speichern entfernt.</p>
            )}

            {avatarError && <p className="text-sm text-red-600">{avatarError}</p>}
          </div>
        </div>
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
