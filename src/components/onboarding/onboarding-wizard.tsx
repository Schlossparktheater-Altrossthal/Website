"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AllergyLevel, Role } from "@prisma/client";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const allergyLevelLabels: Record<AllergyLevel, string> = {
  MILD: "Leicht (Unbehagen)",
  MODERATE: "Mittel (Reaktion möglich)",
  SEVERE: "Stark (ärztliche Hilfe)",
  LETHAL: "Kritisch (Notfall)",
};

const actingOptions = [
  {
    code: "acting_scout",
    title: "Schnupperrolle",
    description: "Kleine Auftritte zum Reinschnuppern mit überschaubarer Textmenge.",
  },
  {
    code: "acting_medium",
    title: "Mittlere Rolle",
    description: "Spürbar auf der Bühne, mit Verantwortung im Ensemble und regelmäßigem Proben.",
  },
  {
    code: "acting_lead",
    title: "Große Rolle",
    description: "Haupt- oder zentrale Nebenrolle mit intensiver Vorbereitung und Bühnenpräsenz.",
  },
];

const crewOptions = [
  {
    code: "crew_stage",
    title: "Bühnenbild & Ausstattung",
    description: "Räume entwerfen, Kulissen bauen und für beeindruckende Bilder sorgen.",
  },
  {
    code: "crew_tech",
    title: "Licht & Ton",
    description: "Shows inszenieren mit Licht, Klang, Effekten und technischer Präzision.",
  },
  {
    code: "crew_costume",
    title: "Kostüm & Maske",
    description: "Looks entwickeln, Nähen, Schminken und verwandeln – kreativ bis ins Detail.",
  },
  {
    code: "crew_direction",
    title: "Regieassistenz & Orga",
    description: "Abläufe koordinieren, Proben strukturieren, Teams im Hintergrund führen.",
  },
];

const backgroundSuggestions = ["Schule", "Berufsschule", "Universität", "Ausbildung", "Beruf"];

const weightLabels: { threshold: number; label: string }[] = [
  { threshold: 0, label: "Nur mal reinschauen" },
  { threshold: 25, label: "Locker interessiert" },
  { threshold: 50, label: "Motiviert" },
  { threshold: 75, label: "Sehr engagiert" },
  { threshold: 90, label: "Herzensprojekt" },
];

const steps = [
  { title: "Willkommen" },
  { title: "Profil" },
  { title: "Fokus" },
  { title: "Interessen" },
  { title: "Fotos" },
  { title: "Essen" },
  { title: "Check" },
];

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"]);

type PreferenceEntry = {
  code: string;
  title: string;
  description: string;
  weight: number;
  enabled: boolean;
  domain: "acting" | "crew";
};

type DietaryEntry = {
  id: string;
  allergen: string;
  level: AllergyLevel;
  symptoms: string;
  treatment: string;
  note: string;
};

type InviteMeta = {
  label: string | null;
  note: string | null;
  roles: Role[];
  createdAt: string;
  createdBy: string | null;
  expiresAt: string | null;
  usageCount: number;
  remainingUses: number | null;
};

type OnboardingWizardProps = {
  sessionToken: string;
  invite: InviteMeta;
};

const initialActingPreferences: PreferenceEntry[] = actingOptions.map((option, index) => ({
  ...option,
  domain: "acting",
  enabled: index === 1,
  weight: index === 1 ? 60 : 40,
}));

const initialCrewPreferences: PreferenceEntry[] = crewOptions.map((option) => ({
  ...option,
  domain: "crew",
  enabled: false,
  weight: 50,
}));

function calculateAge(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age;
}

function createDietaryId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

export function OnboardingWizard({ sessionToken, invite }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [availableInterests, setAvailableInterests] = useState<string[]>([]);
  const [interestsLoading, setInterestsLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    background: "",
    dateOfBirth: "",
    focus: "acting" as "acting" | "tech" | "both",
    actingPreferences: initialActingPreferences,
    crewPreferences: initialCrewPreferences,
    interests: [] as string[],
    photoConsent: { consent: true, skipDocument: false },
    dietary: [] as DietaryEntry[],
  });

  const [newInterest, setNewInterest] = useState("");
  const [dietaryDraft, setDietaryDraft] = useState({
    allergen: "",
    level: "MILD" as AllergyLevel,
    symptoms: "",
    treatment: "",
    note: "",
  });

  useEffect(() => {
    let cancelled = false;
    const loadInterests = async () => {
      setInterestsLoading(true);
      try {
        const response = await fetch("/api/onboarding/interests", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!cancelled && Array.isArray(data?.interests)) {
          setAvailableInterests(data.interests.map((entry: { name: string }) => entry.name).filter(Boolean));
        }
      } catch {
        if (!cancelled) {
          setAvailableInterests([]);
        }
      } finally {
        if (!cancelled) setInterestsLoading(false);
      }
    };
    void loadInterests();
    return () => {
      cancelled = true;
    };
  }, []);

  const age = useMemo(() => calculateAge(form.dateOfBirth || null), [form.dateOfBirth]);
  const requiresDocument = age !== null && age < 18;

  const availableInterestSuggestions = useMemo(() => {
    const selected = new Set(form.interests.map((item) => item.toLowerCase()));
    return availableInterests.filter((interest) => !selected.has(interest.toLowerCase())).slice(0, 12);
  }, [availableInterests, form.interests]);

  const addInterest = useCallback(
    (interest: string) => {
      const value = interest.trim();
      if (!value) return;
      setForm((prev) => {
        if (prev.interests.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
          return prev;
        }
        return { ...prev, interests: [...prev.interests, value] };
      });
      setNewInterest("");
    },
    [setForm],
  );

  const removeInterest = useCallback((interest: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.filter((entry) => entry !== interest),
    }));
  }, []);

  const togglePreference = useCallback((domain: "acting" | "crew", code: string) => {
    setForm((prev) => {
      const key = domain === "acting" ? "actingPreferences" : "crewPreferences";
      const updated = prev[key].map((pref) =>
        pref.code === code ? { ...pref, enabled: !pref.enabled } : pref,
      );
      return { ...prev, [key]: updated };
    });
  }, []);

  const updatePreferenceWeight = useCallback((domain: "acting" | "crew", code: string, weight: number) => {
    setForm((prev) => {
      const key = domain === "acting" ? "actingPreferences" : "crewPreferences";
      const updated = prev[key].map((pref) =>
        pref.code === code ? { ...pref, weight } : pref,
      );
      return { ...prev, [key]: updated };
    });
  }, []);

  const preferenceSummary = useMemo(() => {
    const buildLabel = (entry: PreferenceEntry) => {
      const match = [...weightLabels].reverse().find((label) => entry.weight >= label.threshold);
      return match?.label ?? "Interesse";
    };
    const acting = form.actingPreferences
      .filter((pref) => pref.enabled && pref.weight > 0)
      .map((pref) => `${pref.title} – ${buildLabel(pref)}`);
    const crew = form.crewPreferences
      .filter((pref) => pref.enabled && pref.weight > 0)
      .map((pref) => `${pref.title} – ${buildLabel(pref)}`);
    return { acting, crew };
  }, [form.actingPreferences, form.crewPreferences]);

  const handleAddDietary = () => {
    if (!dietaryDraft.allergen.trim()) {
      setError("Bitte gib an, was du nicht verträgst.");
      return;
    }
    setForm((prev) => ({
      ...prev,
      dietary: [
        ...prev.dietary,
        {
          id: createDietaryId(),
          allergen: dietaryDraft.allergen.trim(),
          level: dietaryDraft.level,
          symptoms: dietaryDraft.symptoms.trim(),
          treatment: dietaryDraft.treatment.trim(),
          note: dietaryDraft.note.trim(),
        },
      ],
    }));
    setDietaryDraft({ allergen: "", level: "MILD", symptoms: "", treatment: "", note: "" });
  };

  const removeDietary = (id: string) => {
    setForm((prev) => ({
      ...prev,
      dietary: prev.dietary.filter((entry) => entry.id !== id),
    }));
  };

  const handleDocumentChange = (file: File | null) => {
    if (!file) {
      setDocumentFile(null);
      setDocumentError(null);
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setDocumentError("Dokument darf maximal 8 MB groß sein");
      setDocumentFile(null);
      return;
    }
    const type = file.type?.toLowerCase() ?? "";
    if (type && !ALLOWED_DOCUMENT_TYPES.has(type)) {
      setDocumentError("Bitte nutze PDF oder Bilddateien (JPG/PNG)");
      setDocumentFile(null);
      return;
    }
    setDocumentError(null);
    setDocumentFile(file);
  };

  const goNext = () => {
    setError(null);
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!form.name.trim()) {
        setError("Bitte gib deinen Namen ein.");
        return;
      }
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        setError("Bitte nutze eine gültige E-Mail-Adresse.");
        return;
      }
      if (!form.background.trim()) {
        setError("Wo kommst du her? Schule, Uni, Ausbildung – ein Stichwort genügt.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const wantsActing = form.focus === "acting" || form.focus === "both";
      const wantsCrew = form.focus === "tech" || form.focus === "both";
      if (wantsActing && !form.actingPreferences.some((pref) => pref.enabled && pref.weight > 0)) {
        setError("Wähle mindestens eine Option im Schauspielbereich.");
        return;
      }
      if (wantsCrew && !form.crewPreferences.some((pref) => pref.enabled && pref.weight > 0)) {
        setError("Wähle mindestens ein Gewerk aus, das dich reizt.");
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
    if (step === 4) {
      if (!form.photoConsent.consent) {
        setError("Wir benötigen deine Zustimmung zur Fotoerlaubnis, damit du beim Theater mitmachen kannst.");
        return;
      }
      if (requiresDocument && !form.photoConsent.skipDocument && !documentFile) {
        setError("Bitte lade das unterschriebene Dokument hoch oder wähle den späteren Upload.");
        return;
      }
      setStep(5);
      return;
    }
    if (step === 5) {
      setStep(6);
      return;
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 0) return;
    setStep((prev) => Math.max(0, prev - 1));
  };

  const handleSubmit = async () => {
    setError(null);
    if (loading) return;
    const preferences = [
      ...form.actingPreferences
        .filter((pref) => pref.enabled && pref.weight > 0)
        .map((pref) => ({ code: pref.code, domain: "acting" as const, weight: pref.weight })),
      ...form.crewPreferences
        .filter((pref) => pref.enabled && pref.weight > 0)
        .map((pref) => ({ code: pref.code, domain: "crew" as const, weight: pref.weight })),
    ];
    if (!preferences.length) {
      setError("Bitte markiere, wo du dich einbringen möchtest.");
      setStep(2);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        sessionToken,
        name: form.name.trim(),
        email: form.email.trim(),
        background: form.background.trim(),
        dateOfBirth: form.dateOfBirth ? form.dateOfBirth : null,
        focus: form.focus,
        preferences,
        interests: form.interests,
        photoConsent: {
          consent: form.photoConsent.consent,
          skipDocument: form.photoConsent.skipDocument,
        },
        dietary: form.dietary.map((entry) => ({
          allergen: entry.allergen,
          level: entry.level,
          symptoms: entry.symptoms,
          treatment: entry.treatment,
          note: entry.note,
        })),
      };

      const body = new FormData();
      body.append("payload", JSON.stringify(payload));
      if (documentFile) {
        body.append("document", documentFile);
      }

      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error ?? "Übermittlung fehlgeschlagen";
        setError(message);
        if (message.toLowerCase().includes("dokument")) {
          setStep(4);
        }
        return;
      }
      setSuccess(true);
      toast.success("Willkommen im Ensemble! Wir melden uns bei dir.");
    } catch (err) {
      console.error("[onboarding.wizard]", err);
      setError("Netzwerkfehler – bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  };

  const inviteCreatedAt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(invite.createdAt));
    } catch {
      return null;
    }
  }, [invite.createdAt]);

  const inviteExpiresAt = useMemo(() => {
    if (!invite.expiresAt) return null;
    try {
      return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(invite.expiresAt));
    } catch {
      return null;
    }
  }, [invite.expiresAt]);

  return (
    <div className="space-y-8">
      <Card className="border border-border/70 bg-gradient-to-br from-background to-background/70">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold">Dein Einstieg ins Theater</CardTitle>
            <p className="text-sm text-muted-foreground">
              Einladung erstellt {inviteCreatedAt ? `am ${inviteCreatedAt}` : "vor Kurzem"}
              {invite.createdBy ? ` von ${invite.createdBy}` : ""}.
              {inviteExpiresAt ? ` Gültig bis ${inviteExpiresAt}.` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Link-ID gesichert</Badge>
            {invite.remainingUses !== null ? (
              <span>{invite.remainingUses} von {invite.remainingUses + invite.usageCount} Plätzen frei</span>
            ) : (
              <span>Mehrfach nutzbar</span>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {steps.map((item, index) => {
          const isActive = index === step;
          const isComplete = index < step;
          return (
            <div key={item.title} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isComplete && !isActive && "border-primary bg-primary/20 text-primary",
                  !isActive && !isComplete && "border-border text-muted-foreground",
                )}
              >
                {index + 1}
              </div>
              <span className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>{item.title}</span>
              {index < steps.length - 1 && <div className="h-px w-10 bg-border" aria-hidden />}
            </div>
          );
        })}
      </div>

      {step === 0 && (
        <Card className="border border-border/70 bg-background/80 shadow-xl">
          <CardContent className="space-y-6 p-8 text-center">
            <h2 className="text-3xl font-semibold">Willkommen im Zukunftstheater</h2>
            <p className="text-muted-foreground">
              Schön, dass du da bist! Nimm dir 10 Minuten Zeit, such dir einen ruhigen Ort und lass uns gemeinsam herausfinden, wie du
              dich auf der Bühne oder hinter den Kulissen einbringen möchtest.
            </p>
            <Button size="lg" onClick={goNext}>
              Los geht&apos;s
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Wer bist du?</CardTitle>
            <p className="text-sm text-muted-foreground">Wir nutzen diese Angaben, um dein Profil anzulegen und dich zu erreichen.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Name</span>
                <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Vorname Nachname" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">E-Mail</span>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="du@example.com"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Geburtsdatum</span>
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                />
                <span className="text-xs text-muted-foreground">Damit wissen wir, ob wir ein Eltern-Formular benötigen.</span>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Wo bist du aktuell?</span>
                <Input
                  value={form.background}
                  onChange={(event) => setForm((prev) => ({ ...prev, background: event.target.value }))}
                  placeholder="z.B. BSZ Altroßthal – Berufsschule"
                />
                <div className="flex flex-wrap gap-2 pt-2">
                  {backgroundSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                      onClick={() => setForm((prev) => ({ ...prev, background: suggestion }))}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Wohin zieht es dich?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Wähle aus, ob du dich eher im Schauspiel, hinter den Kulissen oder in beiden Welten siehst. Danach kannst du gewichten,
              was dich am meisten reizt.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {[
                { value: "acting", label: "Schauspiel", description: "Auf der Bühne stehen, Rollen gestalten." },
                { value: "tech", label: "Gewerke", description: "Technik, Kostüm, Bühnenbild und Organisation." },
                { value: "both", label: "Beides", description: "Ich möchte mich offen halten." },
              ].map((option) => {
                const active = form.focus === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex min-w-[180px] flex-1 flex-col gap-1 rounded-lg border p-4 text-left transition",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/70 hover:text-foreground",
                    )}
                    onClick={() => setForm((prev) => ({ ...prev, focus: option.value as typeof prev.focus }))}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span className="text-xs">{option.description}</span>
                  </button>
                );
              })}
            </div>

            {(form.focus === "acting" || form.focus === "both") && (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Schauspiel</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {form.actingPreferences.map((pref) => {
                    const active = pref.enabled;
                    const weightLabel = [...weightLabels].reverse().find((label) => pref.weight >= label.threshold)?.label ?? "";
                    return (
                      <div
                        key={pref.code}
                        className={cn(
                          "flex flex-col gap-4 rounded-xl border p-4 transition",
                          active ? "border-primary bg-primary/5" : "border-border bg-background",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-medium">{pref.title}</h4>
                            <p className="text-sm text-muted-foreground">{pref.description}</p>
                          </div>
                          <Button
                            size="sm"
                            variant={active ? "default" : "outline"}
                            onClick={() => togglePreference("acting", pref.code)}
                          >
                            {active ? "Ausgewählt" : "Wählen"}
                          </Button>
                        </div>
                        {active && (
                          <div className="space-y-2">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={10}
                              value={pref.weight}
                              onChange={(event) => updatePreferenceWeight("acting", pref.code, Number(event.target.value))}
                              className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Intensität</span>
                              <span>{weightLabel}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {(form.focus === "tech" || form.focus === "both") && (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gewerke & Teams</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {form.crewPreferences.map((pref) => {
                    const active = pref.enabled;
                    const weightLabel = [...weightLabels].reverse().find((label) => pref.weight >= label.threshold)?.label ?? "";
                    return (
                      <div
                        key={pref.code}
                        className={cn(
                          "flex flex-col gap-4 rounded-xl border p-4 transition",
                          active ? "border-primary bg-primary/5" : "border-border bg-background",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-medium">{pref.title}</h4>
                            <p className="text-sm text-muted-foreground">{pref.description}</p>
                          </div>
                          <Button
                            size="sm"
                            variant={active ? "default" : "outline"}
                            onClick={() => togglePreference("crew", pref.code)}
                          >
                            {active ? "Ausgewählt" : "Wählen"}
                          </Button>
                        </div>
                        {active && (
                          <div className="space-y-2">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={10}
                              value={pref.weight}
                              onChange={(event) => updatePreferenceWeight("crew", pref.code, Number(event.target.value))}
                              className="w-full accent-primary"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Intensität</span>
                              <span>{weightLabel}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Was begeistert dich?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sammle Interessen als Schlagworte – so finden wir passende Teams, Workshops und Rollen für dich. Auch neue Ideen sind
              willkommen.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {form.interests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                >
                  {interest}
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-primary/70 transition hover:bg-primary/20"
                    onClick={() => removeInterest(interest)}
                    aria-label={`${interest} entfernen`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {!form.interests.length && <span className="text-sm text-muted-foreground">Noch keine Interessen ausgewählt.</span>}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={newInterest}
                onChange={(event) => setNewInterest(event.target.value)}
                placeholder="z.B. Impro, Tanz, Requisite, Social Media …"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addInterest(newInterest);
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => addInterest(newInterest)}>
                Hinzufügen
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Beliebte Tags</p>
              <div className="flex flex-wrap gap-2">
                {interestsLoading && <span className="text-xs text-muted-foreground">Lade Vorschläge …</span>}
                {!interestsLoading && availableInterestSuggestions.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                    onClick={() => addInterest(interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Fotoeinverständnis</CardTitle>
            <p className="text-sm text-muted-foreground">
              Wir dokumentieren Proben, Aufführungen und Werkstätten. Deine Zustimmung hilft uns bei Social Media, Presse und
              Erinnerungen.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="flex items-start gap-3 rounded-lg border border-border/70 p-4">
              <input
                type="checkbox"
                checked={form.photoConsent.consent}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, photoConsent: { ...prev.photoConsent, consent: event.target.checked } }))
                }
                className="mt-1 h-4 w-4"
              />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Ich bin einverstanden, dass Fotos/Videos von mir für das Schultheater genutzt werden.</p>
                <p className="text-xs text-muted-foreground">
                  Die Zustimmung kann jederzeit im Profil angepasst werden.
                </p>
              </div>
            </label>

            {requiresDocument && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
                <p className="font-medium">Du bist minderjährig</p>
                <p>
                  Bitte lade die unterschriebene Erlaubnis deiner Eltern hoch. Wenn das gerade nicht klappt, kannst du den Upload
                  überspringen und später im Profil nachreichen.
                </p>
                <label className="mt-3 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={form.photoConsent.skipDocument}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        photoConsent: { ...prev.photoConsent, skipDocument: event.target.checked },
                      }))
                    }
                    className="h-4 w-4"
                  />
                  <span>Upload später nachreichen</span>
                </label>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <label className="block font-medium">Eltern-Formular (PDF, JPG, PNG)</label>
              <Input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(event) => handleDocumentChange(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {documentFile ? `Ausgewählt: ${documentFile.name}` : "Optional – wenn vorhanden, gleich hier hochladen."}
              </p>
              {documentError && <p className="text-xs text-destructive">{documentError}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Essensunverträglichkeiten</CardTitle>
            <p className="text-sm text-muted-foreground">
              Damit wir Catering, Probenverpflegung und Team-Events sicher planen können. Alles optional – teile nur, was relevant ist.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4">
              {form.dietary.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border/70 bg-background/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{entry.allergen}</p>
                      <p className="text-xs text-muted-foreground">{allergyLevelLabels[entry.level]}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => removeDietary(entry.id)}>
                      Entfernen
                    </Button>
                  </div>
                  {(entry.symptoms || entry.treatment || entry.note) && (
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {entry.symptoms && <li>Symptome: {entry.symptoms}</li>}
                      {entry.treatment && <li>Behandlung: {entry.treatment}</li>}
                      {entry.note && <li>Hinweis: {entry.note}</li>}
                    </ul>
                  )}
                </div>
              ))}
              {!form.dietary.length && <p className="text-sm text-muted-foreground">Keine Unverträglichkeiten hinterlegt.</p>}
            </div>

            <div className="space-y-3 rounded-lg border border-dashed border-border/70 p-4">
              <p className="text-sm font-medium">Neue Unverträglichkeit hinzufügen</p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span>Auslöser / Gericht</span>
                  <Input
                    value={dietaryDraft.allergen}
                    onChange={(event) => setDietaryDraft((prev) => ({ ...prev, allergen: event.target.value }))}
                    placeholder="z.B. Erdnüsse, Gluten, Vegan"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Schweregrad</span>
                  <Select
                    value={dietaryDraft.level}
                    onValueChange={(value: AllergyLevel) => setDietaryDraft((prev) => ({ ...prev, level: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wähle den Schweregrad" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(AllergyLevel).map((level) => (
                        <SelectItem key={level} value={level}>
                          {allergyLevelLabels[level]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Textarea
                  value={dietaryDraft.symptoms}
                  onChange={(event) => setDietaryDraft((prev) => ({ ...prev, symptoms: event.target.value }))}
                  placeholder="Symptome (optional)"
                  className="md:col-span-1"
                />
                <Textarea
                  value={dietaryDraft.treatment}
                  onChange={(event) => setDietaryDraft((prev) => ({ ...prev, treatment: event.target.value }))}
                  placeholder="Behandlung im Notfall"
                  className="md:col-span-1"
                />
                <Textarea
                  value={dietaryDraft.note}
                  onChange={(event) => setDietaryDraft((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="Weitere Hinweise"
                  className="md:col-span-1"
                />
              </div>
              <Button type="button" variant="outline" onClick={handleAddDietary}>
                Speichern
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Zusammenfassung</CardTitle>
            <p className="text-sm text-muted-foreground">
              Schau alles noch einmal durch. Nach dem Absenden legen wir dein Profil an und melden uns mit den nächsten Schritten.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section className="rounded-lg border border-border/70 p-4">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Profil</h3>
              <dl className="mt-3 grid gap-2 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="col-span-2">{form.name || "–"}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">E-Mail</dt>
                  <dd className="col-span-2">{form.email || "–"}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">Geburtsdatum</dt>
                  <dd className="col-span-2">{form.dateOfBirth || "–"}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">Kontext</dt>
                  <dd className="col-span-2">{form.background || "–"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-border/70 p-4">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Fokus</h3>
              <p className="text-sm font-medium">
                {form.focus === "acting"
                  ? "Schauspiel"
                  : form.focus === "tech"
                  ? "Gewerke & Teams"
                  : "Schauspiel und Gewerke"}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {preferenceSummary.acting.map((item) => (
                  <li key={`acting-${item}`}>🎭 {item}</li>
                ))}
                {preferenceSummary.crew.map((item) => (
                  <li key={`crew-${item}`}>🔧 {item}</li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-border/70 p-4">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Interessen</h3>
              <div className="flex flex-wrap gap-2">
                {form.interests.length ? (
                  form.interests.map((interest) => (
                    <Badge key={interest} variant="outline">
                      {interest}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Keine Angaben</span>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-border/70 p-4">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Fotoerlaubnis</h3>
              <p className="text-sm">
                {form.photoConsent.consent
                  ? "Einverständnis erteilt"
                  : "Noch keine Zustimmung erteilt"}
                {requiresDocument && !form.photoConsent.skipDocument
                  ? documentFile
                    ? " – Dokument wird mitgeschickt"
                    : " – Dokument fehlt noch"
                  : ""}
              </p>
            </section>

            <section className="rounded-lg border border-border/70 p-4">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Essensunverträglichkeiten</h3>
              {form.dietary.length ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {form.dietary.map((entry) => (
                    <li key={entry.id}>
                      <span className="font-medium">{entry.allergen}</span> – {allergyLevelLabels[entry.level]}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Keine Angaben</p>
              )}
            </section>

            {success ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                <p className="font-medium">Danke, deine Angaben sind angekommen!</p>
                <p>
                  Wir legen jetzt dein Profil an und melden uns mit den nächsten Schritten. Du kannst dich demnächst mit deiner
                  E-Mail auf der Mitgliederseite anmelden.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/login">
                    <Button>Zum Mitglieder-Login</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? "Wird übertragen …" : "Angaben absenden"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step > 0 && step < 6 && (
        <div className="flex justify-between gap-3">
          <Button variant="outline" onClick={goBack} disabled={loading}>
            Zurück
          </Button>
          <Button onClick={goNext} disabled={loading}>
            Weiter
          </Button>
        </div>
      )}

      {error && step !== 6 && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
