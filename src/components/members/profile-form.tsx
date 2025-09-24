"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import type { AvatarSource } from "@/components/user-avatar";
import { combineNameParts, splitFullName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { useProfileCompletion } from "@/components/members/profile-completion-context";

interface ProfileFormProps {
  initialFirstName?: string | null;
  initialLastName?: string | null;
  initialName?: string | null;
  initialEmail?: string | null;
  userId: string;
  initialAvatarSource?: AvatarSource | null;
  initialAvatarUpdatedAt?: string | null;
  initialDateOfBirth?: string | null;
  onProfileChange?: (data: {
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string | null;
    avatarSource: AvatarSource | null;
    avatarUpdatedAt: string | null;
    dateOfBirth: string | null;
  }) => void;
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

function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const AVATAR_OPTION_BASE_CLASSES =
  "flex items-center gap-3 rounded-md border px-3 py-2 text-sm shadow-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20";

export function ProfileForm({
  userId,
  initialFirstName,
  initialLastName,
  initialName,
  initialEmail,
  initialAvatarSource,
  initialAvatarUpdatedAt,
  initialDateOfBirth,
  onProfileChange,
}: ProfileFormProps) {
  const { update } = useSession();
  const derivedNames = initialName ? splitFullName(initialName) : { firstName: null, lastName: null };
  const initialFirst = initialFirstName ?? derivedNames.firstName ?? "";
  const initialLast = initialLastName ?? derivedNames.lastName ?? "";
  const [baseline, setBaseline] = useState({
    firstName: initialFirst,
    lastName: initialLast,
    email: initialEmail ?? "",
    avatarSource: normalizeAvatarChoice(initialAvatarSource),
    avatarUpdatedAt: initialAvatarUpdatedAt ?? null,
    dateOfBirth: toDateInputValue(initialDateOfBirth),
  });
  const [firstName, setFirstName] = useState(baseline.firstName);
  const [lastName, setLastName] = useState(baseline.lastName);
  const [email, setEmail] = useState(baseline.email);
  const displayName = combineNameParts(firstName, lastName);
  const [dateOfBirth, setDateOfBirth] = useState(baseline.dateOfBirth);
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
  const completion = useProfileCompletion();

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const resetForm = () => {
    setFirstName(baseline.firstName);
    setLastName(baseline.lastName);
    setEmail(baseline.email);
    setDateOfBirth(baseline.dateOfBirth);
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

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    if (!trimmedFirstName) {
      setError("Vorname darf nicht leer sein");
      return;
    }
    const combinedName = combineNameParts(trimmedFirstName, trimmedLastName);
    const formData = new FormData();
    formData.append("email", trimmedEmail);
    formData.append("firstName", trimmedFirstName);
    formData.append("lastName", trimmedLastName);
    formData.append("name", combinedName ?? "");
    formData.append("dateOfBirth", dateOfBirth ?? "");
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

      const updatedFirstName = (data?.user?.firstName as string | null | undefined) ?? null;
      const updatedLastName = (data?.user?.lastName as string | null | undefined) ?? null;
      const updatedName =
        combineNameParts(updatedFirstName, updatedLastName) ?? ((data?.user?.name as string | null | undefined) ?? null);
      const updatedEmail = (data?.user?.email as string | null | undefined) ?? null;
      const updatedAvatarSource = normalizeAvatarChoice(data?.user?.avatarSource as string | null | undefined);
      const updatedAvatarTimestamp = (data?.user?.avatarUpdatedAt as string | null | undefined) ?? null;
      const updatedDateOfBirthIso = (data?.user?.dateOfBirth as string | null | undefined) ?? null;
      const updatedDateOfBirth = toDateInputValue(data?.user?.dateOfBirth as string | null | undefined);

      setBaseline({
        firstName: updatedFirstName ?? "",
        lastName: updatedLastName ?? "",
        email: updatedEmail ?? "",
        avatarSource: updatedAvatarSource,
        avatarUpdatedAt: updatedAvatarTimestamp,
        dateOfBirth: updatedDateOfBirth,
      });
      setFirstName(updatedFirstName ?? "");
      setLastName(updatedLastName ?? "");
      setEmail(updatedEmail ?? "");
      setDateOfBirth(updatedDateOfBirth);
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

      onProfileChange?.({
        firstName: updatedFirstName ?? null,
        lastName: updatedLastName ?? null,
        name: updatedName ?? null,
        email: updatedEmail ?? null,
        avatarSource: (updatedAvatarSource ?? null) as AvatarSource | null,
        avatarUpdatedAt: updatedAvatarTimestamp,
        dateOfBirth: updatedDateOfBirthIso ?? null,
      });

      completion.setItemComplete(
        "basics",
        Boolean(updatedFirstName && updatedLastName && updatedEmail),
      );
      completion.setItemComplete("birthdate", Boolean(updatedDateOfBirthIso));

      // Aktualisiere die Session-Daten, damit Navigationskomponenten sofort aktualisiert werden.
      try {
        await update({
          user: {
            firstName: updatedFirstName ?? null,
            lastName: updatedLastName ?? null,
            name: updatedName ?? null,
            email: updatedEmail ?? null,
            avatarSource: updatedAvatarSource,
            avatarUpdatedAt: updatedAvatarTimestamp,
            dateOfBirth: updatedDateOfBirthIso,
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
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground/90" htmlFor="profile-first-name">
            Vorname
          </label>
          <Input
            id="profile-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="Vorname"
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground/90" htmlFor="profile-last-name">
            Nachname
          </label>
          <Input
            id="profile-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Nachname"
            autoComplete="family-name"
          />
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
          <p className="text-xs text-muted-foreground">
            Diese E-Mail dient sowohl zur Anmeldung als auch für Benachrichtigungen.
          </p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="block text-sm font-medium text-foreground/90" htmlFor="profile-date-of-birth">
            Geburtsdatum
          </label>
          <Input
            id="profile-date-of-birth"
            type="date"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
            autoComplete="bday"
            max={toDateInputValue(new Date().toISOString())}
          />
          <p className="text-xs text-muted-foreground">
            Das Geburtsdatum hilft uns, notwendige Einverständniserklärungen korrekt zu verwalten.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <span className="text-sm font-medium text-foreground/90">Profilbild</span>
          <p className="text-xs text-muted-foreground">
            Wähle, wie dein Portrait im Portal angezeigt wird. Lade optional ein eigenes Bild hoch.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <UserAvatar
            userId={userId}
            email={email}
            firstName={firstName}
            lastName={lastName}
            name={displayName}
            size={80}
            className="h-20 w-20 text-2xl"
            avatarSource={avatarSource}
            avatarUpdatedAt={avatarPreview ? Date.now() : avatarUpdatedAt}
            previewUrl={avatarPreview}
          />
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              <label
                className={cn(
                  AVATAR_OPTION_BASE_CLASSES,
                  avatarSource === "GRAVATAR"
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border/60 bg-background/70 hover:border-primary/40"
                )}
              >
                <input
                  type="radio"
                  name="avatar-source"
                  value="GRAVATAR"
                  checked={avatarSource === "GRAVATAR"}
                  onChange={() => handleAvatarSourceChange("GRAVATAR")}
                  className="h-4 w-4 border-border text-primary focus-visible:outline-none focus-visible:ring-0"
                />
                <span>Gravatar (basierend auf deiner E-Mail)</span>
              </label>
              <label
                className={cn(
                  AVATAR_OPTION_BASE_CLASSES,
                  avatarSource === "INITIALS"
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border/60 bg-background/70 hover:border-primary/40"
                )}
              >
                <input
                  type="radio"
                  name="avatar-source"
                  value="INITIALS"
                  checked={avatarSource === "INITIALS"}
                  onChange={() => handleAvatarSourceChange("INITIALS")}
                  className="h-4 w-4 border-border text-primary focus-visible:outline-none focus-visible:ring-0"
                />
                <span>Initialen (farbiger Platzhalter)</span>
              </label>
              <label
                className={cn(
                  AVATAR_OPTION_BASE_CLASSES,
                  avatarSource === "UPLOAD"
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border/60 bg-background/70 hover:border-primary/40"
                )}
              >
                <input
                  type="radio"
                  name="avatar-source"
                  value="UPLOAD"
                  checked={avatarSource === "UPLOAD"}
                  onChange={() => handleAvatarSourceChange("UPLOAD")}
                  className="h-4 w-4 border-border text-primary focus-visible:outline-none focus-visible:ring-0"
                />
                <span>Eigenes Bild</span>
              </label>
            </div>

            <p className="text-xs text-muted-foreground">
              Du nutzt Gravatar noch nicht?{" "}
              <Link
                href="https://gravatar.com"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Lege dir kostenlos ein Profil an
              </Link>
              , um dein Bild über deine E-Mail-Adresse zu steuern.
            </p>

            {avatarSource === "UPLOAD" && (
              <div className="space-y-2">
                <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarFileChange} />
                <p className="text-xs text-muted-foreground">Unterstützt JPG, PNG und WebP bis 2&nbsp;MB.</p>
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
              <p className="text-xs text-muted-foreground">Das aktuelle Upload-Bild wird nach dem Speichern entfernt.</p>
            )}

            {avatarError && <p className="text-sm text-destructive">{avatarError}</p>}
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

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-500">{success}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-4">
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
