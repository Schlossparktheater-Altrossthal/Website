"use client";

import { CheckCircle2Icon, MessageCircleIcon } from "@/components/ui/action-icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AsyncButton } from "@/components/ui/async-button";
import { Card } from "@/components/ui/card";
import { FormSaveBar } from "@/components/ui/form-save-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EducationFields } from "@/components/onboarding/education-fields";
import {
  readStoredEducation,
  toEducationPayload,
  validateEducation,
} from "@/lib/education/schools";
import { deriveOnboardingFocusFromPreferences } from "@/lib/onboarding/role-preference-utils";
import { cn } from "@/lib/utils";
import { type OnboardingFocus } from "@prisma/client";
import { saveOnboardingAction } from "../actions/onboarding";
import {
  CURRENT_YEAR,
  ONBOARDING_STATUS_LABELS,
  ProfileClientProps,
  OnboardingProfile,
  OnboardingFormState,
  onboardingSchema,
  formatDate,
} from "../profile-shared";
import { ProfileField } from "./profile-fieldset";

export type OnboardingSectionProps = {
  onboarding: ProfileClientProps["onboarding"];
  onOnboardingChange: (next: ProfileClientProps["onboarding"]) => void;
  rolePreferences: ProfileClientProps["rolePreferences"];
  whatsappVisitedAt: string | null;
  /** Wird zwischen Produktionskarte und „Über dich“ angezeigt (Rollenwünsche). */
  children?: React.ReactNode;
  onWhatsAppVisit?: () => Promise<{ visitedAt: string | null; alreadyVisited: boolean }>;
};

export function OnboardingSection({
  onboarding,
  onOnboardingChange,
  rolePreferences,
  whatsappVisitedAt,
  onWhatsAppVisit,
  children,
}: OnboardingSectionProps) {
  const whatsappLink = onboarding?.whatsappLink ?? null;
  const currentShow = onboarding?.show ?? null;
  const initialForm = useMemo<OnboardingFormState>(
    () => ({
      education: readStoredEducation(onboarding?.education),
      notes: onboarding?.notes ?? "",
      memberSinceYear: onboarding?.memberSinceYear ? String(onboarding.memberSinceYear) : "",
    }),
    [onboarding?.education, onboarding?.memberSinceYear, onboarding?.notes],
  );

  const [formState, setFormState] = useState<OnboardingFormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dirty = JSON.stringify(formState) !== JSON.stringify(initialForm);
  const showTitle =
    currentShow?.title && currentShow.title.trim().length ? currentShow.title.trim() : null;
  const showYear = typeof currentShow?.year === "number" ? currentShow.year : null;
  const showLabel = currentShow
    ? showTitle
      ? showYear
        ? `${showTitle} (${showYear})`
        : showTitle
      : showYear
        ? `Produktion ${showYear}`
        : "Produktion"
    : "Keine aktive Produktion";
  const showHelper = currentShow
    ? (currentShow.periodLabel ?? "Zeitraum wird noch geplant.")
    : "Sobald du einer Produktion angehörst, kannst du hier deine Wünsche dafür angeben.";
  const showStatusLabel = currentShow
    ? (ONBOARDING_STATUS_LABELS[currentShow.status] ?? currentShow.status)
    : null;
  const [whatsappSubmitting, setWhatsappSubmitting] = useState(false);
  const whatsappVisitedLabel = useMemo(() => formatDate(whatsappVisitedAt), [whatsappVisitedAt]);
  const preferenceSource = onboarding?.preferences?.length
    ? onboarding.preferences
    : rolePreferences;
  const focusCandidates = useMemo(
    () =>
      (preferenceSource ?? []).map((pref) => ({
        domain: pref.domain,
        weight: pref.weight,
      })),
    [preferenceSource],
  );
  const derivedFocus = useMemo(
    () => deriveOnboardingFocusFromPreferences(focusCandidates) ?? null,
    [focusCandidates],
  );
  const storedFocus = (onboarding?.focus as OnboardingFocus | null) ?? null;
  const effectiveFocus = derivedFocus ?? storedFocus;
  const focusForSubmission = effectiveFocus ?? "acting";

  useEffect(() => {
    setFormState(initialForm);
  }, [initialForm]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parseResult = onboardingSchema.safeParse(formState);
    if (!parseResult.success) {
      setError(parseResult.error.issues[0]?.message ?? "Ungültige Eingaben");
      return;
    }

    const educationError = validateEducation(formState.education);
    if (educationError) {
      setError(educationError);
      return;
    }

    setSubmitting(true);
    try {
      const result = await saveOnboardingAction({
        focus: focusForSubmission,
        education: toEducationPayload(formState.education),
        notes: parseResult.data.notes ?? null,
        memberSinceYear: parseResult.data.memberSinceYear
          ? Number.parseInt(parseResult.data.memberSinceYear, 10)
          : null,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      const payload = result.data.onboarding;
      const next: OnboardingProfile = {
        focus: payload.focus,
        background: payload.background,
        backgroundClass: payload.backgroundClass,
        education: payload.education,
        notes: payload.notes,
        memberSinceYear: payload.memberSinceYear,
        updatedAt: payload.updatedAt,
        dietaryPreference: onboarding?.dietaryPreference ?? null,
        dietaryPreferenceStrictness: onboarding?.dietaryPreferenceStrictness ?? null,
        whatsappLinkVisitedAt: onboarding?.whatsappLinkVisitedAt ?? null,
        preferences: onboarding?.preferences ?? rolePreferences,
        show: onboarding?.show ?? null,
        whatsappLink: onboarding?.whatsappLink ?? null,
      };
      onOnboardingChange(next);
      setFormState({
        education: readStoredEducation(payload.education),
        notes: payload.notes ?? "",
        memberSinceYear: payload.memberSinceYear ? String(payload.memberSinceYear) : "",
      });
      toast.success("Onboarding-Angaben gespeichert");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsAppClick = async () => {
    if (!whatsappLink) {
      return;
    }

    if (!onWhatsAppVisit) {
      window.open(whatsappLink, "_blank", "noopener,noreferrer");
      return;
    }

    setWhatsappSubmitting(true);
    try {
      const result = await onWhatsAppVisit();
      toast.success(result.alreadyVisited ? "WhatsApp-Link geöffnet" : "WhatsApp-Besuch vermerkt");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aktion fehlgeschlagen";
      toast.error(message);
    } finally {
      setWhatsappSubmitting(false);
    }
  };

  return (
    <>
      <Card variant="plain" size="md" className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-base font-semibold text-foreground">{showLabel}</p>
            <p className="text-xs text-muted-foreground">{showHelper}</p>
          </div>
          {currentShow && showStatusLabel ? (
            <Badge variant="muted" size="sm">
              {showStatusLabel}
            </Badge>
          ) : null}
        </div>
        {whatsappLink ? (
          <div className="flex items-center gap-3 border-t border-border/60 pt-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                whatsappVisitedAt ? "bg-success/15 text-success" : "bg-primary/15 text-primary",
              )}
              aria-hidden
            >
              {whatsappVisitedAt ? (
                <CheckCircle2Icon className="h-4 w-4" />
              ) : (
                <MessageCircleIcon className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Team-Chat</p>
              <p className="text-xs text-muted-foreground">
                {whatsappVisitedAt
                  ? `WhatsApp-Onboarding bestätigt${
                      whatsappVisitedLabel ? ` am ${whatsappVisitedLabel}` : ""
                    }.`
                  : "WhatsApp-Onboarding steht noch aus."}
              </p>
            </div>
            <AsyncButton
              size="sm"
              variant={whatsappVisitedAt ? "outline" : "primary"}
              onClick={handleWhatsAppClick}
              isLoading={whatsappSubmitting}
              loadingText="Öffne…"
            >
              WhatsApp öffnen
            </AsyncButton>
          </div>
        ) : null}
      </Card>

      {children}

      <Card variant="plain" size="md">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <SectionHeader
            title="Über dich"
            description="Hilft uns bei der Planung von Teams und Proben."
          />
          <EducationFields
            value={formState.education}
            onChange={(education) => setFormState((prev) => ({ ...prev, education }))}
          />

          <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <ProfileField label="Dabei seit" htmlFor="memberSinceYear">
              <Input
                id="memberSinceYear"
                type="number"
                inputMode="numeric"
                min="1900"
                max={String(CURRENT_YEAR)}
                value={formState.memberSinceYear}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, memberSinceYear: event.target.value }))
                }
                placeholder={String(CURRENT_YEAR)}
              />
            </ProfileField>
            <ProfileField label="Notiz ans Team" htmlFor="notes">
              <Textarea
                id="notes"
                rows={2}
                value={formState.notes}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, notes: event.target.value }))
                }
                placeholder="z. B. Termine, an denen du sicher nicht kannst"
              />
            </ProfileField>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <FormSaveBar
            dirty={dirty}
            submitting={submitting}
            onReset={() => {
              setFormState(initialForm);
              setError(null);
            }}
          />
        </form>
      </Card>
    </>
  );
}
