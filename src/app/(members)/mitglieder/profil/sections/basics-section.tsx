"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Card } from "@/components/ui/card";
import { FormSaveBar } from "@/components/ui/form-save-bar";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { updateProfileBasicsAction } from "../actions/basics";
import { AvatarCropDialog } from "../avatar-crop-dialog";
import { useAvatarCrop } from "../use-avatar-crop";
import { ProfileField, ProfileFieldset } from "./profile-fieldset";
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
  const [passwordOpen, setPasswordOpen] = useState(false);

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

  const storedAvatarSource: BasicsFormState["avatarSource"] =
    user.avatarSource === "GRAVATAR" ||
    user.avatarSource === "UPLOAD" ||
    user.avatarSource === "INITIALS"
      ? user.avatarSource
      : "INITIALS";
  const storedDateOfBirth = user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "";
  const dirty =
    formState.firstName !== user.firstName ||
    formState.lastName !== user.lastName ||
    formState.displayName !== user.displayName ||
    formState.email !== user.email ||
    formState.dateOfBirth !== storedDateOfBirth ||
    formState.avatarSource !== storedAvatarSource ||
    formState.removeAvatar ||
    Boolean(formState.password) ||
    Boolean(formState.confirmPassword) ||
    Boolean(avatarCrop.avatarFile);

  const handleReset = () => {
    setFormState({
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      email: user.email,
      dateOfBirth: storedDateOfBirth,
      password: "",
      confirmPassword: "",
      avatarSource: storedAvatarSource,
      removeAvatar: false,
    });
    setFieldErrors({});
    setError(null);
    setPasswordOpen(false);
    avatarCrop.resetAvatarCrop();
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
      setPasswordOpen(false);
      avatarCrop.resetAvatarCrop();
      setFormState((prev) => ({ ...prev, removeAvatar: false }));
      toast.success("Stammdaten aktualisiert");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card variant="plain" size="md">
        <form className="divide-y divide-border/60" onSubmit={handleSubmit} noValidate>
          <ProfileFieldset title="Persönliches">
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileField label="Vorname" htmlFor="firstName" error={fieldErrors.firstName}>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formState.firstName}
                  onChange={handleInputChange}
                  autoComplete="given-name"
                />
              </ProfileField>
              <ProfileField label="Nachname" htmlFor="lastName" error={fieldErrors.lastName}>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formState.lastName}
                  onChange={handleInputChange}
                  autoComplete="family-name"
                />
              </ProfileField>
              <ProfileField
                label="Anzeigename"
                htmlFor="displayName"
                error={fieldErrors.displayName}
                hint="So sehen dich andere im Mitgliederbereich."
              >
                <Input
                  id="displayName"
                  name="displayName"
                  value={formState.displayName}
                  onChange={handleInputChange}
                />
              </ProfileField>
              <ProfileField
                label="Geburtsdatum"
                htmlFor="dateOfBirth"
                error={fieldErrors.dateOfBirth}
                hint="Für Fotoerlaubnis und Altersfreigaben."
              >
                <DateInput
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={formState.dateOfBirth}
                  onChange={handleInputChange}
                />
              </ProfileField>
            </div>
          </ProfileFieldset>

          <ProfileFieldset title="Profilbild">
            <div className="flex items-center gap-3">
              <UserAvatar
                userId={useStoredUploadPreview ? user.id : undefined}
                email={formState.email}
                firstName={formState.firstName}
                lastName={formState.lastName}
                name={formState.displayName}
                size={48}
                className="h-12 w-12 shrink-0"
                avatarSource={avatarPreviewState.source}
                avatarUpdatedAt={useStoredUploadPreview ? user.avatarUpdatedAt : undefined}
                previewUrl={avatarPreviewState.previewUrl}
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div
                  className="grid w-full grid-cols-3 rounded-lg bg-muted/60 p-1 sm:inline-grid sm:w-auto"
                  role="radiogroup"
                  aria-label="Quelle des Profilbilds"
                >
                  {(
                    [
                      { value: "INITIALS", label: "Initialen" },
                      { value: "GRAVATAR", label: "Gravatar" },
                      { value: "UPLOAD", label: "Foto" },
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
                          "min-h-9 whitespace-nowrap rounded-md px-2 text-sm font-medium transition sm:px-3",
                          active
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formState.avatarSource === "GRAVATAR"
                    ? "Bild von gravatar.com zu deiner E-Mail-Adresse."
                    : avatarPreviewState.description}
                </p>
              </div>
            </div>
            {formState.avatarSource === "UPLOAD" ? (
              <div className="space-y-2">
                <Input
                  ref={avatarCrop.fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={avatarCrop.handleAvatarFileChange}
                  aria-label="Bild hochladen"
                />
                <p className="text-xs text-muted-foreground">PNG, JPG oder WebP bis 8 MB.</p>
                <div className="flex flex-wrap items-center gap-2">
                  {(avatarCrop.avatarPreviewUrl || user.avatarSource === "UPLOAD") &&
                  !formState.removeAvatar ? (
                    <AsyncButton
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleAvatarCropReopenClick}
                      isLoading={avatarCrop.avatarCropLoading}
                      loadingText="Ausschnitt wird geladen…"
                    >
                      Ausschnitt anpassen
                    </AsyncButton>
                  ) : null}
                  {user.avatarSource === "UPLOAD" && !avatarCrop.avatarFile ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        setFormState((prev) => ({ ...prev, removeAvatar: !prev.removeAvatar }))
                      }
                    >
                      {formState.removeAvatar ? "Bild behalten" : "Bild entfernen"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </ProfileFieldset>

          <ProfileFieldset title="Konto">
            <ProfileField
              label="E-Mail"
              htmlFor="email"
              error={fieldErrors.email}
              hint="Für Anmeldung und Benachrichtigungen."
            >
              <Input
                id="email"
                name="email"
                type="email"
                value={formState.email}
                onChange={handleInputChange}
                autoComplete="email"
              />
            </ProfileField>
            {passwordOpen ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">Neues Passwort</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PasswordInput
                    name="password"
                    value={formState.password}
                    onChange={handleInputChange}
                    placeholder="Neues Passwort"
                    autoComplete="new-password"
                    aria-label="Neues Passwort"
                  />
                  <PasswordInput
                    name="confirmPassword"
                    value={formState.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Wiederholen"
                    autoComplete="new-password"
                    aria-label="Neues Passwort wiederholen"
                  />
                </div>
                {fieldErrors.password || fieldErrors.confirmPassword ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.password ?? fieldErrors.confirmPassword}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Mindestens 6 Zeichen.</p>
                )}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPasswordOpen(true)}
              >
                Passwort ändern
              </Button>
            )}
          </ProfileFieldset>

          {error ? <p className="py-2 text-sm text-destructive">{error}</p> : null}
          <FormSaveBar dirty={dirty} submitting={submitting} onReset={handleReset} />
        </form>
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
