"use client";

import {
  ArrowRightIcon,
  CheckCircle2Icon,
  Loader2Icon,
  MessageCircleIcon,
} from "@/components/ui/action-icons";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { Card } from "@/components/ui/card";
import { FormSaveBar } from "@/components/ui/form-save-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BACKGROUND_TAGS, normalizeBackgroundLabel } from "@/data/onboarding-backgrounds";
import { useOnboardingBackgroundData } from "@/components/onboarding/use-onboarding-background-data";
import { deriveOnboardingFocusFromPreferences } from "@/lib/onboarding/role-preference-utils";
import { cn } from "@/lib/utils";
import type { OnboardingSummary } from "@/lib/onboarding/dashboard-schemas";
import { type OnboardingFocus } from "@prisma/client";
import { saveOnboardingAction, startOnboardingAction } from "../actions/onboarding";
import {
  CURRENT_YEAR,
  PROFILE_ONBOARDING_BACKGROUND_SUGGESTIONS,
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
  availableOnboardings: OnboardingSummary[];
  whatsappVisitedAt: string | null;
  /** Wird zwischen Produktionskarte und „Über dich“ angezeigt (Rollenwünsche). */
  children?: React.ReactNode;
  onWhatsAppVisit?: () => Promise<{ visitedAt: string | null; alreadyVisited: boolean }>;
};

export function OnboardingSection({
  onboarding,
  onOnboardingChange,
  rolePreferences,
  availableOnboardings,
  whatsappVisitedAt,
  onWhatsAppVisit,
  children,
}: OnboardingSectionProps) {
  const whatsappLink = onboarding?.whatsappLink ?? null;
  const currentShow = onboarding?.show ?? null;
  const initialForm = useMemo<OnboardingFormState>(
    () => ({
      background: onboarding?.background ?? "",
      backgroundClass: onboarding?.backgroundClass ?? "",
      notes: onboarding?.notes ?? "",
      memberSinceYear: onboarding?.memberSinceYear ? String(onboarding.memberSinceYear) : "",
    }),
    [
      onboarding?.background,
      onboarding?.backgroundClass,
      onboarding?.memberSinceYear,
      onboarding?.notes,
    ],
  );

  const [formState, setFormState] = useState<OnboardingFormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dirty = JSON.stringify(formState) !== JSON.stringify(initialForm);
  const [showDialogOpen, setShowDialogOpen] = useState(false);
  const [selectedShowId, setSelectedShowId] = useState<string>(() => currentShow?.id ?? "");
  const [showSubmitting, setShowSubmitting] = useState(false);
  const [showError, setShowError] = useState<string | null>(null);
  const hasOnboardingOptions = availableOnboardings.length > 0;
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
    : "Noch keine Produktion verknüpft";
  const showHelper = currentShow
    ? (currentShow.periodLabel ?? "Zeitraum wird noch geplant.")
    : "Wähle eine Produktion, um mit dem Onboarding zu starten.";
  const showStatusLabel = currentShow
    ? (ONBOARDING_STATUS_LABELS[currentShow.status] ?? currentShow.status)
    : null;
  const { backgroundSuggestions, classSuggestions, activeTag, requiresClass } =
    useOnboardingBackgroundData(formState.background, {
      initialSuggestions: PROFILE_ONBOARDING_BACKGROUND_SUGGESTIONS,
    });
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
    setSelectedShowId(currentShow?.id ?? "");
  }, [currentShow?.id]);

  useEffect(() => {
    setFormState(initialForm);
  }, [initialForm]);

  const handleShowAssign = async () => {
    if (!selectedShowId) {
      setShowError("Bitte wähle eine Produktion.");
      return;
    }

    setShowSubmitting(true);
    setShowError(null);

    try {
      const result = await startOnboardingAction(selectedShowId);
      if (!result.ok) {
        setShowError(result.error);
        toast.error(result.error);
        return;
      }

      const payload = result.data.onboarding;
      const option = availableOnboardings.find((entry) => entry.id === payload.show.id) ?? null;
      const nextShow = {
        id: payload.show.id,
        title: payload.show.title,
        year: payload.show.year,
        periodLabel: option?.periodLabel ?? payload.show.periodLabel ?? null,
        status: (option?.status ?? payload.show.status ?? "draft") as OnboardingSummary["status"],
      } satisfies NonNullable<OnboardingProfile["show"]>;

      const nextOnboarding: OnboardingProfile = onboarding
        ? {
            ...onboarding,
            focus: focusForSubmission,
            show: nextShow,
            whatsappLink: payload.whatsappLink,
            whatsappLinkVisitedAt: payload.whatsappLinkVisitedAt,
          }
        : ({
            focus: focusForSubmission,
            background: formState.background.trim() ? formState.background.trim() : null,
            backgroundClass: formState.backgroundClass.trim()
              ? formState.backgroundClass.trim()
              : null,
            notes: formState.notes.trim() ? formState.notes.trim() : null,
            memberSinceYear: formState.memberSinceYear
              ? Number.parseInt(formState.memberSinceYear, 10)
              : null,
            dietaryPreference: null,
            dietaryPreferenceStrictness: null,
            whatsappLinkVisitedAt: payload.whatsappLinkVisitedAt,
            updatedAt: null,
            preferences: rolePreferences,
            show: nextShow,
            whatsappLink: payload.whatsappLink,
          } satisfies OnboardingProfile);

      onOnboardingChange(nextOnboarding);
      toast.success(onboarding?.show ? "Produktion aktualisiert" : "Onboarding gestartet");
      setShowDialogOpen(false);
    } finally {
      setShowSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parseResult = onboardingSchema.safeParse(formState);
    if (!parseResult.success) {
      setError(parseResult.error.issues[0]?.message ?? "Ungültige Eingaben");
      return;
    }

    if (requiresClass && !parseResult.data.backgroundClass) {
      const helper = activeTag?.classRequiredError ?? "Bitte gib deine Klasse an.";
      setError(helper);
      return;
    }

    setSubmitting(true);
    try {
      const result = await saveOnboardingAction({
        focus: focusForSubmission,
        background: parseResult.data.background,
        backgroundClass: parseResult.data.backgroundClass ?? null,
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
        background: payload.background ?? "",
        backgroundClass: payload.backgroundClass ?? "",
        notes: payload.notes ?? "",
        memberSinceYear: payload.memberSinceYear ? String(payload.memberSinceYear) : "",
      });
      toast.success("Onboarding-Angaben gespeichert");
    } finally {
      setSubmitting(false);
    }
  };

  const backgroundOptions = [
    ...BACKGROUND_TAGS.map((tag) => ({
      key: `tag-${tag.id}`,
      label: tag.label,
      active: activeTag?.id === tag.id,
      onSelect: () =>
        setFormState((prev) => ({
          ...prev,
          background: tag.value,
          backgroundClass: tag.requiresClass ? prev.backgroundClass : "",
        })),
    })),
    ...backgroundSuggestions
      .filter(
        (suggestion) =>
          !BACKGROUND_TAGS.some(
            (tag) => normalizeBackgroundLabel(tag.value) === normalizeBackgroundLabel(suggestion),
          ),
      )
      .slice(0, 4)
      .map((suggestion) => ({
        key: `suggestion-${suggestion}`,
        label: suggestion,
        active: false,
        onSelect: () => setFormState((prev) => ({ ...prev, background: suggestion })),
      })),
  ];

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
        {hasOnboardingOptions ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShowDialogOpen(true);
              setShowError(null);
            }}
          >
            {currentShow ? "Produktion wechseln" : "Onboarding starten"}
          </Button>
        ) : currentShow ? null : (
          <p className="text-xs text-muted-foreground">
            Aktuell sind keine Produktionen verfügbar.
          </p>
        )}

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
          <ProfileField
            label="Schule, Ausbildung oder Beruf"
            htmlFor="background"
            hint={
              <span className="flex flex-wrap gap-1.5 pt-1">
                {backgroundOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition",
                      option.active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                    )}
                    onClick={option.onSelect}
                  >
                    {option.label}
                  </button>
                ))}
              </span>
            }
          >
            <Input
              id="background"
              value={formState.background}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, background: event.target.value }))
              }
              placeholder="z. B. BSZ Altroßthal – Berufsschule"
            />
          </ProfileField>

          {requiresClass ? (
            <ProfileField
              label={activeTag?.classLabel ?? "Klasse"}
              htmlFor="backgroundClass"
              hint={
                classSuggestions.length ? (
                  <span className="flex flex-wrap gap-1.5 pt-1">
                    {classSuggestions.slice(0, 8).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                        onClick={() =>
                          setFormState((prev) => ({ ...prev, backgroundClass: suggestion }))
                        }
                      >
                        {suggestion}
                      </button>
                    ))}
                  </span>
                ) : (
                  (activeTag?.classHelper ?? "Hilft uns bei der Zuordnung.")
                )
              }
            >
              <Input
                id="backgroundClass"
                value={formState.backgroundClass}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, backgroundClass: event.target.value }))
                }
                placeholder={activeTag?.classPlaceholder ?? "z. B. BG 12"}
              />
            </ProfileField>
          ) : null}

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

      <Dialog
        open={showDialogOpen}
        onOpenChange={(open) => {
          setShowDialogOpen(open);
          if (!open) {
            setShowError(null);
            setSelectedShowId(currentShow?.id ?? "");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Produktion auswählen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {hasOnboardingOptions ? (
              <div className="grid gap-2">
                {availableOnboardings.map((option) => {
                  const active = option.id === selectedShowId;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => setSelectedShowId(option.id)}
                      className={cn(
                        "w-full rounded-lg border px-4 py-3 text-left transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        active
                          ? "border-primary/60 bg-primary/10 shadow-sm"
                          : "border-border/60 bg-background hover:border-primary/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{option.title}</p>
                          {option.periodLabel ? (
                            <p className="text-xs text-muted-foreground">{option.periodLabel}</p>
                          ) : null}
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/60 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide"
                        >
                          {ONBOARDING_STATUS_LABELS[option.status] ?? option.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        {active ? (
                          <>
                            <CheckCircle2Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                            <span className="font-medium text-primary">Ausgewählt</span>
                          </>
                        ) : (
                          <>
                            <ArrowRightIcon
                              className="h-4 w-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span className="text-muted-foreground">Auswählen</span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Es sind keine Produktionen verfügbar.</p>
            )}
            {showError ? <p className="text-sm text-destructive">{showError}</p> : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDialogOpen(false)}
              disabled={showSubmitting}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={handleShowAssign}
              disabled={showSubmitting || !selectedShowId}
            >
              {showSubmitting ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Speichern…
                </>
              ) : currentShow ? (
                "Produktion wechseln"
              ) : (
                "Onboarding starten"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
