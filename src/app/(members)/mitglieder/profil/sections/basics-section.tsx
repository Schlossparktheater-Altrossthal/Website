"use client";

import { Loader2Icon } from "@/components/ui/action-icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { updateProfileBasicsAction } from "../actions/basics";
import { AvatarCropDialog } from "../avatar-crop-dialog";
import { useAvatarCrop } from "../use-avatar-crop";
import {
  ProfileUser,
  mapUpdatedUserFromPayload,
  BasicsFormState,
  basicsSchema,
} from "../profile-shared";

type BasicsSectionProps = {
  user: ProfileUser;
  onUserUpdated: (nextUser: ProfileUser) => Promise<void> | void;
};

export function BasicsSection({ user, onUserUpdated }: BasicsSectionProps) {
  const [formState, setFormState] = useState<BasicsFormState>(() => ({
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    email: user.email,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "",
    password: "",
    confirmPassword: "",
    avatarSource:
      user.avatarSource === "GRAVATAR" ||
      user.avatarSource === "UPLOAD" ||
      user.avatarSource === "INITIALS"
        ? (user.avatarSource as BasicsFormState["avatarSource"])
        : "INITIALS",
    removeAvatar: false,
  }));

  const avatarCrop = useAvatarCrop({
    userId: user.id,
    onCropComplete: () => {
      setFormState((prev) => ({ ...prev, avatarSource: "UPLOAD", removeAvatar: false }));
    },
  });

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      email: user.email,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "",
      avatarSource:
        user.avatarSource === "GRAVATAR" ||
        user.avatarSource === "UPLOAD" ||
        user.avatarSource === "INITIALS"
          ? (user.avatarSource as BasicsFormState["avatarSource"])
          : prev.avatarSource,
      removeAvatar: false,
    }));
  }, [
    user.firstName,
    user.lastName,
    user.displayName,
    user.email,
    user.dateOfBirth,
    user.avatarSource,
  ]);

  useEffect(() => {
    if (!avatarCrop.avatarFile) {
      avatarCrop.resetAvatarCrop();
    }
  }, [avatarCrop]);

  const avatarPreviewState = useMemo(() => {
    if (formState.avatarSource === "GRAVATAR") {
      return {
        source: "GRAVATAR" as const,
        previewUrl: null,
        description: "Vorschau deines Gravatar-Bildes.",
      };
    }

    if (formState.avatarSource === "UPLOAD") {
      if (avatarCrop.avatarPreviewUrl) {
        return {
          source: "UPLOAD" as const,
          previewUrl: avatarCrop.avatarPreviewUrl,
          description:
            "Vorschau deines neuen Uploads mit individuellem Ausschnitt (noch nicht gespeichert).",
        };
      }

      if (user.avatarSource === "UPLOAD") {
        if (formState.removeAvatar) {
          return {
            source: "INITIALS" as const,
            previewUrl: null,
            description: "Eigenes Bild wird entfernt – wir zeigen deine Initialen.",
          };
        }

        return {
          source: "UPLOAD" as const,
          previewUrl: null,
          description: "Aktuell gespeichertes, eigenes Bild.",
        };
      }

      return {
        source: "INITIALS" as const,
        previewUrl: null,
        description: "Kein Upload vorhanden – wir zeigen deine Initialen.",
      };
    }

    return {
      source: "INITIALS" as const,
      previewUrl: null,
      description: "Avatar basiert auf deinen Initialen.",
    };
  }, [
    avatarCrop.avatarPreviewUrl,
    formState.avatarSource,
    formState.removeAvatar,
    user.avatarSource,
  ]);

  const useStoredUploadPreview =
    avatarPreviewState.source === "UPLOAD" && !avatarPreviewState.previewUrl;

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarSourceChange = (value: BasicsFormState["avatarSource"]) => {
    setFormState((prev) => ({ ...prev, avatarSource: value, removeAvatar: false }));
  };

  const handleAvatarCropReopenClick = () => {
    void avatarCrop.handleAvatarCropReopen(
      formState.avatarSource === "UPLOAD" && user.avatarSource === "UPLOAD" ? "UPLOAD" : null,
    );
  };

  const resetPasswordFields = () => {
    setFormState((prev) => ({ ...prev, password: "", confirmPassword: "" }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parseResult = basicsSchema.safeParse({
      ...formState,
      lastName: formState.lastName,
      password: formState.password || undefined,
      confirmPassword: formState.confirmPassword,
    });

    if (!parseResult.success) {
      const issues = parseResult.error.flatten();
      const fieldIssueEntries = Object.entries(issues.fieldErrors).filter(
        ([, messages]) => messages && messages.length > 0,
      );
      if (fieldIssueEntries.length > 0) {
        setFieldErrors(
          Object.fromEntries(fieldIssueEntries.map(([key, messages]) => [key, messages![0]])),
        );
      }
      if (issues.formErrors.length) {
        setError(issues.formErrors[0]);
      }
      return;
    }

    const data = parseResult.data;
    const formData = new FormData();
    formData.append("firstName", data.firstName);
    formData.append("lastName", data.lastName ?? "");
    formData.append("name", data.displayName);
    formData.append("email", data.email);
    if (data.dateOfBirth) {
      formData.append("dateOfBirth", data.dateOfBirth);
    } else {
      formData.append("dateOfBirth", "");
    }
    if (data.password) {
      formData.append("password", data.password);
    }
    formData.append("avatarSource", data.avatarSource);
    if (data.removeAvatar) {
      formData.append("removeAvatar", "1");
    }
    if (avatarCrop.avatarFile) {
      formData.append("avatarFile", avatarCrop.avatarFile);
      if (avatarCrop.avatarCropSelection) {
        formData.append("avatarCrop", JSON.stringify(avatarCrop.avatarCropSelection));
      }
    }

    setSubmitting(true);
    try {
      const result = await updateProfileBasicsAction(formData);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      const payload = result.data.user;
      const nextUser = mapUpdatedUserFromPayload(user, payload);
      await onUserUpdated(nextUser);
      resetPasswordFields();
      avatarCrop.resetAvatarCrop();
      setFormState((prev) => ({ ...prev, removeAvatar: false }));
      toast.success("Stammdaten aktualisiert");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Stammdaten &amp; Zugang</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Vorname</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formState.firstName}
                  onChange={handleInputChange}
                  autoComplete="given-name"
                />
                {fieldErrors.firstName ? (
                  <p className="text-sm text-destructive">{fieldErrors.firstName}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nachname</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formState.lastName}
                  onChange={handleInputChange}
                  autoComplete="family-name"
                />
                {fieldErrors.lastName ? (
                  <p className="text-sm text-destructive">{fieldErrors.lastName}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="displayName">Anzeigename</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  value={formState.displayName}
                  onChange={handleInputChange}
                />
                {fieldErrors.displayName ? (
                  <p className="text-sm text-destructive">{fieldErrors.displayName}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formState.email}
                  onChange={handleInputChange}
                  autoComplete="email"
                />
                {fieldErrors.email ? (
                  <p className="text-sm text-destructive">{fieldErrors.email}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Geburtsdatum</Label>
                <DateInput
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={formState.dateOfBirth}
                  onChange={handleInputChange}
                />
                {fieldErrors.dateOfBirth ? (
                  <p className="text-sm text-destructive">{fieldErrors.dateOfBirth}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Benötigt für Fotoeinverständnis und Altersfreigaben.
                </p>
              </div>
              <div className="space-y-2">
                <Label id="avatar-source-label">Avatar-Quelle wählen</Label>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-labelledby="avatar-source-label"
                >
                  {(
                    [
                      { value: "INITIALS", label: "Initialen" },
                      { value: "GRAVATAR", label: "Gravatar" },
                      { value: "UPLOAD", label: "Eigenes Bild" },
                    ] satisfies Array<{ value: BasicsFormState["avatarSource"]; label: string }>
                  ).map((option) => {
                    const active = formState.avatarSource === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => handleAvatarSourceChange(option.value)}
                        className={cn(
                          "min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                  <UserAvatar
                    userId={useStoredUploadPreview ? user.id : undefined}
                    email={formState.email}
                    firstName={formState.firstName}
                    lastName={formState.lastName}
                    name={formState.displayName}
                    size={48}
                    className="h-12 w-12"
                    avatarSource={avatarPreviewState.source}
                    avatarUpdatedAt={useStoredUploadPreview ? user.avatarUpdatedAt : undefined}
                    previewUrl={avatarPreviewState.previewUrl}
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">Aktuelle Vorschau</p>
                    <p className="text-xs text-muted-foreground">
                      {avatarPreviewState.description}
                    </p>
                  </div>
                </div>
                {formState.avatarSource === "GRAVATAR" ? (
                  <p className="text-xs text-muted-foreground">
                    Wir nutzen den Gravatar zu deiner E-Mail-Adresse. Stelle sicher, dass dort ein
                    Bild hinterlegt ist.
                  </p>
                ) : null}
                {formState.avatarSource === "UPLOAD" ? (
                  <div className="space-y-2 pt-2">
                    <Input
                      ref={avatarCrop.fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={avatarCrop.handleAvatarFileChange}
                    />
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG oder WebP bis 8 MB. Wir skalieren dein Bild automatisch und speichern
                      es optimiert.
                    </p>
                    {(avatarCrop.avatarPreviewUrl || user.avatarSource === "UPLOAD") &&
                    !formState.removeAvatar ? (
                      <div className="space-y-2">
                        {avatarCrop.avatarPreviewUrl ? (
                          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
                            <UserAvatar
                              name={user.displayName}
                              size={48}
                              className="h-12 w-12"
                              previewUrl={avatarCrop.avatarPreviewUrl}
                            />
                            <span className="text-xs text-muted-foreground">
                              Vorschau des neuen Avatars
                            </span>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={handleAvatarCropReopenClick}
                            disabled={avatarCrop.avatarCropLoading}
                          >
                            {avatarCrop.avatarCropLoading ? (
                              <>
                                <Loader2Icon
                                  className="mr-2 h-3.5 w-3.5 animate-spin"
                                  aria-hidden
                                />
                                Ausschnitt wird geladen…
                              </>
                            ) : (
                              "Bildausschnitt anpassen"
                            )}
                          </Button>
                          {avatarCrop.avatarCropSelection ? (
                            <span className="text-[0.7rem] text-muted-foreground">
                              Zuletzt gewählter Ausschnitt bleibt erhalten.
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {user.avatarSource === "UPLOAD" && !avatarCrop.avatarFile ? (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline transition hover:text-foreground"
                        onClick={() =>
                          setFormState((prev) => ({ ...prev, removeAvatar: !prev.removeAvatar }))
                        }
                      >
                        {formState.removeAvatar
                          ? "Eigenes Bild behalten"
                          : "Eigenes Bild entfernen"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Passwort zurücksetzen</Label>
              <div className="grid gap-4 md:grid-cols-2">
                <PasswordInput
                  name="password"
                  value={formState.password}
                  onChange={handleInputChange}
                  placeholder="Neues Passwort"
                  autoComplete="new-password"
                />
                <PasswordInput
                  name="confirmPassword"
                  value={formState.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Bestätigung"
                  autoComplete="new-password"
                />
              </div>
              {(fieldErrors.password || fieldErrors.confirmPassword) && (
                <p className="text-sm text-destructive">
                  {fieldErrors.password ?? fieldErrors.confirmPassword}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Lasse die Felder leer, wenn das Passwort unverändert bleiben soll.
              </p>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center">
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Speichern…
                  </>
                ) : (
                  "Änderungen speichern"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <AvatarCropDialog
        open={Boolean(avatarCrop.cropDialogOpen && avatarCrop.cropImageUrl)}
        imageUrl={avatarCrop.cropImageUrl}
        initialSelection={avatarCrop.cropDialogInitialSelection}
        initialState={avatarCrop.cropDialogInitialState}
        onClose={avatarCrop.handleCropDialogClose}
        onConfirm={avatarCrop.handleCropDialogConfirm}
      />
    </>
  );
}
